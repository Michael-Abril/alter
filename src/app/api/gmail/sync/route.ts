/**
 * Gmail sync — pulls sent AND received emails and stores in Email table.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { syncGmailForUser } from '@/lib/gmail-sync';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true, gmailConnected: true, gmailToken: true },
    });

    if (!user || !user.gmailConnected || !user.gmailToken) {
      return apiError('Gmail not connected', 400);
    }

    const body = await req.json().catch(() => ({}));
    const direction = body.direction as 'sent' | 'received' | 'both' | undefined;
    const mode = body.mode as 'high_signal' | 'full_inbox' | 'sent_only' | undefined;
    const sinceDays: number =
      typeof body.sinceDays === 'number' && body.sinceDays > 0 ? body.sinceDays : 14;

    const result = await syncGmailForUser(user.id, {
      mode,
      direction,
      sinceDays,
    });

    console.log(
      `[gmail/sync] Sync complete: ${result.newEmails} new, ${result.skippedEmails} skipped`
    );

    return apiSuccess(result);
  } catch (error: any) {
    console.error('[gmail/sync] Error:', error);
    const msg = error?.message === 'Gmail not connected' ? 'Gmail not connected' : 'Failed to sync emails';
    return apiError(msg, error?.message === 'Gmail not connected' ? 400 : 500);
  }
}
