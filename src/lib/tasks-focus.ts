/**
 * Today's Focus dashboard — derived from the unified prioritization engine.
 *
 * This file is the adapter between the unified engine and the dashboard components.
 * All scoring and classification happens in unified-priority.ts.
 * This file only handles display formatting and the "grouped other work" bucketing.
 */

import { dueRelativePhrase } from '@/lib/dashboard-morning-line';
import { focusDisplayKindForTask, type DisplayKind } from '@/lib/project-deliverable';
import type { TodayTask, TodayTaskSource, TodayTaskUrgency } from '@/lib/tasks-today';
import type { UserPriorityContext } from '@/lib/priority-context';
import {
  buildUnifiedPriority,
  type ProjectRow,
  type SuggestedAutomation,
  MAX_FOCUS_ITEMS,
} from '@/lib/unified-priority';

// Re-export so components don't need to change their import paths
export { MAX_FOCUS_ITEMS as MAX_FOCUS_TASKS };
export type { SuggestedAutomation };

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkBucket = 'school' | 'product' | 'side';

export interface FocusItem {
  id: string;
  title: string;
  dueTiming: string | null;
  /** ISO due date for urgency styling (badges). */
  dueAt: string | null;
  /** One short imperative — no time blocks or filler. */
  action: string;
  urgency: TodayTaskUrgency;
  source: TodayTaskSource;
  kind: DisplayKind;
  externalUrl?: string | null;
  submissionUrl?: string | null;
  provider?: TodayTask['provider'];
}

export interface FocusDashboardResult {
  focusItems: FocusItem[];
  grouped: Record<WorkBucket, TodayTask[]>;
  focusIds: Set<string>;
  noiseFiltered: number;
  suggestedAutomations: SuggestedAutomation[];
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function dueTiming(task: TodayTask): string | null {
  if (!task.dueDate) return null;
  return `Due ${dueRelativePhrase(task.dueDate)}`;
}

/** Short, distinct verbs — no duration estimates or long phrasing. */
function shortAction(task: TodayTask): string {
  if (task.source === 'canvas') {
    const blob = `${task.title} ${task.description}`.toLowerCase();
    if (/\b(submit|upload|turn in)\b/.test(blob)) return 'Submit';
    if (/\b(quiz|exam|midterm|final|test)\b/.test(blob)) return 'Study and prep';
    if (/\b(read|reading|chapter)\b/.test(blob)) return 'Finish reading';
    if (/\b(reflect|reflection|journal)\b/.test(blob)) return 'Write first draft';
    return 'Write first draft';
  }
  if (task.source === 'email') return 'Reply';
  if (task.source === 'project') {
    let a = task.suggestedAction
      .replace(/^Open\s+/i, '')
      .replace(/^Continue\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    a = a.split(/\s+/).slice(0, 7).join(' ');
    if (a.length > 44) a = `${a.slice(0, 41)}…`;
    return a || 'Ship the next slice';
  }
  const s = task.suggestedAction.trim().split(/\s+/).slice(0, 7).join(' ');
  return s.length > 44 ? `${s.slice(0, 41)}…` : s || 'Do the next step';
}

function oneLineSummary(task: TodayTask): string {
  const d = task.description.replace(/\s+/g, ' ').trim();
  if (!d) return task.title;
  return d.length > 88 ? `${d.slice(0, 85)}…` : d;
}

// ─── Bucket assignment (for "other work" grouping below the focus list) ───────

function parseCtx(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function assignBucket(task: TodayTask, projectsById: Map<string, ProjectRow>): WorkBucket {
  if (task.source === 'canvas') return 'school';

  if (task.source === 'email') {
    return task.urgency === 'critical' || task.urgency === 'high' ? 'product' : 'side';
  }

  if (task.source === 'project') {
    const pid = task.id.replace(/^project-/, '');
    const p = projectsById.get(pid);
    const ctx = parseCtx(p?.context ?? null);
    const cls = ctx.classification;
    const classes = Array.isArray(cls) ? cls.map(String) : cls != null ? [String(cls)] : [];
    if (classes.some((c) => c === 'academic_deliverable' || c === 'document_build')) {
      return 'school';
    }
    const name = (p?.name ?? task.title).toLowerCase();
    const combined = `${name} ${(typeof ctx.nextStep === 'string' ? ctx.nextStep : '')}`.toLowerCase();
    if (
      /\b(alter|nightshift|startup|saas|mvp|launch|product|founder)\b/.test(combined) ||
      /\b(alter|startup|mvp)\b/.test(name)
    ) {
      return 'product';
    }
    return 'side';
  }

  return 'side';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the dashboard focus view.
 *
 * Delegates all scoring and classification to buildUnifiedPriority().
 * Returns focus items + grouped "other work" + suggested automations
 * — all derived from the same ranked list.
 */
export function buildFocusDashboard(
  tasks: TodayTask[],
  projects: ProjectRow[],
  priorityContext?: UserPriorityContext
): FocusDashboardResult {
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const unified = buildUnifiedPriority(tasks, projects, { priorityContext });

  const focusItems: FocusItem[] = unified.focusItems.map((t) => ({
    id: t.id,
    title: t.title,
    dueTiming: dueTiming(t),
    dueAt: t.dueDate ?? null,
    action: shortAction(t),
    urgency: t.urgency,
    source: t.source,
    kind: focusDisplayKindForTask(t, projectsById),
    externalUrl: t.externalUrl ?? null,
    submissionUrl: t.submissionUrl ?? null,
    provider: t.provider,
  }));

  const focusIds = new Set(focusItems.map((f) => f.id));

  // Group non-focus tasks by work bucket
  const grouped: Record<WorkBucket, TodayTask[]> = { school: [], product: [], side: [] };
  for (const t of tasks) {
    if (focusIds.has(t.id)) continue;
    const bucket = assignBucket(t, projectsById);
    grouped[bucket].push({ ...t, description: oneLineSummary(t) });
  }

  return {
    focusItems,
    grouped,
    focusIds,
    noiseFiltered: unified.noiseFiltered,
    suggestedAutomations: unified.suggestedAutomations,
  };
}

// ─── Morning brief narrative ──────────────────────────────────────────────────

export function buildMorningBriefWelcomeLine(firstName: string): string {
  return `Welcome back, ${firstName}.`;
}
