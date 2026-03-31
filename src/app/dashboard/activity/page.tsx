/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Activity log view — shows all NightShift actions over time
 * DEPENDENCIES: @clerk/nextjs, components/layout/*
 * STATUS: Scaffold — needs real data integration
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import AppIcon from '@/components/shared/AppIcon';
import { timeAgo } from '@/lib/utils';
import type { Action } from '@/types';

// TODO: Person 3 (Royce) — Replace with real data from /api/actions or activity endpoint
const mockActions: Action[] = [
  {
    id: 'act_1',
    userId: 'user_1',
    type: 'email_sent',
    title: 'Follow-up email to Sarah Chen',
    description: 'Sent re: Q2 marketing timeline — confirmed Tuesday meeting',
    app: 'gmail',
    confidence: 0.92,
    status: 'completed',
    metadata: null,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'act_2',
    userId: 'user_1',
    type: 'doc_edited',
    title: 'Fanzley Proposal — Final Draft',
    description: 'Completed sections 3-5, added pricing table',
    app: 'gdocs',
    confidence: 0.87,
    status: 'completed',
    metadata: null,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'act_3',
    userId: 'user_1',
    type: 'flagged',
    title: 'Email from CEO — urgent tone detected',
    description: 'Draft created but held for review due to low confidence',
    app: 'gmail',
    confidence: 0.45,
    status: 'flagged',
    metadata: null,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'act_4',
    userId: 'user_1',
    type: 'email_sent',
    title: 'Weekly standup notes to team',
    description: 'Compiled and sent standup notes from this week',
    app: 'gmail',
    confidence: 0.94,
    status: 'completed',
    metadata: null,
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
  },
  {
    id: 'act_5',
    userId: 'user_1',
    type: 'task_completed',
    title: 'Updated project timeline in Notion',
    description: 'Adjusted milestones based on new deadline',
    app: 'notion',
    confidence: 0.85,
    status: 'completed',
    metadata: null,
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
  },
];

export default async function ActivityPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Activity Log</h1>
              <p className="mt-1 text-nightshift-text-secondary">
                Everything NightShift has done on your behalf.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2">
              {['All', 'Completed', 'Flagged', 'Failed'].map((filter) => (
                <button
                  key={filter}
                  className={`btn-ghost text-sm ${filter === 'All' ? 'bg-nightshift-bg-card text-nightshift-text-primary' : ''}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Activity List */}
            <div className="space-y-3">
              {mockActions.map((action) => (
                <div
                  key={action.id}
                  className="card flex items-start gap-4 hover:border-nightshift-accent/20 transition-colors"
                >
                  <div className="mt-1">
                    <AppIcon app={action.app} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-nightshift-text-primary truncate">
                        {action.title}
                      </h3>
                      {action.confidence !== null && (
                        <ConfidenceBadge score={action.confidence} />
                      )}
                    </div>
                    {action.description && (
                      <p className="mt-1 text-sm text-nightshift-text-secondary">
                        {action.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-nightshift-text-muted">
                      <span>{timeAgo(action.createdAt)}</span>
                      <span
                        className={`capitalize ${
                          action.status === 'completed'
                            ? 'text-nightshift-success'
                            : action.status === 'flagged'
                            ? 'text-nightshift-warning'
                            : 'text-nightshift-error'
                        }`}
                      >
                        {action.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
