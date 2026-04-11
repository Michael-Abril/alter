/**
 * Async server component for suggested focus section.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import db from '@/lib/db';

type Props = {
  userId: string;
};

function parseProjectContext(rawContext: string | null): Record<string, unknown> {
  if (!rawContext) return {};
  try {
    return JSON.parse(rawContext) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function SuggestedFocus({ userId }: Props) {
  const projects = await db.project.findMany({
    where: { userId, status: 'in_progress' },
    orderBy: { progress: 'desc' },
    take: 4,
    select: {
      id: true,
      name: true,
      progress: true,
      context: true,
    },
  });

  if (projects.length === 0) {
    return null;
  }

  const suggestedFocus = projects.map((p) => {
    const ctx = parseProjectContext(p.context);
    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    return {
      title: p.name,
      reason: nextStep || `${p.progress}% complete — continue this work`,
      priority: (p.progress >= 70 ? 'high' : p.progress >= 40 ? 'medium' : 'low') as
        | 'high'
        | 'medium'
        | 'low',
    };
  });

  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
        Suggested Focus
      </h2>
      <div className="space-y-3">
        {suggestedFocus.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg bg-nightshift-bg-light p-3"
          >
            <span
              className={`mt-0.5 inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                item.priority === 'high'
                  ? 'bg-nightshift-warning'
                  : item.priority === 'medium'
                  ? 'bg-nightshift-accent'
                  : 'bg-nightshift-text-muted'
              }`}
            />
            <div>
              <span className="text-sm font-medium text-nightshift-text-primary">
                {item.title}
              </span>
              <p className="mt-0.5 text-xs text-nightshift-text-muted">
                {item.reason}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
