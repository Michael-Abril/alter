/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GET: generate/return morning brief — aggregates real project data and chat stats
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — returns real data from projects + chat history, falls back to starter brief
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Generate and return morning brief
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    // Find the user
    const user = await db.user.findUnique({ where: { clerkId: userId } });

    // Get real projects
    const projects = user ? await db.project.findMany({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' },
    }) : [];

    // Get chat stats
    const chatCount = user ? await db.chatMessage.count({
      where: { userId: user.id },
    }) : 0;

    const embeddedCount = user ? await db.chatMessage.count({
      where: { userId: user.id, embedded: true },
    }) : 0;

    // Get unique sessions
    const sessions = user ? await db.chatMessage.groupBy({
      by: ['sessionId'],
      where: { userId: user.id },
    }) : [];

    // Build real brief from detected projects
    const inProgress = projects.filter(p => p.status === 'in_progress');
    const completed = projects.filter(p => p.status === 'completed');
    const stalled = projects.filter(p => p.status === 'stalled');

    // Generate summary from real data
    const summaryParts: string[] = [];
    if (projects.length > 0) {
      summaryParts.push(`I've analyzed ${chatCount} chat messages across ${sessions.length} conversations and detected ${projects.length} projects.`);
      if (inProgress.length > 0) {
        summaryParts.push(`${inProgress.length} project${inProgress.length > 1 ? 's are' : ' is'} in progress.`);
      }
      if (completed.length > 0) {
        summaryParts.push(`${completed.length} project${completed.length > 1 ? 's appear' : ' appears'} completed.`);
      }
      if (stalled.length > 0) {
        summaryParts.push(`${stalled.length} project${stalled.length > 1 ? 's need' : ' needs'} attention.`);
      }
    } else {
      summaryParts.push('No projects detected yet. Run the project detector to analyze your chat history.');
    }

    // Build completed actions from completed projects
    const completedActions = completed.map(p => {
      const ctx = p.context ? JSON.parse(p.context) : {};
      return {
        id: p.id,
        userId: p.userId,
        type: 'task_completed' as const,
        title: p.name,
        description: p.description || ctx.nextStep || 'Project completed',
        app: 'claude',
        confidence: (p.progress / 100),
        status: 'completed' as const,
        metadata: null,
        createdAt: p.updatedAt.toISOString(),
      };
    });

    // Build flagged items from stalled projects
    const flaggedItems = stalled.map(p => {
      const ctx = p.context ? JSON.parse(p.context) : {};
      return {
        id: p.id,
        userId: p.userId,
        type: 'flagged' as const,
        title: `${p.name} — stalled`,
        description: ctx.nextStep || 'This project has gone quiet. Review and decide next steps.',
        app: 'claude',
        confidence: 0.4,
        status: 'flagged' as const,
        metadata: null,
        createdAt: p.lastActive.toISOString(),
      };
    });

    // Build suggested focus from in-progress projects sorted by progress (lowest first)
    const suggestedFocus = inProgress
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4)
      .map(p => {
        const ctx = p.context ? JSON.parse(p.context) : {};
        return {
          title: p.name,
          reason: ctx.nextStep || `${p.progress}% complete — continue this work`,
          priority: (p.progress >= 70 ? 'high' : p.progress >= 40 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        };
      });

    return apiSuccess({
      summary: summaryParts.join(' '),
      actionsCompleted: completed.length,
      flaggedForReview: stalled.length,
      completedActions,
      flaggedItems,
      suggestedFocus,
      generatedAt: new Date().toISOString(),
      stats: {
        totalProjects: projects.length,
        inProgress: inProgress.length,
        completed: completed.length,
        stalled: stalled.length,
        totalMessages: chatCount,
        embeddedMessages: embeddedCount,
        conversations: sessions.length,
      },
      source: projects.length > 0 ? 'database' : 'empty',
    });
  } catch (error) {
    console.error('[brief] Error:', error);
    return apiError('Failed to generate brief', 500);
  }
}
