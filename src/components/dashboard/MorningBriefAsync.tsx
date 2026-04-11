/**
 * Async server component for morning brief lead.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import db from '@/lib/db';
import { buildMorningBriefLead, firstNameFromUser } from '@/lib/dashboard-morning-line';
import { buildTodayTasks } from '@/lib/tasks-today';
import MorningBriefLead from './MorningBriefLead';

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string;
};

function parseProjectContext(rawContext: string | null): Record<string, unknown> {
  if (!rawContext) return {};
  try {
    return JSON.parse(rawContext) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function MorningBriefAsync({ userId, userName, userEmail }: Props) {
  const since24h = new Date();
  since24h.setDate(since24h.getDate() - 1);

  // Fetch all data in parallel
  const [overnightWork, overnightDrafts, todayTasks, inProgressProjects] = await Promise.all([
    db.action.count({
      where: { userId, type: 'work_continued', createdAt: { gte: since24h } },
    }),
    db.draft.count({
      where: { userId, type: 'email', createdAt: { gte: since24h } },
    }),
    buildTodayTasks(userId).catch(() => []),
    db.project.findMany({
      where: { userId, status: 'in_progress' },
      select: { context: true },
      take: 10,
    }),
  ]);

  const topCanvasTask = todayTasks.find((t) => t.source === 'canvas');
  const hasDocOrAcademicInProgress = inProgressProjects.some((p) => {
    const c = parseProjectContext(p.context);
    return c.classification === 'document_build' || c.classification === 'academic_deliverable';
  });

  const morningLead = buildMorningBriefLead({
    firstName: firstNameFromUser(userName, userEmail),
    projectsContinued: overnightWork,
    emailDraftsOvernight: overnightDrafts,
    topCanvas: topCanvasTask
      ? { title: topCanvasTask.title, dueDate: topCanvasTask.dueDate }
      : null,
    hasDocOrAcademicInProgress,
  });

  return <MorningBriefLead lead={morningLead} />;
}
