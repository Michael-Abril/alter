/**
 * Deliverable vs casual projects — handoff, completed list, stats, focus icons.
 */

import type { TodayTask } from '@/lib/tasks-today';
import type { ProjectRow } from '@/lib/unified-priority';

const DELIVERABLE = new Set(['code_build', 'document_build', 'academic_deliverable']);
const EXCLUDE = new Set(['casual', 'quick_task', 'not_actionable']);

export function parseCtx(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function classificationList(ctx: Record<string, unknown>): string[] {
  const raw = ctx.classification;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw != null) return [String(raw)];
  return [];
}

/** Handoff: only these classifications (excludes casual / not_actionable). */
export function isHandoffEligible(contextJson: string | null): boolean {
  const classes = classificationList(parseCtx(contextJson));
  if (classes.some((c) => EXCLUDE.has(c))) return false;
  return classes.some((c) => DELIVERABLE.has(c));
}

/** Recently completed: deliverables only; exclude obvious one-offs by name. */
export function isDeliverableCompletedProject(name: string, contextJson: string | null): boolean {
  const classes = classificationList(parseCtx(contextJson));
  if (classes.some((c) => EXCLUDE.has(c))) return false;
  if (!classes.some((c) => DELIVERABLE.has(c))) return false;
  const n = name.toLowerCase();
  if (/\b(merchandise|adpi|sorority|fraternity|greek)\b/.test(n)) return false;
  if (/\bmerch\b/.test(n) && /\b(store|shop)\b/.test(n)) return false;
  return true;
}

export type DisplayKind = 'academic' | 'code' | 'document' | 'email' | 'other';

export function focusDisplayKindForTask(
  task: TodayTask,
  projectsById: Map<string, ProjectRow>
): DisplayKind {
  if (task.source === 'canvas') return 'academic';
  if (task.source === 'email') return 'email';
  if (task.source === 'project') {
    const pid = task.id.replace(/^project-/, '');
    const p = projectsById.get(pid);
    const classes = classificationList(parseCtx(p?.context ?? null));
    if (classes.includes('academic_deliverable')) return 'academic';
    if (classes.includes('code_build')) return 'code';
    if (classes.includes('document_build')) return 'document';
  }
  return 'other';
}

export function deliverableKindFromProjectContext(contextJson: string | null): DisplayKind {
  const classes = classificationList(parseCtx(contextJson));
  if (classes.includes('academic_deliverable')) return 'academic';
  if (classes.includes('code_build')) return 'code';
  if (classes.includes('document_build')) return 'document';
  return 'other';
}
