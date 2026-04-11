/**
 * Build the unified "tasks today" list: Canvas (API + chat fallback),
 * in-progress code/document projects, and received emails without drafts.
 */

import db from '@/lib/db';
import {
  loadCanvasConfig,
  getUpcomingAssignments,
  getCourses,
} from '@/lib/canvas';

export type TodayTaskSource = 'canvas' | 'project' | 'email';
export type TodayTaskUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface TodayTask {
  id: string;
  title: string;
  source: TodayTaskSource;
  urgency: TodayTaskUrgency;
  description: string;
  dueDate: string | null;
  suggestedAction: string;
}

type InternalTask = TodayTask & { lastActiveMs?: number; receivedAtMs?: number };

const URGENCY_ORDER: Record<TodayTaskUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SOURCE_ORDER: Record<TodayTaskSource, number> = {
  canvas: 0,
  project: 1,
  email: 2,
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hoursUntil(d: Date): number {
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

/** Urgency from a future due date: critical ≤24h, high ≤72h, medium ≤7d, else low. */
export function urgencyFromDueDate(d: Date): TodayTaskUrgency {
  const h = hoursUntil(d);
  if (h <= 24) return 'critical';
  if (h <= 72) return 'high';
  if (h <= 168) return 'medium';
  return 'low';
}

function maxUrgency(a: TodayTaskUrgency, b: TodayTaskUrgency): TodayTaskUrgency {
  return URGENCY_ORDER[a] <= URGENCY_ORDER[b] ? a : b;
}

const ASSIGN_RE = /Assignment:\s*(.+?)\s+-\s+(.+?)\s+due\s+([^.\n]+)\./i;

function parseCanvasDueFromChat(dueDateStr: string): Date | null {
  const year = new Date().getFullYear();
  const s = dueDateStr.trim();
  const attempts = [`${s}, ${year}`, s, `${s} ${year}`];
  for (const candidate of attempts) {
    const d = new Date(candidate);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function normSubject(s: string): string {
  return s.replace(/^(re|fwd):\s*/gi, '').trim().toLowerCase();
}

function canvasDedupeKey(title: string, due: Date): string {
  return `${title.trim().toLowerCase()}|${due.toISOString().slice(0, 10)}`;
}

type DraftEmailLink = {
  subjects: Set<string>;
  gmailIds: Set<string>;
  threadIds: Set<string>;
};

function extractDraftEmailLinks(
  drafts: { title: string; context: string | null }[]
): DraftEmailLink {
  const subjects = new Set<string>();
  const gmailIds = new Set<string>();
  const threadIds = new Set<string>();
  for (const d of drafts) {
    subjects.add(normSubject(d.title));
    if (!d.context) continue;
    try {
      const ctx = JSON.parse(d.context) as Record<string, unknown>;
      const inc = ctx.incomingSubject;
      if (typeof inc === 'string') subjects.add(normSubject(inc));
      const gid = ctx.gmailId ?? ctx.emailGmailId;
      if (typeof gid === 'string' && gid.length > 0) gmailIds.add(gid);
      const tid = ctx.threadId ?? ctx.emailThreadId;
      if (typeof tid === 'string' && tid.length > 0) threadIds.add(tid);
    } catch {
      /* ignore */
    }
  }
  return { subjects, gmailIds, threadIds };
}

function emailHasDraft(
  email: { subject: string; gmailId: string; threadId: string | null },
  links: DraftEmailLink
): boolean {
  if (links.gmailIds.has(email.gmailId)) return true;
  if (email.threadId && links.threadIds.has(email.threadId)) return true;
  return links.subjects.has(normSubject(email.subject));
}

function projectClassificationOk(ctx: Record<string, unknown>): boolean {
  const raw = ctx.classification;
  const classes = Array.isArray(raw)
    ? raw.map((x) => String(x))
    : raw != null
      ? [String(raw)]
      : [];
  return classes.some((c) => c === 'code_build' || c === 'document_build');
}

export async function buildTodayTasks(userId: string): Promise<TodayTask[]> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const canvasByKey = new Map<string, TodayTask>();
  const canvasForProjectMatch: Array<{
    title: string;
    description: string;
    urgency: TodayTaskUrgency;
  }> = [];

  const config = loadCanvasConfig(userId);
  if (config) {
    try {
      const [assignments, courses] = await Promise.all([
        getUpcomingAssignments(config, 7),
        getCourses(config),
      ]);
      const courseLabel = (courseId: number) => {
        const c = courses.find((x) => x.id === courseId);
        return c?.course_code || c?.name || `Course ${courseId}`;
      };

      for (const a of assignments) {
        if (!a.due_at) continue;
        const due = new Date(a.due_at);
        if (due.getTime() < now - 60 * 1000) continue;
        if (due.getTime() > now + weekMs) continue;
        const u = urgencyFromDueDate(due);
        const courseName = courseLabel(a.course_id);
        const title = a.name;
        const desc =
          stripHtml(a.description || '').slice(0, 280) ||
          `${courseName} — due soon.`;
        const task: TodayTask = {
          id: `canvas-assignment-${a.id}`,
          title,
          source: 'canvas',
          urgency: u,
          description: desc,
          dueDate: due.toISOString(),
          suggestedAction: a.html_url
            ? `Open in Canvas and submit before the deadline: ${a.html_url}`
            : 'Open Canvas and complete this assignment before the deadline.',
        };
        canvasByKey.set(canvasDedupeKey(title, due), task);
        canvasForProjectMatch.push({ title, description: desc, urgency: u });
      }
    } catch (e) {
      console.warn('[buildTodayTasks] Canvas API failed:', e);
    }
  }

  const canvasMessages = await db.chatMessage.findMany({
    where: { userId, source: 'canvas', content: { contains: 'due' } },
    orderBy: { timestamp: 'desc' },
    take: 30, // Reduced from 150 for faster page loads
    select: { id: true, content: true }, // Only fetch needed fields
  });

  for (const msg of canvasMessages) {
    const m = msg.content.match(ASSIGN_RE);
    if (!m) continue;
    const [, courseName, assignName, dueStr] = m;
    const due = parseCanvasDueFromChat(dueStr);
    if (!due || isNaN(due.getTime())) continue;
    if (due.getTime() < now - 60 * 1000) continue;
    if (due.getTime() > now + weekMs) continue;
    const key = canvasDedupeKey(assignName, due);
    if (canvasByKey.has(key)) continue;

    const u = urgencyFromDueDate(due);
    const tail = msg.content.replace(ASSIGN_RE, '').trim();
    const desc =
      stripHtml(tail).slice(0, 280) ||
      `${String(courseName).trim()} — complete before the due date.`;
    const task: TodayTask = {
      id: `canvas-chat-${msg.id}`,
      title: assignName.trim(),
      source: 'canvas',
      urgency: u,
      description: desc,
      dueDate: due.toISOString(),
      suggestedAction: 'Complete this Canvas assignment before the deadline.',
    };
    canvasByKey.set(key, task);
    canvasForProjectMatch.push({
      title: assignName.trim(),
      description: desc,
      urgency: u,
    });
  }

  const canvasTasks: InternalTask[] = [...canvasByKey.values()];

  const projects = await db.project.findMany({
    where: { userId, status: 'in_progress' },
    orderBy: { lastActive: 'desc' },
  });

  const projectTasks: InternalTask[] = [];
  for (const p of projects) {
    let ctx: Record<string, unknown> = {};
    try {
      ctx = p.context ? (JSON.parse(p.context) as Record<string, unknown>) : {};
    } catch {
      ctx = {};
    }
    if (!projectClassificationOk(ctx)) continue;

    const topicStrings: string[] = [p.name];
    const kt = ctx.keyTopics;
    if (Array.isArray(kt)) {
      for (const t of kt) {
        if (typeof t === 'string' && t.length >= 3) topicStrings.push(t);
      }
    }
    const topics = topicStrings.map((t) => t.toLowerCase());

    let u: TodayTaskUrgency = 'medium';
    for (const c of canvasForProjectMatch) {
      const blob = `${c.title} ${c.description}`.toLowerCase();
      if (topics.some((t) => t.length >= 3 && blob.includes(t))) {
        u = maxUrgency(u, c.urgency);
      }
    }

    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    projectTasks.push({
      id: `project-${p.id}`,
      title: p.name,
      source: 'project',
      urgency: u,
      description: (p.description || nextStep || 'In-progress build — continue the next step.').slice(
        0,
        280
      ),
      dueDate: null,
      suggestedAction:
        nextStep || 'Open the project workspace and continue implementation or writing.',
      lastActiveMs: p.lastActive.getTime(),
    });
  }

  const [receivedEmails, emailDrafts] = await Promise.all([
    db.email.findMany({
      where: { userId, direction: 'received', ingestChannel: 'important_inbox' },
      orderBy: { receivedAt: 'desc' },
      take: 20, // Reduced from 100 for faster page loads
      select: { id: true, subject: true, from: true, body: true, gmailId: true, threadId: true, receivedAt: true },
    }),
    db.draft.findMany({
      where: { userId, type: 'email' },
      take: 50, // Limit drafts too
      select: { title: true, context: true },
    }),
  ]);

  const links = extractDraftEmailLinks(emailDrafts);
  const emailTasks: InternalTask[] = [];
  for (const e of receivedEmails) {
    if (emailHasDraft(e, links)) continue;
    emailTasks.push({
      id: `email-${e.id}`,
      title: e.subject || '(No subject)',
      source: 'email',
      urgency: 'medium',
      description: `From ${e.from}: ${e.body.replace(/\s+/g, ' ').trim().slice(0, 200)}`,
      dueDate: null,
      suggestedAction:
        'Open your inbox and draft a reply, or review when Alter generates a draft.',
      receivedAtMs: e.receivedAt.getTime(),
    });
  }

  const all: InternalTask[] = [...canvasTasks, ...projectTasks, ...emailTasks];

  all.sort((a, b) => {
    const ur = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (ur !== 0) return ur;
    const sr = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
    if (sr !== 0) return sr;

    if (a.source === 'canvas' && b.source === 'canvas') {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return a.title.localeCompare(b.title);
    }
    if (a.source === 'project' && b.source === 'project') {
      const la = a.lastActiveMs ?? 0;
      const lb = b.lastActiveMs ?? 0;
      if (la !== lb) return lb - la;
      return a.title.localeCompare(b.title);
    }
    if (a.source === 'email' && b.source === 'email') {
      const ra = a.receivedAtMs ?? 0;
      const rb = b.receivedAtMs ?? 0;
      if (ra !== rb) return rb - ra;
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return all.map(
    ({ id, title, source, urgency, description, dueDate, suggestedAction }) => ({
      id,
      title,
      source,
      urgency,
      description,
      dueDate,
      suggestedAction,
    })
  );
}
