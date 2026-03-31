/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Tonight's Handoff view — user selects tasks to hand off to NightShift
 * DEPENDENCIES: @clerk/nextjs, components/handoff/*
 * STATUS: Scaffold — needs real data integration
 */

'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import UnfinishedWork from '@/components/handoff/UnfinishedWork';
import HandoffButton from '@/components/handoff/HandoffButton';
import type { HandoffTask } from '@/types';

// TODO: Person 3 (Royce) — Replace with real data from /api/handoff
const mockTasks: HandoffTask[] = [
  {
    id: 'task_1',
    projectId: 'proj_1',
    title: 'Finish Fanzley proposal — sections 3-5',
    description: 'Proposal is 60% done. Sections 3 (Pricing), 4 (Timeline), and 5 (Terms) need completion based on the notes in the doc.',
    app: 'gdocs',
    estimatedConfidence: 0.87,
    selected: false,
  },
  {
    id: 'task_2',
    title: 'Reply to Sarah Chen — Q2 marketing timeline',
    description: 'Sarah asked about the Q2 timeline. Draft a response confirming the Tuesday meeting and sharing the updated timeline.',
    app: 'gmail',
    estimatedConfidence: 0.92,
    selected: false,
  },
  {
    id: 'task_3',
    title: 'Send follow-up to Mike about API specs',
    description: 'Mike requested the technical specification summary yesterday. Compile from the recent docs and send.',
    app: 'gmail',
    estimatedConfidence: 0.89,
    selected: false,
  },
  {
    id: 'task_4',
    title: 'Update project timeline in Notion',
    description: 'The launch date moved from March 15 to March 22. Update the Notion project board to reflect new milestones.',
    app: 'notion',
    estimatedConfidence: 0.85,
    selected: false,
  },
  {
    id: 'task_5',
    projectId: 'proj_2',
    title: 'Review and merge PR #47 — Auth refactor',
    description: 'PR has been open for 2 days. Run tests, review changes, and merge if everything looks good.',
    app: 'github',
    estimatedConfidence: 0.65,
    selected: false,
  },
];

export default function HandoffPage() {
  const [tasks, setTasks] = useState<HandoffTask[]>(mockTasks);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isActivated, setIsActivated] = useState(false);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, selected: !t.selected } : t))
    );
  };

  const selectedTasks = tasks.filter((t) => t.selected);

  const handleActivate = async () => {
    // TODO: Person 3 (Royce) — POST to /api/handoff with selected tasks
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
                Select the tasks you want NightShift to work on while you sleep.
              </p>
            </div>

            {isActivated ? (
              <div className="card border-nightshift-success/50 text-center">
                <div className="text-4xl mb-4">🌙</div>
                <h2 className="text-xl font-semibold text-nightshift-success">
                  NightShift Activated
                </h2>
                <p className="mt-2 text-nightshift-text-secondary">
                  {selectedTasks.length} tasks queued. NightShift will start working when
                  you go to sleep. Sweet dreams!
                </p>
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
                    placeholder="Any specific instructions for tonight? (e.g., 'Be extra careful with the Fanzley pricing — use the rates from last quarter')"
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
