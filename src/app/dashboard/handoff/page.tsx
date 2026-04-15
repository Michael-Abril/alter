/**
 * Handoff — select deliverable projects for Alter to continue. Minimal UI (no duplicate Morning Brief blocks).
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import UnfinishedWork from '@/components/handoff/UnfinishedWork';
import HandoffButton from '@/components/handoff/HandoffButton';
import type { HandoffTask } from '@/types';
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';
import { CheckCircle2, ClipboardList, Loader2, XCircle } from 'lucide-react';
import type { ScoredTask, SuggestedAutomation } from '@/lib/unified-priority';

interface ProjectFromAPI {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  lastActive: string;
  context: {
    nextStep?: string;
    keyTopics?: string[];
    sessionId?: string;
    messageCount?: number;
  } | null;
}

const MAX_HANDOFF_RECOMMENDED = 3;

export default function HandoffPage() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const router = useRouter();
  const [tasks, setTasks] = useState<HandoffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isActivated, setIsActivated] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [activateResult, setActivateResult] = useState<{ projectsQueued?: number } | null>(null);
  const [focusTitles, setFocusTitles] = useState<string[]>([]);
  const [suggestedAutomations, setSuggestedAutomations] = useState<SuggestedAutomation[]>([]);
  const [runStatus, setRunStatus] = useState<{
    state?: string;
    projectsContinued?: number;
    canvasPrepDrafts?: number;
    emailsDrafted?: number;
    duration?: number;
    currentProject?: string;
    currentAction?: string;
    projectsCompleted?: number;
    projectsTotal?: number;
    currentIteration?: number;
    maxIterations?: number;
    tokensUsedSoFar?: number;
    spentSoFar?: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollRunStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/handoff/status');
      const json = await res.json();
      if (isUserNotFoundResponse(res, json)) {
        router.replace('/onboarding');
        return;
      }
      const s = json.data;
      setRunStatus(s);
      if (s?.state === 'completed' || s?.state === 'error') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch {
      /* ignore */
    }
  }, [router]);

  useEffect(() => {
    if (isActivated && !pollRef.current) {
      pollRunStatus();
      pollRef.current = setInterval(pollRunStatus, 2000);  // Poll every 2 seconds for live progress
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isActivated, pollRunStatus]);

  useEffect(() => {
    async function loadPriority() {
      try {
        const res = await fetch('/api/priority');
        const json = await res.json();
        if (isUserNotFoundResponse(res, json)) {
          router.replace('/onboarding');
          return;
        }

        const data = json.data;
        const projects: ProjectFromAPI[] = data?.projects || [];
        const focusItems: ScoredTask[] = data?.focusItems || [];
        const handoffItems: ScoredTask[] = data?.handoffItems || [];
        const automations: SuggestedAutomation[] = data?.suggestedAutomations || [];
        setFocusTitles(focusItems.slice(0, 3).map((item) => item.title));
        setSuggestedAutomations(automations.slice(0, 1));

        const projectTaskMap = new Map(
          projects.map((p) => [
            p.id,
            (p.context?.nextStep || p.description || `${p.progress}% in progress — continue the latest milestone.`)
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 100),
          ])
        );

        const handoffForUi = handoffItems.filter(
          (item) => item.source === 'project' || item.source === 'canvas'
        );

        const handoffTasks: HandoffTask[] = handoffForUi.map((item, i) => {
          const tier: 'recommended' | 'other' = i < MAX_HANDOFF_RECOMMENDED ? 'recommended' : 'other';
          if (item.source === 'canvas') {
            const desc = (item.description || item.suggestedAction || 'Canvas assignment — prep and drafts overnight.')
              .replace(/\s+/g, ' ')
              .trim();
            return {
              id: item.id,
              title: item.title,
              description: desc.length > 100 ? `${desc.slice(0, 97)}…` : desc,
              app: 'canvas',
              estimatedConfidence: Math.min(0.95, Math.max(0.45, item.score / 100)),
              selected: i < MAX_HANDOFF_RECOMMENDED,
              tier,
              handoffKind: 'canvas' as const,
            };
          }
          const projectId = item.id.replace(/^project-/, '');
          const desc =
            projectTaskMap.get(projectId) || item.description || 'Continue the next project milestone.';
          const short = desc.replace(/\s+/g, ' ').trim();
          return {
            id: projectId,
            projectId,
            title: item.title,
            description: short.length > 100 ? `${short.slice(0, 97)}…` : short,
            app: 'claude',
            estimatedConfidence: Math.min(0.95, Math.max(0.45, item.score / 100)),
            selected: i < MAX_HANDOFF_RECOMMENDED,
            tier,
            handoffKind: 'project' as const,
          };
        });

        setTasks(handoffTasks);
      } catch (err) {
        console.error('Failed to load priority:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPriority();
  }, [router]);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, selected: !t.selected } : t))
    );
  };

  const selectedTasks = tasks.filter((t) => t.selected);

  const handleActivate = async () => {
    setActivating(true);
    setActivateError('');
    try {
      const projectIds = selectedTasks
        .filter((t) => t.handoffKind === 'project' && t.projectId)
        .map((t) => t.projectId as string);
      const canvasLines = selectedTasks
        .filter((t) => t.handoffKind === 'canvas')
        .map((t) => `- ${t.id} | ${t.title}`);
      let instructions = specialInstructions?.trim() || '';
      if (canvasLines.length > 0) {
        const block = `Canvas assignments to support (outlines, drafts, prep):\n${canvasLines.join('\n')}`;
        instructions = instructions ? `${instructions}\n\n${block}` : block;
      }

      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds,
          instructions: instructions || undefined,
        }),
      });
      const json = await res.json();
      if (isUserNotFoundResponse(res, json)) {
        router.replace('/onboarding');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to activate');
      setActivateResult(json.data);
      setIsActivated(true);
    } catch (err: unknown) {
      setActivateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(124,58,237,0.08),transparent_50%)] px-5 py-8 sm:px-8 md:px-12">
          <div className="mx-auto w-full max-w-[800px] space-y-8">
            {isActivated ? (
              <div
                className={`card text-center ${
                  runStatus?.state === 'error'
                    ? 'border-nightshift-error/50'
                    : 'border-nightshift-success/50'
                }`}
              >
                <div className="mb-4 flex justify-center">
                  {runStatus?.state === 'completed' ? (
                    <CheckCircle2
                      className="h-14 w-14 text-nightshift-success"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  ) : runStatus?.state === 'error' ? (
                    <XCircle className="h-14 w-14 text-nightshift-error" strokeWidth={1.25} aria-hidden />
                  ) : (
                    <Loader2
                      className="h-14 w-14 animate-spin text-nightshift-highlight"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  )}
                </div>
                <h2
                  className={`text-xl font-semibold ${
                    runStatus?.state === 'error' ? 'text-nightshift-error' : 'text-nightshift-success'
                  }`}
                >
                  {runStatus?.state === 'completed'
                    ? 'Run complete'
                    : runStatus?.state === 'error'
                      ? 'Run encountered an error'
                      : 'Alter running…'}
                </h2>
                {runStatus?.state === 'running' && (
                  <div className="mt-3 space-y-2">
                    {runStatus.currentProject ? (
                      <>
                        <p className="text-nightshift-text-primary font-medium animate-pulse">
                          Working on: {runStatus.currentProject}
                        </p>
                        <p className="text-sm text-nightshift-text-secondary">
                          {runStatus.currentAction || 'Processing...'}
                        </p>
                        <div className="flex items-center justify-center gap-4 text-xs text-nightshift-text-muted">
                          <span>Progress: {runStatus.projectsCompleted || 0} / {runStatus.projectsTotal || '?'} projects</span>
                          {(runStatus.currentIteration ?? 0) > 0 && (
                            <span>Iteration: {runStatus.currentIteration} / {runStatus.maxIterations || 3}</span>
                          )}
                        </div>
                        {(runStatus.tokensUsedSoFar ?? 0) > 0 && (
                          <p className="text-xs text-nightshift-text-muted">
                            Tokens: {(runStatus.tokensUsedSoFar ?? 0).toLocaleString()} | Cost: ${(runStatus.spentSoFar || 0).toFixed(4)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-nightshift-text-secondary animate-pulse">
                        Starting Alter...
                      </p>
                    )}
                  </div>
                )}
                {runStatus?.state === 'completed' && (
                  <div className="mt-4 space-y-4 text-sm text-nightshift-text-secondary">
                    <div className="space-y-1">
                      <p>
                        {runStatus.projectsContinued || 0} code project(s) continued
                        {typeof runStatus.canvasPrepDrafts === 'number' && runStatus.canvasPrepDrafts > 0
                          ? `, ${runStatus.canvasPrepDrafts} Canvas prep draft(s) in Draft review`
                          : ''}
                        , {runStatus.emailsDrafted || 0} email draft(s) created
                      </p>
                      <p className="text-xs text-nightshift-text-muted">
                        Canvas selections produce prep/outlines in Draft review (not counted as “projects continued”).
                      </p>
                      {runStatus.duration && <p>Duration: {runStatus.duration}s</p>}
                    </div>
                    <p className="font-medium text-nightshift-text-primary">Where to find your output</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <Link
                        href="/dashboard/drafts"
                        className="btn-primary inline-flex items-center justify-center gap-2 py-3 text-center text-base font-semibold"
                      >
                        Draft Review <span aria-hidden>→</span>
                      </Link>
                      <Link
                        href="/dashboard/activity"
                        className="btn-ghost inline-flex items-center justify-center gap-2 border border-nightshift-border py-3 text-center text-base font-semibold text-nightshift-text-primary hover:border-nightshift-accent/40"
                      >
                        Activity Log
                      </Link>
                    </div>
                  </div>
                )}
                {runStatus?.state === 'error' && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Link
                      href="/dashboard/activity"
                      className="btn-primary inline-flex items-center justify-center py-3 text-center text-base font-semibold"
                    >
                      Open Activity Log
                    </Link>
                    <Link
                      href="/dashboard/drafts"
                      className="btn-ghost inline-flex items-center justify-center border border-nightshift-border py-3 text-center text-base font-semibold text-nightshift-text-primary"
                    >
                      Draft Review
                    </Link>
                  </div>
                )}
                {runStatus?.state !== 'running' &&
                  runStatus?.state !== 'completed' &&
                  runStatus?.state !== 'error' && (
                    <p className="mt-2 text-nightshift-text-secondary">
                      Run queued — check Activity and Draft review when Alter finishes.
                    </p>
                  )}
              </div>
            ) : loading ? (
              <div className="card py-12 text-center">
                <div className="mb-3 flex justify-center">
                  <Loader2 className="h-9 w-9 animate-spin text-nightshift-accent" aria-hidden />
                </div>
                <p className="text-nightshift-text-secondary">Loading…</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="card py-12 text-center">
                <div className="mb-3 flex justify-center">
                  <ClipboardList className="h-9 w-9 text-nightshift-highlight" strokeWidth={1.5} aria-hidden />
                </div>
                <p className="text-nightshift-text-secondary">
                  No handoff items yet. Connect Canvas in Settings, ensure projects are in progress with code/document
                  classifications, or check back when you have email or assignment load.
                </p>
              </div>
            ) : (
              <>
                <h1 className="font-display text-xl font-bold text-nightshift-text-primary md:text-2xl">Handoff</h1>
                <p className="text-sm text-nightshift-text-secondary">Let Alter continue while you&apos;re away.</p>

                {focusTitles.length > 0 && (
                  <section className="card border-nightshift-border/80 bg-nightshift-bg-card/70">
                    <h2 className="text-sm font-semibold text-nightshift-text-primary">You focus on</h2>
                    <p className="mt-2 text-sm text-nightshift-text-secondary">
                      {focusTitles.join(', ')}
                    </p>
                  </section>
                )}

                {suggestedAutomations[0] && (
                  <section className="card border-nightshift-border/80 bg-nightshift-bg-card/70">
                    <h2 className="text-sm font-semibold text-nightshift-text-primary">
                      Alter will handle
                    </h2>
                    <p className="mt-2 text-sm text-nightshift-text-secondary">
                      {suggestedAutomations[0].headline}
                    </p>
                  </section>
                )}

                <UnfinishedWork tasks={tasks} onToggleTask={toggleTask} />

                {!demoMode && (
                <div className="card border-nightshift-border/80 bg-nightshift-bg-card/80">
                  <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">
                    Special instructions
                  </h3>
                  <textarea
                    className="input h-24 w-full resize-none"
                    placeholder="Optional context for this run"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                  />
                </div>
                )}

                {activateError && (
                  <div className="card border-nightshift-error/50 text-center">
                    <p className="text-sm text-nightshift-error">{activateError}</p>
                  </div>
                )}

                <HandoffButton
                  selectedCount={selectedTasks.length}
                  onActivate={handleActivate}
                  disabled={activating}
                />
                {activating && (
                  <p className="animate-pulse text-center text-sm text-nightshift-text-muted">Starting run…</p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
