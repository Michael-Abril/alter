/**
 * Handoff project picks — “Recommended” (max 3, pre-selected) + collapsed “Other work”.
 */

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AppIcon from '@/components/shared/AppIcon';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import type { HandoffTask } from '@/types';
import { MAX_HANDOFF_RECOMMENDED } from '@/lib/handoff-recommended';

interface UnfinishedWorkProps {
  tasks: HandoffTask[];
  onToggleTask: (taskId: string) => void;
}

export default function UnfinishedWork({ tasks, onToggleTask }: UnfinishedWorkProps) {
  const [otherOpen, setOtherOpen] = useState(false);

  const recommended = tasks.filter((t) => t.tier === 'recommended').slice(0, MAX_HANDOFF_RECOMMENDED);
  const other = tasks.filter((t) => t.tier === 'other');

  return (
    <div className="space-y-4">
      <section
        className="relative overflow-hidden rounded-2xl border border-alter-border bg-gradient-to-br from-alter-surface-elevated/35 via-alter-surface to-alter-bg p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_48px_-24px_rgba(0,0,0,0.65)] md:p-6"
        aria-labelledby="handoff-recommended-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_0%_0%,rgba(212,167,68,0.08),transparent_55%)]"
          aria-hidden
        />
        <div className="relative">
          <h2
            id="handoff-recommended-heading"
            className="font-display text-base font-semibold tracking-tight text-alter-text md:text-lg"
          >
            Alter will handle
          </h2>
          <p className="mt-1 text-xs text-alter-muted">
            Top 2–3 items — projects and Canvas assignments Alter can advance overnight.
          </p>
          <div className="mt-4 space-y-2">
            {recommended.map((task) => (
              <HandoffRow key={task.id} task={task} onToggle={onToggleTask} emphasized />
            ))}
          </div>
        </div>
      </section>

      {other.length > 0 && (
        <section className="rounded-2xl border border-alter-border/80 bg-alter-surface/50 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
          <button
            type="button"
            onClick={() => setOtherOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left transition-colors hover:bg-alter-surface/25 md:px-5"
            aria-expanded={otherOpen}
          >
            <div>
              <h2 className="font-display text-base font-semibold text-alter-text">Other work</h2>
              <p className="mt-0.5 text-xs text-alter-muted">{other.length} more</p>
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-alter-muted transition-transform ${otherOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
          {otherOpen && (
            <div className="space-y-2 border-t border-alter-border/60 px-4 pb-4 pt-2 md:px-5">
              {other.map((task) => (
                <HandoffRow key={task.id} task={task} onToggle={onToggleTask} emphasized={false} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function HandoffRow({
  task,
  onToggle,
  emphasized,
}: {
  task: HandoffTask;
  onToggle: (id: string) => void;
  emphasized: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      className={`w-full rounded-xl border text-left transition-all duration-200 ${
        task.selected
          ? emphasized
            ? 'border-alter-primary/40 bg-alter-bg/80 shadow-alter-gold-sm hover:-translate-y-0.5'
            : 'border-alter-primary/35 bg-alter-primary/5'
          : 'border-alter-border hover:border-alter-muted hover:bg-alter-surface/20'
      } flex items-start gap-3 p-3 md:p-4`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
          task.selected ? 'border-alter-primary bg-alter-primary' : 'border-alter-muted'
        }`}
      >
        {task.selected && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <AppIcon app={task.app} />
          <span className="truncate text-sm font-medium text-alter-text">{task.title}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-alter-text-secondary">{task.description}</p>
        <div className="mt-1.5">
          <ConfidenceBadge score={task.estimatedConfidence} size="sm" />
        </div>
      </div>
    </button>
  );
}
