/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Main dashboard — Morning Brief view with streaming data
 * DEPENDENCIES: @clerk/nextjs, Prisma, components/dashboard/*
 * STATUS: LIVE — streaming architecture for instant page loads
 */

import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getCachedDashboardUser } from '@/lib/clerk-user';
import { getCachedProjectCount, getCachedChatCount } from '@/lib/cached-queries';

// Async streaming components
import MorningBriefAsync from '@/components/dashboard/MorningBriefAsync';
import TasksTodayAsync from '@/components/dashboard/TasksTodayAsync';
import DashboardStats from '@/components/dashboard/DashboardStats';
import SuggestedFocus from '@/components/dashboard/SuggestedFocus';
import DraftsBanner from '@/components/dashboard/DraftsBanner';
import UpcomingEvents from '@/components/dashboard/UpcomingEvents';
import GithubActivity from '@/components/dashboard/GithubActivity';
import CompletedAndFlagged from '@/components/dashboard/CompletedAndFlagged';

// Skeleton fallbacks
import {
  MorningBriefSkeleton,
  TasksTodaySkeleton,
  StatsSkeleton,
  SuggestedFocusSkeleton,
  EventsAndGithubSkeleton,
  CompletedFlaggedSkeleton,
} from '@/components/dashboard/skeletons';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (typeof userId !== 'string' || userId.length === 0) redirect('/sign-in');

  const user = await getCachedDashboardUser(userId);
  if (!user) redirect('/onboarding');

  // Quick check for new user (cached queries for deduplication)
  const [projectCount, chatCount] = await Promise.all([
    getCachedProjectCount(user.id),
    getCachedChatCount(user.id),
  ]);

  const isNewUser = !user.onboardingCompletedAt && projectCount === 0 && chatCount === 0;

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
                  Before NightShift can work for you, it needs to learn who you are — your voice,
                  your projects, and how you think.
                </p>
              </div>
              <div className="card border-nightshift-accent/30 bg-nightshift-bg-card p-6 space-y-4">
                <h2 className="text-xl font-semibold text-nightshift-text-primary">
                  Start your personality upload
                </h2>
                <p className="text-sm text-nightshift-text-secondary">
                  Connect your tools and import your chat history. Takes about 2 minutes. NightShift
                  will build your voice profile and detect your active projects.
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

  // Render dashboard with streaming Suspense boundaries
  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-8">
            {/* Morning Brief - streams first */}
            <Suspense fallback={<MorningBriefSkeleton />}>
              <MorningBriefAsync
                userId={user.id}
                userName={user.name}
                userEmail={user.email}
              />
            </Suspense>

            {/* Tasks Today - critical, streams second */}
            <Suspense fallback={<TasksTodaySkeleton />}>
              <TasksTodayAsync userId={user.id} />
            </Suspense>

            {/* Stats - fast queries, streams quickly */}
            <Suspense fallback={<StatsSkeleton />}>
              <DashboardStats userId={user.id} />
            </Suspense>

            {/* Suggested Focus - medium priority */}
            <Suspense fallback={<SuggestedFocusSkeleton />}>
              <SuggestedFocus userId={user.id} />
            </Suspense>

            {/* Drafts Banner - quick check */}
            <Suspense fallback={null}>
              <DraftsBanner userId={user.id} />
            </Suspense>

            {/* Calendar & GitHub - lower priority, can load last */}
            <Suspense fallback={<EventsAndGithubSkeleton />}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <UpcomingEvents userId={user.id} />
                <GithubActivity userId={user.id} />
              </div>
            </Suspense>

            {/* Completed & Flagged - lowest priority */}
            <Suspense fallback={<CompletedFlaggedSkeleton />}>
              <CompletedAndFlagged userId={user.id} />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
