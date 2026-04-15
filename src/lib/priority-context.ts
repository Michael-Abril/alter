/**
 * Optional user-level signals for unified prioritization (exam week, tags).
 * Stored as JSON on User.priorityContext or passed from API.
 */

export type UserPriorityContext = {
  /** Boost school / deadline-sensitive work */
  examWeek?: boolean;
  /** Substrings that boost matching tasks when present in title/description */
  focusTags?: string[];
};

export function parsePriorityContext(raw: string | null | undefined): UserPriorityContext {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const examWeek = o.examWeek === true;
    const ft = o.focusTags;
    const focusTags = Array.isArray(ft) ? ft.map(String).filter(Boolean) : [];
    return { examWeek, focusTags: focusTags.length ? focusTags : undefined };
  } catch {
    return {};
  }
}

export function serializePriorityContext(ctx: UserPriorityContext): string {
  return JSON.stringify({
    examWeek: ctx.examWeek === true,
    focusTags: ctx.focusTags?.length ? ctx.focusTags : undefined,
  });
}
