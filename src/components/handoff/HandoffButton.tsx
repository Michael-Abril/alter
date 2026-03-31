/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: "Activate NightShift" button — submits handoff selections
 * DEPENDENCIES: None
 * STATUS: Scaffold — needs loading state and error handling
 */

interface HandoffButtonProps {
  selectedCount: number;
  onActivate: () => void;
}

export default function HandoffButton({ selectedCount, onActivate }: HandoffButtonProps) {
  const isDisabled = selectedCount === 0;

  return (
    <div className="flex items-center justify-between rounded-xl border border-nightshift-border bg-nightshift-bg-card p-6">
      <div>
        <p className="text-sm text-nightshift-text-secondary">
          {selectedCount > 0
            ? `${selectedCount} task${selectedCount > 1 ? 's' : ''} selected for handoff`
            : 'Select tasks above to hand off to NightShift'}
        </p>
      </div>
      <button
        onClick={onActivate}
        disabled={isDisabled}
        className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-all ${
          isDisabled
            ? 'bg-nightshift-border text-nightshift-text-muted cursor-not-allowed'
            : 'bg-nightshift-accent hover:bg-nightshift-accent/90 text-white shadow-lg shadow-nightshift-accent/25 hover:shadow-nightshift-accent/40'
        }`}
      >
        <span>🌙</span>
        <span>Activate NightShift</span>
      </button>
    </div>
  );
}
