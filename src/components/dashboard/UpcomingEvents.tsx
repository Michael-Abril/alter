/**
 * Async server component for upcoming events.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import db from '@/lib/db';

type Props = {
  userId: string;
};

export default async function UpcomingEvents({ userId }: Props) {
  let upcomingEvents: Array<{ id: string; title: string; startTime: Date }> = [];

  try {
    const dbWithEvents = db as {
      calendarEvent?: {
        findMany: (args: object) => Promise<Array<{ id: string; title: string; startTime: Date }>>;
      };
    };

    if (dbWithEvents.calendarEvent) {
      upcomingEvents = await dbWithEvents.calendarEvent.findMany({
        where: { userId, startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 5,
      });
    }
  } catch {
    // Calendar table may not exist
  }

  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
        Upcoming Events
      </h2>
      {upcomingEvents.length > 0 ? (
        <div className="space-y-2">
          {upcomingEvents.map((event, idx) => {
            const title = event.title || 'Event';
            const start = new Date(event.startTime);
            const isDeadline = ['due', 'deadline', 'quiz', 'exam', 'assignment', 'submit'].some(
              (k: string) => title.toLowerCase().includes(k)
            );
            return (
              <div
                key={event.id ?? `ev-${idx}`}
                className={`rounded-lg p-3 ${
                  isDeadline
                    ? 'bg-nightshift-warning/10 border border-nightshift-warning/30'
                    : 'bg-nightshift-bg-light'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{isDeadline ? '⚡' : '📅'}</span>
                  <span className="text-sm font-medium text-nightshift-text-primary">{title}</span>
                </div>
                <p className="text-xs text-nightshift-text-muted mt-1 ml-6">
                  {start.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-nightshift-text-muted">
          No upcoming events. Connect Google Calendar in Settings.
        </p>
      )}
    </div>
  );
}
