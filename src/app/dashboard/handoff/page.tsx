/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Tonight's Handoff view — user selects real detected projects to hand off to NightShift
 * DEPENDENCIES: @clerk/nextjs, components/handoff/*
 * STATUS: LIVE — fetches real projects from /api/projects
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import UnfinishedWork from '@/components/handoff/UnfinishedWork';
import HandoffButton from '@/components/handoff/HandoffButton';
import type { HandoffTask } from '@/types';
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';

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

export default function HandoffPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<HandoffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isActivated, setIsActivated] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [activateResult, setActivateResult] = useState<any>(null);
  const [runStatus, setRunStatus] = useState<any>(null);
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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isActivated && !pollRef.current) {
      pollRunStatus();
      pollRef.current = setInterval(pollRunStatus, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isActivated, pollRunStatus, router]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        const json = await res.json();
        if (isUserNotFoundResponse(res, json)) {
          router.replace('/onboarding');
          return;
        }
        const projects: ProjectFromAPI[] = json.data?.projects || json.data || [];

        // Convert real projects into handoff tasks — only non-completed
        const handoffTasks: HandoffTask[] = projects
          .filter((p) => p.status !== 'completed')
          .map((p) => ({
            id: p.id,
            projectId: p.id,
            title: p.name,
            description: buildTaskDescription(p),
            app: 'claude',
            estimatedConfidence: Math.min(0.95, p.progress / 100 + 0.1),
            selected: false,
          }));

        setTasks(handoffTasks);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
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
      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: selectedTasks.map((t) => t.id),
          instructions: specialInstructions || undefined,
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
    } catch (err: any) {
      setActivateError(err.message || 'Something went wrong');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Tonight&apos;s Handoff</h1>
              <p className="mt-1 text-nightshift-text-secondary">
                Select the projects you want NightShift to continue while you sleep.
              </p>
            </div>

            {isActivated ? (
              <div className={`card text-center ${runStatus?.state === 'error' ? 'border-nightshift-error/50' : 'border-nightshift-success/50'}`}>
                <div className="text-4xl mb-4">{runStatus?.state === 'completed' ? '✅' : runStatus?.state === 'error' ? '❌' : '🌙'}</div>
                <h2 className={`text-xl font-semibold ${runStatus?.state === 'error' ? 'text-nightshift-error' : 'text-nightshift-success'}`}>
                  {runStatus?.state === 'completed' ? 'NightShift Complete' : runStatus?.state === 'error' ? 'NightShift Encountered an Error' : 'NightShift Running...'}
                </h2>
                {runStatus?.state === 'running' && (
                  <p className="mt-2 text-nightshift-text-secondary animate-pulse">
                    Working on {activateResult?.projectsQueued || selectedTasks.length} project{(activateResult?.projectsQueued || selectedTasks.length) !== 1 ? 's' : ''}...
                  </p>
                )}
                {runStatus?.state === 'completed' && (
                  <div className="mt-3 text-sm text-nightshift-text-secondary space-y-1">
                    <p>{runStatus.projectsContinued || 0} project(s) continued, {runStatus.emailsDrafted || 0} email draft(s) created</p>
                    {runStatus.duration && <p>Duration: {runStatus.duration}s</p>}
                    <p className="mt-2 font-medium text-nightshift-accent">Check Drafts and Activity for results.</p>
                  </div>
                )}
                {runStatus?.state !== 'running' && runStatus?.state !== 'completed' && runStatus?.state !== 'error' && (
                  <p className="mt-2 text-nightshift-text-secondary">
                    {activateResult?.projectsQueued || selectedTasks.length} project{(activateResult?.projectsQueued || selectedTasks.length) !== 1 ? 's' : ''} queued. Sweet dreams!
                  </p>
                )}
              </div>
            ) : loading ? (
              <div className="card text-center py-12">
                <div className="text-2xl mb-2">⏳</div>
                <p className="text-nightshift-text-secondary">Loading your projects...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-2xl mb-2">📋</div>
                <p className="text-nightshift-text-secondary">
                  No in-progress projects found. Run the project detector first:
                </p>
                <code className="mt-2 inline-block text-xs bg-nightshift-bg-light px-3 py-1 rounded text-nightshift-accent">
                  npx tsx scripts/detect-projects.ts
                </code>
              </div>
            ) : (
              <>
                <UnfinishedWork tasks={tasks} onToggleTask={toggleTask} />

                <div className="card">
                  <h3 className="mb-3 text-sm font-medium text-nightshift-text-secondary uppercase tracking-wider">
                    Special Instructions
                  </h3>
                  <textarea
                    className="input w-full h-24 resize-none"
                    placeholder="Any specific instructions for tonight? (e.g., 'Focus on the Peru trip — finalize the itinerary and budget')"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                  />
                </div>

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
                  <p className="text-center text-sm text-nightshift-text-muted animate-pulse">
                    Activating NightShift...
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function buildTaskDescription(p: ProjectFromAPI): string {
  const parts: string[] = [];
  parts.push(`${p.progress}% complete.`);
  if (p.description) {
    parts.push(p.description.slice(0, 120) + (p.description.length > 120 ? '...' : ''));
  }
  if (p.context?.nextStep) {
    parts.push(`Next: ${p.context.nextStep.slice(0, 120)}`);
  }
  return parts.join(' ');
}
