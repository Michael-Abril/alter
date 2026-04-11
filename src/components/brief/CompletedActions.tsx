/**
 * Recently completed deliverables — kind badges match Today’s Focus.
 */

import { ProjectKindBadge } from '@/components/dashboard/ProjectKindBadge';
import type { DisplayKind } from '@/lib/project-deliverable';
import { timeAgo } from '@/lib/utils';

export type CompletedDeliverableItem = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  kind: DisplayKind;
};

export default function CompletedActions({ actions }: { actions: CompletedDeliverableItem[] }) {
  return (
    <div className="rounded-xl border border-nightshift-border bg-nightshift-bg-card/50 p-5 md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Recently completed</p>
      <h2 className="mt-1 font-display text-xl font-bold text-nightshift-text-primary md:text-2xl">Deliverables done</h2>
      <div className="mt-5 space-y-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex items-start gap-3 rounded-lg border border-nightshift-border/50 bg-nightshift-bg-light/20 p-3 transition-colors hover:border-nightshift-border"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ProjectKindBadge kind={action.kind} />
                <span className="text-sm font-semibold text-nightshift-text-primary">{action.title}</span>
              </div>
              {action.description && (
                <p className="mt-1 line-clamp-2 text-xs text-nightshift-text-muted">{action.description}</p>
              )}
              <span className="mt-1 block text-xs text-nightshift-text-muted">{timeAgo(action.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
