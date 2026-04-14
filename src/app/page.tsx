/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Marketing landing (Alter) — redirects authenticated users to dashboard
 * DEPENDENCIES: @clerk/nextjs, AlterLanding
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AlterLanding } from '@/components/alter/AlterLanding';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return <AlterLanding />;
}
