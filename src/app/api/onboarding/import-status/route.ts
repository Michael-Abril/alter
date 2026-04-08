import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiError, apiSuccess } from '@/lib/utils';
import { readSyncStatus, type SyncSource } from '@/lib/onboarding-sync';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  const sourceParam = req.nextUrl.searchParams.get('source');
  if (sourceParam !== 'claude' && sourceParam !== 'chatgpt') {
    return apiError('source must be "claude" or "chatgpt"', 400);
  }

  const status = readSyncStatus(userId, sourceParam as SyncSource);
  return apiSuccess(status);
}
