/**
 * Ensures a Prisma User exists for the Clerk session before any dashboard subtree renders.
 * Prevents client pages from mounting then hitting APIs with no user row.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getCachedDashboardUser } from '@/lib/clerk-user';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (typeof userId !== 'string' || userId.length === 0) {
    redirect('/sign-in?redirect_url=/dashboard');
  }

  const user = await getCachedDashboardUser(userId);
  if (!user) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-nightshift-bg text-nightshift-text-primary">{children}</div>
  );
}
