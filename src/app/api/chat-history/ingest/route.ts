/**
 * OWNER: Person 1 (Backend) + Person 3 (Royce/OpenClaw)
 * PURPOSE: POST: receive scraped chat history from OpenClaw
 * DEPENDENCIES: Prisma
 * STATUS: Scaffold — needs real implementation with webhook verification
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// POST: Receive scraped chat history from OpenClaw
export async function POST(req: NextRequest) {
  // TODO: Person 1 — Verify OpenClaw webhook secret
  const webhookSecret = req.headers.get('x-openclaw-secret');
  if (webhookSecret !== process.env.OPENCLAW_WEBHOOK_SECRET) {
    return apiError('Invalid webhook secret', 401);
  }

  try {
    const body = await req.json();
    const { userId, source, messages } = body;

    if (!userId || !source || !messages?.length) {
      return apiError('Missing required fields: userId, source, messages', 400);
    }

    // TODO: Person 1 — Validate user exists, store messages in DB
    // const user = await db.user.findUnique({ where: { id: userId } });
    // if (!user) return apiError('User not found', 404);

    // TODO: Person 1 — Batch insert chat messages
    // await db.chatMessage.createMany({
    //   data: messages.map((msg) => ({
    //     userId,
    //     source,
    //     role: msg.role,
    //     content: msg.content,
    //     sessionId: msg.sessionId || null,
    //     timestamp: new Date(msg.timestamp),
    //   })),
    // });

    console.log(`[chat-history/ingest] Received ${messages.length} messages from ${source} for user ${userId}`);

    return apiSuccess({
      message: `Ingested ${messages.length} messages`,
      source,
      userId,
    });
  } catch (error) {
    console.error('[chat-history/ingest] Error:', error);
    return apiError('Failed to ingest chat history', 500);
  }
}
