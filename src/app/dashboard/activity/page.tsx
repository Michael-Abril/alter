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
import { Loader2, Clock, Zap } from 'lucide-react';
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';

interface HandoffStatus {
  state: 'idle' | 'running' | 'completed';
  projectIds?: string[];
  projectsQueued?: number;
  startedAt?: string;
  projectsContinued?: number;
  currentProject?: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all' | 'completed' | 'flagged' | 'failed'>('all');
  const [handoffStatus, setHandoffStatus] = useState<HandoffStatus | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch actions and handoff status in parallel
        const [actionsRes, statusRes] = await Promise.all([
          fetch('/api/actions'),
          fetch('/api/handoff/status'),
        ]);

        const actionsJson = await actionsRes.json();
        if (isUserNotFoundResponse(actionsRes, actionsJson)) {
          router.replace('/onboarding');
          return;
        }
        if (actionsJson.success) {
          setActions(Array.isArray(actionsJson.data?.actions) ? actionsJson.data.actions : []);
        }

        const statusJson = await statusRes.json();
        if (statusJson.success && statusJson.data) {
          setHandoffStatus(statusJson.data);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Poll for status updates every 10 seconds when there's active work
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/handoff/status');
        const json = await res.json();
        if (json.success && json.data) {
          setHandoffStatus(json.data);
        }
      } catch (err) {
        // Silent fail for polling
      }
    }, 10000);

    return () => clearInterval(interval);
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
              <h1 className="font-display text-2xl font-bold tracking-tight text-nightshift-text-primary">
                Activity
              </h1>
              <p className="mt-1 text-sm text-nightshift-text-secondary">
                Everything Alter has done on your behalf.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2">
              {[
                {label: 'Active', value: 'active', showBadge: handoffStatus?.state === 'running'},
                {label: 'All', value: 'all'},
                {label: 'Completed', value: 'completed'},
                {label: 'Flagged', value: 'flagged'},
                {label: 'Failed', value: 'failed'}
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value as typeof filter)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${
                    filter === f.value
                      ? 'bg-nightshift-accent/15 font-medium text-nightshift-text-primary ring-1 ring-nightshift-accent/30'
                      : 'text-nightshift-text-secondary hover:bg-nightshift-bg-card hover:text-nightshift-text-primary'
                  }`}
                >
                  {f.label}
                  {f.showBadge && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nightshift-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-nightshift-accent"></span>
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Active Work Display */}
            {filter === 'active' && (
              <div className="space-y-3">
                {handoffStatus?.state === 'running' ? (
                  <div className="card border-nightshift-accent/30 bg-nightshift-accent/5">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2 rounded-lg bg-nightshift-accent/10">
                        <Zap className="h-5 w-5 text-nightshift-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-nightshift-text-primary">
                            Alter is working...
                          </h3>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nightshift-accent opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-nightshift-accent"></span>
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-nightshift-text-secondary">
                          {handoffStatus.projectsQueued || 1} project{(handoffStatus.projectsQueued || 1) > 1 ? 's' : ''} queued for overnight work
                        </p>
                        {handoffStatus.currentProject && (
                          <p className="mt-1 text-xs text-nightshift-text-muted">
                            Currently: {handoffStatus.currentProject}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-xs text-nightshift-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Started {handoffStatus.startedAt ? timeAgo(handoffStatus.startedAt) : 'recently'}
                          </span>
                          {handoffStatus.projectsContinued !== undefined && handoffStatus.projectsContinued > 0 && (
                            <span className="text-nightshift-success">
                              {handoffStatus.projectsContinued} completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card text-center py-12">
                    <Zap className="h-8 w-8 text-nightshift-text-muted mx-auto mb-3" />
                    <p className="text-nightshift-text-secondary">
                      No active work running
                    </p>
                    <p className="text-sm text-nightshift-text-muted mt-1">
                      Go to Handoff to start Alter&apos;s overnight run
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Activity List */}
            {filter !== 'active' && (
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={`/api/download?path=${encodeURIComponent(meta.filePath || meta.outputPath)}`}
                                  download
                                  className="text-xs px-2 py-1 rounded bg-nightshift-success/10 text-nightshift-success hover:bg-nightshift-success/20 transition-colors"
                                >
                                  Download File
                                </a>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(meta.filePath || meta.outputPath);
                                    alert('File path copied to clipboard!');
                                  }}
                                  className="text-xs px-2 py-1 rounded bg-nightshift-accent/10 text-nightshift-accent hover:bg-nightshift-accent/20 transition-colors"
                                >
                                  Copy Path
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
