/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: run project detection for onboarding (inline, no child process)
 * DEPENDENCIES: Prisma, @clerk/nextjs, detect-projects-inline
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { detectProjectsForUser } from '@/lib/detect-projects-inline';

const ONBOARDING_LOOKBACK_DAYS = 3;

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    const urlDays = req.nextUrl.searchParams.get('sinceDays');
    const body = await req.json().catch(() => ({}));
    const lookbackDays = Math.max(
      1,
      Math.min(365, Number(urlDays || body?.days) || ONBOARDING_LOOKBACK_DAYS)
    );

    console.log('[onboarding/detect-projects] Starting inline project detection...');

    const result = await detectProjectsForUser(user.id, {
      sinceDays: lookbackDays,
      maxConversations: 20,
    });

    console.log(`[onboarding/detect-projects] Detected ${result.detected} projects`);

    return apiSuccess({
      projectsDetected: result.detected,
      created: result.created,
      updated: result.updated,
      status: 'complete',
      lookbackDays,
    });
  } catch (error: any) {
    console.error('[onboarding/detect-projects] Error:', error);
    return apiError(`Failed to run project detection: ${error.message}`, 500);
  }
}
