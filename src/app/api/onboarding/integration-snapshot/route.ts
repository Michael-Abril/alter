/**
 * POST /api/onboarding/integration-snapshot
 * Parallel Gmail + Calendar + Canvas ingest in one round-trip (fast onboarding).
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { runOnboardingIntegrationSnapshot } from '@/lib/onboarding-integration-snapshot';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    const body = await req.json().catch(() => ({}));
    const gmailSinceDays =
      typeof body.gmailSinceDays === 'number' && body.gmailSinceDays > 0 && body.gmailSinceDays <= 90
        ? body.gmailSinceDays
        : 14;
    const calendarDaysAhead =
      typeof body.calendarDaysAhead === 'number' &&
      body.calendarDaysAhead > 0 &&
      body.calendarDaysAhead <= 90
        ? body.calendarDaysAhead
        : 21;

    const data = await runOnboardingIntegrationSnapshot(user.id, clerkId, {
      gmailSinceDays,
      calendarDaysAhead,
    });

    return apiSuccess(data);
  } catch (e: any) {
    console.error('[onboarding/integration-snapshot]', e);
    return apiError(e?.message || 'Integration snapshot failed', 500);
  }
}
