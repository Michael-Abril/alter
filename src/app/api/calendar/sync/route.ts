/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Sync Google Calendar events — pull upcoming events and upsert into CalendarEvent table
 * DEPENDENCIES: Prisma, Google Calendar API, @clerk/nextjs
 * STATUS: Ready for integration
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { syncCalendarForUser } from '@/lib/calendar-sync';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return apiError('User not found', 404);

    const body = await req.json().catch(() => ({}));
    const daysAhead =
      typeof body.daysAhead === 'number' && body.daysAhead > 0 && body.daysAhead <= 90
        ? body.daysAhead
        : 14;

    const { synced } = await syncCalendarForUser(user.id, daysAhead);

    console.log(`[calendar/sync] Synced ${synced} events for user ${user.id}`);
    return apiSuccess({ synced });
  } catch (error) {
    console.error('[calendar/sync] Error:', error);
    return apiError('Failed to sync calendar events', 500);
  }
}
