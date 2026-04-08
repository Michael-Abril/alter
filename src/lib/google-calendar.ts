/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Google Calendar API helpers — fetch events, detect deadlines
 * DEPENDENCIES: googleapis, google-auth
 * STATUS: Ready for integration
 */

import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/google-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  googleId: string;
  calendarId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  location: string | null;
  isAllDay: boolean;
}

// ─── Deadline Detection ───────────────────────────────────────────────────────

const DEADLINE_KEYWORDS = [
  'deadline',
  'due',
  'quiz',
  'exam',
  'assignment',
  'submit',
  'presentation',
];

function matchesDeadlineKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return DEADLINE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Fetch Events ─────────────────────────────────────────────────────────────

export async function fetchUpcomingEvents(
  userId: string,
  daysAhead: number = 7
): Promise<CalendarEvent[]> {
  try {
    const authClient = await getGoogleAuthClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const items = response.data.items ?? [];

    return items.map((event) => {
      const isAllDay = !event.start?.dateTime;
      const startTime = isAllDay
        ? new Date((event.start?.date || '1970-01-01') + 'T00:00:00')
        : new Date(event.start!.dateTime!);
      const endTime = isAllDay
        ? new Date((event.end?.date || '1970-01-01') + 'T23:59:59')
        : new Date(event.end!.dateTime!);

      return {
        googleId: event.id!,
        calendarId: 'primary',
        title: event.summary ?? '(No title)',
        description: event.description ?? null,
        startTime,
        endTime,
        location: event.location ?? null,
        isAllDay,
      };
    });
  } catch (error) {
    console.warn('[google-calendar] Failed to fetch upcoming events:', error);
    return [];
  }
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

export async function fetchTodayEvents(
  userId: string
): Promise<CalendarEvent[]> {
  return fetchUpcomingEvents(userId, 1);
}

export async function getDeadlines(
  userId: string,
  daysAhead: number = 7
): Promise<CalendarEvent[]> {
  const events = await fetchUpcomingEvents(userId, daysAhead);

  return events
    .filter(
      (e) =>
        matchesDeadlineKeywords(e.title) ||
        (e.description && matchesDeadlineKeywords(e.description))
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
