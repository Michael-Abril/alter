/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: POST: OpenClaw calls this to report completed actions
 * DEPENDENCIES: Prisma
 * STATUS: Scaffold — needs real implementation with webhook verification
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// POST: OpenClaw reports a completed action
export async function POST(req: NextRequest) {
  // TODO: Person 3 (Royce) — Verify OpenClaw webhook secret
  const webhookSecret = req.headers.get('x-openclaw-secret');
  if (webhookSecret !== process.env.OPENCLAW_WEBHOOK_SECRET) {
    return apiError('Invalid webhook secret', 401);
  }

  try {
    const body = await req.json();
    const { userId, type, title, description, app, confidence, status, metadata } = body;

    if (!userId || !type || !title || !app) {
      return apiError('Missing required fields: userId, type, title, app', 400);
    }

    // TODO: Person 3 (Royce) — Store action in DB
    // const action = await db.action.create({
    //   data: {
    //     userId,
    //     type,
    //     title,
    //     description: description || null,
    //     app,
    //     confidence: confidence || null,
    //     status: status || 'completed',
    //     metadata: metadata ? JSON.stringify(metadata) : null,
    //   },
    // });

    console.log(`[actions] Action reported: ${type} — ${title} (${app})`);

    return apiSuccess({
      message: 'Action recorded',
      actionId: 'act_' + Date.now(),
      type,
      title,
      status: status || 'completed',
    });
  } catch (error) {
    console.error('[actions] Error:', error);
    return apiError('Failed to record action', 500);
  }
}
