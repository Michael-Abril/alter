/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: GET: return detected active projects for a user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real project detection logic
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: Return detected active projects for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 2 — Implement real project detection:
  // 1. Query user's emails and chat history for project-related keywords
  // 2. Use vector similarity to cluster related activities
  // 3. Detect stalled projects (no activity in X days)
  // const projects = await db.project.findMany({
  //   where: { user: { clerkId: userId } },
  //   orderBy: { lastActive: 'desc' },
  // });

  const mockProjects = [
    {
      id: 'proj_1',
      name: 'Fanzley Proposal',
      description: 'Q2 partnership proposal for Fanzley Inc.',
      status: 'in_progress',
      lastActive: new Date(Date.now() - 3600000 * 5).toISOString(),
      progress: 60,
    },
    {
      id: 'proj_2',
      name: 'Auth Refactor',
      description: 'Refactoring authentication module — PR #47 open',
      status: 'in_progress',
      lastActive: new Date(Date.now() - 86400000 * 2).toISOString(),
      progress: 85,
    },
    {
      id: 'proj_3',
      name: 'Q1 Marketing Report',
      description: 'Quarterly marketing performance report',
      status: 'stalled',
      lastActive: new Date(Date.now() - 86400000 * 7).toISOString(),
      progress: 40,
    },
  ];

  return apiSuccess(mockProjects);
}
