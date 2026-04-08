/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: GET: list all pending drafts for a user, POST: create new draft
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — GET returns mock data, POST creates real drafts
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: List all pending drafts for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    const drafts = await db.draft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(
      drafts.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        content: d.content,
        targetApp: d.targetApp,
        confidenceScore: d.confidenceScore,
        status: d.status,
        context: d.context ? JSON.parse(d.context) : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[drafts] Error:', error);
    return apiError('Failed to fetch drafts', 500);
  }
}
