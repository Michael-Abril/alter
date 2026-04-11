/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Items that Alter flagged for user review (low confidence or sensitive)
 * DEPENDENCIES: @/types, @/components/shared/*
 * STATUS: Scaffold — needs real data and action buttons
 */

import AppIcon from '@/components/shared/AppIcon';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import { timeAgo } from '@/lib/utils';
import type { Action } from '@/types';

interface FlaggedItemsProps {
  items: Action[];
}

export default function FlaggedItems({ items }: FlaggedItemsProps) {
  return (
    <div className="card border-nightshift-warning/20">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-warning">
        Needs Your Review
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-nightshift-warning/20 bg-nightshift-bg-light p-3"
          >
            <div className="flex items-start gap-3">
              <AppIcon app={item.app} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-nightshift-text-primary">
                    {item.title}
                  </span>
                  {item.confidence !== null && (
                    <ConfidenceBadge score={item.confidence} size="sm" />
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-xs text-nightshift-text-secondary">
                    {item.description}
                  </p>
                )}
                <span className="mt-1 block text-xs text-nightshift-text-muted">
                  {timeAgo(item.createdAt)}
                </span>
              </div>
            </div>
            {/* TODO: Person 4 — Add Review / Dismiss action buttons */}
            <div className="mt-3 flex gap-2 pl-9">
              <button className="btn-primary text-xs px-3 py-1">Review</button>
              <button className="btn-ghost text-xs px-3 py-1">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
