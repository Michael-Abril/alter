'use client';

import { useCallback, useEffect, useState } from 'react';

type DaemonPayload = { running?: boolean; message?: string };

export default function DaemonStatus() {
  const [running, setRunning] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/daemon/status', { cache: 'no-store' });
      const json = (await res.json()) as { success?: boolean; data?: DaemonPayload };
      if (json.success && json.data && typeof json.data.running === 'boolean') {
        setRunning(json.data.running);
      } else {
        setRunning(false);
      }
    } catch {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const isLive = running === true;
  const label = running === null ? 'Checking…' : isLive ? 'Active — monitoring' : 'Idle';

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-nightshift-border bg-nightshift-bg-card px-3 py-1.5 shadow-sm"
      title="Alter background daemon"
    >
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
          running === null
            ? 'bg-nightshift-text-muted'
            : isLive
              ? 'bg-nightshift-success shadow-[0_0_8px_rgba(16,185,129,0.55)]'
              : 'bg-nightshift-text-muted'
        } ${isLive ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      <span
        className={`text-xs font-medium ${
          isLive ? 'text-nightshift-success' : 'text-nightshift-text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
