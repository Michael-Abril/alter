/**
 * Prioritization engine — ranks tasks and items by urgency, recency,
 * and actionability to determine what Alter should work on next.
 */

import db from '@/lib/db';

export interface PriorityItem {
  id: string;
  source: 'project' | 'email' | 'calendar' | 'github' | 'draft';
  title: string;
  description: string | null;
  urgencyScore: number;   // 0-1 how time-sensitive
  actionability: number;  // 0-1 how actionable
  recencyScore: number;   // 0-1 how recent
  overallScore: number;   // weighted combination
  reason: string;
  dueDate?: Date;
}

const URGENCY_WEIGHT = 0.4;
const ACTIONABILITY_WEIGHT = 0.35;
const RECENCY_WEIGHT = 0.25;

function daysFromNow(date: Date): number {
  return (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

function recencyFromDate(date: Date): number {
  const daysAgo = -daysFromNow(date);
  if (daysAgo < 0) return 1.0;
  if (daysAgo < 1) return 0.95;
  if (daysAgo < 3) return 0.8;
  if (daysAgo < 7) return 0.5;
  return Math.max(0.1, 1 - daysAgo / 30);
}

export async function prioritize(userId: string): Promise<PriorityItem[]> {
  const items: PriorityItem[] = [];

  const [projects, pendingDrafts, calEvents, recentEmails, ghActivity] = await Promise.all([
    db.project.findMany({
      where: { userId, status: 'in_progress' },
      orderBy: { lastActive: 'desc' },
      take: 10,
    }),
    db.draft.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.calendarEvent.findMany({
      where: {
        userId,
        startTime: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    }).catch(() => []),
    db.email.findMany({
      where: {
        userId,
        direction: 'received',
        receivedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
    }),
    db.githubActivity.findMany({
      where: {
        userId,
        authoredAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { authoredAt: 'desc' },
      take: 10,
    }).catch(() => []),
  ]);

  for (const project of projects) {
    const recency = recencyFromDate(project.lastActive);
    const actionability = project.progress < 90 ? 0.8 : 0.4;
    const urgency = project.progress > 50 ? 0.6 : 0.4;
    const context = project.context ? JSON.parse(project.context) : {};

    items.push({
      id: project.id,
      source: 'project',
      title: project.name,
      description: context.nextStep || project.description,
      urgencyScore: urgency,
      actionability,
      recencyScore: recency,
      overallScore: urgency * URGENCY_WEIGHT + actionability * ACTIONABILITY_WEIGHT + recency * RECENCY_WEIGHT,
      reason: context.nextStep ? `Next: ${context.nextStep}` : `${project.progress}% complete, recently active`,
    });
  }

  for (const draft of pendingDrafts) {
    items.push({
      id: draft.id,
      source: 'draft',
      title: `Review: ${draft.title}`,
      description: `Pending ${draft.type} draft for ${draft.targetApp}`,
      urgencyScore: 0.7,
      actionability: 1.0,
      recencyScore: recencyFromDate(draft.createdAt),
      overallScore: 0.7 * URGENCY_WEIGHT + 1.0 * ACTIONABILITY_WEIGHT + recencyFromDate(draft.createdAt) * RECENCY_WEIGHT,
      reason: 'Pending draft awaiting review',
    });
  }

  for (const event of calEvents) {
    const dLeft = daysFromNow(event.startTime);
    const urgency = dLeft < 1 ? 1.0 : dLeft < 3 ? 0.8 : 0.5;
    const titleLower = event.title.toLowerCase();
    const isDeadline = ['due', 'deadline', 'quiz', 'exam', 'assignment', 'submit'].some(k => titleLower.includes(k));
    const actionability = isDeadline ? 0.9 : 0.4;

    items.push({
      id: event.id,
      source: 'calendar',
      title: event.title,
      description: event.description,
      urgencyScore: urgency,
      actionability,
      recencyScore: 0.8,
      overallScore: urgency * URGENCY_WEIGHT + actionability * ACTIONABILITY_WEIGHT + 0.8 * RECENCY_WEIGHT,
      reason: isDeadline
        ? `Deadline in ${Math.ceil(dLeft)} day(s)`
        : `Event in ${Math.ceil(dLeft)} day(s)`,
      dueDate: event.startTime,
    });
  }

  for (const email of recentEmails) {
    const recency = recencyFromDate(email.receivedAt);
    items.push({
      id: email.id,
      source: 'email',
      title: `Reply to: ${email.subject}`,
      description: `From ${email.from.split('<')[0].trim()}`,
      urgencyScore: 0.5,
      actionability: 0.7,
      recencyScore: recency,
      overallScore: 0.5 * URGENCY_WEIGHT + 0.7 * ACTIONABILITY_WEIGHT + recency * RECENCY_WEIGHT,
      reason: 'Recent email may need a response',
    });
  }

  for (const gh of ghActivity) {
    if (gh.type !== 'issue' && gh.type !== 'pr') continue;
    const recency = recencyFromDate(gh.authoredAt);
    items.push({
      id: gh.id,
      source: 'github',
      title: gh.title,
      description: gh.body?.slice(0, 200) || null,
      urgencyScore: gh.type === 'issue' ? 0.5 : 0.4,
      actionability: 0.6,
      recencyScore: recency,
      overallScore: (gh.type === 'issue' ? 0.5 : 0.4) * URGENCY_WEIGHT + 0.6 * ACTIONABILITY_WEIGHT + recency * RECENCY_WEIGHT,
      reason: gh.type === 'issue' ? 'Open issue needs attention' : 'Open PR needs review',
    });
  }

  items.sort((a, b) => b.overallScore - a.overallScore);
  return items;
}
