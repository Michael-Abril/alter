/**
 * Unified priority endpoint — powers both Today's Focus and Handoff.
 *
 * Returns the same scored, classified task list so both features derive from
 * one prioritization pass. The handoff page calls this instead of /api/projects
 * so it sees the same ranked view the dashboard shows under Today's Focus.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { tryAuthUser } from '@/lib/clerk-user';
import { buildTodayTasks } from '@/lib/tasks-today';
import { buildUnifiedPriority, scoreProjectRow, type ProjectRow } from '@/lib/unified-priority';
import { parsePriorityContext } from '@/lib/priority-context';
import db from '@/lib/db';
import { isHandoffEligible } from '@/lib/project-deliverable';

function parseLastMessageAt(context: string | null): number | null {
  if (!context) return null;
  try {
    const c = JSON.parse(context) as Record<string, unknown>;
    const v = c.lastMessageAt;
    if (typeof v !== 'string') return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const auth = await tryAuthUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  // Fetch tasks and all projects in parallel
  const [tasks, allProjects] = await Promise.all([
    buildTodayTasks(user.id).catch(() => []),
    db.project.findMany({
      where: { userId: user.id, status: { not: 'completed' } },
      orderBy: { lastActive: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        context: true,
        status: true,
        progress: true,
        lastActive: true,
      },
    }),
  ]);

  // Build the unified priority result (shared engine)
  const projectRows: (ProjectRow & { progress?: number })[] = allProjects.map((p) => ({
    id: p.id,
    name: p.name,
    context: p.context,
    lastActive: p.lastActive,
    progress: p.progress,
  }));

  const unified = buildUnifiedPriority(tasks, projectRows, {
    priorityContext: parsePriorityContext(user.priorityContext),
  });

  const freshnessCutoffMs = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const eligibleProjects = allProjects.filter((p) => {
    if (!isHandoffEligible(p.context)) return false;
    const evidenceMs = parseLastMessageAt(p.context) ?? p.lastActive.getTime();
    return evidenceMs >= freshnessCutoffMs;
  });

  // Build the handoff project list — deliverable-classified projects only, ranked by unified score
  const rankedProjects = [...eligibleProjects].sort((a, b) => {
    const sA = scoreProjectRow({
      id: a.id,
      name: a.name,
      context: a.context,
      lastActive: a.lastActive,
      progress: a.progress,
      status: a.status,
    });
    const sB = scoreProjectRow({
      id: b.id,
      name: b.name,
      context: b.context,
      lastActive: b.lastActive,
      progress: b.progress,
      status: b.status,
    });
    if (sB !== sA) return sB - sA;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.lastActive.getTime() - a.lastActive.getTime();
  });

  // Parse context for client
  const projectsForClient = rankedProjects.map((p) => {
    let ctx: { nextStep?: string; keyTopics?: string[] } | null = null;
    try {
      ctx = p.context ? (JSON.parse(p.context) as { nextStep?: string; keyTopics?: string[] }) : null;
    } catch {
      ctx = null;
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      progress: p.progress,
      lastActive: p.lastActive.toISOString(),
      context: ctx,
    };
  });

  return apiSuccess({
    focusItems: unified.focusItems,
    handoffItems: unified.handoffItems,
    suggestedAutomations: unified.suggestedAutomations,
    /** All non-completed projects ranked by unified score — for Handoff's project list */
    projects: projectsForClient,
    noiseFiltered: unified.noiseFiltered,
  });
}
