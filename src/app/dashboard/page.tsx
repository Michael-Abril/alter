/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Main dashboard — Morning Brief view showing real project data and chat stats
 * DEPENDENCIES: @clerk/nextjs, Prisma, components/brief/*, components/layout/*
 * STATUS: LIVE — fetches real data from DB
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BriefSummary from '@/components/brief/BriefSummary';
import CompletedActions from '@/components/brief/CompletedActions';
import FlaggedItems from '@/components/brief/FlaggedItems';
import db from '@/lib/db';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch real data directly from DB (server component — no HTTP needed)
  let user = await db.user.findUnique({ where: { clerkId: userId } });

  // Dev convenience: if no user found but a test user exists, link the Clerk session to it
  if (!user) {
    const testUser = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
    if (testUser) {
      user = await db.user.update({
        where: { id: testUser.id },
        data: { clerkId: userId },
      });
      console.log(`[dashboard] Linked Clerk user ${userId} to existing test user ${user.id}`);
    }
  }

  const projects = user
    ? await db.project.findMany({
        where: { userId: user.id },
        orderBy: { lastActive: 'desc' },
      })
    : [];

  const chatCount = user
    ? await db.chatMessage.count({ where: { userId: user.id } })
    : 0;

  const embeddedCount = user
    ? await db.chatMessage.count({ where: { userId: user.id, embedded: true } })
    : 0;

  const sessions = user
    ? await db.chatMessage.groupBy({
        by: ['sessionId'],
        where: { userId: user.id },
      })
    : [];

  const inProgress = projects.filter((p) => p.status === 'in_progress');
  const completed = projects.filter((p) => p.status === 'completed');
  const stalled = projects.filter((p) => p.status === 'stalled');

  // Build summary
  const summaryParts: string[] = [];
  if (projects.length > 0) {
    summaryParts.push(
      `I've analyzed ${chatCount} chat messages across ${sessions.length} conversations and detected ${projects.length} projects.`
    );
    if (inProgress.length > 0)
      summaryParts.push(
        `${inProgress.length} project${inProgress.length > 1 ? 's are' : ' is'} in progress.`
      );
    if (completed.length > 0)
      summaryParts.push(
        `${completed.length} project${completed.length > 1 ? 's appear' : ' appears'} completed.`
      );
    if (stalled.length > 0)
      summaryParts.push(
        `${stalled.length} project${stalled.length > 1 ? 's need' : ' needs'} attention.`
      );
  } else {
    summaryParts.push(
      'No projects detected yet. Run the project detector to analyze your chat history.'
    );
  }

  // Build completed actions from completed projects
  const completedActions = completed.map((p) => {
    const ctx = p.context ? JSON.parse(p.context) : {};
    return {
      id: p.id,
      userId: p.userId,
      type: 'task_completed' as const,
      title: p.name,
      description: p.description || ctx.nextStep || 'Project completed',
      app: 'claude',
      confidence: p.progress / 100,
      status: 'completed' as const,
      metadata: null,
      createdAt: p.updatedAt.toISOString(),
    };
  });

  // Build flagged items from stalled projects
  const flaggedItems = stalled.map((p) => {
    const ctx = p.context ? JSON.parse(p.context) : {};
    return {
      id: p.id,
      userId: p.userId,
      type: 'flagged' as const,
      title: `${p.name} — stalled`,
      description:
        ctx.nextStep || 'This project has gone quiet. Review and decide next steps.',
      app: 'claude',
      confidence: 0.4,
      status: 'flagged' as const,
      metadata: null,
      createdAt: p.lastActive.toISOString(),
    };
  });

  // Build suggested focus from in-progress projects
  const suggestedFocus = inProgress
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4)
    .map((p) => {
      const ctx = p.context ? JSON.parse(p.context) : {};
      return {
        title: p.name,
        reason: ctx.nextStep || `${p.progress}% complete — continue this work`,
        priority: (p.progress >= 70 ? 'high' : p.progress >= 40 ? 'medium' : 'low') as
          | 'high'
          | 'medium'
          | 'low',
      };
    });

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <h1 className="text-2xl font-bold">Good Morning ☀️</h1>

            <BriefSummary
              summary={summaryParts.join(' ')}
              actionsCompleted={completed.length}
              flaggedForReview={stalled.length}
            />

            {/* Real stats banner */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="card text-center">
                <div className="text-2xl font-bold text-nightshift-accent">{projects.length}</div>
                <div className="text-xs text-nightshift-text-secondary">Projects</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-nightshift-accent">{chatCount}</div>
                <div className="text-xs text-nightshift-text-secondary">Messages</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-nightshift-accent">{embeddedCount}</div>
                <div className="text-xs text-nightshift-text-secondary">Embedded</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-nightshift-accent">{sessions.length}</div>
                <div className="text-xs text-nightshift-text-secondary">Conversations</div>
              </div>
            </div>

            {/* Suggested Focus — from in-progress projects */}
            {suggestedFocus.length > 0 && (
              <div className="card">
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
                  Suggested Focus
                </h2>
                <div className="space-y-3">
                  {suggestedFocus.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg bg-nightshift-bg-light p-3"
                    >
                      <span
                        className={`mt-0.5 inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                          item.priority === 'high'
                            ? 'bg-nightshift-warning'
                            : item.priority === 'medium'
                            ? 'bg-nightshift-accent'
                            : 'bg-nightshift-text-muted'
                        }`}
                      />
                      <div>
                        <span className="text-sm font-medium text-nightshift-text-primary">
                          {item.title}
                        </span>
                        <p className="mt-0.5 text-xs text-nightshift-text-muted">
                          {item.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed & Flagged */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {completedActions.length > 0 ? (
                <CompletedActions actions={completedActions} />
              ) : (
                <div className="card">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
                    Completed Overnight
                  </h2>
                  <p className="text-sm text-nightshift-text-muted">
                    No completed projects yet. Projects will appear here once NightShift detects completed work.
                  </p>
                </div>
              )}
              {flaggedItems.length > 0 ? (
                <FlaggedItems items={flaggedItems} />
              ) : (
                <div className="card border-nightshift-success/20">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-success">
                    All Clear
                  </h2>
                  <p className="text-sm text-nightshift-text-muted">
                    No stalled projects. Everything looks good!
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
