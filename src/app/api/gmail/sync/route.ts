/**
 * Gmail sync — pulls sent AND received emails and stores in Email table.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchSentEmails, fetchInboxEmails, refreshAccessToken } from '@/lib/gmail';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true, gmailConnected: true, gmailToken: true, gmailRefreshToken: true },
    });

    if (!user || !user.gmailConnected || !user.gmailToken) {
      return apiError('Gmail not connected', 400);
    }

    const body = await req.json().catch(() => ({}));
    const direction: string = body.direction || 'both';
    const sinceDays: number = body.sinceDays || 3;

    let accessToken = user.gmailToken;

    async function withTokenRefresh<T>(fn: (token: string) => Promise<T>): Promise<T> {
      try {
        return await fn(accessToken);
      } catch (error: any) {
        if (user.gmailRefreshToken && (error.code === 401 || error.message?.includes('401'))) {
          accessToken = await refreshAccessToken(user.gmailRefreshToken);
          await db.user.update({ where: { id: user.id }, data: { gmailToken: accessToken } });
          return await fn(accessToken);
        }
        throw error;
      }
    }

    let sentEmails: any[] = [];
    let inboxEmails: any[] = [];

    if (direction === 'sent' || direction === 'both') {
      sentEmails = await withTokenRefresh(t => fetchSentEmails(t, user.gmailRefreshToken, 100));
    }
    if (direction === 'received' || direction === 'both') {
      inboxEmails = await withTokenRefresh(t => fetchInboxEmails(t, user.gmailRefreshToken, 50, sinceDays));
    }

    const allEmails = [...sentEmails, ...inboxEmails];
    let newEmails = 0;
    let skipped = 0;

    for (const email of allEmails) {
      const existing = await db.email.findUnique({ where: { gmailId: email.gmailId } });
      if (existing) { skipped++; continue; }

      await db.email.create({
        data: {
          userId: user.id,
          gmailId: email.gmailId,
          threadId: email.threadId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          body: email.body,
          direction: email.direction,
          isRead: email.direction === 'sent',
          receivedAt: email.receivedAt,
        },
      });
      newEmails++;
    }

    console.log(`[gmail/sync] Sync complete: ${newEmails} new, ${skipped} skipped`);

    return apiSuccess({
      totalFetched: allEmails.length,
      newEmails,
      skippedEmails: skipped,
      sent: sentEmails.length,
      received: inboxEmails.length,
    });
  } catch (error) {
    console.error('[gmail/sync] Error:', error);
    return apiError('Failed to sync emails', 500);
  }
}
