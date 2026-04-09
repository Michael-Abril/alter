import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiError, apiSuccess } from '@/lib/utils';
import { readSyncStatus, type SyncSource } from '@/lib/onboarding-sync';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  const sourceParam = req.nextUrl.searchParams.get('source');
  if (sourceParam !== 'claude' && sourceParam !== 'chatgpt') {
    return apiError('source must be "claude" or "chatgpt"', 400);
  }

  const status = readSyncStatus(userId, sourceParam as SyncSource);

  // While running, query the live DB count so the UI shows real-time progress
  if (status.state === 'running' || status.importedMessages === 0) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (status.lookbackDays || 3));
      const liveCount = await db.chatMessage.count({
        where: {
          user: { clerkId: userId },
          source: sourceParam,
          timestamp: { gte: cutoff },
        },
      });
      status.importedMessages = liveCount;
    } catch { /* non-fatal */ }
  }

  return apiSuccess(status);
}
