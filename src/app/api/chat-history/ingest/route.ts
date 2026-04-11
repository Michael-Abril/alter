/**
 * OWNER: Person 1 (Backend) + Person 3 (Royce/OpenClaw)
 * PURPOSE: POST: receive scraped chat history from OpenClaw
 * DEPENDENCIES: Prisma
 * STATUS: LIVE — writes to SQLite via Prisma
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { ingestChatMessages } from '@/lib/chat-history-ingest';

interface IngestMessage {
  role: string;
  content: string;
  sessionId?: string;
  timestamp?: string;
}

// POST: Receive scraped chat history from OpenClaw
export async function POST(req: NextRequest) {
  // Verify OpenClaw webhook secret (skip if not configured — local dev)
  const webhookSecret = req.headers.get('x-openclaw-secret');
  const expectedSecret = process.env.OPENCLAW_WEBHOOK_SECRET;
  if (expectedSecret && webhookSecret !== expectedSecret) {
    return apiError('Invalid webhook secret', 401);
  }

  try {
    const body = await req.json();
    const { userId, source, messages } = body as {
      userId: string;
      source: string;
      messages: IngestMessage[];
    };

    if (!userId || !source || !messages?.length) {
      return apiError('Missing required fields: userId, source, messages', 400);
    }

    console.log(`[chat-history/ingest] Received ${messages.length} messages from ${source} for user ${userId}`);

    // Find user by clerkId OR internal id (scrapers may send either)
    const user = await db.user.findFirst({
      where: { OR: [{ clerkId: userId }, { id: userId }] },
    });

    if (!user) {
      console.error(`[chat-history/ingest] No user found for identifier "${userId}" — rejecting`);
      return apiError(`User not found: ${userId}`, 404);
    }

    const { count } = await ingestChatMessages({
      prismaUserId: user.id,
      clerkId: user.clerkId,
      source,
      messages,
    });

    if (count === 0) {
      return apiSuccess({
        message: 'No new messages to ingest',
        source,
        userId: user.id,
        clerkId: user.clerkId,
        count: 0,
      });
    }

    console.log(`[chat-history/ingest] Wrote ${count} messages to database`);

    return apiSuccess({
      message: `Ingested ${count} messages`,
      source,
      userId: user.id,
      clerkId: user.clerkId,
      count,
    });
  } catch (error) {
    console.error('[chat-history/ingest] Error:', error);
    return apiError('Failed to ingest chat history', 500);
  }
}
