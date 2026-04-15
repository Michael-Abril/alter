/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Draft review — overnight drafts from Alter
 * DEPENDENCIES: @clerk/nextjs, components/layout/*
 * STATUS: LIVE — real draft review with approve/edit/reject actions
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import {
  BookOpen,
  CheckCircle2,
  Code,
<<<<<<< HEAD
  Download,
=======
>>>>>>> origin/main
  Edit3,
  FileEdit,
  FileText,
  Hash,
  Lightbulb,
  Loader2,
  Mail,
  XCircle,
} from 'lucide-react';
<<<<<<< HEAD
import { DraftChat } from '@/components/drafts/DraftChat';
=======
>>>>>>> origin/main
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';

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
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDrafts();
  }, [router]);

  async function fetchDrafts() {
    try {
<<<<<<< HEAD
      const res = await fetch('/api/drafts');
=======
      const res = await fetch('/api/drafts?status=pending');
>>>>>>> origin/main
      const json = await res.json();
      if (isUserNotFoundResponse(res, json)) {
        router.replace('/onboarding');
        return;
      }
      if (json.success) {
        setDrafts(Array.isArray(json.data) ? json.data : []);
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
      if (isUserNotFoundResponse(res, json)) {
        router.replace('/onboarding');
        return;
      }
      if (!res.ok) {
        throw new Error(json.error || 'Action failed');
      }

      const data = json.data;
      if (data?.gmailDraftUrl) {
        setError(`Draft approved! Open in Gmail: ${data.gmailDraftUrl}`);
      } else if (data?.errorCode) {
        const messages: Record<string, string> = {
          GMAIL_NOT_CONNECTED: 'Draft approved. To create Gmail drafts, connect Gmail in Settings.',
          GMAIL_API_NOT_ENABLED: 'Draft approved. Enable the Gmail API in your Google Cloud Console, then retry.',
          GMAIL_SEND_FAILED: `Draft approved but Gmail draft failed: ${data.message || 'unknown error'}`,
        };
        setError(messages[data.errorCode] || data.message || 'Draft approved with warnings.');
      }

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

  function DraftTypeIcon({ type }: { type: string }) {
<<<<<<< HEAD
    const cls = 'h-5 w-5 shrink-0 text-nightshift-highlight';
=======
    const cls = 'h-5 w-5 shrink-0 text-alter-gold-light';
>>>>>>> origin/main
    switch (type) {
      case 'email':
        return <Mail className={cls} strokeWidth={1.75} aria-hidden />;
      case 'doc':
        return <FileText className={cls} strokeWidth={1.75} aria-hidden />;
      case 'code':
        return <Code className={cls} strokeWidth={1.75} aria-hidden />;
      case 'task':
        return <CheckCircle2 className={cls} strokeWidth={1.75} aria-hidden />;
      default:
        return <FileEdit className={cls} strokeWidth={1.75} aria-hidden />;
    }
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

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center justify-center py-12">
<<<<<<< HEAD
                <Loader2 className="h-8 w-8 animate-spin text-nightshift-accent" />
=======
                <Loader2 className="h-8 w-8 animate-spin text-alter-primary" />
>>>>>>> origin/main
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
<<<<<<< HEAD
              <h1 className="font-display text-2xl font-bold tracking-tight text-nightshift-text-primary">
                Draft review
              </h1>
              <p className="mt-1 text-sm text-nightshift-text-secondary">
=======
              <h1 className="font-display text-2xl font-bold tracking-tight text-alter-text">
                Draft review
              </h1>
              <p className="mt-1 text-sm text-alter-text-secondary">
>>>>>>> origin/main
                Review and approve drafts Alter created for you — often after a handoff run.
              </p>
            </div>

            {error && (
              <div className={`card ${error.startsWith('Draft approved') ? 'border-nightshift-success/50' : 'border-nightshift-error/50'}`}>
                {error.includes('Open in Gmail:') ? (
                  <div className="text-sm text-nightshift-success">
                    <span>Draft approved! </span>
                    <a
                      href={error.split('Open in Gmail: ')[1]}
                      target="_blank"
                      rel="noopener noreferrer"
<<<<<<< HEAD
                      className="underline hover:text-nightshift-accent transition-colors"
=======
                      className="underline hover:text-alter-primary transition-colors"
>>>>>>> origin/main
                    >
                      Open in Gmail →
                    </a>
                  </div>
                ) : (
                  <p className={`text-sm ${error.startsWith('Draft approved') ? 'text-nightshift-warning' : 'text-nightshift-error'}`}>{error}</p>
                )}
              </div>
            )}

            {drafts.length === 0 ? (
              <div className="card py-12 text-center">
<<<<<<< HEAD
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-nightshift-border bg-nightshift-bg-light text-nightshift-highlight">
                  <FileEdit className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold text-nightshift-text-primary">
                  No drafts yet
                </h2>
                <p className="mt-2 text-nightshift-text-secondary">
=======
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-alter-border bg-alter-surface text-alter-gold-light">
                  <FileEdit className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                </div>
                <h2 className="text-lg font-semibold text-alter-text">
                  No drafts yet
                </h2>
                <p className="mt-2 text-alter-text-secondary">
>>>>>>> origin/main
                  Run Handoff from the Handoff page, then check Draft review or Activity.
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
                          <DraftTypeIcon type={draft.type} />
                          <div>
<<<<<<< HEAD
                            <h3 className="font-semibold text-nightshift-text-primary">
                              {draft.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-nightshift-text-muted">
                                {new Date(draft.createdAt).toLocaleString()}
                              </span>
                              <span className="text-xs text-nightshift-text-muted">•</span>
                              <span className="text-xs text-nightshift-text-muted capitalize">
=======
                            <h3 className="font-semibold text-alter-text">
                              {draft.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-alter-muted">
                                {new Date(draft.createdAt).toLocaleString()}
                              </span>
                              <span className="text-xs text-alter-muted">•</span>
                              <span className="text-xs text-alter-muted capitalize">
>>>>>>> origin/main
                                {draft.type} for {draft.targetApp}
                              </span>
                            </div>
                          </div>
                        </div>
                        {getConfidenceBadge(draft.confidenceScore)}
                      </div>

                      {/* Content */}
                      {isEditing ? (
<<<<<<< HEAD
                        <>
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="input w-full h-64 resize-none font-mono text-sm mb-4"
                            disabled={isActionLoading}
                          />
                          <DraftChat
                            draftId={draft.id}
                            draftContent={editedContent}
                            onContentUpdate={(newContent) => setEditedContent(newContent)}
                          />
                        </>
                      ) : (
                        <div className="bg-nightshift-bg-light rounded-lg p-4 mb-4">
                          <pre className="whitespace-pre-wrap text-sm text-nightshift-text-primary font-sans">
=======
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="input w-full h-64 resize-none font-mono text-sm"
                          disabled={isActionLoading}
                        />
                      ) : (
                        <div className="bg-alter-surface rounded-lg p-4 mb-4">
                          <pre className="whitespace-pre-wrap text-sm text-alter-text font-sans">
>>>>>>> origin/main
                            {draft.content}
                          </pre>
                        </div>
                      )}

                      {/* Context Info */}
                      {draft.context && (
<<<<<<< HEAD
                        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-nightshift-text-muted">
                          {draft.context.retrievedSources > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5 text-nightshift-text-muted" strokeWidth={1.75} aria-hidden />
=======
                        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-alter-muted">
                          {draft.context.retrievedSources > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5 text-alter-muted" strokeWidth={1.75} aria-hidden />
>>>>>>> origin/main
                              {draft.context.retrievedSources} sources
                            </span>
                          )}
                          {draft.context.tokensUsed && (
                            <span className="inline-flex items-center gap-1">
<<<<<<< HEAD
                              <Hash className="h-3.5 w-3.5 text-nightshift-text-muted" strokeWidth={1.75} aria-hidden />
=======
                              <Hash className="h-3.5 w-3.5 text-alter-muted" strokeWidth={1.75} aria-hidden />
>>>>>>> origin/main
                              {draft.context.tokensUsed} tokens
                            </span>
                          )}
                          {draft.context.recommendation && (
                            <span className="inline-flex items-center gap-1 capitalize">
<<<<<<< HEAD
                              <Lightbulb className="h-3.5 w-3.5 text-nightshift-text-muted" strokeWidth={1.75} aria-hidden />
=======
                              <Lightbulb className="h-3.5 w-3.5 text-alter-muted" strokeWidth={1.75} aria-hidden />
>>>>>>> origin/main
                              {draft.context.recommendation.replace(/_/g, ' ')}
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
<<<<<<< HEAD
                            <a
                              href={`/api/drafts/${draft.id}/download?format=docx`}
                              download
                              className="btn-ghost flex items-center gap-2 ml-auto"
                            >
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </a>
=======
>>>>>>> origin/main
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
