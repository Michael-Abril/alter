/**
 * PURPOSE: Session/working status indicator (placeholder until live backend wiring)
 */

'use client';

import { useState } from 'react';

type SessionStatus = 'active' | 'sleeping' | 'working';

const statusConfig: Record<SessionStatus, { label: string; color: string; pulse: boolean }> = {
  active: { label: 'Active — monitoring', color: 'bg-nightshift-success', pulse: true },
  sleeping: { label: 'Idle', color: 'bg-nightshift-text-muted', pulse: false },
  working: { label: 'Working…', color: 'bg-nightshift-accent', pulse: true },
};

export default function StatusIndicator() {
  const [status] = useState<SessionStatus>('active');
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 rounded-full border border-nightshift-border bg-nightshift-bg-card px-3 py-1.5 shadow-sm">
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-xs text-nightshift-text-secondary">{config.label}</span>
    </div>
  );
}
