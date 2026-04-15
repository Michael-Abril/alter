import type { FocusItem } from '@/lib/tasks-focus';
import { ProjectKindBadge } from '@/components/dashboard/ProjectKindBadge';

function UrgencyBadge({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return null;
  const h = (new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (h < 0) {
    return (
      <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
        Overdue
      </span>
    );
  }
  if (h <= 24) {
    return (
      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
        Due within 24 hours
      </span>
    );
  }
  if (h <= 72) {
    return (
      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
        Due within 3 days
      </span>
    );
  }
  if (h <= 168) {
    return (
      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
        Due this week
      </span>
    );
  }
  return null;
}

export default function TodaysFocus({ items }: { items: FocusItem[] }) {
  if (items.length === 0) {
    return (
      <section
        className="rounded-xl border border-alter-border/80 bg-alter-surface/50 px-5 py-8 md:px-6"
        aria-labelledby="today-heading"
      >
        <h2 id="today-heading" className="font-display text-xl font-bold text-alter-text">
          Today
        </h2>
        <p className="mt-2 text-sm text-alter-muted">Nothing in focus yet.</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-alter-border bg-gradient-to-br from-alter-surface to-alter-surface/30 px-5 py-6 shadow-lg md:px-7 md:py-8"
      aria-labelledby="today-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-alter-muted">Today</p>
      <h2 id="today-heading" className="mt-1 font-display text-2xl font-bold tracking-tight text-alter-text md:text-[26px]">
        Focus
      </h2>

      <ol className="mt-6 space-y-6">
        {items.map((item, i) => (
          <li key={item.id} className="border-b border-alter-border/40 pb-6 last:border-0 last:pb-0">
            <div className="flex gap-3">
              <span className="mt-1 w-7 shrink-0 text-right font-mono text-sm font-bold text-alter-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ProjectKindBadge kind={item.kind} />
                  <UrgencyBadge dueAt={item.dueAt} />
                </div>
                <h3 className="text-lg font-bold leading-snug text-alter-text md:text-[19px]">{item.title}</h3>
                {item.dueTiming && (
                  <p className="text-xs font-medium text-alter-text-secondary">{item.dueTiming}</p>
                )}
                <p className="text-base text-alter-text-secondary">
                  <span className="text-alter-gold-light">→</span>{' '}
                  <span className="font-semibold text-alter-text">{item.action}</span>
                </p>
                {item.externalUrl ? (
                  <p className="text-sm">
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-alter-primary underline-offset-2 hover:underline"
                    >
                      {item.provider === 'canvas' ? 'Open in Canvas' : 'Open'}
                    </a>
                    {item.submissionUrl && item.submissionUrl !== item.externalUrl ? (
                      <>
                        {' · '}
                        <a
                          href={item.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-alter-primary underline-offset-2 hover:underline"
                        >
                          Submit
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
