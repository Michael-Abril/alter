/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Internal API for orchestration scripts - no auth required
 * DEPENDENCIES: Prisma
 * STATUS: LIVE — returns projects by userId for server-side scripts
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Return projects for a specific user (for orchestration scripts)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return apiError('Missing userId parameter', 400);
  }

  try {
    const user = await db.user.findFirst({
      where: { OR: [{ id: userId }, { clerkId: userId }] },
      select: { id: true },
    });
    if (!user) {
      return apiSuccess({ projects: [], count: 0 });
    }

    const projects = await db.project.findMany({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        status: true,
        lastActive: true,
        progress: true,
        context: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Parse context JSON for each project
    const enriched = projects.map((p) => ({
      ...p,
      context: p.context ? JSON.parse(p.context) : null,
    }));

    return apiSuccess({
      projects: enriched,
      count: enriched.length,
    });
  } catch (error) {
    console.error('[internal/projects] Error:', error);
    return apiError('Failed to fetch projects', 500);
  }
}
