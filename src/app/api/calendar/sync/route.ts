/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Sync Google Calendar events — pull upcoming events and upsert into CalendarEvent table
 * DEPENDENCIES: Prisma, Google Calendar API, @clerk/nextjs
 * STATUS: Ready for integration
 */

import { auth } from '@clerk/nextjs/server';
import { fetchUpcomingEvents } from '@/lib/google-calendar';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return apiError('User not found', 404);

    const events = await fetchUpcomingEvents(user.id, 14);

    let synced = 0;
    for (const event of events) {
      await db.calendarEvent.upsert({
        where: { googleId: event.googleId },
        create: {
          userId: user.id,
          googleId: event.googleId,
          calendarId: event.calendarId,
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          isAllDay: event.isAllDay,
        },
        update: {
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          isAllDay: event.isAllDay,
          syncedAt: new Date(),
        },
      });
      synced++;
    }

    console.log(`[calendar/sync] Synced ${synced} events for user ${user.id}`);
    return apiSuccess({ synced });
  } catch (error) {
    console.error('[calendar/sync] Error:', error);
    return apiError('Failed to sync calendar events', 500);
  }
}
