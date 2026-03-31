/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: GET/PATCH: view or approve/reject a specific draft
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: View a specific draft
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 4 — Fetch real draft from DB
  // const draft = await db.draft.findFirst({ where: { id: params.id, user: { clerkId: userId } } });
  // if (!draft) return apiError('Draft not found', 404);

  const mockDraft = {
    id: params.id,
    type: 'email',
    title: 'Re: Follow-up on Q2 Timeline',
    content: 'Hey Sarah,\n\nJust following up on our conversation about the Q2 timeline.\n\nBest,\nUser',
    targetApp: 'gmail',
    confidenceScore: 0.87,
    status: 'pending',
    context: JSON.stringify({ retrievedSources: 3 }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return apiSuccess(mockDraft);
}

// PATCH: Update draft status (approve/reject)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { status, content } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return apiError('Invalid status. Must be "approved" or "rejected"', 400);
    }

    // TODO: Person 4 — Update draft in DB, if approved trigger sending via appropriate app
    // const draft = await db.draft.update({
    //   where: { id: params.id },
    //   data: { status, content: content || undefined },
    // });

    console.log(`[drafts/${params.id}] Status updated to: ${status}`);

    return apiSuccess({
      id: params.id,
      status,
      message: status === 'approved' ? 'Draft approved and queued for delivery' : 'Draft rejected',
    });
  } catch (error) {
    console.error(`[drafts/${params.id}] Error:`, error);
    return apiError('Failed to update draft', 500);
  }
}
