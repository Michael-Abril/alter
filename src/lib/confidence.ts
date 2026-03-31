/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Confidence scoring logic — determines whether NightShift should auto-execute,
 * draft for review, or flag for user attention
 * DEPENDENCIES: @/types
 * STATUS: Scaffold — needs real implementation
 */

import type { ConfidenceAssessment, ConfidenceLevel, AutonomyLevel } from '@/types';

// ─── Confidence Thresholds ───────────────────────────────────────────────────

const THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.4,
};

// Risk multipliers by action type
const RISK_MULTIPLIERS: Record<string, number> = {
  email_sent: 0.8,      // sending emails is high risk — lower confidence
  doc_edited: 0.95,     // editing docs is moderate risk
  task_completed: 1.0,  // completing tasks is lower risk
  code_pushed: 0.7,     // pushing code is highest risk
};

// ─── Core Scoring ────────────────────────────────────────────────────────────

/**
 * Calculate confidence level from a numeric score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= THRESHOLDS.HIGH) return 'high';
  if (score >= THRESHOLDS.MEDIUM) return 'medium';
  if (score >= THRESHOLDS.LOW) return 'low';
  return 'very_low';
}

/**
 * Assess confidence for an action and determine the recommendation
 * TODO: Person 4 — Implement multi-factor scoring:
 * - Voice match quality (how well does the draft match the user's style?)
 * - Context availability (how much relevant context did we retrieve from vectors?)
 * - Action risk level (email > code > doc > task)
 * - Historical accuracy (how well have we done on similar tasks before?)
 * - User's autonomy level preference
 */
export function assessConfidence(params: {
  baseScore: number;
  actionType: string;
  contextRelevance: number;  // 0-1: how relevant the retrieved context was
  voiceMatchScore: number;   // 0-1: how well the output matches the user's voice
  autonomyLevel: number;     // user's preferred autonomy level (0-3)
}): ConfidenceAssessment {
  const reasons: string[] = [];

  // Apply risk multiplier for action type
  const riskMultiplier = RISK_MULTIPLIERS[params.actionType] || 0.9;
  let adjustedScore = params.baseScore * riskMultiplier;

  // Factor in context relevance
  if (params.contextRelevance < 0.5) {
    adjustedScore *= 0.8;
    reasons.push('Limited relevant context available');
  } else if (params.contextRelevance > 0.8) {
    reasons.push('Strong contextual match found');
  }

  // Factor in voice match
  if (params.voiceMatchScore < 0.5) {
    adjustedScore *= 0.85;
    reasons.push('Voice match below threshold');
  } else if (params.voiceMatchScore > 0.8) {
    reasons.push('Strong voice profile match');
  }

  // Clamp score to 0-1
  adjustedScore = Math.max(0, Math.min(1, adjustedScore));

  const level = getConfidenceLevel(adjustedScore);

  // Determine recommendation based on confidence + autonomy level
  const recommendation = getRecommendation(adjustedScore, params.autonomyLevel);
  reasons.push(`Autonomy level: ${params.autonomyLevel}`);

  return {
    score: Math.round(adjustedScore * 100) / 100,
    level,
    reasons,
    recommendation,
  };
}

/**
 * Determine action recommendation based on confidence score and user's autonomy level
 * TODO: Person 4 — Add boundary rules check (some actions might be "never auto" regardless)
 */
function getRecommendation(
  score: number,
  autonomyLevel: number
): 'auto_execute' | 'draft_for_review' | 'flag_for_user' {
  // Level 0: Observe only — always flag
  if (autonomyLevel === 0) return 'flag_for_user';

  // Level 1: Draft only — always create drafts
  if (autonomyLevel === 1) return 'draft_for_review';

  // Level 2: Auto low-risk — auto-execute only high confidence
  if (autonomyLevel === 2) {
    if (score >= THRESHOLDS.HIGH) return 'auto_execute';
    if (score >= THRESHOLDS.LOW) return 'draft_for_review';
    return 'flag_for_user';
  }

  // Level 3: Full auto — auto-execute medium+ confidence
  if (score >= THRESHOLDS.MEDIUM) return 'auto_execute';
  if (score >= THRESHOLDS.LOW) return 'draft_for_review';
  return 'flag_for_user';
}

/**
 * Format confidence score for display
 */
export function formatConfidence(score: number): {
  percentage: string;
  label: string;
  color: string;
} {
  const level = getConfidenceLevel(score);
  const colors: Record<ConfidenceLevel, string> = {
    high: 'text-nightshift-success',
    medium: 'text-nightshift-warning',
    low: 'text-nightshift-accent',
    very_low: 'text-nightshift-error',
  };
  const labels: Record<ConfidenceLevel, string> = {
    high: 'High Confidence',
    medium: 'Medium Confidence',
    low: 'Low Confidence',
    very_low: 'Very Low Confidence',
  };

  return {
    percentage: `${Math.round(score * 100)}%`,
    label: labels[level],
    color: colors[level],
  };
}
