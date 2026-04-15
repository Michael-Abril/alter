/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Activity log — actions Alter took on your behalf
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
import { linkLabel, parseWorkMetadata } from '@/lib/work-destination';

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
                <Loader2 className="h-8 w-8 animate-spin text-alter-primary" />
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
              <h1 className="font-display text-2xl font-bold tracking-tight text-alter-text">
                Activity
              </h1>
              <p className="mt-1 text-sm text-alter-text-secondary">
                Everything Alter has done on your behalf.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2">
              {[{label: 'All', value: 'all'}, {label: 'Completed', value: 'completed'}, {label: 'Flagged', value: 'flagged'}, {label: 'Failed', value: 'failed'}].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value as any)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    filter === f.value
                      ? 'bg-alter-primary/15 font-medium text-alter-text ring-1 ring-alter-primary/30'
                      : 'text-alter-text-secondary hover:bg-alter-surface hover:text-alter-text'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Activity List */}
            <div className="space-y-3">
              {filteredActions.length === 0 ? (
                <div className="card text-center py-12">
                  <p className="text-alter-text-secondary">
                    No {filter !== 'all' ? filter : ''} actions found.
                  </p>
                </div>
              ) : (
                filteredActions.map((action) => (
                <div
                  key={action.id}
                  className="card flex items-start gap-4 hover:border-alter-primary/20 transition-colors"
                >
                  <div className="mt-1">
                    <AppIcon app={action.app} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-alter-text truncate">
                        {action.title}
                      </h3>
                      {action.confidence !== null && (
                        <ConfidenceBadge score={action.confidence} />
                      )}
                    </div>
                    {action.description && (
                      <p className="mt-1 text-sm text-alter-text-secondary">
                        {action.description}
                      </p>
                    )}
                    {(() => {
                      const meta = parseWorkMetadata(action.metadata);
                      if (!meta) return null;
                      const prSkip =
                        typeof meta.prSkipReason === 'string' ? meta.prSkipReason : '';
                      const outputFsPath =
                        typeof meta.filePath === 'string'
                          ? meta.filePath
                          : typeof meta.outputPath === 'string'
                            ? meta.outputPath
                            : '';
                      const destinationStatus =
                        typeof meta.destinationStatus === 'string' ? meta.destinationStatus : '';
                      const destinationNote =
                        typeof meta.destinationNote === 'string' ? meta.destinationNote : '';
                      return (
                        <div className="mt-2 space-y-1">
                          {meta.externalUrl ? (
                            <a
                              href={meta.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-nightshift-success/10 text-nightshift-success hover:bg-nightshift-success/20 transition-colors"
                            >
                              🔗 {linkLabel(meta)}
                            </a>
                          ) : null}
                          {typeof meta.submissionUrl === 'string' && meta.submissionUrl.length > 0 ? (
                            <a
                              href={meta.submissionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-alter-primary/10 text-alter-primary hover:bg-alter-primary/20 transition-colors"
                            >
                              Open submission
                            </a>
                          ) : null}
                          {prSkip ? (
                            <div className="text-xs text-nightshift-warning">
                              {prSkip === 'missing_token' && 'GitHub not connected — connect GitHub in Settings.'}
                              {prSkip === 'missing_default_repo' && 'No default repo configured in Settings.'}
                              {prSkip.startsWith('push_failed') &&
                                `GitHub push failed: ${prSkip.replace('push_failed: ', '')}`}
                            </div>
                          ) : null}
                          {outputFsPath ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(outputFsPath);
                                }}
                                className="text-xs px-2 py-1 rounded bg-alter-primary/10 text-alter-primary hover:bg-alter-primary/20 transition-colors"
                              >
                                Copy File Path
                              </button>
                              <span className="text-xs text-alter-muted truncate max-w-md">
                                {outputFsPath}
                              </span>
                            </div>
                          ) : null}
                          {destinationStatus === 'local_fallback' ? (
                            <div className="text-xs text-alter-muted">
                              Saved locally for this run. Connect/reconnect Google Drive to restore Open Document links.
                              {destinationNote ? ` (${destinationNote})` : ''}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                    <div className="mt-2 flex items-center gap-3 text-xs text-alter-muted">
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
