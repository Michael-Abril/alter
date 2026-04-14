/**
 * POST /api/onboarding/complete — mark onboarding finished so dashboard does not loop back here.
 */

import { apiSuccess, apiError } from '@/lib/utils';
import { tryAuthUser } from '@/lib/clerk-user';
import db from '@/lib/db';

export async function POST() {
  const authResult = await tryAuthUser();
  if (!authResult.ok) return authResult.response;

  try {
    await db.user.update({
      where: { id: authResult.user.id },
      data: { onboardingCompletedAt: new Date() },
    });
    return apiSuccess({ completed: true });
  } catch (e) {
    console.error('[onboarding/complete]', e);
    return apiError('Failed to complete onboarding', 500);
  }
}
