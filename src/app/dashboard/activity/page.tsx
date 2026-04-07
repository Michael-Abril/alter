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
import db from '@/lib/db';

export default async function ActivityPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch real actions from DB
  let user = await db.user.findUnique({ where: { clerkId: userId } });

  // Dev convenience: auto-link to test user if no user found
  if (!user) {
    const testUser = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
    if (testUser) {
      user = await db.user.update({
        where: { id: testUser.id },
        data: { clerkId: userId },
      });
    }
  }

  let actions: Action[] = [];

  if (user) {
    const dbActions = await db.action.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    actions = dbActions.map((a) => ({
      id: a.id,
      userId: a.userId,
      type: a.type as Action['type'],
      title: a.title,
      description: a.description || '',
      app: a.app,
      confidence: a.confidence,
      status: a.status as Action['status'],
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  // Fallback to mock data only when no real actions exist
  if (actions.length === 0) {
    actions = [
      {
        id: 'mock_act_1',
        userId: 'mock',
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
        id: 'mock_act_2',
        userId: 'mock',
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
  }

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
              {actions.map((action) => (
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
                    {action.metadata && (() => {
                      try {
                        const meta = typeof action.metadata === 'string' ? JSON.parse(action.metadata) : action.metadata;
                        if (meta.filePath || meta.outputPath) {
                          const filePath = meta.filePath || meta.outputPath;
                          return (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(filePath);
                                  alert('File path copied to clipboard!');
                                }}
                                className="text-xs px-2 py-1 rounded bg-nightshift-accent/10 text-nightshift-accent hover:bg-nightshift-accent/20 transition-colors"
                              >
                                📁 Copy File Path
                              </button>
                              <span className="text-xs text-nightshift-text-muted truncate max-w-md">
                                {filePath}
                              </span>
                            </div>
                          );
                        }
                      } catch (e) {
                        return null;
                      }
                      return null;
                    })()}
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
