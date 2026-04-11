/**
 * Shared Gmail → Email table sync (API route, OAuth, onboarding snapshot).
 */

import db from '@/lib/db';
import {
  fetchSentEmails,
  fetchInboxEmails,
  fetchImportantEmails,
  refreshAccessToken,
} from '@/lib/gmail';

export type GmailSyncDirection = 'sent' | 'received' | 'both';

/** high_signal = sent + capped Important; full_inbox = legacy sent + inbox; sent_only = sent only */
export type GmailSyncMode = 'high_signal' | 'full_inbox' | 'sent_only';

const DEFAULT_SENT_MAX = 150;
const DEFAULT_IMPORTANT_MAX = 25;

export async function syncGmailForUser(
  internalUserId: string,
  options?: {
    mode?: GmailSyncMode;
    /** Legacy: maps to mode when `mode` omitted */
    direction?: GmailSyncDirection;
    sinceDays?: number;
    sentMax?: number;
    importantMax?: number;
    inboxMax?: number;
  }
): Promise<{
  totalFetched: number;
  newEmails: number;
  skippedEmails: number;
  sent: number;
  received: number;
  importantReceived: number;
  mode: GmailSyncMode;
}> {
  const sinceDays =
    typeof options?.sinceDays === 'number' && options.sinceDays > 0 && options.sinceDays <= 3650
      ? options.sinceDays
      : 14;

  let mode: GmailSyncMode = options?.mode ?? 'high_signal';
  if (!options?.mode && options?.direction) {
    if (options.direction === 'both') mode = 'full_inbox';
    else if (options.direction === 'sent') mode = 'sent_only';
    else if (options.direction === 'received') mode = 'full_inbox'; // will only fetch inbox branch — handle below
  }

  const sentMax = options?.sentMax ?? DEFAULT_SENT_MAX;
  const importantMax = options?.importantMax ?? DEFAULT_IMPORTANT_MAX;
  const inboxMax = options?.inboxMax ?? 50;

  const user = await db.user.findUnique({
    where: { id: internalUserId },
    select: {
      id: true,
      gmailConnected: true,
      gmailToken: true,
      gmailRefreshToken: true,
    },
  });

  if (!user || !user.gmailConnected || !user.gmailToken) {
    throw new Error('Gmail not connected');
  }

  const row = user;
  let accessToken: string = row.gmailToken as string;

  async function withTokenRefresh<T>(fn: (token: string) => Promise<T>): Promise<T> {
    try {
      return await fn(accessToken);
    } catch (error: any) {
      if (row.gmailRefreshToken && (error.code === 401 || error.message?.includes('401'))) {
        accessToken = await refreshAccessToken(row.gmailRefreshToken);
        await db.user.update({ where: { id: row.id }, data: { gmailToken: accessToken } });
        return await fn(accessToken);
      }
      throw error;
    }
  }

  let sentEmails: Awaited<ReturnType<typeof fetchSentEmails>> = [];
  let inboxEmails: Awaited<ReturnType<typeof fetchInboxEmails>> = [];
  let importantEmails: Awaited<ReturnType<typeof fetchImportantEmails>> = [];

  if (mode === 'high_signal') {
    sentEmails = await withTokenRefresh((t) => fetchSentEmails(t, row.gmailRefreshToken, sentMax));
    importantEmails = await withTokenRefresh((t) =>
      fetchImportantEmails(t, row.gmailRefreshToken, importantMax, sinceDays)
    );
  } else if (mode === 'sent_only') {
    sentEmails = await withTokenRefresh((t) => fetchSentEmails(t, row.gmailRefreshToken, sentMax));
  } else if (mode === 'full_inbox') {
    // Legacy: only inbox when direction was 'received' without sent
    if (options?.direction === 'received') {
      inboxEmails = await withTokenRefresh((t) =>
        fetchInboxEmails(t, row.gmailRefreshToken, inboxMax, sinceDays)
      );
    } else {
      sentEmails = await withTokenRefresh((t) => fetchSentEmails(t, row.gmailRefreshToken, sentMax));
      inboxEmails = await withTokenRefresh((t) =>
        fetchInboxEmails(t, row.gmailRefreshToken, inboxMax, sinceDays)
      );
    }
  }

  const allEmails = [...sentEmails, ...inboxEmails, ...importantEmails];
  let newEmails = 0;
  let skipped = 0;

  for (const email of allEmails) {
    const existing = await db.email.findUnique({ where: { gmailId: email.gmailId } });
    if (existing) {
      skipped++;
      continue;
    }

    const ingestChannel =
      email.ingestChannel ??
      (email.direction === 'sent' ? 'sent' : 'inbox');

    await db.email.create({
      data: {
        userId: row.id,
        gmailId: email.gmailId,
        threadId: email.threadId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        direction: email.direction,
        ingestChannel,
        isRead: email.direction === 'sent',
        receivedAt: email.receivedAt,
      },
    });
    newEmails++;
  }

  return {
    totalFetched: allEmails.length,
    newEmails,
    skippedEmails: skipped,
    sent: sentEmails.length,
    received: inboxEmails.length + importantEmails.length,
    importantReceived: importantEmails.length,
    mode,
  };
}
