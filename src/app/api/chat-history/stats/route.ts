/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GET: return chat message counts per user, broken down by source
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  const source = req.nextUrl.searchParams.get('source');
  const sinceDaysParam = req.nextUrl.searchParams.get('sinceDays');
  const sinceDays = sinceDaysParam ? Math.max(1, parseInt(sinceDaysParam, 10)) : null;
  const sinceDate = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : null;

  // If authenticated, scope to this user. Otherwise show all (local dev).
  const whereClause: any = clerkId ? { user: { clerkId } } : {};
  if (source === 'claude' || source === 'chatgpt') whereClause.source = source;
  if (sinceDate) whereClause.timestamp = { gte: sinceDate };

  try {
    // Total messages
    const total = await db.chatMessage.count({ where: whereClause });

    // Count by source
    const bySource = await db.chatMessage.groupBy({
      by: ['source'],
      where: whereClause,
      _count: { id: true },
    });

    // Count by source + role
    const bySourceRole = await db.chatMessage.groupBy({
      by: ['source', 'role'],
      where: whereClause,
      _count: { id: true },
    });

    // Unique sessions
    const sessions = await db.chatMessage.groupBy({
      by: ['sessionId'],
      where: whereClause,
    });

    // Most recent message
    const latest = await db.chatMessage.findFirst({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      select: { source: true, timestamp: true, sessionId: true },
    });

    return apiSuccess({
      total,
      sources: bySource.reduce(
        (acc, row) => ({ ...acc, [row.source]: row._count.id }),
        {} as Record<string, number>
      ),
      breakdown: bySourceRole.map((row) => ({
        source: row.source,
        role: row.role,
        count: row._count.id,
      })),
      uniqueSessions: sessions.length,
      latestMessage: latest,
      userId: clerkId || 'all',
      source: source || 'all',
      sinceDays: sinceDays || null,
    });
  } catch (error) {
    console.error('[chat-history/stats] Error:', error);
    return apiError('Failed to fetch stats', 500);
  }
}
