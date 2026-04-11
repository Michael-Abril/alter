/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: User settings — autonomy level, wake time, Gmail connection, boundary rules
 * DEPENDENCIES: @clerk/nextjs, components/layout/*
 * STATUS: Scaffold — needs real data integration
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';

interface Boundary {
  id: string;
  rule: string;
  category: string;
  action: string;
  conditions?: unknown;
}

type RuleCategory = 'email' | 'docs' | 'code' | 'general';
type RuleAction = 'auto' | 'draft' | 'flag' | 'never';

const autonomyLabels = [
  { level: 0, name: 'Observe only', description: 'Alter watches and learns, but takes no action.' },
  { level: 1, name: 'Draft mode', description: 'Creates drafts for everything. You approve before anything is sent.' },
  { level: 2, name: 'Smart auto', description: 'Auto-executes high-confidence actions. Drafts everything else.' },
  { level: 3, name: 'Full autonomy', description: 'Alter handles most tasks automatically. Flags only low-confidence items.' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState(1);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [outputDirectory, setOutputDirectory] = useState('');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [boundaries, setBoundaries] = useState<Boundary[]>([]);
  const [newRuleCategory, setNewRuleCategory] = useState<RuleCategory>('general');
  const [newRuleAction, setNewRuleAction] = useState<RuleAction>('flag');
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [disconnecting, setDisconnecting] = useState<'gmail' | 'github' | 'canvas' | null>(null);
  const [canvasRefreshing, setCanvasRefreshing] = useState(false);
  const [needsScopeUpgrade, setNeedsScopeUpgrade] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetch('/api/user/scope-check')
      .then(async (r) => {
        const j = await r.json();
        if (isUserNotFoundResponse(r, j)) {
          router.replace('/onboarding');
          return;
        }
        if (j.data?.needsUpgrade) setNeedsScopeUpgrade(true);
      })
      .catch(() => {});
  }, [router]);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/user/settings');
      const json = await res.json();
      if (isUserNotFoundResponse(res, json)) {
        router.replace('/onboarding');
        return;
      }
      if (json.success && json.data) {
        setAutonomyLevel(json.data.autonomyLevel ?? 1);
        setWakeTime(json.data.wakeTime ?? '07:00');
        setOutputDirectory(json.data.outputDirectory || '');
        setGmailConnected(Boolean(json.data.gmailConnected));
        setGithubConnected(Boolean(json.data.githubConnected));
        setCanvasConnected(Boolean(json.data.canvasConnected));
        setBoundaries(Array.isArray(json.data.boundaries) ? json.data.boundaries : []);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCanvas() {
    if (!canvasConnected) return;
    setCanvasRefreshing(true);
    try {
      const res = await fetch('/api/canvas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysAhead: 21, daysBack: 14 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Canvas refresh failed', j);
      }
    } finally {
      setCanvasRefreshing(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError('');
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autonomyLevel,
          wakeTime,
          outputDirectory,
          boundaries,
        }),
      });
      const json = await res.json();
      if (isUserNotFoundResponse(res, json)) {
        router.replace('/onboarding');
        return;
      }
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save settings');
      }

      // Roundtrip validation: refetch to confirm persistence
      const verify = await fetch('/api/user/settings');
      const vJson = await verify.json();
      if (isUserNotFoundResponse(verify, vJson)) {
        router.replace('/onboarding');
        return;
      }
      if (vJson.success) {
        const d = vJson.data;
        const mismatches: string[] = [];
        if (d.autonomyLevel !== autonomyLevel) mismatches.push('autonomy level');
        if (d.wakeTime !== wakeTime) mismatches.push('wake time');
        if ((d.outputDirectory || '') !== outputDirectory) mismatches.push('output directory');
        if (mismatches.length > 0) {
          setError(`Settings saved but ${mismatches.join(', ')} did not persist. Try saving again.`);
          return;
        }
        setAutonomyLevel(d.autonomyLevel);
        setWakeTime(d.wakeTime);
        setOutputDirectory(d.outputDirectory || '');
        setBoundaries(d.boundaries || []);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    const trimmedRule = newRuleDescription.trim();
    if (!trimmedRule) {
      setError('Rule description is required');
      return;
    }

    setError('');
    setBoundaries((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        rule: trimmedRule,
        category: newRuleCategory,
        action: newRuleAction,
      },
    ]);
    setNewRuleDescription('');
  }

  async function disconnectAccount(provider: 'gmail' | 'github' | 'canvas') {
    setDisconnecting(provider);
    setError('');
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/${provider}/connect`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Failed to disconnect ${provider}`);
      }

      if (provider === 'gmail') setGmailConnected(false);
      if (provider === 'github') setGithubConnected(false);
      if (provider === 'canvas') setCanvasConnected(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || `Failed to disconnect ${provider}`);
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-bold text-nightshift-text-primary">Settings</h1>
              {saveSuccess && (
                <div className="flex items-center gap-2 text-nightshift-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Settings saved</span>
                </div>
              )}
            </div>

            {error && (
              <div className="card border-nightshift-error/50">
                <p className="text-sm text-nightshift-error">{error}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-nightshift-accent" />
              </div>
            )}

            {!loading && (
              <>
            {/* Connected Accounts */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>

              {needsScopeUpgrade && (
                <div className="mb-4 rounded-lg border border-nightshift-warning/50 bg-nightshift-warning/10 p-3">
                  <p className="text-sm text-nightshift-warning font-medium">Permissions upgrade available</p>
                  <p className="text-xs text-nightshift-text-secondary mt-1">
                    Alter now supports Google Drive and Calendar. Reconnect Google to enable these features.
                  </p>
                  <button
                    className="btn-primary text-xs mt-2"
                    onClick={() => { window.location.href = '/api/gmail/connect'; }}
                  >
                    Upgrade Permissions
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${gmailConnected ? 'bg-nightshift-success' : 'bg-nightshift-text-muted'}`} />
                  <span className="text-nightshift-text-primary">Google (Gmail, Drive, Calendar)</span>
                  <span className="text-sm text-nightshift-text-secondary">{gmailConnected ? 'Connected' : 'Not connected'}</span>
                  {gmailConnected ? (
                    <button
                      className="btn-ghost text-sm ml-auto"
                      onClick={() => disconnectAccount('gmail')}
                      disabled={disconnecting === 'gmail'}
                    >
                      {disconnecting === 'gmail' ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button className="btn-primary ml-auto" onClick={() => { window.location.href = '/api/gmail/connect'; }}>
                      Connect
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${githubConnected ? 'bg-nightshift-success' : 'bg-nightshift-text-muted'}`} />
                  <span className="text-nightshift-text-primary">GitHub</span>
                  <span className="text-sm text-nightshift-text-secondary">{githubConnected ? 'Connected' : 'Not connected'}</span>
                  {githubConnected ? (
                    <button
                      className="btn-ghost text-sm ml-auto"
                      onClick={() => disconnectAccount('github')}
                      disabled={disconnecting === 'github'}
                    >
                      {disconnecting === 'github' ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button className="btn-primary ml-auto" onClick={() => { window.location.href = '/api/github/connect'; }}>
                      Connect
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${canvasConnected ? 'bg-nightshift-success' : 'bg-nightshift-text-muted'}`} />
                  <span className="text-nightshift-text-primary">Canvas</span>
                  <span className="text-sm text-nightshift-text-secondary">{canvasConnected ? 'Connected' : 'Not connected'}</span>
                  {canvasConnected ? (
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => void refreshCanvas()}
                        disabled={canvasRefreshing}
                      >
                        {canvasRefreshing ? 'Refreshing…' : 'Refresh Canvas'}
                      </button>
                      <button
                        className="btn-ghost text-sm"
                        onClick={() => disconnectAccount('canvas')}
                        disabled={disconnecting === 'canvas'}
                      >
                        {disconnecting === 'canvas' ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button className="btn-primary ml-auto" onClick={() => { window.location.href = '/onboarding?step=canvas'; }}>
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Autonomy Level */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-4">Autonomy Level</h2>
              <div className="space-y-3">
                {autonomyLabels.map((level) => (
                  <button
                    key={level.level}
                    onClick={() => setAutonomyLevel(level.level)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      autonomyLevel === level.level
                        ? 'border-nightshift-accent bg-nightshift-accent/10'
                        : 'border-nightshift-border hover:border-nightshift-text-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          autonomyLevel === level.level
                            ? 'border-nightshift-accent'
                            : 'border-nightshift-text-muted'
                        }`}
                      >
                        {autonomyLevel === level.level && (
                          <div className="h-2 w-2 rounded-full bg-nightshift-accent" />
                        )}
                      </div>
                      <span className="font-medium">{level.name}</span>
                      <span className="ml-auto text-xs text-nightshift-text-muted">
                        Level {level.level}
                      </span>
                    </div>
                    <p className="mt-1 ml-6 text-sm text-nightshift-text-secondary">
                      {level.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Wake Time */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-2">Wake Time</h2>
              <p className="text-sm text-nightshift-text-secondary mb-4">
                Alter will have your morning brief ready by this time.
              </p>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="input"
              />
            </section>

            {/* Output Directory */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-2">Output Directory</h2>
              <p className="text-sm text-nightshift-text-secondary mb-4">
                Alter saves generated .docx files in this folder.
              </p>
              <input
                type="text"
                value={outputDirectory}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder="Documents/Alter"
                className="input"
              />
            </section>

            {/* Boundaries */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-4">Boundary Rules</h2>
              <p className="text-sm text-nightshift-text-secondary mb-4">
                Set rules for what Alter can and cannot do.
              </p>
              <div className="space-y-3">
                {boundaries.map((boundary) => (
                  <div
                    key={boundary.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-nightshift-bg-light"
                  >
                    <span className="text-sm">{boundary.rule}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        boundary.action === 'auto'
                          ? 'bg-nightshift-success/20 text-nightshift-success'
                          : boundary.action === 'draft'
                          ? 'bg-nightshift-warning/20 text-nightshift-warning'
                          : boundary.action === 'never'
                          ? 'bg-nightshift-error/20 text-nightshift-error'
                          : 'bg-nightshift-navy/20 text-nightshift-text-secondary'
                      }`}
                    >
                      {boundary.action}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3">
                <select
                  className="input"
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value as RuleCategory)}
                >
                  <option value="email">email</option>
                  <option value="docs">docs</option>
                  <option value="code">code</option>
                  <option value="general">general</option>
                </select>
                <select
                  className="input"
                  value={newRuleAction}
                  onChange={(e) => setNewRuleAction(e.target.value as RuleAction)}
                >
                  <option value="auto">auto</option>
                  <option value="draft">draft</option>
                  <option value="flag">flag</option>
                  <option value="never">never</option>
                </select>
                <input
                  type="text"
                  className="input"
                  value={newRuleDescription}
                  onChange={(e) => setNewRuleDescription(e.target.value)}
                  placeholder="Rule description"
                />
                <button className="btn-ghost text-sm" onClick={addRule}>+ Add Rule</button>
              </div>
            </section>

            {/* Save */}
            <div className="flex justify-end">
              <button
                className="btn-primary flex items-center gap-2"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
