/**
 * One parallel pass of Gmail + Calendar + Canvas ingest for onboarding / post-OAuth.
 * Keeps client round-trips low while maximizing data before embed.
 */

import db from '@/lib/db';
import { syncGmailForUser } from '@/lib/gmail-sync';
import { syncCalendarForUser } from '@/lib/calendar-sync';
import { loadCanvasConfig } from '@/lib/canvas';
import { buildCanvasIngestMessages } from '@/lib/canvas-sync-messages';
import { ingestChatMessages } from '@/lib/chat-history-ingest';

export type SnapshotPartResult =
  | { ok: true; skipped?: true; detail?: Record<string, unknown> }
  | { ok: false; error: string };

export interface OnboardingIntegrationSnapshotResult {
  gmail: SnapshotPartResult & { newEmails?: number; totalFetched?: number };
  calendar: SnapshotPartResult & { synced?: number };
  canvas: SnapshotPartResult & { ingested?: number; built?: number };
}

export async function runOnboardingIntegrationSnapshot(
  internalUserId: string,
  clerkId: string,
  options?: {
    gmailSinceDays?: number;
    calendarDaysAhead?: number;
    canvasDaysAhead?: number;
    canvasDaysBack?: number;
  }
): Promise<OnboardingIntegrationSnapshotResult> {
  const user = await db.user.findUnique({
    where: { id: internalUserId },
    select: { gmailConnected: true, gmailToken: true },
  });

  const gmailSinceDays = options?.gmailSinceDays ?? 14;
  const calendarDaysAhead = options?.calendarDaysAhead ?? 21;
  const canvasDaysAhead = options?.canvasDaysAhead ?? 21;
  const canvasDaysBack = options?.canvasDaysBack ?? 14;

  const result: OnboardingIntegrationSnapshotResult = {
    gmail: { ok: false, error: 'not_run' },
    calendar: { ok: false, error: 'not_run' },
    canvas: { ok: false, error: 'not_run' },
  };

  const gmailPromise: Promise<void> = (async () => {
    if (!user?.gmailConnected || !user.gmailToken) {
      result.gmail = { ok: true, skipped: true };
      return;
    }
    try {
      const r = await syncGmailForUser(internalUserId, {
        mode: 'high_signal',
        sinceDays: gmailSinceDays,
      });
      result.gmail = {
        ok: true,
        newEmails: r.newEmails,
        totalFetched: r.totalFetched,
      };
    } catch (e: any) {
      result.gmail = { ok: false, error: e?.message || 'gmail_sync_failed' };
    }
  })();

  const calendarPromise: Promise<void> = (async () => {
    if (!user?.gmailToken) {
      result.calendar = { ok: true, skipped: true };
      return;
    }
    try {
      const { synced } = await syncCalendarForUser(internalUserId, calendarDaysAhead);
      result.calendar = { ok: true, synced };
    } catch (e: any) {
      result.calendar = { ok: false, error: e?.message || 'calendar_sync_failed' };
    }
  })();

  const canvasPromise: Promise<void> = (async () => {
    const config = loadCanvasConfig(internalUserId);
    if (!config) {
      result.canvas = { ok: true, skipped: true };
      return;
    }
    try {
      const messages = await buildCanvasIngestMessages(config, {
        daysAhead: canvasDaysAhead,
        daysBack: canvasDaysBack,
        maxSyllabusCourses: 10,
        maxConversations: 12,
      });
      if (messages.length === 0) {
        result.canvas = { ok: true, ingested: 0, built: 0 };
        return;
      }
      const { count } = await ingestChatMessages({
        prismaUserId: internalUserId,
        clerkId,
        source: 'canvas',
        messages,
      });
      result.canvas = { ok: true, ingested: count, built: messages.length };
    } catch (e: any) {
      result.canvas = { ok: false, error: e?.message || 'canvas_sync_failed' };
    }
  })();

  await Promise.all([gmailPromise, calendarPromise, canvasPromise]);

  return result;
}
