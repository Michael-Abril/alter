'use client';

import { useState } from 'react';
import { ChevronRight, ChevronUp } from 'lucide-react';
import type { TodayTask } from '@/lib/tasks-today';
import type { WorkBucket } from '@/lib/tasks-focus';

const BUCKET_ORDER: WorkBucket[] = ['school', 'product', 'side'];

const BUCKET_LABEL: Record<WorkBucket, string> = {
  school: 'School',
  product: 'Alter / startup',
  side: 'Side projects & other',
};

function oneLine(task: TodayTask) {
  const d = task.description?.replace(/\s+/g, ' ').trim();
  if (d && d.length > 0) return d.length > 120 ? `${d.slice(0, 117)}…` : d;
  return task.suggestedAction.length > 120 ? `${task.suggestedAction.slice(0, 117)}…` : task.suggestedAction;
}

export default function OtherActiveWork({
  grouped,
}: {
  grouped: Record<WorkBucket, TodayTask[]>;
}) {
  const [open, setOpen] = useState(false);

  const total = BUCKET_ORDER.reduce((n, b) => n + (grouped[b]?.length ?? 0), 0);
  if (total === 0) return null;

  return (
    <section
      className="rounded-2xl border border-nightshift-border/70 bg-gradient-to-br from-nightshift-elevated/25 to-nightshift-bg-card/50 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]"
      aria-label="Other active work"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left transition-colors hover:bg-nightshift-bg-light/30 md:px-5"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Elsewhere</p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-nightshift-text-primary md:text-xl">
            Other active work
          </h2>
          <p className="mt-0.5 text-xs text-nightshift-text-muted">
            {total} item{total !== 1 ? 's' : ''} — lower priority; safe to ignore for now. Collapsed by default.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm text-nightshift-highlight">
          {open ? (
            <>
              Hide <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show <ChevronRight className="h-4 w-4" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-nightshift-border/60 px-4 pb-5 pt-2 md:px-5">
          {BUCKET_ORDER.map((bucket) => {
            const list = grouped[bucket] ?? [];
            if (list.length === 0) return null;
            return (
              <div key={bucket}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-nightshift-navy/90">
                  {BUCKET_LABEL[bucket]}
                </h3>
                <ul className="space-y-2">
                  {list.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-nightshift-border/60 bg-nightshift-bg-light/30 px-3 py-2.5 text-sm transition-colors hover:border-nightshift-accent/25 hover:bg-nightshift-bg-light/50"
                    >
                      <span className="font-medium text-nightshift-text-primary">{t.title}</span>
                      <span className="mx-2 text-nightshift-text-muted">·</span>
                      <span className="text-nightshift-text-secondary">{oneLine(t)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
