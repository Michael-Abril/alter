/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Draft review component — approve, edit, or reject a NightShift-generated draft
 * DEPENDENCIES: @/types, @/components/shared/*
 * STATUS: Scaffold — needs real draft data and action handlers
 */

'use client';

import { useState } from 'react';
import ConfidenceBadge from '@/components/shared/ConfidenceBadge';
import AppIcon from '@/components/shared/AppIcon';
import type { Draft } from '@/types';

interface DraftReviewProps {
  draft: Draft;
  onApprove: (draftId: string) => void;
  onReject: (draftId: string) => void;
  onEdit: (draftId: string, newContent: string) => void;
}

export default function DraftReview({ draft, onApprove, onReject, onEdit }: DraftReviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(draft.content);

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AppIcon app={draft.targetApp} />
          <div>
            <h3 className="font-medium text-nightshift-text-primary">{draft.title}</h3>
            <span className="text-xs text-nightshift-text-muted capitalize">{draft.type}</span>
          </div>
        </div>
        <ConfidenceBadge score={draft.confidenceScore} />
      </div>

      {/* Content */}
      <div className="mb-4">
        {isEditing ? (
          <textarea
            className="input w-full h-48 resize-y font-mono text-sm"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
          />
        ) : (
          <div className="rounded-lg bg-nightshift-bg-light p-4 text-sm text-nightshift-text-primary whitespace-pre-wrap">
            {draft.content}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onApprove(draft.id)}
          className="btn-primary text-sm"
        >
          Approve & Send
        </button>
        {isEditing ? (
          <>
            <button
              onClick={() => {
                onEdit(draft.id, editedContent);
                setIsEditing(false);
              }}
              className="btn-secondary text-sm"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setEditedContent(draft.content);
                setIsEditing(false);
              }}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-secondary text-sm"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onReject(draft.id)}
          className="btn-ghost text-sm text-nightshift-error hover:text-nightshift-error ml-auto"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
