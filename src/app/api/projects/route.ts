/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: GET: return detected active projects for a user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — returns real detected projects from DB, falls back to mock when empty
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Return detected active projects for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    // Find user, with dev auto-link fallback
    let user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      const testUser = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
      if (testUser) {
        user = await db.user.update({
          where: { id: testUser.id },
          data: { clerkId: userId },
        });
        console.log(`[projects] Linked Clerk user ${userId} to existing test user ${user.id}`);
      }
    }

    const projects = user ? await db.project.findMany({
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
    }) : [];

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
    return apiError('Failed to fetch projects', 500);
  }
}
