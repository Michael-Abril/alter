/**
 * Lists real Action rows from the database (overnight loop, drafts, etc.).
 */

import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import { linkLabel, parseWorkMetadata } from '@/lib/work-destination';

export type AlterActionRow = {
  id: string;
  title: string;
  description: string | null;
  app: string;
  type: string;
  createdAt: string;
  metadata?: string | null;
};

export default function RecentAlterActions({ actions }: { actions: AlterActionRow[] }) {
  if (actions.length === 0) return null;

  return (
    <section className="rounded-xl border border-nightshift-border/60 bg-nightshift-bg-card/40 px-5 py-5 md:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Activity log</p>
      <h2 className="mt-1 font-display text-xl font-bold text-nightshift-text-primary">What Alter did recently</h2>
      <ul className="mt-4 space-y-3">
        {actions.map((a) => (
          (() => {
            const meta = parseWorkMetadata(a.metadata);
            return (
          <li key={a.id} className="rounded-lg border border-nightshift-border/40 bg-nightshift-bg-light/20 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-nightshift-text-primary">{a.title}</span>
              <span className="text-xs text-nightshift-text-muted">{timeAgo(a.createdAt)}</span>
            </div>
            {a.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-nightshift-text-secondary">{a.description}</p>
            ) : null}
            <p className="mt-1 text-[10px] uppercase tracking-wider text-nightshift-text-muted">
              {a.app} · {a.type}
            </p>
            {meta?.externalUrl ? (
              <a
                href={meta.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-nightshift-accent hover:underline"
              >
                {linkLabel(meta)} →
              </a>
            ) : null}
          </li>
            );
          })()
        ))}
      </ul>
      <Link
        href="/dashboard/activity"
        className="mt-4 inline-block text-sm text-nightshift-accent hover:underline"
      >
        View all activity →
      </Link>
    </section>
  );
}
