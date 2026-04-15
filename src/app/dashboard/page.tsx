/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Main dashboard — Morning Brief view showing real project data and chat stats
 * DEPENDENCIES: @clerk/nextjs, Prisma, components/brief/*, components/layout/*
 * STATUS: LIVE — fetches real data from DB
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Bug, Calendar, FileEdit, GitBranch, Package, Zap } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CompletedActions from '@/components/brief/CompletedActions';
import FlaggedItems from '@/components/brief/FlaggedItems';
import TodaysFocus from '@/components/dashboard/TodaysFocus';
import SuggestedAutomations from '@/components/dashboard/SuggestedAutomations';
import OtherActiveWork from '@/components/dashboard/OtherActiveWork';
import MorningBriefCard from '@/components/dashboard/MorningBriefCard';
import DashboardCompletionBanner from '@/components/dashboard/DashboardCompletionBanner';
import RecentAlterActions from '@/components/dashboard/RecentAlterActions';
import DevConsistencyPanel from '@/components/dashboard/DevConsistencyPanel';
import db from '@/lib/db';
import { getCachedDashboardUser } from '@/lib/clerk-user';
import { displayFirstName } from '@/lib/display-name';
import {
  isDeliverableCompletedProject,
  deliverableKindFromProjectContext,
  isHandoffEligible,
} from '@/lib/project-deliverable';
import { parsePriorityContext } from '@/lib/priority-context';
import { buildMorningBriefWelcomeLine, buildFocusDashboard } from '@/lib/tasks-focus';
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
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const { userId } = await auth();
  if (typeof userId !== 'string' || userId.length === 0) redirect('/sign-in');

  const user = await getCachedDashboardUser(userId);
  if (!user) redirect('/sign-in?redirect_url=/dashboard');

  if (!user.onboardingCompletedAt) {
    return (
      <div className="flex h-screen bg-nightshift-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-lg space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-nightshift-accent/25 to-nightshift-navy/30 ring-1 ring-white/10">
                <span className="font-display text-2xl font-bold text-nightshift-text-primary">A</span>
              </div>
              <div>
                <h1 className="mb-3 font-display text-3xl font-bold text-nightshift-text-primary">
                  Welcome to Alter
                </h1>
                <p className="text-lg leading-relaxed text-nightshift-text-secondary">
                  Before Alter can work for you, it needs to learn who you are — your voice, your projects, and how you think.
                </p>
              </div>
              <div className="card space-y-4 border-nightshift-accent/25 bg-nightshift-bg-card p-6">
                <h2 className="text-xl font-semibold text-nightshift-text-primary">
                  Build your identity profile
                </h2>
                <p className="text-sm text-nightshift-text-secondary">
                  Connect your tools and import your chat history. Takes about two minutes. Alter builds your voice profile and detects active projects — locally first.
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

  let projects: ProjectWithContext[] = [];
  let upcomingEvents: unknown[] = [];
  let recentGithub: unknown[] = [];
  let pendingDrafts = 0;
  let todayTasks: TodayTask[] = [];

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
    ]);
    projects = Array.isArray(results[0]) ? (results[0] as ProjectWithContext[]) : [];
    upcomingEvents = Array.isArray(results[1]) ? results[1] : [];
    recentGithub = Array.isArray(results[2]) ? results[2] : [];
    pendingDrafts = typeof results[3] === 'number' ? results[3] : 0;
  } catch {
    /* keep defaults */
  }

  const completed = projects.filter((p) => p?.status === 'completed');
  const stalled = projects.filter((p) => p?.status === 'stalled');

  const focusDashboard = buildFocusDashboard(
    todayTasks,
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      context: p.context,
      lastActive: p.lastActive,
      progress: p.progress,
    })),
    parsePriorityContext(user.priorityContext)
  );

  const clerkUser = await currentUser();
  const welcomeFirst = displayFirstName({
    dbName: user.name,
    email: user.email,
    clerkFirstName: clerkUser?.firstName ?? null,
  });
  const welcomeLine = buildMorningBriefWelcomeLine(welcomeFirst);

  const rawForBrief = todayTasks.slice(0, 14).map((t) => ({
    title: t.title,
    dueDate: t.dueDate,
    source: t.source,
  }));
  const narrative = process.env.DASHBOARD_SHOW_NARRATIVE === 'true'
    ? `You have ${rawForBrief.length} active signals today — focus on the top priorities first.`
    : '';

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const completedDeliverables = completed.filter((p) =>
    isDeliverableCompletedProject(p.name, p.context)
  );
  const recentlyFinishedDeliverables = completedDeliverables.filter(
    (p) => p.updatedAt >= sevenDaysAgo
  );

  let recentAlterActions: {
    id: string;
    title: string;
    description: string | null;
    app: string;
    type: string;
    createdAt: Date;
    metadata: string | null;
  }[] = [];
  let actionsThisWeek = 0;
  try {
    [recentAlterActions, actionsThisWeek] = await Promise.all([
      db.action.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          description: true,
          app: true,
          type: true,
          createdAt: true,
          metadata: true,
        },
      }),
      db.action.count({
        where: { userId: user.id, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);
  } catch {
    recentAlterActions = [];
    actionsThisWeek = 0;
  }

  const showCompletionBanner =
    recentlyFinishedDeliverables.length > 0 || actionsThisWeek > 0;
  const completionBannerMessage =
    recentlyFinishedDeliverables.length > 0 && actionsThisWeek > 0
      ? `${recentlyFinishedDeliverables.length} deliverable${recentlyFinishedDeliverables.length !== 1 ? 's' : ''} continued, ${actionsThisWeek} action${actionsThisWeek !== 1 ? 's' : ''} logged this week.`
      : recentlyFinishedDeliverables.length > 0
        ? `${recentlyFinishedDeliverables.length} deliverable${recentlyFinishedDeliverables.length !== 1 ? 's' : ''} continued while you were away.`
        : `${actionsThisWeek} action${actionsThisWeek !== 1 ? 's' : ''} logged this week.`;

  const completedActions = completedDeliverables.map((p) => {
    const ctx = parseProjectContext(p.context);
    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    return {
      id: p.id,
      title: p.name,
      description: p.description || nextStep || 'Completed',
      createdAt: p.updatedAt.toISOString(),
      kind: deliverableKindFromProjectContext(p.context),
    };
  });

  let inboxApprox = 0;
  try {
    inboxApprox = await db.email.count({ where: { userId: user.id } });
  } catch {
    inboxApprox = 0;
  }

  const activeDeliverableCount = projects.filter(
    (p) => p.status !== 'completed' && isHandoffEligible(p.context)
  ).length;

  const upcomingDeadlineCount = todayTasks.filter((t) => {
    if (!t.dueDate) return false;
    const h = (new Date(t.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    return h > 0 && h <= 168;
  }).length;

  const bannerId = `done-${user.id}-${recentlyFinishedDeliverables.length}-${actionsThisWeek}-${sevenDaysAgo.toISOString().slice(0, 10)}`;

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

  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(124,58,237,0.07),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_20%,rgba(6,182,212,0.05),transparent_45%)] px-5 py-10 sm:px-8 md:px-12">
          <div className="mx-auto w-full max-w-[800px] space-y-10">
            {showCompletionBanner && (
              <DashboardCompletionBanner bannerId={bannerId} message={completionBannerMessage} />
            )}

            {!demoMode && process.env.NODE_ENV !== 'production' && <DevConsistencyPanel />}

            <MorningBriefCard welcomeLine={welcomeLine} narrative={narrative} />

            <TodaysFocus items={focusDashboard.focusItems} />

            <SuggestedAutomations items={focusDashboard.suggestedAutomations} />

            {demoMode ? (
              <section className="rounded-xl border border-nightshift-border/60 bg-nightshift-bg-card/30 px-5 py-5 md:px-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Next</p>
                <h2 className="mt-1 font-display text-xl font-bold text-nightshift-text-primary">Delegate with Handoff</h2>
                <p className="mt-2 text-sm text-nightshift-text-secondary">
                  Focus on your top items. Alter can handle the rest.
                </p>
                <a href="/dashboard/handoff" className="btn-primary mt-4 inline-flex items-center gap-2">
                  Open Handoff →
                </a>
              </section>
            ) : (
            <details className="rounded-xl border border-nightshift-border/60 bg-nightshift-bg-card/30">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-nightshift-text-secondary md:px-6">
                More
              </summary>
              <div className="space-y-6 px-5 pb-5 md:px-6 md:pb-6">
                {recentAlterActions.length > 0 && (
                  <RecentAlterActions
                    actions={recentAlterActions.map((a) => ({
                      ...a,
                      createdAt: a.createdAt.toISOString(),
                    }))}
                  />
                )}

                <OtherActiveWork grouped={focusDashboard.grouped} />

                <section className="rounded-xl border border-nightshift-border/60 bg-nightshift-bg-card/30 px-5 py-5 md:px-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Alter knows</p>
                  <h2 className="mt-1 font-display text-xl font-bold text-nightshift-text-primary md:text-2xl">Your landscape</h2>
                  <p className="mt-2 text-sm leading-relaxed text-nightshift-text-secondary">
                    {activeDeliverableCount} active deliverable{activeDeliverableCount !== 1 ? 's' : ''} · {upcomingDeadlineCount}{' '}
                    upcoming deadline{upcomingDeadlineCount !== 1 ? 's' : ''} this week · {inboxApprox} inbox thread
                    {inboxApprox !== 1 ? 's' : ''} indexed
                  </p>
                </section>

                {pendingDrafts > 0 && (
                  <a href="/dashboard/drafts" className="card block border-nightshift-warning/30 transition-colors hover:border-nightshift-warning/60">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-nightshift-border bg-nightshift-bg-light text-nightshift-highlight">
                        <FileEdit className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div>
                        <span className="font-medium text-nightshift-text-primary">{pendingDrafts} draft{pendingDrafts > 1 ? 's' : ''} awaiting review</span>
                        <p className="text-xs text-nightshift-text-muted">Alter drafted these — review and approve</p>
                      </div>
                    </div>
                  </a>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="card">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Calendar</p>
                <h2 className="mt-1 mb-4 font-display text-lg font-bold text-nightshift-text-primary">Upcoming events</h2>
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
                            <span className="text-nightshift-highlight">
                              {isDeadline ? <Zap className="h-4 w-4" aria-hidden /> : <Calendar className="h-4 w-4" aria-hidden />}
                            </span>
                            <span className="text-sm font-medium text-nightshift-text-primary">{title}</span>
                          </div>
                          <p className="mt-1 text-xs text-nightshift-text-muted ml-7">
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

              <div className="card">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">GitHub</p>
                <h2 className="mt-1 mb-4 font-display text-lg font-bold text-nightshift-text-primary">Recent activity</h2>
                {recentGithub.length > 0 ? (
                  <div className="space-y-2">
                    {recentGithub.map((gh: any, idx: number) => (
                      <div key={gh?.id ?? `gh-${idx}`} className="rounded-lg bg-nightshift-bg-light p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-nightshift-highlight">
                            {gh?.type === 'commit' ? (
                              <Package className="h-4 w-4" aria-hidden />
                            ) : gh?.type === 'pr' ? (
                              <GitBranch className="h-4 w-4" aria-hidden />
                            ) : (
                              <Bug className="h-4 w-4" aria-hidden />
                            )}
                          </span>
                          <a
                            href={typeof gh?.url === 'string' ? gh.url : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-nightshift-accent hover:underline truncate"
                          >
                            {typeof gh?.title === 'string' ? gh.title : 'Activity'}
                          </a>
                        </div>
                        <p className="mt-1 text-xs text-nightshift-text-muted ml-7">
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {completedActions.length > 0 ? (
                    <CompletedActions actions={completedActions} />
                  ) : (
                    <div className="card rounded-xl p-5 md:p-6">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">
                        Recently completed
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold text-nightshift-text-primary">Deliverables</h2>
                      <p className="mt-2 text-sm text-nightshift-text-muted">
                        {recentAlterActions.length > 0
                          ? 'No completed deliverable projects yet — Alter activity from the overnight loop and drafts appears in Activity and above.'
                          : 'No completed deliverables yet — finished academic, code, or doc work shows here.'}
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
            </details>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
