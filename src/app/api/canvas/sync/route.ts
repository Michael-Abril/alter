/**
 * POST /api/canvas/sync — pull Canvas assignments/announcements into ChatMessage (source: canvas).
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { loadCanvasConfig } from '@/lib/canvas';
import { buildCanvasIngestMessages } from '@/lib/canvas-sync-messages';
import { ingestChatMessages } from '@/lib/chat-history-ingest';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    const config = loadCanvasConfig(user.id);
    if (!config) {
      return apiError('Canvas not connected — add token and domain first', 400);
    }

    const body = await req.json().catch(() => ({}));
    const daysAhead =
      typeof body.daysAhead === 'number' && body.daysAhead > 0 && body.daysAhead <= 365
        ? body.daysAhead
        : 14;
    const daysBack =
      typeof body.daysBack === 'number' && body.daysBack > 0 && body.daysBack <= 365
        ? body.daysBack
        : 14;
    const maxSyllabusCourses =
      typeof body.maxSyllabusCourses === 'number' && body.maxSyllabusCourses >= 0
        ? Math.min(body.maxSyllabusCourses, 30)
        : 10;
    const maxConversations =
      typeof body.maxConversations === 'number' && body.maxConversations >= 0
        ? Math.min(body.maxConversations, 50)
        : 12;

    const messages = await buildCanvasIngestMessages(config, {
      daysAhead,
      daysBack,
      maxSyllabusCourses,
      maxConversations,
      includeSyllabus: body.includeSyllabus !== false,
      includeConversations: body.includeConversations !== false,
    });

    if (messages.length === 0) {
      return apiSuccess({
        message: 'No Canvas assignments or announcements in range',
        built: 0,
        ingested: 0,
      });
    }

    const { count } = await ingestChatMessages({
      prismaUserId: user.id,
      clerkId: user.clerkId,
      source: 'canvas',
      messages,
    });

    console.log(`[canvas/sync] Ingested ${count} new Canvas messages for user ${user.id}`);

    return apiSuccess({
      message: `Ingested ${count} Canvas messages`,
      built: messages.length,
      ingested: count,
    });
  } catch (error: any) {
    console.error('[canvas/sync] Error:', error);
    return apiError(error?.message || 'Canvas sync failed', 500);
  }
}
