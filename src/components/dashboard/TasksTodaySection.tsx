import { ChevronRight, GraduationCap, FolderKanban, Mail } from 'lucide-react';
import type { TodayTask, TodayTaskSource, TodayTaskUrgency } from '@/lib/tasks-today';

function urgencyStyles(u: TodayTaskUrgency): { badge: string; ring: string } {
  switch (u) {
    case 'critical':
      return {
        badge: 'border-red-500/40 bg-red-950/50 text-red-200',
        ring: 'ring-1 ring-red-500/20',
      };
    case 'high':
      return {
        badge: 'border-amber-500/40 bg-amber-950/40 text-amber-100',
        ring: 'ring-1 ring-amber-500/15',
      };
    case 'medium':
      return {
        badge: 'border-yellow-500/30 bg-yellow-950/30 text-yellow-50',
        ring: 'ring-1 ring-yellow-500/10',
      };
    case 'low':
    default:
      return {
        badge: 'border-emerald-500/35 bg-emerald-950/35 text-emerald-100',
        ring: 'ring-1 ring-emerald-500/10',
      };
  }
}

function SourceBadge({ source }: { source: TodayTaskSource }) {
  const icon =
    source === 'canvas' ? (
      <GraduationCap className="h-4 w-4" aria-hidden />
    ) : source === 'project' ? (
      <FolderKanban className="h-4 w-4" aria-hidden />
    ) : (
      <Mail className="h-4 w-4" aria-hidden />
    );
  const label = source === 'canvas' ? 'Canvas' : source === 'project' ? 'Project' : 'Email';
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-nightshift-border/60 bg-nightshift-bg/80 text-nightshift-text-secondary"
      title={label}
    >
      {icon}
    </div>
  );
}

export default function TasksTodaySection({ tasks }: { tasks: TodayTask[] }) {
  if (tasks.length === 0) {
    return (
      <section
        className="rounded-2xl border border-nightshift-border/80 bg-nightshift-bg-card/60 p-6 md:p-8"
        aria-labelledby="tasks-today-heading"
      >
        <h2
          id="tasks-today-heading"
          className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted"
        >
          Your tasks today
        </h2>
        <p className="text-sm leading-relaxed text-nightshift-text-secondary">
          You&apos;re caught up here. Connect Canvas, keep projects in progress, or sync Gmail to surface
          deadlines and follow-ups.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="tasks-today-heading">
      <div className="flex items-end justify-between gap-4">
        <h2
          id="tasks-today-heading"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted"
        >
          Your tasks today
        </h2>
        <span className="text-xs text-nightshift-text-muted">{tasks.length} prioritized</span>
      </div>
      <ul className="space-y-3">
        {tasks.map((task) => {
          const u = urgencyStyles(task.urgency);
          return (
            <li
              key={task.id}
              className={`group relative overflow-hidden rounded-xl border border-nightshift-border/70 bg-nightshift-bg-light/40 p-4 transition-colors hover:border-nightshift-accent/25 hover:bg-nightshift-bg-light/70 md:p-5 ${u.ring}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 gap-4">
                  <SourceBadge source={task.source} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${u.badge}`}
                      >
                        {task.urgency}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold leading-snug text-nightshift-text-primary md:text-lg">
                      {task.title}
                    </h3>
                    {task.dueDate && (
                      <p className="mt-1 text-xs text-nightshift-text-muted">
                        Due{' '}
                        {new Date(task.dueDate).toLocaleString(undefined, {
                          weekday: 'short',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    )}
                    {task.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-nightshift-text-secondary">{task.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 border-t border-nightshift-border/50 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:max-w-[min(100%,20rem)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-nightshift-text-muted">
                    Next step
                  </span>
                  <p className="flex items-start gap-1 text-sm leading-snug text-nightshift-text-primary">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-nightshift-accent opacity-80" aria-hidden />
                    <span>{task.suggestedAction}</span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
