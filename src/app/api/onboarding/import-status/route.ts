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

  // Always augment with the live DB count — ensures the display is accurate
  // even after deduplication (delta = 0) or after a test reset wipes the status file
  try {
    const liveCount = await db.chatMessage.count({
      where: {
        user: { clerkId: userId },
        source: sourceParam,
      },
    });
    // Use whichever is higher: the status file delta or the actual DB total
    if (liveCount > (status.importedMessages ?? 0)) {
      status.importedMessages = liveCount;
    }
  } catch { /* non-fatal */ }

  return apiSuccess(status);
}
