'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'alter_completion_banner_dismissed_id';

export default function DashboardCompletionBanner({
  bannerId,
  message,
}: {
  /** Change when new work completes so banner can show again */
  bannerId: string;
  message: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY);
      if (dismissed !== bannerId) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [bannerId]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, bannerId);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, [bannerId]);

  if (!visible) return null;

  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-nightshift-border bg-[#0f1419] px-4 py-3 md:px-5">
      <p className="text-sm font-medium text-teal-400/95">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-nightshift-text-muted transition-colors hover:bg-white/5 hover:text-nightshift-text-primary"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
