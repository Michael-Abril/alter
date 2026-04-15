import db from '@/lib/db';
import { buildTodayTasks } from '@/lib/tasks-today';
import { buildUnifiedPriority, MAX_FOCUS_ITEMS, MAX_HANDOFF_ITEMS } from '@/lib/unified-priority';
import { parsePriorityContext } from '@/lib/priority-context';

type Severity = 'error' | 'warn';

export type ConsistencyIssue = {
  severity: Severity;
  code: string;
  message: string;
};

export type ConsistencyReport = {
  userId: string;
  generatedAt: string;
  focusCount: number;
  handoffCount: number;
  issues: ConsistencyIssue[];
};

const ALLOWED_PROVIDERS = new Set(['gmail', 'github', 'canvas', 'drive', 'calendar', 'docs', 'local']);
const ALLOWED_KINDS = new Set([
  'doc',
  'pr',
  'canvas',
  'canvas_prep',
  'gmail_draft',
  'calendar_event',
  'drive_file',
  'file',
]);

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function validateDestinationMeta(meta: Record<string, unknown>, entity: string, issues: ConsistencyIssue[]) {
  const externalUrl = typeof meta.externalUrl === 'string' ? meta.externalUrl : null;
  const provider = typeof meta.provider === 'string' ? meta.provider : null;
  const kind = typeof meta.kind === 'string' ? meta.kind : null;

  if (externalUrl && !/^https?:\/\//i.test(externalUrl)) {
    issues.push({
      severity: 'warn',
      code: 'META_EXTERNAL_URL_FORMAT',
      message: `${entity}: externalUrl is present but not an absolute http(s) URL`,
    });
  }

  if (provider && !ALLOWED_PROVIDERS.has(provider)) {
    issues.push({
      severity: 'warn',
      code: 'META_PROVIDER_UNKNOWN',
      message: `${entity}: provider "${provider}" is outside the standard contract`,
    });
  }

  if (kind && !ALLOWED_KINDS.has(kind)) {
    issues.push({
      severity: 'warn',
      code: 'META_KIND_UNKNOWN',
      message: `${entity}: kind "${kind}" is outside the standard contract`,
    });
  }

  if (externalUrl && (!provider || !kind)) {
    issues.push({
      severity: 'warn',
      code: 'META_MISSING_PROVIDER_OR_KIND',
      message: `${entity}: externalUrl exists but provider/kind is incomplete`,
    });
  }
}

export async function buildConsistencyReport(userId: string): Promise<ConsistencyReport> {
  const issues: ConsistencyIssue[] = [];
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return {
      userId,
      generatedAt: new Date().toISOString(),
      focusCount: 0,
      handoffCount: 0,
      issues: [
        {
          severity: 'error',
          code: 'USER_NOT_FOUND',
          message: `User ${userId} not found`,
        },
      ],
    };
  }

  const [tasks, projects, actions, drafts] = await Promise.all([
    buildTodayTasks(userId).catch(() => []),
    db.project.findMany({
      where: { userId, status: { not: 'completed' } },
      select: { id: true, name: true, context: true, lastActive: true, progress: true },
    }),
    db.action.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, metadata: true },
    }),
    db.draft.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, context: true },
    }),
  ]);

  const unified = buildUnifiedPriority(tasks, projects, {
    priorityContext: parsePriorityContext(user.priorityContext),
  });

  if (unified.focusItems.length > MAX_FOCUS_ITEMS) {
    issues.push({
      severity: 'error',
      code: 'FOCUS_CAP_EXCEEDED',
      message: `focusItems=${unified.focusItems.length} exceeds MAX_FOCUS_ITEMS=${MAX_FOCUS_ITEMS}`,
    });
  }

  if (unified.handoffItems.length > MAX_HANDOFF_ITEMS) {
    issues.push({
      severity: 'error',
      code: 'HANDOFF_CAP_EXCEEDED',
      message: `handoffItems=${unified.handoffItems.length} exceeds MAX_HANDOFF_ITEMS=${MAX_HANDOFF_ITEMS}`,
    });
  }

  const focusIds = new Set(unified.focusItems.map((i) => i.id));
  const overlap = unified.handoffItems.filter((i) => focusIds.has(i.id));
  if (overlap.length > 0) {
    issues.push({
      severity: 'error',
      code: 'FOCUS_HANDOFF_OVERLAP',
      message: `Focus/Handoff overlap detected: ${overlap.map((x) => x.id).join(', ')}`,
    });
  }

  if (unified.suggestedAutomations.length !== 1) {
    issues.push({
      severity: 'warn',
      code: 'AUTOMATION_BLOCK_COUNT',
      message: `Expected 1 suggested automation block, found ${unified.suggestedAutomations.length}`,
    });
  }

  for (const action of actions) {
    const meta = parseJsonObject(action.metadata);
    if (!meta) continue;
    validateDestinationMeta(meta, `action:${action.id}`, issues);
  }

  for (const draft of drafts) {
    const ctx = parseJsonObject(draft.context);
    if (!ctx) continue;
    validateDestinationMeta(ctx, `draft:${draft.id}`, issues);
  }

  return {
    userId,
    generatedAt: new Date().toISOString(),
    focusCount: unified.focusItems.length,
    handoffCount: unified.handoffItems.length,
    issues,
  };
}
