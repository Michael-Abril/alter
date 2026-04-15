'use client';

import { useEffect, useState } from 'react';

type ConsistencyIssue = {
  severity: 'error' | 'warn';
  code: string;
  message: string;
};

type ConsistencyPayload = {
  healthy: boolean;
  summary: string;
  focusCount: number;
  handoffCount: number;
  issues: ConsistencyIssue[];
};

export default function DevConsistencyPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConsistencyPayload | null>(null);

  useEffect(() => {
    async function runCheck() {
      try {
        const res = await fetch('/api/internal/dev/consistency', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error || 'Consistency endpoint failed');
        }
        setData(json.data as ConsistencyPayload);
      } catch (e: any) {
        setError(e?.message || 'Failed to run consistency check');
      } finally {
        setLoading(false);
      }
    }
    runCheck();
  }, []);

  return (
    <section className="rounded-xl border border-nightshift-border/60 bg-nightshift-bg-card/40 px-5 py-4 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">
          Dev Consistency
        </p>
        {loading ? (
          <span className="text-xs text-nightshift-text-muted">Checking…</span>
        ) : data?.healthy ? (
          <span className="rounded bg-nightshift-success/15 px-2 py-0.5 text-xs text-nightshift-success">
            Healthy
          </span>
        ) : (
          <span className="rounded bg-nightshift-warning/15 px-2 py-0.5 text-xs text-nightshift-warning">
            Needs attention
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-nightshift-error">{error}</p>
      ) : data ? (
        <>
          <p className="mt-2 text-sm text-nightshift-text-secondary">{data.summary}</p>
          <p className="mt-1 text-xs text-nightshift-text-muted">
            Focus: {data.focusCount} · Handoff: {data.handoffCount}
          </p>
          {data.issues.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs">
              {data.issues.slice(0, 5).map((issue, idx) => (
                <li
                  key={`${issue.code}-${idx}`}
                  className={issue.severity === 'error' ? 'text-nightshift-error' : 'text-nightshift-warning'}
                >
                  {issue.code}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
