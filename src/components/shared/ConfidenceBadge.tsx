/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Confidence score display badge — shows percentage and color-coded level
 * DEPENDENCIES: @/lib/confidence
 * STATUS: Ready to use
 */

import { formatConfidence } from '@/lib/confidence';

interface ConfidenceBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export default function ConfidenceBadge({ score, size = 'md' }: ConfidenceBadgeProps) {
  const { percentage, label, color } = formatConfidence(score);

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-nightshift-bg-light ${sizeClasses} ${color}`}
      title={label}
    >
      <span className="font-medium">{percentage}</span>
    </span>
  );
}
