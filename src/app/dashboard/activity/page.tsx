/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Activity log view — shows all NightShift actions over time
 * DEPENDENCIES: @clerk/nextjs, components/layout/*
 * STATUS: LIVE — fetches real data from API
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import AppIcon from '@/components/shared/AppIcon';
import { timeAgo } from '@/lib/utils';
import type { Action } from '@/types';
import { Loader2 } from 'lucide-react';
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';

export default function ActivityPage() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'flagged' | 'failed'>('all');

  useEffect(() => {
    async function fetchActions() {
      try {
        const res = await fetch('/api/actions');
        const json = await res.json();
        if (isUserNotFoundResponse(res, json)) {
          router.replace('/onboarding');
          return;
        }
        if (json.success) {
          setActions(Array.isArray(json.data?.actions) ? json.data.actions : []);
        }
      } catch (err) {
        console.error('Failed to fetch actions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActions();
  }, [router]);

  const filteredActions = actions.filter(action => {
    if (filter === 'all') return true;
    return action.status === filter;
  });

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-nightshift-accent" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Activity Log</h1>
              <p className="mt-1 text-nightshift-text-secondary">
                Everything NightShift has done on your behalf.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2">
              {[{label: 'All', value: 'all'}, {label: 'Completed', value: 'completed'}, {label: 'Flagged', value: 'flagged'}, {label: 'Failed', value: 'failed'}].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value as any)}
                  className={`btn-ghost text-sm ${filter === f.value ? 'bg-nightshift-bg-card text-nightshift-text-primary' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Activity List */}
            <div className="space-y-3">
              {filteredActions.length === 0 ? (
                <div className="card text-center py-12">
                  <p className="text-nightshift-text-secondary">
                    No {filter !== 'all' ? filter : ''} actions found.
                  </p>
                </div>
              ) : (
                filteredActions.map((action) => (
                <div
                  key={action.id}
                  className="card flex items-start gap-4 hover:border-nightshift-accent/20 transition-colors"
                >
                  <div className="mt-1">
                    <AppIcon app={action.app} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-nightshift-text-primary truncate">
                        {action.title}
                      </h3>
                      {action.confidence !== null && (
                        <ConfidenceBadge score={action.confidence} />
                      )}
                    </div>
                    {action.description && (
                      <p className="mt-1 text-sm text-nightshift-text-secondary">
                        {action.description}
                      </p>
                    )}
                    {action.metadata && (() => {
                      try {
                        const meta = typeof action.metadata === 'string' ? JSON.parse(action.metadata) : action.metadata;
                        return (
                          <div className="mt-2 space-y-1">
                            {meta.prUrl && (
                              <a
                                href={meta.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-nightshift-success/10 text-nightshift-success hover:bg-nightshift-success/20 transition-colors"
                              >
                                🔗 View Pull Request
                              </a>
                            )}
                            {meta.prSkipReason && (
                              <div className="text-xs text-nightshift-warning">
                                {meta.prSkipReason === 'missing_token' && '⚠ GitHub not connected — connect GitHub in Settings to auto-create PRs'}
                                {meta.prSkipReason === 'missing_default_repo' && '⚠ No default repo set — configure a default repo in Settings'}
                                {meta.prSkipReason?.startsWith('push_failed') && `⚠ GitHub push failed: ${meta.prSkipReason.replace('push_failed: ', '')}`}
                              </div>
                            )}
                            {(meta.filePath || meta.outputPath) && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(meta.filePath || meta.outputPath);
                                    alert('File path copied to clipboard!');
                                  }}
                                  className="text-xs px-2 py-1 rounded bg-nightshift-accent/10 text-nightshift-accent hover:bg-nightshift-accent/20 transition-colors"
                                >
                                  📁 Copy File Path
                                </button>
                                <span className="text-xs text-nightshift-text-muted truncate max-w-md">
                                  {meta.filePath || meta.outputPath}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      } catch (e) {
                        return null;
                      }
                    })()}
                    <div className="mt-2 flex items-center gap-3 text-xs text-nightshift-text-muted">
                      <span>{timeAgo(action.createdAt)}</span>
                      <span
                        className={`capitalize ${
                          action.status === 'completed'
                            ? 'text-nightshift-success'
                            : action.status === 'flagged'
                            ? 'text-nightshift-warning'
                            : 'text-nightshift-error'
                        }`}
                      >
                        {action.status}
                      </span>
                    </div>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
