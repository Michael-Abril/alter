'use client';

import { useCallback, useEffect, useState } from 'react';

type Payload = {
  daemonRunning: boolean;
  completedRecent: number;
  alterWorking?: boolean;
  alterStatus?: string;
};

export default function AlterHeaderStatus() {
  const [data, setData] = useState<Payload | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/header-status', { cache: 'no-store' });
      const json = (await res.json()) as { success?: boolean; data?: Payload };
      if (json.success && json.data) setData(json.data);
      else setData({ daemonRunning: false, completedRecent: 0 });
    } catch {
      setData({ daemonRunning: false, completedRecent: 0 });
    }
  }, []);

  const alterWorking = data?.alterWorking ?? false;

  useEffect(() => {
    void refresh();
    // Poll more frequently (5s) when Alter might be working
    const pollInterval = alterWorking ? 5000 : 25000;
    const id = setInterval(() => void refresh(), pollInterval);
    return () => clearInterval(id);
  }, [refresh, alterWorking]);

  const completed = data?.completedRecent ?? 0;
  const daemonRunning = data?.daemonRunning ?? false;
  const alterStatus = data?.alterStatus ?? '';

  // Alter is actively working on handoff tasks - highest priority
  if (alterWorking) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.6)]" aria-hidden />
        <span className="text-xs font-medium text-violet-200">Alter is working...</span>
      </div>
    );
  }

  // Recently completed tasks
  if (completed > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" aria-hidden />
        <span className="text-xs font-medium text-emerald-300">
          Alter completed {completed} task{completed !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  // Daemon monitoring in background
  if (daemonRunning) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-nightshift-border bg-nightshift-bg-card px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.45)]" aria-hidden />
        <span className="text-xs font-medium text-cyan-200/90">Monitoring your work</span>
      </div>
    );
  }

  // Default idle state
  return (
    <div className="flex items-center gap-2 rounded-full border border-nightshift-border/80 bg-nightshift-bg-card/80 px-3 py-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-nightshift-text-muted/80" aria-hidden />
      <span className="text-xs font-medium text-nightshift-text-secondary">Ready when you step away</span>
    </div>
  );
}
