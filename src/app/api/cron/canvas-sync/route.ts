/**
 * POST /api/cron/canvas-sync — refresh Canvas-derived ChatMessage rows for all users with saved tokens.
 * Secured with CRON_SECRET (header x-cron-secret).
 */

import fs from 'fs';
import path from 'path';
import db from '@/lib/db';
import { loadCanvasConfig } from '@/lib/canvas';
import { buildCanvasIngestMessages } from '@/lib/canvas-sync-messages';
import { ingestChatMessages } from '@/lib/chat-history-ingest';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'canvas-config.json');

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userIds: string[] = [];
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return Response.json({ ok: true, synced: 0, message: 'no canvas config file' });
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    userIds = Object.keys(JSON.parse(raw));
  } catch {
    return Response.json({ ok: true, synced: 0, message: 'no canvas config' });
  }

  const results: Array<{ userId: string; ingested: number; built?: number }> = [];

  for (const uid of userIds) {
    const config = loadCanvasConfig(uid);
    if (!config) continue;

    const user = await db.user.findUnique({
      where: { id: uid },
      select: { id: true, clerkId: true },
    });
    if (!user) continue;

    try {
      const messages = await buildCanvasIngestMessages(config, {
        daysAhead: 21,
        daysBack: 14,
        maxSyllabusCourses: 10,
        maxConversations: 12,
      });
      if (messages.length === 0) {
        results.push({ userId: uid, ingested: 0, built: 0 });
        continue;
      }
      const { count } = await ingestChatMessages({
        prismaUserId: user.id,
        clerkId: user.clerkId,
        source: 'canvas',
        messages,
      });
      results.push({ userId: uid, ingested: count, built: messages.length });
    } catch (e) {
      console.warn('[cron/canvas-sync] user', uid, e);
    }
  }

  return Response.json({
    ok: true,
    users: userIds.length,
    results,
  });
}
