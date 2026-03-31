/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Active/Sleep mode toggle — shows NightShift's current status
 * DEPENDENCIES: None
 * STATUS: Scaffold — needs real status from backend
 */

'use client';

import { useState } from 'react';

type NightShiftStatus = 'active' | 'sleeping' | 'working';

const statusConfig: Record<NightShiftStatus, { label: string; color: string; pulse: boolean }> = {
  active: { label: 'Active — Monitoring', color: 'bg-nightshift-success', pulse: true },
  sleeping: { label: 'Sleeping', color: 'bg-nightshift-text-muted', pulse: false },
  working: { label: 'Working...', color: 'bg-nightshift-accent', pulse: true },
};

export default function StatusIndicator() {
  // TODO: Person 4 — Replace with real status from backend/websocket
  const [status] = useState<NightShiftStatus>('active');
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 rounded-full border border-nightshift-border bg-nightshift-bg-card px-3 py-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-xs text-nightshift-text-secondary">{config.label}</span>
    </div>
  );
}
