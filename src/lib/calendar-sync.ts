/**
 * Shared Google Calendar → CalendarEvent sync (API route + OAuth / onboarding).
 */

import db from '@/lib/db';
import { fetchUpcomingEvents } from '@/lib/google-calendar';

export async function syncCalendarForUser(
  internalUserId: string,
  daysAhead: number = 14
): Promise<{ synced: number }> {
  const capped = Math.min(Math.max(daysAhead, 1), 90);

  const events = await fetchUpcomingEvents(internalUserId, capped);
  let synced = 0;

  for (const event of events) {
    await db.calendarEvent.upsert({
      where: { googleId: event.googleId },
      create: {
        userId: internalUserId,
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

  return { synced };
}
