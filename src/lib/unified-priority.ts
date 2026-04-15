/**
 * Unified prioritization engine — single source of truth for Today's Focus and Handoff.
 *
 * One brain. Both features derive their items from one scoring pass.
 *
 * FOCUS answers:  "What should the user personally do now?"
 * HANDOFF answers: "What should Alter work on while the user is away?"
 */

import type { TodayTask, TodayTaskSource, TodayTaskUrgency } from '@/lib/tasks-today';
import type { UserPriorityContext } from '@/lib/priority-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Effort = 'low' | 'medium' | 'high';

export interface ScoredTask extends TodayTask {
  /** Composite priority score — same formula for Focus and Handoff ranking. */
  score: number;
  deadlineScore: number;
  urgencyScore: number;
  strategicValue: number;
  momentumScore: number;
  blockingBonus: number;
  tagMatchBonus: number;
  examWeekBonus: number;
  recencyBoost: number;
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

export type BuildUnifiedPriorityOptions = {
  priorityContext?: UserPriorityContext;
};

/** Default focus list size — expand to MAX_FOCUS_ITEMS only when scores stay tight or urgency is critical. */
export const DEFAULT_FOCUS_CAP = 3;
export const MAX_FOCUS_ITEMS = 5;
export const MAX_HANDOFF_ITEMS = 3;

// ─── Noise filter (identical to tasks-focus.ts) ───────────────────────────────

const NOISE_RE =
  /(github\s*oauth|personal\s*access\s*token|connect\s*github|repository\s*settings|ssh\s*key|api\s*key|npm\s+install|yarn\s+install|pnpm\s+install|clone\s*the\s*repo|scaffold|boilerplate|eslint\s*config|prettier|husky|dependabot|workflows?\/)/i;

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
  if (h <= 0) return 50; // overdue — clear it NOW
  if (h <= 24) return 45; // due today
  if (h <= 48) return 35; // due tomorrow
  if (h <= 72) return 28; // due in 3 days
  if (h <= 168) return 12; // due this week
  return 4; // on the horizon
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
    if (ageH <= 48) return 14; // recently active — context still warm
    if (ageH <= 168) return 8; // active this week
    return 3; // going stale
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

/** Project blocks other work — boost surfacing (0–12). */
function computeBlockingBonus(project: ProjectRow | undefined): number {
  if (!project) return 0;
  const ctx = parseCtx(project.context);
  if (ctx.blocksOther === true) return 12;
  if (ctx.blocksOther === 'true') return 12;
  const deps = ctx.blockingDependencies;
  if (typeof deps === 'number' && deps > 0) return Math.min(12, 4 + deps * 2);
  return 0;
}

/** User focusTags match task text (0–10). */
function computeTagMatchBonus(task: TodayTask, ctx: UserPriorityContext | undefined): number {
  const tags = ctx?.focusTags;
  if (!tags?.length) return 0;
  const blob = `${task.title} ${task.description}`.toLowerCase();
  let hits = 0;
  for (const t of tags) {
    const s = t.trim().toLowerCase();
    if (s.length >= 2 && blob.includes(s)) hits++;
  }
  return Math.min(10, hits * 4);
}

/** Exam week: boost school-relevant tasks (0–8). */
function computeExamWeekBonus(task: TodayTask, ctx: UserPriorityContext | undefined): number {
  if (!ctx?.examWeek) return 0;
  if (task.source === 'canvas') return 8;
  const blob = `${task.title} ${task.description}`.toLowerCase();
  if (/\b(exam|midterm|final|quiz|course|class|study)\b/.test(blob)) return 6;
  return 0;
}

function evidenceTimestampMs(task: TodayTask, project: ProjectRow | undefined): number | null {
  if (typeof task.evidenceAt === 'string') {
    const t = new Date(task.evidenceAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (task.dueDate) {
    const t = new Date(task.dueDate).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (project) return project.lastActive.getTime();
  return null;
}

/** Fresh evidence should dominate stale backlog. */
function computeRecencyBoost(task: TodayTask, project: ProjectRow | undefined): number {
  const ts = evidenceTimestampMs(task, project);
  if (!ts) return 0;
  const ageH = (Date.now() - ts) / (1000 * 60 * 60);
  if (ageH <= 24) return 20;
  if (ageH <= 72) return 14;
  if (ageH <= 168) return 8;
  if (ageH <= 336) return 3;
  return -8;
}

function shouldSuppressStaleTask(task: TodayTask, project: ProjectRow | undefined): boolean {
  const text = `${task.title} ${task.description} ${task.suggestedAction}`.toLowerCase();
  const staleAdmin = /\b(sync|github sync|code sync|setup|oauth|connect github|token)\b/.test(text);
  const ts = evidenceTimestampMs(task, project);
  const ageDays = ts ? (Date.now() - ts) / (1000 * 60 * 60 * 24) : Infinity;
  if (staleAdmin && !task.dueDate && ageDays > 3) return true;
  if (task.source === 'project' && !task.dueDate && ageDays > 21) return true;
  if (task.source === 'email' && ageDays > 14) return true;
  return false;
}

// ─── Task classification ──────────────────────────────────────────────────────

function classifyTask(
  task: TodayTask,
  project: ProjectRow | undefined
): { requiresUserJudgment: boolean; automatable: boolean; effort: Effort } {
  if (task.source === 'canvas') {
    // User must submit the work, but Alter can draft outlines, prep, and checklists overnight.
    return { requiresUserJudgment: true, automatable: true, effort: 'high' };
  }

  if (task.source === 'email') {
    const highStakes = task.urgency === 'critical' || task.urgency === 'high';
    return {
      requiresUserJudgment: highStakes,
      automatable: true,
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
      return { requiresUserJudgment: true, automatable: true, effort: 'medium' };
    }
    if (classes.includes('code_build')) {
      return { requiresUserJudgment: false, automatable: true, effort: 'medium' };
    }
  }

  return { requiresUserJudgment: false, automatable: true, effort: 'low' };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreTask(
  task: TodayTask,
  projectsById: Map<string, ProjectRow>,
  priorityContext?: UserPriorityContext
): ScoredTask {
  const pid = task.id.replace(/^project-/, '');
  const project = task.source === 'project' ? projectsById.get(pid) : undefined;
  const progress = (project as (ProjectRow & { progress?: number }) | undefined)?.progress ?? 0;

  const deadlineScore = computeDeadlineScore(task.dueDate);
  const urgencyScore = computeUrgencyScore(task.urgency);
  const strategicValue = computeStrategicValue(task, project);
  const momentumScore = computeMomentumScore(progress);
  const blockingBonus = computeBlockingBonus(project);
  const tagMatchBonus = computeTagMatchBonus(task, priorityContext);
  const examWeekBonus = computeExamWeekBonus(task, priorityContext);
  const recencyBoost = computeRecencyBoost(task, project);

  const score =
    deadlineScore +
    urgencyScore +
    strategicValue +
    momentumScore +
    blockingBonus +
    tagMatchBonus +
    examWeekBonus +
    recencyBoost;

  const { requiresUserJudgment, automatable, effort } = classifyTask(task, project);

  return {
    ...task,
    score,
    deadlineScore,
    urgencyScore,
    strategicValue,
    momentumScore,
    blockingBonus,
    tagMatchBonus,
    examWeekBonus,
    recencyBoost,
    requiresUserJudgment,
    automatable,
    effort,
    progress,
  };
}

// ─── Suggested automations (dynamic from focus) ───────────────────────────────

function truncateTitle(t: string, max = 42): string {
  const s = t.trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * One block for dashboard + handoff — headline tied to top focus tasks.
 * @param canvasAssignments Upcoming Canvas tasks (for “Alter will handle” copy)
 */
export function buildSuggestedAutomationsFromFocus(
  focusItems: ScoredTask[],
  canvasAssignments: ScoredTask[] = []
): SuggestedAutomation[] {
  const canvasTitles = canvasAssignments
    .slice(0, 3)
    .map((c) => truncateTitle(c.title, 40));

  if (focusItems.length === 0) {
    if (canvasTitles.length > 0) {
      return [
        {
          id: 'let-alter-handle-canvas',
          headline: 'Let Alter handle',
          bullets: [
            `Canvas: prep, outlines, and drafts for ${canvasTitles.join(' · ')}.`,
            'Draft summaries and supporting notes.',
            'Continue lower-priority project work in the background.',
          ],
          linkedFocusId: null,
        },
      ];
    }
    return [
      {
        id: 'let-alter-handle',
        headline: 'Let Alter handle',
        bullets: ['Organize notes', 'Draft summaries', 'Continue low-priority work'],
        linkedFocusId: null,
      },
    ];
  }

  const a = truncateTitle(focusItems[0].title);
  const b = focusItems[1] ? truncateTitle(focusItems[1].title) : null;
  const headline =
    focusItems.length >= 2 && b
      ? `Focus on ${a} and ${b} — Alter handles the rest`
      : `Focus on ${a} — Alter handles the rest`;

  const focusMentions = focusItems.slice(0, 3).map((f) => truncateTitle(f.title, 32));
  const bullets: string[] = [];

  if (canvasTitles.length > 0) {
    bullets.push(
      `Canvas: ${canvasTitles.slice(0, 2).join(' · ')} — outlines, drafts, and checklists.`
    );
  }
  if (focusMentions[0]) {
    bullets.push(`Supporting notes and context for "${focusMentions[0]}".`);
  }
  if (focusMentions[1]) {
    bullets.push(`Draft summaries and prep for "${focusMentions[1]}".`);
  }
  if (bullets.length < 2) {
    bullets.push('Draft summaries and prep artifacts.');
  }
  bullets.push('Continue lower-priority project work in the background.');

  return [
    {
      id: 'suggested-auto-focus',
      headline,
      bullets: bullets.slice(0, 3),
      linkedFocusId: focusItems[0]?.id ?? null,
    },
  ];
}

/**
 * Pick 2–5 focus items: prefer a tight list (default 3), don't pad with weak tasks.
 */
function pickFocusItems(judgmentSorted: ScoredTask[], allScored: ScoredTask[]): ScoredTask[] {
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

  // Ensure one current school assignment can surface when genuinely relevant.
  if (!out.some((t) => t.source === 'canvas')) {
    const topCanvas = allScored.find(
      (t) =>
        t.source === 'canvas' &&
        (t.urgency === 'critical' || t.urgency === 'high' || t.score >= (out[0]?.score ?? 0) - 12)
    );
    if (topCanvas) {
      if (out.length < MAX_FOCUS_ITEMS) out.push(topCanvas);
      else out[out.length - 1] = topCanvas;
      out.sort((a, b) => b.score - a.score);
    }
  }

  return out.slice(0, MAX_FOCUS_ITEMS);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build unified priority from all tasks and projects.
 *
 * @param tasks     Output of buildTodayTasks() — Canvas, projects, email
 * @param projects  All ProjectRow entries (used for scoring context)
 * @param options   Optional user priorityContext (exam week, focus tags)
 */
export function buildUnifiedPriority(
  tasks: TodayTask[],
  projects: ProjectRow[],
  options?: BuildUnifiedPriorityOptions
): UnifiedPriorityResult {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const priorityContext = options?.priorityContext;

  const clean = tasks.filter((t) => !isNoise(t));
  const noiseFiltered = tasks.length - clean.length;

  const scored = clean
    .map((t) => scoreTask(t, projectsById, priorityContext))
    .filter((t) => {
      const pid = t.id.replace(/^project-/, '');
      const p = t.source === 'project' ? projectsById.get(pid) : undefined;
      return !shouldSuppressStaleTask(t, p);
    });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });

  const judgmentSorted = scored.filter((t) => t.requiresUserJudgment).sort((a, b) => b.score - a.score);
  const focusItems = pickFocusItems(judgmentSorted, scored);

  const focusIds = new Set(focusItems.map((t) => t.id));

  const handoffCandidates = scored.filter((t) => t.automatable && !focusIds.has(t.id));
  const canvasH = handoffCandidates.filter((t) => t.source === 'canvas');
  const projectH = handoffCandidates.filter((t) => t.source === 'project');
  const otherH = handoffCandidates.filter((t) => t.source !== 'canvas' && t.source !== 'project');
  const handoffItems = [...canvasH, ...projectH, ...otherH].slice(0, MAX_HANDOFF_ITEMS);

  const canvasForCopy = scored.filter((t) => t.source === 'canvas').slice(0, 3);
  const suggestedAutomations = buildSuggestedAutomationsFromFocus(focusItems, canvasForCopy);

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
  s += computeMomentumScore(progress);
  if (ageH <= 48) s += 14;
  else if (ageH <= 168) s += 8;
  else s += 2;
  if (p.status === 'stalled') s -= 6;
  s += computeBlockingBonus(p);

  return s;
}
