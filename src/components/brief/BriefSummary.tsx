/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Morning brief summary card — shows high-level overnight stats
 * DEPENDENCIES: None
 * STATUS: Scaffold — needs animation and real data
 */

interface BriefSummaryProps {
  summary: string;
  actionsCompleted: number;
  flaggedForReview: number;
}

export default function BriefSummary({
  summary,
  actionsCompleted,
  flaggedForReview,
}: BriefSummaryProps) {
  return (
    <div className="card border-nightshift-accent/20">
      <p className="text-lg text-nightshift-text-primary leading-relaxed">{summary}</p>
      <div className="mt-4 flex gap-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-nightshift-success">{actionsCompleted}</span>
          <span className="text-sm text-nightshift-text-secondary">actions completed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-nightshift-warning">{flaggedForReview}</span>
          <span className="text-sm text-nightshift-text-secondary">flagged for review</span>
        </div>
      </div>
    </div>
  );
}
