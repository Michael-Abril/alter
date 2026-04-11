/**
 * Unified prioritization engine — single source of truth for Today's Focus and Handoff.
 *
 * One brain. Both features derive their items from one scoring pass.
 *
 * FOCUS answers:  "What should the user personally do now?"
 * HANDOFF answers: "What should Alter work on while the user is away?"
 *
 * The two lists are designed to complement each other:
 * - Focus = high-judgment tasks the user must drive
 * - Handoff = automatable support + tasks Alter can advance without the user
 */

import type { TodayTask, TodayTaskSource, TodayTaskUrgency } from '@/lib/tasks-today';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Effort = 'low' | 'medium' | 'high';

export interface ScoredTask extends TodayTask {
  /** Composite priority score — same formula for Focus and Handoff ranking. */
  score: number;
  deadlineScore: number;
  urgencyScore: number;
  strategicValue: number;
  momentumScore: number;
  /**
   * True when the user must personally drive this task.
   * Studying, decisions, reviews, creative output — no AI substitute.
   * These belong in Today's Focus.
   */
  requiresUserJudgment: boolean;
  /**
   * True when Alter can meaningfully advance this without the user being present.
   * Code builds, email drafts, document scaffolds — these belong in Handoff.
   */
  automatable: boolean;
  effort: Effort;
  /** Project progress 0–100 (only set for project-source tasks). */
  progress: number;
}

export interface SuggestedAutomation {
  id: string;
  /**
   * Context-aware headline tied to what's in Focus.
   * e.g. "You focus on your accounting midterm — Alter handles these"
   */
  headline: string;
  bullets: string[];
  /** Focus task this automation creates space for (null if general). */
  linkedFocusId: string | null;
}

export interface UnifiedPriorityResult {
  /** All scored tasks, sorted by score desc. */
  all: ScoredTask[];
  /**
   * What the user should personally do now.
   * Max MAX_FOCUS_ITEMS, requiresUserJudgment = true, sorted by score.
   */
  focusItems: ScoredTask[];
  /**
   * What Alter should work on.
   * Automatable tasks NOT already in focusItems, sorted by same score.
   * Feeds Handoff's "Work to continue" section.
   */
  handoffItems: ScoredTask[];
  /**
   * Context-aware support tasks generated from focusItems.
   * Feeds Handoff's "Suggested Automations" section.
   * These explain the relationship: "You focus on X, Alter handles Y."
   */
  suggestedAutomations: SuggestedAutomation[];
  noiseFiltered: number;
}

export type ProjectRow = {
  id: string;
  name: string;
  context: string | null;
  lastActive: Date;
  progress?: number;
};

/** Default focus list size — expand to MAX_FOCUS_ITEMS only when scores stay tight or urgency is critical. */
export const DEFAULT_FOCUS_CAP = 3;
export const MAX_FOCUS_ITEMS = 5;
export const MAX_HANDOFF_ITEMS = 6;

// ─── Noise filter (identical to tasks-focus.ts) ───────────────────────────────

const NOISE_RE =
  /(github\s*oauth|personal\s*access\s*token|connect\s*github|repository\s*settings|ssh\s*key|api\s*key|npm\s+install|yarn\s+install|pnpm\s+install|clone\s+the\s*repo|scaffold|boilerplate|eslint\s*config|prettier|husky|dependabot|workflows?\/)/i;

const SETUP_TITLE_RE =
  /^(setup|configure|install|init|bootstrap|scaffold|repo\s*setup|dev\s*environment)/i;

function isNoise(task: TodayTask): boolean {
  const blob = `${task.title} ${task.description} ${task.suggestedAction}`.toLowerCase();
  if (NOISE_RE.test(blob)) return true;
  if (SETUP_TITLE_RE.test(task.title.trim())) return true;
  if (task.source === 'project' && /setup|configure|install|oauth|token/i.test(task.title)) return true;
  return false;
}

// ─── Context helpers ──────────────────────────────────────────────────────────

function parseCtx(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getClassifications(ctx: Record<string, unknown>): string[] {
  const raw = ctx.classification;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw != null) return [String(raw)];
  return [];
}

// ─── Scoring components ───────────────────────────────────────────────────────

/**
 * Deadline urgency score (0–50).
 * The closer the due date, the higher the pressure.
 */
function computeDeadlineScore(dueDate: string | null): number {
  if (!dueDate) return 0;
  const h = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (h <= 0) return 50;    // overdue — clear it NOW
  if (h <= 24) return 45;   // due today
  if (h <= 48) return 35;   // due tomorrow
  if (h <= 72) return 28;   // due in 3 days
  if (h <= 168) return 12;  // due this week
  return 4;                  // on the horizon
}

/**
 * Urgency field score (0–30).
 * Derived from the TodayTask's urgency field (set by source logic).
 */
function computeUrgencyScore(urgency: TodayTaskUrgency): number {
  const map: Record<TodayTaskUrgency, number> = {
    critical: 30,
    high: 22,
    medium: 14,
    low: 6,
  };
  return map[urgency];
}

/**
 * Strategic value (0–18).
 * Source-based signal: Canvas deadlines are real; code builds keep context warm; email
 * has lower inherent weight.
 */
function computeStrategicValue(task: TodayTask, project: ProjectRow | undefined): number {
  if (task.source === 'canvas') return 18;
  if (task.source === 'email') {
    return task.urgency === 'critical' || task.urgency === 'high' ? 10 : 6;
  }
  if (task.source === 'project' && project) {
    const ageH = (Date.now() - project.lastActive.getTime()) / (1000 * 60 * 60);
    if (ageH <= 48) return 14;   // recently active — context still warm
    if (ageH <= 168) return 8;   // active this week
    return 3;                     // going stale
  }
  return 4;
}

/**
 * Momentum score (0–10).
 * Tasks close to done are worth finishing — surface nearly-complete work.
 */
function computeMomentumScore(progress: number): number {
  if (progress >= 80) return 10;
  if (progress >= 50) return 6;
  if (progress >= 20) return 3;
  return 0;
}

// ─── Task classification ──────────────────────────────────────────────────────

/**
 * Classify a task into user-judgment / automatable buckets.
 *
 * requiresUserJudgment: user must personally drive this (studying, deciding, creating)
 * automatable: Alter can meaningfully advance this without the user
 *
 * A task can be BOTH (e.g. a document build: user writes core content, Alter scaffolds).
 * In that case the task goes into Focus AND its automatable side goes into Suggested Automations.
 */
function classifyTask(
  task: TodayTask,
  project: ProjectRow | undefined
): { requiresUserJudgment: boolean; automatable: boolean; effort: Effort } {
  // Canvas assignments are exclusively user-driven — studying and submitting cannot be delegated
  if (task.source === 'canvas') {
    return { requiresUserJudgment: true, automatable: false, effort: 'high' };
  }

  if (task.source === 'email') {
    const highStakes = task.urgency === 'critical' || task.urgency === 'high';
    return {
      requiresUserJudgment: highStakes, // user should draft high-stakes replies
      automatable: true,                // Alter can always generate a first draft
      effort: highStakes ? 'medium' : 'low',
    };
  }

  if (task.source === 'project' && project) {
    const ctx = parseCtx(project.context);
    const classes = getClassifications(ctx);

    if (classes.includes('academic_deliverable')) {
      return { requiresUserJudgment: true, automatable: false, effort: 'high' };
    }
    if (classes.includes('document_build')) {
      // User drives the thinking; Alter can scaffold and draft
      return { requiresUserJudgment: true, automatable: true, effort: 'medium' };
    }
    if (classes.includes('code_build')) {
      // Code can be continued by Alter; user reviews
      return { requiresUserJudgment: false, automatable: true, effort: 'medium' };
    }
  }

  // Anything else defaults to automatable background work
  return { requiresUserJudgment: false, automatable: true, effort: 'low' };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreTask(task: TodayTask, projectsById: Map<string, ProjectRow>): ScoredTask {
  const pid = task.id.replace(/^project-/, '');
  const project = task.source === 'project' ? projectsById.get(pid) : undefined;
  const progress = (project as (ProjectRow & { progress?: number }) | undefined)?.progress ?? 0;

  const deadlineScore = computeDeadlineScore(task.dueDate);
  const urgencyScore = computeUrgencyScore(task.urgency);
  const strategicValue = computeStrategicValue(task, project);
  const momentumScore = computeMomentumScore(progress);

  const score = deadlineScore + urgencyScore + strategicValue + momentumScore;

  const { requiresUserJudgment, automatable, effort } = classifyTask(task, project);

  return {
    ...task,
    score,
    deadlineScore,
    urgencyScore,
    strategicValue,
    momentumScore,
    requiresUserJudgment,
    automatable,
    effort,
    progress,
  };
}

// ─── Suggested automations (single block — no per-task repetition) ────────────

/** One high-signal block for the dashboard; not duplicated per focus item. */
function buildSuggestedAutomations(): SuggestedAutomation[] {
  return [
    {
      id: 'let-alter-handle',
      headline: 'Let Alter handle',
      bullets: ['Organize notes', 'Draft summaries', 'Continue low-priority work', 'Queue Handoff for the rest'],
      linkedFocusId: null,
    },
  ];
}

/**
 * Pick 2–5 focus items: prefer a tight list (default 3), don't pad with weak tasks.
 * Slots 4–5 only when the task is critical or still scores close to the pack.
 */
function pickFocusItems(judgmentSorted: ScoredTask[]): ScoredTask[] {
  if (judgmentSorted.length === 0) return [];
  const maxS = judgmentSorted[0].score;
  const out: ScoredTask[] = [];

  for (let i = 0; i < judgmentSorted.length && out.length < MAX_FOCUS_ITEMS; i++) {
    const t = judgmentSorted[i];
    const gap = maxS - t.score;

    if (out.length < DEFAULT_FOCUS_CAP) {
      if (gap <= 50) out.push(t);
      else break;
    } else {
      const third = out[2];
      if (!third) break;
      if (t.urgency === 'critical' || t.score >= third.score - 15) out.push(t);
      else break;
    }
  }

  return out;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build unified priority from all tasks and projects.
 *
 * @param tasks     Output of buildTodayTasks() — Canvas, projects, email
 * @param projects  All ProjectRow entries (used for scoring context)
 */
export function buildUnifiedPriority(
  tasks: TodayTask[],
  projects: ProjectRow[]
): UnifiedPriorityResult {
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  // Filter setup/config noise
  const clean = tasks.filter((t) => !isNoise(t));
  const noiseFiltered = tasks.length - clean.length;

  // Score every task with the unified formula
  const scored = clean.map((t) => scoreTask(t, projectsById));

  // Sort: score desc, then deadline asc as tiebreaker
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });

  // Today's Focus: user-judgment tasks — default 3, max 5 only when scores stay tight or critical
  const judgmentSorted = scored.filter((t) => t.requiresUserJudgment).sort((a, b) => b.score - a.score);
  const focusItems = pickFocusItems(judgmentSorted);

  const focusIds = new Set(focusItems.map((t) => t.id));

  // Handoff "Work to Continue": automatable tasks not already in Focus
  const handoffItems = scored
    .filter((t) => t.automatable && !focusIds.has(t.id))
    .slice(0, MAX_HANDOFF_ITEMS);

  const suggestedAutomations = buildSuggestedAutomations();

  return { all: scored, focusItems, handoffItems, suggestedAutomations, noiseFiltered };
}

// ─── Helpers for project-only scoring (when full task list isn't available) ───

/**
 * Score a project directly (without a TodayTask wrapper).
 * Used by Handoff when it needs to rank ALL projects (not just those in buildTodayTasks).
 */
export function scoreProjectRow(p: ProjectRow & { progress?: number; status?: string }): number {
  const progress = p.progress ?? 0;
  const ageH = (Date.now() - p.lastActive.getTime()) / (1000 * 60 * 60);

  let s = 0;
  // Momentum: nearly-done work is worth completing
  s += computeMomentumScore(progress);
  // Recency: warm context is worth keeping warm
  if (ageH <= 48) s += 14;
  else if (ageH <= 168) s += 8;
  else s += 2;
  // Stalled projects get a small penalty
  if (p.status === 'stalled') s -= 6;

  return s;
}
