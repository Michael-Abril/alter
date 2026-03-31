/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: GET: list all pending drafts for a user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: List all pending drafts for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 4 — Fetch real drafts from DB
  // const drafts = await db.draft.findMany({
  //   where: { user: { clerkId: userId }, status: 'pending' },
  //   orderBy: { createdAt: 'desc' },
  // });

  const mockDrafts = [
    {
      id: 'draft_1',
      type: 'email',
      title: 'Re: Follow-up on Q2 Timeline',
      content: 'Hey Sarah,\n\nJust following up on our conversation about the Q2 timeline. I\'ve updated the milestones to reflect the new March 22 launch date.\n\nBest,\nUser',
      targetApp: 'gmail',
      confidenceScore: 0.87,
      status: 'pending',
      context: null,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'draft_2',
      type: 'email',
      title: 'Reply to CEO — Budget Approval',
      content: 'Hi James,\n\nThank you for flagging this. I\'ve reviewed the budget numbers and have a few thoughts...\n\nBest,\nUser',
      targetApp: 'gmail',
      confidenceScore: 0.45,
      status: 'pending',
      context: null,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ];

  return apiSuccess(mockDrafts);
}
