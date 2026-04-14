/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: GET: fetch upcoming calendar events from DB for the authenticated user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Ready for integration
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return apiError('User not found', 404);

    const events = await db.calendarEvent.findMany({
      where: {
        userId: user.id,
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    return apiSuccess(events);
  } catch (error) {
    console.error('[calendar/events] GET error:', error);
    return apiError('Failed to fetch calendar events', 500);
  }
}
