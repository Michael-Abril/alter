/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GET: unfinished tasks, POST: submit handoff selections
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: Return unfinished tasks detected for the user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 3 (Royce) — Implement real unfinished work detection:
  // 1. Check for draft emails in Gmail
  // 2. Check for incomplete docs (via metadata from OpenClaw)
  // 3. Check for open PRs on GitHub
  // 4. Check for stalled projects from /api/projects
  // 5. Score estimated confidence for each task

  const mockTasks = [
    {
      id: 'task_1',
      projectId: 'proj_1',
      title: 'Finish Fanzley proposal — sections 3-5',
      description: 'Proposal is 60% done. Sections 3 (Pricing), 4 (Timeline), and 5 (Terms) need completion.',
      app: 'gdocs',
      estimatedConfidence: 0.87,
      selected: false,
    },
    {
      id: 'task_2',
      title: 'Reply to Sarah Chen — Q2 marketing timeline',
      description: 'Sarah asked about the Q2 timeline. Draft a response confirming the Tuesday meeting.',
      app: 'gmail',
      estimatedConfidence: 0.92,
      selected: false,
    },
    {
      id: 'task_3',
      title: 'Send follow-up to Mike about API specs',
      description: 'Mike requested the technical specification summary yesterday.',
      app: 'gmail',
      estimatedConfidence: 0.89,
      selected: false,
    },
    {
      id: 'task_4',
      title: 'Update project timeline in Notion',
      description: 'The launch date moved from March 15 to March 22. Update milestones.',
      app: 'notion',
      estimatedConfidence: 0.85,
      selected: false,
    },
    {
      id: 'task_5',
      projectId: 'proj_2',
      title: 'Review and merge PR #47 — Auth refactor',
      description: 'PR has been open for 2 days. Run tests, review changes, and merge if OK.',
      app: 'github',
      estimatedConfidence: 0.65,
      selected: false,
    },
  ];

  return apiSuccess(mockTasks);
}

// POST: Submit handoff selections — activate NightShift for tonight
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { tasks, specialInstructions, wakeTime } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return apiError('No tasks selected for handoff', 400);
    }

    // TODO: Person 3 (Royce) — Implement handoff submission:
    // 1. Validate task IDs
    // 2. Store handoff session in DB
    // 3. Trigger OpenClaw orchestration workflow
    // 4. Update user's wake time if provided

    console.log(`[handoff] Activated for user ${userId}:`, {
      taskCount: tasks.length,
      specialInstructions,
      wakeTime,
    });

    return apiSuccess({
      message: 'NightShift activated',
      tasksQueued: tasks.length,
      estimatedCompletion: wakeTime || '07:00',
    });
  } catch (error) {
    console.error('[handoff] Error:', error);
    return apiError('Failed to activate NightShift', 500);
  }
}
