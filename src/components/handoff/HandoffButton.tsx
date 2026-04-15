/**
 * Primary Handoff CTA — run Alter on selected work while you’re away.
 */

import { Sparkles } from 'lucide-react';

interface HandoffButtonProps {
  selectedCount: number;
  onActivate: () => void;
  disabled?: boolean;
}

export default function HandoffButton({ selectedCount, onActivate, disabled }: HandoffButtonProps) {
  const isDisabled = selectedCount === 0 || !!disabled;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-alter-border bg-gradient-to-r from-alter-surface/95 to-alter-surface-elevated/30 p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-alter-text-secondary">
          {selectedCount > 0
            ? `${selectedCount} item${selectedCount > 1 ? 's' : ''} selected — Alter will continue these while you’re away`
            : 'Select at least one project or Canvas assignment above'}
        </p>
      </div>
      <button
        type="button"
        onClick={onActivate}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
          isDisabled
            ? 'cursor-not-allowed bg-alter-surface text-alter-muted'
            : 'bg-alter-primary text-alter-bg shadow-alter-gold-lg hover:bg-alter-gold-light hover:-translate-y-0.5 active:scale-[0.97]'
        }`}
      >
        <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
        <span>Start handoff</span>
      </button>
    </div>
  );
}
