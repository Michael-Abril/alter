/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Tonight's Handoff view — user selects real detected projects to hand off to NightShift
 * DEPENDENCIES: @clerk/nextjs, components/handoff/*
 * STATUS: LIVE — fetches real projects from /api/projects
 */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import UnfinishedWork from '@/components/handoff/UnfinishedWork';
import HandoffButton from '@/components/handoff/HandoffButton';
import type { HandoffTask } from '@/types';

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
  const [tasks, setTasks] = useState<HandoffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        const json = await res.json();
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
  }, []);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, selected: !t.selected } : t))
    );
  };

  const selectedTasks = tasks.filter((t) => t.selected);

  const handleActivate = async () => {
    console.log('Activating NightShift with tasks:', selectedTasks);
    console.log('Special instructions:', specialInstructions);
    setIsActivated(true);
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
              <div className="card border-nightshift-success/50 text-center">
                <div className="text-4xl mb-4">🌙</div>
                <h2 className="text-xl font-semibold text-nightshift-success">
                  NightShift Activated
                </h2>
                <p className="mt-2 text-nightshift-text-secondary">
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} queued. NightShift will start working when
                  you go to sleep. Sweet dreams!
                </p>
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

                <HandoffButton
                  selectedCount={selectedTasks.length}
                  onActivate={handleActivate}
                />
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
