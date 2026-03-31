/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: User settings — autonomy level, wake time, Gmail connection, boundary rules
 * DEPENDENCIES: @clerk/nextjs, components/layout/*
 * STATUS: Scaffold — needs real data integration
 */

'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

// TODO: Person 4 — Fetch real user settings from API
const mockSettings = {
  autonomyLevel: 1,
  wakeTime: '07:00',
  gmailConnected: false,
  boundaries: [
    { id: 'b1', rule: 'Never send emails to clients without review', category: 'email', action: 'draft' },
    { id: 'b2', rule: 'Auto-reply to internal team messages', category: 'email', action: 'auto' },
    { id: 'b3', rule: 'Never push code to main branch', category: 'code', action: 'never' },
  ],
};

const autonomyLabels = [
  { level: 0, name: 'Observe Only', description: 'NightShift watches and learns, but takes no action.' },
  { level: 1, name: 'Draft Mode', description: 'Creates drafts for everything. You approve before anything is sent.' },
  { level: 2, name: 'Smart Auto', description: 'Auto-executes high-confidence actions. Drafts everything else.' },
  { level: 3, name: 'Full Autonomy', description: 'NightShift handles most tasks automatically. Flags only low-confidence items.' },
];

export default function SettingsPage() {
  const [autonomyLevel, setAutonomyLevel] = useState(mockSettings.autonomyLevel);
  const [wakeTime, setWakeTime] = useState(mockSettings.wakeTime);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-8">
            <h1 className="text-2xl font-bold">Settings</h1>

            {/* Gmail Connection */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-4">Gmail Connection</h2>
              {mockSettings.gmailConnected ? (
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-nightshift-success" />
                  <span className="text-nightshift-text-primary">Connected</span>
                  <button className="btn-ghost text-sm ml-auto">Disconnect</button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => {
                    // TODO: Person 1 — Redirect to /api/gmail/connect
                    window.location.href = '/api/gmail/connect';
                  }}
                >
                  Connect Gmail
                </button>
              )}
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
                NightShift will have your Morning Brief ready by this time.
              </p>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="input"
              />
            </section>

            {/* Boundaries */}
            <section className="card">
              <h2 className="text-lg font-semibold mb-4">Boundary Rules</h2>
              <p className="text-sm text-nightshift-text-secondary mb-4">
                Set rules for what NightShift can and cannot do.
              </p>
              <div className="space-y-3">
                {mockSettings.boundaries.map((boundary) => (
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
              <button className="btn-ghost text-sm mt-4">+ Add Rule</button>
            </section>

            {/* Save */}
            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={() => {
                  // TODO: Person 1 — Save settings to API
                  console.log('Saving settings:', { autonomyLevel, wakeTime });
                }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
