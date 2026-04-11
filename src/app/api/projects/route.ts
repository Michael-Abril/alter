/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: GET: return detected active projects for a user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — returns real detected projects from DB, falls back to mock when empty
 */

import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { tryAuthUser } from '@/lib/clerk-user';

// GET: Return detected active projects for the authenticated user
export async function GET() {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const projects = await db.project.findMany({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' },
      select: {
        id: true,
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
      source: projects.length > 0 ? 'database' : 'empty',
    });
  } catch (error) {
    console.error('[projects] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch projects',
      500
    );
  }
}
