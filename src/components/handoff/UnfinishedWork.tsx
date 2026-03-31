/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: List of detected unfinished tasks the user can select for NightShift handoff
 * DEPENDENCIES: @/types, @/components/shared/*
 * STATUS: Scaffold — needs real data
 */

import AppIcon from '@/components/shared/AppIcon';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import type { HandoffTask } from '@/types';

interface UnfinishedWorkProps {
  tasks: HandoffTask[];
  onToggleTask: (taskId: string) => void;
}

export default function UnfinishedWork({ tasks, onToggleTask }: UnfinishedWorkProps) {
  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
        Detected Unfinished Work
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onToggleTask(task.id)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              task.selected
                ? 'border-nightshift-accent bg-nightshift-accent/5'
                : 'border-nightshift-border hover:border-nightshift-text-muted'
            }`}
          >
            {/* Checkbox */}
            <div
              className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                task.selected
                  ? 'border-nightshift-accent bg-nightshift-accent'
                  : 'border-nightshift-text-muted'
              }`}
            >
              {task.selected && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <AppIcon app={task.app} />
                <span className="text-sm font-medium text-nightshift-text-primary truncate">
                  {task.title}
                </span>
              </div>
              <p className="mt-1 text-xs text-nightshift-text-secondary line-clamp-2">
                {task.description}
              </p>
              <div className="mt-1.5">
                <ConfidenceBadge score={task.estimatedConfidence} size="sm" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
