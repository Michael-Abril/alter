/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: GET: check if user has Gmail connected
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { gmailConnected: true },
    });

    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({
      connected: user.gmailConnected,
    });
  } catch (error) {
    console.error('[gmail/status] Error:', error);
    return apiError('Failed to check Gmail status', 500);
  }
}
