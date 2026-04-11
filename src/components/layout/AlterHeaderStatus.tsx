'use client';

import { useCallback, useEffect, useState } from 'react';

type Payload = {
  daemonRunning: boolean;
  completedRecent: number;
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

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 25000);
    return () => clearInterval(id);
  }, [refresh]);

  const completed = data?.completedRecent ?? 0;
  const daemonRunning = data?.daemonRunning ?? false;

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

  if (daemonRunning) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-nightshift-border bg-nightshift-bg-card px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.45)]" aria-hidden />
        <span className="text-xs font-medium text-cyan-200/90">Monitoring your work</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-nightshift-border/80 bg-nightshift-bg-card/80 px-3 py-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-nightshift-text-muted/80" aria-hidden />
      <span className="text-xs font-medium text-nightshift-text-secondary">Ready when you step away</span>
    </div>
  );
}
