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
        className="rounded-xl border border-nightshift-border/80 bg-nightshift-bg-card/50 px-5 py-8 md:px-6"
        aria-labelledby="today-heading"
      >
        <h2 id="today-heading" className="font-display text-xl font-bold text-nightshift-text-primary">
          Today
        </h2>
        <p className="mt-2 text-sm text-nightshift-text-muted">Nothing in focus yet.</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-nightshift-border bg-gradient-to-br from-nightshift-bg-card to-nightshift-bg-light/30 px-5 py-6 shadow-lg md:px-7 md:py-8"
      aria-labelledby="today-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Today</p>
      <h2 id="today-heading" className="mt-1 font-display text-2xl font-bold tracking-tight text-nightshift-text-primary md:text-[26px]">
        Focus
      </h2>

      <ol className="mt-6 space-y-6">
        {items.map((item, i) => (
          <li key={item.id} className="border-b border-nightshift-border/40 pb-6 last:border-0 last:pb-0">
            <div className="flex gap-3">
              <span className="mt-1 w-7 shrink-0 text-right font-mono text-sm font-bold text-nightshift-text-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ProjectKindBadge kind={item.kind} />
                  <UrgencyBadge dueAt={item.dueAt} />
                </div>
                <h3 className="text-lg font-bold leading-snug text-nightshift-text-primary md:text-[19px]">{item.title}</h3>
                {item.dueTiming && (
                  <p className="text-xs font-medium text-nightshift-text-secondary">{item.dueTiming}</p>
                )}
                <p className="text-base text-nightshift-text-secondary">
                  <span className="text-nightshift-highlight">→</span>{' '}
                  <span className="font-semibold text-nightshift-text-primary">{item.action}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
