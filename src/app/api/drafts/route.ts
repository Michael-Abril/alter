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
import { tryAuthUser, resolveUserForClerkId } from '@/lib/clerk-user';

// GET: List all pending drafts for the authenticated user
export async function GET() {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const drafts = await db.draft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(
      drafts.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        content: d.content,
        targetApp: d.targetApp,
        confidenceScore: d.confidenceScore,
        status: d.status,
        context: d.context ? JSON.parse(d.context) : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[drafts] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch drafts',
      500
    );
  }
}

// POST: Create draft (supports authenticated app flow and orchestration flow)
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();

  // Optional webhook secret for orchestration scripts (skip if not configured).
  const webhookSecret = req.headers.get('x-openclaw-secret');
  const expectedSecret = process.env.OPENCLAW_WEBHOOK_SECRET;
  if (expectedSecret && webhookSecret !== expectedSecret && !clerkId) {
    return apiError('Invalid webhook secret', 401);
  }

  try {
    const body = await req.json();
    const {
      userId,
      type,
      title,
      content,
      targetApp,
      confidenceScore,
      status,
      context,
    } = body;

    if (!type || !title || !content || !targetApp) {
      return apiError('Missing required fields: type, title, content, targetApp', 400);
    }

    // Resolve user by auth first, then by provided userId (internal id or clerkId).
    let user = clerkId ? await resolveUserForClerkId(clerkId) : null;
    if (!user && userId) {
      user = await db.user.findFirst({
        where: {
          OR: [{ id: userId }, { clerkId: userId }],
        },
      });
    }

    if (!user) {
      return apiError('User not found', 404, { code: 'USER_NOT_FOUND' });
    }

    const draft = await db.draft.create({
      data: {
        userId: user.id,
        type,
        title,
        content,
        targetApp,
        confidenceScore: typeof confidenceScore === 'number' ? confidenceScore : 0.5,
        status: status || 'pending',
        context:
          typeof context === 'string'
            ? context
            : context
            ? JSON.stringify(context)
            : null,
      },
    });

    return apiSuccess({
      id: draft.id,
      draftId: draft.id,
      status: draft.status,
      createdAt: draft.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[drafts] POST error:', error);
    return apiError('Failed to create draft', 500);
  }
}
