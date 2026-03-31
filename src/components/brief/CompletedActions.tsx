/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: List of actions NightShift completed overnight
 * DEPENDENCIES: @/types, @/components/shared/*
 * STATUS: Scaffold — needs real data
 */

import AppIcon from '@/components/shared/AppIcon';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import { timeAgo } from '@/lib/utils';
import type { Action } from '@/types';

interface CompletedActionsProps {
  actions: Action[];
}

export default function CompletedActions({ actions }: CompletedActionsProps) {
  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
        Completed Overnight
      </h2>
      <div className="space-y-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex items-start gap-3 rounded-lg bg-nightshift-bg-light p-3"
          >
            <AppIcon app={action.app} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-nightshift-text-primary truncate">
                  {action.title}
                </span>
                {action.confidence !== null && (
                  <ConfidenceBadge score={action.confidence} size="sm" />
                )}
              </div>
              {action.description && (
                <p className="mt-0.5 text-xs text-nightshift-text-muted">
                  {action.description}
                </p>
              )}
              <span className="mt-1 block text-xs text-nightshift-text-muted">
                {timeAgo(action.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
