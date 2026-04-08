/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: POST: OpenClaw calls this to report completed actions
 * DEPENDENCIES: Prisma
 * STATUS: LIVE — stores actions in DB with optional webhook verification
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Fetch all actions for authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    // Find user with auto-link fallback
    let user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      const testUser = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
      if (testUser) {
        user = await db.user.update({
          where: { id: testUser.id },
          data: { clerkId: userId },
        });
      }
    }

    if (!user) return apiError('User not found', 404);

    const actions = await db.action.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return apiSuccess({
      actions: actions.map(a => ({
        id: a.id,
        userId: a.userId,
        type: a.type,
        title: a.title,
        description: a.description,
        app: a.app,
        confidence: a.confidence,
        status: a.status,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
      count: actions.length,
    });
  } catch (error) {
    console.error('[actions] GET error:', error);
    return apiError('Failed to fetch actions', 500);
  }
}

// POST: OpenClaw reports a completed action
export async function POST(req: NextRequest) {
  // Verify OpenClaw webhook secret (skip if not configured for local dev)
  const webhookSecret = req.headers.get('x-openclaw-secret');
  const expectedSecret = process.env.OPENCLAW_WEBHOOK_SECRET;
  
  if (expectedSecret && webhookSecret !== expectedSecret) {
    return apiError('Invalid webhook secret', 401);
  }

  try {
    const body = await req.json();
    const { userId, type, title, description, app, confidence, status, metadata } = body;

    if (!userId || !type || !title || !app) {
      return apiError('Missing required fields: userId, type, title, app', 400);
    }

    // Accept both internal user id and clerkId from callers.
    const user = await db.user.findFirst({
      where: {
        OR: [{ id: userId }, { clerkId: userId }],
      },
      select: { id: true },
    });
    if (!user) return apiError('User not found', 404);

    // Store action in DB
    const action = await db.action.create({
      data: {
        userId: user.id,
        type,
        title,
        description: description || null,
        app,
        confidence: confidence || null,
        status: status || 'completed',
        metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
      },
    });

    console.log(`[actions] Action recorded: ${type} — ${title} (${app}) [${action.id}]`);

    return apiSuccess({
      message: 'Action recorded',
      actionId: action.id,
      type,
      title,
      status: action.status,
    });
  } catch (error) {
    console.error('[actions] Error:', error);
    return apiError('Failed to record action', 500);
  }
}
