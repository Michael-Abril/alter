/**
 * Handoff project selection — now derived from the unified priority engine.
 *
 * Projects are ranked by the same formula as Today's Focus:
 *   score = deadlineScore + urgencyScore + strategicValue + momentumScore
 *
 * Previously: sorted by progress % + recency only (unrelated to Focus ranking).
 * Now: sorted by unified score, so Handoff recommendations are logically consistent
 *      with what Today's Focus shows.
 */

import { scoreProjectRow } from '@/lib/unified-priority';

export const MAX_HANDOFF_RECOMMENDED = 3;

export type ProjectLike = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  lastActive: string;
  context: { nextStep?: string } | null;
};

/**
 * Sort projects for Handoff using the unified priority score.
 *
 * This replaces the old progress-only sort and ensures Handoff recommendations
 * are consistent with the same logic that powers Today's Focus.
 */
export function sortProjectsForHandoff<T extends ProjectLike>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    const scoreA = scoreProjectRow({
      id: a.id,
      name: a.name,
      context: typeof a.context === 'object' && a.context !== null
        ? JSON.stringify(a.context)
        : null,
      lastActive: new Date(a.lastActive),
      progress: a.progress,
      status: a.status,
    });
    const scoreB = scoreProjectRow({
      id: b.id,
      name: b.name,
      context: typeof b.context === 'object' && b.context !== null
        ? JSON.stringify(b.context)
        : null,
      lastActive: new Date(b.lastActive),
      progress: b.progress,
      status: b.status,
    });

    if (scoreB !== scoreA) return scoreB - scoreA;
    // Tiebreak: higher progress first (momentum signal)
    if (b.progress !== a.progress) return b.progress - a.progress;
    // Final tiebreak: most recent activity
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });
}

/** One action-style line — no long "Next step" blocks. */
export function oneLineHandoffSummary(p: ProjectLike): string {
  const step = p.context?.nextStep?.replace(/\s+/g, ' ').trim();
  if (step && step.length > 0) {
    const s = step.length > 100 ? `${step.slice(0, 97)}…` : step;
    return s;
  }
  if (p.description) {
    const d = p.description.replace(/\s+/g, ' ').trim();
    return d.length > 100 ? `${d.slice(0, 97)}…` : d;
  }
  return `${p.progress}% in progress — continue the latest milestone.`;
}
