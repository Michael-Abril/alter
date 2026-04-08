/**
 * OWNER: Person 1 (Backend) + Person 3 (Royce/OpenClaw)
 * PURPOSE: POST: receive scraped chat history from OpenClaw
 * DEPENDENCIES: Prisma
 * STATUS: LIVE — writes to SQLite via Prisma
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import {
  buildMessageFingerprint,
  readFingerprints,
  writeFingerprints,
  type SyncSource,
} from '@/lib/onboarding-sync';

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
    let user = await db.user.findFirst({
      where: { OR: [{ clerkId: userId }, { id: userId }] },
    });

    if (!user) {
      console.log(`[chat-history/ingest] User ${userId} not found, creating placeholder...`);
      user = await db.user.create({
        data: {
          clerkId: userId,
          email: `${userId}@nightshift.local`,
          name: userId,
        },
      });
      console.log(`[chat-history/ingest] Created placeholder user: ${user.id}`);
    }

    // Validate messages
    const validMessages = messages.filter(
      (msg) => msg.role && msg.content && msg.content.trim().length > 0
    );

    // Dedupe within payload to avoid repeated inserts on retried scrapes.
    const dedupedMessages: IngestMessage[] = [];
    const seen = new Set<string>();
    for (const msg of validMessages) {
      const ts = msg.timestamp || '';
      const key = `${msg.role}|${msg.sessionId || ''}|${ts}|${msg.content.slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedMessages.push(msg);
    }

    if (dedupedMessages.length === 0) {
      return apiError('No valid messages in payload (need role + non-empty content)', 400);
    }

    const syncSource: SyncSource = source === 'claude' ? 'claude' : 'chatgpt';
    const storedFingerprints = readFingerprints(userId, syncSource);
    const netNewMessages = dedupedMessages.filter((msg) => {
      const fp = buildMessageFingerprint({
        source,
        role: msg.role,
        content: msg.content,
        sessionId: msg.sessionId,
        timestamp: msg.timestamp,
      });
      if (storedFingerprints.has(fp)) return false;
      storedFingerprints.add(fp);
      return true;
    });

    if (netNewMessages.length === 0) {
      return apiSuccess({
        message: 'No new messages to ingest',
        source,
        userId: user.id,
        clerkId: userId,
        count: 0,
      });
    }

    // Batch insert chat messages
    const result = await db.chatMessage.createMany({
      data: netNewMessages.map((msg) => ({
        userId: user!.id,
        source,
        role: msg.role,
        content: msg.content,
        sessionId: msg.sessionId || null,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })),
    });
    writeFingerprints(userId, syncSource, storedFingerprints);

    console.log(`[chat-history/ingest] Wrote ${result.count} messages to database`);

    return apiSuccess({
      message: `Ingested ${result.count} messages`,
      source,
      userId: user.id,
      clerkId: userId,
      count: result.count,
    });
  } catch (error) {
    console.error('[chat-history/ingest] Error:', error);
    return apiError('Failed to ingest chat history', 500);
  }
}
