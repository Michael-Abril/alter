/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Draft review page — morning review screen for NightShift's overnight drafts
 * DEPENDENCIES: @clerk/nextjs, components/layout/*
 * STATUS: LIVE — real draft review with approve/edit/reject actions
 */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { CheckCircle2, XCircle, Edit3, Loader2 } from 'lucide-react';

interface Draft {
  id: string;
  type: string;
  title: string;
  content: string;
  targetApp: string;
  confidenceScore: number;
  status: string;
  context: any;
  createdAt: string;
  updatedAt: string;
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    try {
      const res = await fetch('/api/drafts');
      const json = await res.json();
      if (json.success) {
        setDrafts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      setError('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(draftId: string, action: 'approved' | 'rejected', content?: string) {
    setActionLoading(draftId);
    setError('');
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action,
          content: content || undefined,
          rejectionReason: action === 'rejected' ? 'User rejected draft' : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Action failed');
      }

      // Remove draft from list after successful action
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setEditingId(null);
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  function startEdit(draft: Draft) {
    setEditingId(draft.id);
    setEditedContent(draft.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditedContent('');
  }

  function getConfidenceBadge(score: number) {
    const percentage = Math.round(score * 100);
    let colorClass = 'bg-nightshift-error/20 text-nightshift-error';
    if (score >= 0.85) {
      colorClass = 'bg-nightshift-success/20 text-nightshift-success';
    } else if (score >= 0.6) {
      colorClass = 'bg-nightshift-warning/20 text-nightshift-warning';
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {percentage}% confidence
      </span>
    );
  }

  function getTypeIcon(type: string) {
    const icons: Record<string, string> = {
      email: '📧',
      doc: '📄',
      code: '💻',
      task: '✅',
    };
    return icons[type] || '📝';
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-5xl">
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
          <div className="mx-auto max-w-5xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Draft Review</h1>
              <p className="mt-1 text-nightshift-text-secondary">
                Review and approve drafts created by NightShift overnight.
              </p>
            </div>

            {error && (
              <div className="card border-nightshift-error/50">
                <p className="text-sm text-nightshift-error">{error}</p>
              </div>
            )}

            {drafts.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-4xl mb-4">🌙</div>
                <h2 className="text-lg font-semibold text-nightshift-text-primary">
                  No drafts yet
                </h2>
                <p className="mt-2 text-nightshift-text-secondary">
                  Activate NightShift from the Handoff page and check back in the morning.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => {
                  const isEditing = editingId === draft.id;
                  const isActionLoading = actionLoading === draft.id;

                  return (
                    <div key={draft.id} className="card">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getTypeIcon(draft.type)}</span>
                          <div>
                            <h3 className="font-semibold text-nightshift-text-primary">
                              {draft.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-nightshift-text-muted">
                                {new Date(draft.createdAt).toLocaleString()}
                              </span>
                              <span className="text-xs text-nightshift-text-muted">•</span>
                              <span className="text-xs text-nightshift-text-muted capitalize">
                                {draft.type} for {draft.targetApp}
                              </span>
                            </div>
                          </div>
                        </div>
                        {getConfidenceBadge(draft.confidenceScore)}
                      </div>

                      {/* Content */}
                      {isEditing ? (
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="input w-full h-64 resize-none font-mono text-sm"
                          disabled={isActionLoading}
                        />
                      ) : (
                        <div className="bg-nightshift-bg-light rounded-lg p-4 mb-4">
                          <pre className="whitespace-pre-wrap text-sm text-nightshift-text-primary font-sans">
                            {draft.content}
                          </pre>
                        </div>
                      )}

                      {/* Context Info */}
                      {draft.context && (
                        <div className="text-xs text-nightshift-text-muted mb-4 flex items-center gap-3">
                          {draft.context.retrievedSources > 0 && (
                            <span>📚 {draft.context.retrievedSources} sources</span>
                          )}
                          {draft.context.tokensUsed && (
                            <span>🔢 {draft.context.tokensUsed} tokens</span>
                          )}
                          {draft.context.recommendation && (
                            <span className="capitalize">
                              💡 {draft.context.recommendation.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleAction(draft.id, 'approved', editedContent)}
                              disabled={isActionLoading}
                              className="btn-primary flex items-center gap-2"
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              <span>Approve Edited</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={isActionLoading}
                              className="btn-ghost"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleAction(draft.id, 'approved')}
                              disabled={isActionLoading}
                              className="btn-primary flex items-center gap-2"
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => startEdit(draft)}
                              disabled={isActionLoading}
                              className="btn-ghost flex items-center gap-2"
                            >
                              <Edit3 className="h-4 w-4" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleAction(draft.id, 'rejected')}
                              disabled={isActionLoading}
                              className="btn-ghost text-nightshift-error hover:bg-nightshift-error/10 flex items-center gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
