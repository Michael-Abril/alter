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
import CompletedActions from '@/components/brief/CompletedActions';
import FlaggedItems from '@/components/brief/FlaggedItems';
import MorningBriefLead from '@/components/dashboard/MorningBriefLead';
import TasksTodaySection from '@/components/dashboard/TasksTodaySection';
import db from '@/lib/db';
import { getCachedDashboardUser } from '@/lib/clerk-user';
import { buildMorningBriefLead, firstNameFromUser } from '@/lib/dashboard-morning-line';
import { buildTodayTasks, type TodayTask } from '@/lib/tasks-today';

type ProjectWithContext = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  context: string | null;
  status: string;
  progress: number;
  lastActive: Date;
  updatedAt: Date;
};

function parseProjectContext(rawContext: string | null): Record<string, unknown> {
  if (!rawContext) return {};
  try {
    return JSON.parse(rawContext) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (typeof userId !== 'string' || userId.length === 0) redirect('/sign-in');

  const user = await getCachedDashboardUser(userId);
  if (!user) redirect('/onboarding');

  let projects: ProjectWithContext[] = [];
  let chatCount = 0;
  let embeddedCount = 0;
  let sessions: Array<{ sessionId: string | null }> = [];
  let upcomingEvents: unknown[] = [];
  let recentGithub: unknown[] = [];
  let pendingDrafts = 0;
  let recentActions: Awaited<ReturnType<typeof db.action.findMany>> = [];
  let todayTasks: TodayTask[] = [];
  let overnightWorkCount = 0;
  let overnightEmailDraftCount = 0;

  try {
    todayTasks = await buildTodayTasks(user.id);
  } catch {
    /* brief empty task list */
  }

  try {
    const results = await Promise.all([
      db.project.findMany({
        where: { userId: user.id },
        orderBy: { lastActive: 'desc' },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          context: true,
          status: true,
          progress: true,
          lastActive: true,
          updatedAt: true,
        },
      }),
      db.chatMessage.count({ where: { userId: user.id } }),
      db.chatMessage.count({ where: { userId: user.id, embedded: true } }),
      db.chatMessage.groupBy({
        by: ['sessionId'],
        where: { userId: user.id },
      }),
      (
        (db as { calendarEvent?: { findMany: (a: object) => Promise<unknown[]> } }).calendarEvent?.findMany({
          where: { userId: user.id, startTime: { gte: new Date() } },
          orderBy: { startTime: 'asc' },
          take: 5,
        }) ?? Promise.resolve([])
      ).catch(() => []),
      (
        (db as { githubActivity?: { findMany: (a: object) => Promise<unknown[]> } }).githubActivity?.findMany({
          where: { userId: user.id },
          orderBy: { authoredAt: 'desc' },
          take: 5,
        }) ?? Promise.resolve([])
      ).catch(() => []),
      db.draft.count({ where: { userId: user.id, status: 'pending' } }),
      db.action.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    projects = Array.isArray(results[0]) ? (results[0] as ProjectWithContext[]) : [];
    chatCount = typeof results[1] === 'number' ? results[1] : 0;
    embeddedCount = typeof results[2] === 'number' ? results[2] : 0;
    sessions = Array.isArray(results[3]) ? (results[3] as Array<{ sessionId: string | null }>) : [];
    upcomingEvents = Array.isArray(results[4]) ? results[4] : [];
    recentGithub = Array.isArray(results[5]) ? results[5] : [];
    pendingDrafts = typeof results[6] === 'number' ? results[6] : 0;
    recentActions = Array.isArray(results[7]) ? results[7] : [];
  } catch {
    /* keep defaults */
  }

  const since24h = new Date();
  since24h.setDate(since24h.getDate() - 1);
  try {
    const [w, d] = await Promise.all([
      db.action.count({
        where: { userId: user.id, type: 'work_continued', createdAt: { gte: since24h } },
      }),
      db.draft.count({
        where: { userId: user.id, type: 'email', createdAt: { gte: since24h } },
      }),
    ]);
    overnightWorkCount = w;
    overnightEmailDraftCount = d;
  } catch {
    /* leave zeros */
  }

  // First-time users with no data → show empty dashboard with onboarding CTA
  const isNewUser =
    !user.onboardingCompletedAt &&
    projects.length === 0 &&
    chatCount === 0;

  if (isNewUser) {
    return (
      <div className="flex h-screen bg-nightshift-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-lg text-center space-y-6">
              <div className="text-6xl">🌙</div>
              <div>
                <h1 className="text-3xl font-bold text-nightshift-text-primary mb-3">
                  Welcome to NightShift
                </h1>
                <p className="text-nightshift-text-secondary text-lg leading-relaxed">
                  Before NightShift can work for you, it needs to learn who you are — your voice, your projects, and how you think.
                </p>
              </div>
              <div className="card border-nightshift-accent/30 bg-nightshift-bg-card p-6 space-y-4">
                <h2 className="text-xl font-semibold text-nightshift-text-primary">
                  Start your personality upload
                </h2>
                <p className="text-sm text-nightshift-text-secondary">
                  Connect your tools and import your chat history. Takes about 2 minutes. NightShift will build your voice profile and detect your active projects.
                </p>
                <div className="flex items-center gap-4 text-sm text-nightshift-text-muted pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-nightshift-accent" />
                    Gmail
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-nightshift-accent" />
                    GitHub
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-nightshift-accent" />
                    Chat history
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-nightshift-accent" />
                    Voice profile
                  </span>
                </div>
                <a
                  href="/onboarding"
                  className="btn-primary block w-full py-3 text-center text-base font-semibold mt-2"
                >
                  Begin Setup →
                </a>
              </div>
              <p className="text-xs text-nightshift-text-muted">
                You can skip any step — connect only what you want.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const inProgress = projects.filter((p) => p?.status === 'in_progress');
  const completed = projects.filter((p) => p?.status === 'completed');
  const stalled = projects.filter((p) => p?.status === 'stalled');

  const topCanvasTask = todayTasks.find((t) => t.source === 'canvas');
  const hasDocOrAcademicInProgress = inProgress.some((p) => {
    const c = parseProjectContext(p.context);
    return c.classification === 'document_build' || c.classification === 'academic_deliverable';
  });

  const morningLead = buildMorningBriefLead({
    firstName: firstNameFromUser(user.name, user.email),
    projectsContinued: overnightWorkCount,
    emailDraftsOvernight: overnightEmailDraftCount,
    topCanvas: topCanvasTask
      ? { title: topCanvasTask.title, dueDate: topCanvasTask.dueDate }
      : null,
    hasDocOrAcademicInProgress,
  });

  // Build completed actions from completed projects
  const completedActions = completed.map((p) => {
    const ctx = parseProjectContext(p.context);
    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    return {
      id: p.id,
      userId: p.userId,
      type: 'task_completed' as const,
      title: p.name,
      description: p.description || nextStep || 'Project completed',
      app: 'claude',
      confidence: p.progress / 100,
      status: 'completed' as const,
      metadata: null,
      createdAt: p.updatedAt.toISOString(),
    };
  });

  // Build flagged items from stalled projects
  const flaggedItems = stalled.map((p) => {
    const ctx = parseProjectContext(p.context);
    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    return {
      id: p.id,
      userId: p.userId,
      type: 'flagged' as const,
      title: `${p.name} — stalled`,
      description:
        nextStep || 'This project has gone quiet. Review and decide next steps.',
      app: 'claude',
      confidence: 0.4,
      status: 'flagged' as const,
      metadata: null,
      createdAt: p.lastActive.toISOString(),
    };
  });

  // Build suggested focus from in-progress projects
  const suggestedFocus = inProgress
    .sort((a: ProjectWithContext, b: ProjectWithContext) => b.progress - a.progress)
    .slice(0, 4)
    .map((p) => {
      const ctx = parseProjectContext(p.context);
      const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
      return {
        title: p.name,
        reason: nextStep || `${p.progress}% complete — continue this work`,
        priority: (p.progress >= 70 ? 'high' : p.progress >= 40 ? 'medium' : 'low') as
          | 'high'
          | 'medium'
          | 'low',
      };
    });

  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-8">
            <MorningBriefLead lead={morningLead} />

            <TasksTodaySection tasks={todayTasks} />

            {/* At a glance */}
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

            {/* Quick Actions Bar */}
            {pendingDrafts > 0 && (
              <a href="/dashboard/drafts" className="card border-nightshift-warning/30 hover:border-nightshift-warning/60 transition-colors block">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <span className="font-medium text-nightshift-text-primary">{pendingDrafts} draft{pendingDrafts > 1 ? 's' : ''} awaiting review</span>
                    <p className="text-xs text-nightshift-text-muted">NightShift created drafts overnight — review and approve them</p>
                  </div>
                </div>
              </a>
            )}

            {/* Calendar & GitHub row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Upcoming Events */}
              <div className="card">
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
                  Upcoming Events
                </h2>
                {upcomingEvents.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingEvents.map((event: any, idx: number) => {
                      const title = typeof event?.title === 'string' ? event.title : 'Event';
                      const start = event?.startTime ? new Date(event.startTime) : new Date();
                      const isDeadline = ['due', 'deadline', 'quiz', 'exam', 'assignment', 'submit'].some((k: string) =>
                        title.toLowerCase().includes(k)
                      );
                      return (
                        <div
                          key={event?.id ?? `ev-${idx}`}
                          className={`rounded-lg p-3 ${isDeadline ? 'bg-nightshift-warning/10 border border-nightshift-warning/30' : 'bg-nightshift-bg-light'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{isDeadline ? '⚡' : '📅'}</span>
                            <span className="text-sm font-medium text-nightshift-text-primary">{title}</span>
                          </div>
                          <p className="text-xs text-nightshift-text-muted mt-1 ml-6">
                            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-nightshift-text-muted">No upcoming events. Connect Google Calendar in Settings.</p>
                )}
              </div>

              {/* Recent GitHub Activity */}
              <div className="card">
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
                  GitHub Activity
                </h2>
                {recentGithub.length > 0 ? (
                  <div className="space-y-2">
                    {recentGithub.map((gh: any, idx: number) => (
                      <div key={gh?.id ?? `gh-${idx}`} className="rounded-lg bg-nightshift-bg-light p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{gh?.type === 'commit' ? '📦' : gh?.type === 'pr' ? '🔀' : '🐛'}</span>
                          <a
                            href={typeof gh?.url === 'string' ? gh.url : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-nightshift-accent hover:underline truncate"
                          >
                            {typeof gh?.title === 'string' ? gh.title : 'Activity'}
                          </a>
                        </div>
                        <p className="text-xs text-nightshift-text-muted mt-1 ml-6">
                          {String(gh?.type ?? 'item')} &middot;{' '}
                          {gh?.authoredAt ? new Date(gh.authoredAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-nightshift-text-muted">No recent activity. Connect GitHub in Settings.</p>
                )}
              </div>
            </div>

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
