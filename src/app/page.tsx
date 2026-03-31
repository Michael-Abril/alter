/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Landing page — redirects authenticated users to dashboard, shows landing for guests
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Scaffold — needs real landing page design
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Hero Section */}
      <div className="max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-nightshift-border bg-nightshift-bg-card px-4 py-1.5 text-sm text-nightshift-text-secondary">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-nightshift-accent animate-pulse" />
          Your AI work engine — active while you sleep
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          <span className="text-nightshift-text-primary">Night</span>
          <span className="text-nightshift-accent">Shift</span>
          <span className="text-nightshift-text-primary"> AI</span>
        </h1>

        <p className="mb-8 text-lg text-nightshift-text-secondary md:text-xl">
          NightShift learns how you work, how you write, and what you&apos;re working on.
          When you go to sleep, it continues your work — finishing drafts, sending emails,
          and completing tasks — all in your voice.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="btn-primary px-8 py-3 text-lg"
          >
            Start Your NightShift
          </Link>
          <Link
            href="/sign-in"
            className="btn-ghost px-8 py-3 text-lg"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="mt-24 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        <FeatureCard
          title="Learns Your Voice"
          description="Analyzes your emails and chat history to understand how you write, your tone, and your style."
          icon="🎙️"
        />
        <FeatureCard
          title="Continues Your Work"
          description="Picks up where you left off — finishes code, writes emails, completes docs while you sleep."
          icon="🌙"
        />
        <FeatureCard
          title="Morning Brief"
          description="Wake up to a summary of everything NightShift did overnight, with items flagged for your review."
          icon="☀️"
        />
      </div>

      {/* Footer */}
      <footer className="mt-24 pb-8 text-center text-sm text-nightshift-text-muted">
        Built by vibe coders who needed more hours in the day.
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="card hover:border-nightshift-accent/30 transition-colors">
      <div className="mb-3 text-3xl">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-nightshift-text-primary">{title}</h3>
      <p className="text-sm text-nightshift-text-secondary">{description}</p>
    </div>
  );
}
