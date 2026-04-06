/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: GET: list all pending drafts for a user, POST: create new draft
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — GET returns mock data, POST creates real drafts
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

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

// POST: Create a new draft (for orchestration scripts, no auth required if userId provided)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, title, content, targetApp, confidenceScore, status, context } = body;

    if (!userId || !type || !title || !content || !targetApp) {
      return apiError('Missing required fields: userId, type, title, content, targetApp', 400);
    }

    // Create draft in database
    const draft = await db.draft.create({
      data: {
        userId,
        type,
        title,
        content,
        targetApp,
        confidenceScore: confidenceScore || 0.5,
        status: status || 'pending',
        context: typeof context === 'string' ? context : JSON.stringify(context || {}),
      },
    });

    console.log(`[drafts] Created draft: ${draft.id} (${draft.type})`);

    return apiSuccess({
      id: draft.id,
      draftId: draft.id,
      type: draft.type,
      title: draft.title,
      confidenceScore: draft.confidenceScore,
      status: draft.status,
    });
  } catch (error) {
    console.error('[drafts] Error:', error);
    return apiError('Failed to create draft', 500);
  }
}
