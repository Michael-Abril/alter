/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: trigger Claude conversation scraper for onboarding
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import db from '@/lib/db';
import {
  readSyncStatus,
  readLastSyncedAt,
  writeSyncStatus,
  writeLastSyncedAt,
  type OnboardingSyncStatus,
} from '@/lib/onboarding-sync';
import { enqueueSyncJob } from '@/lib/sync-queue';

const execAsync = promisify(exec);
const ONBOARDING_LOOKBACK_DAYS = 3;
const ONBOARDING_MAX_CONVERSATIONS = 8;
let playwrightInstallPromise: Promise<void> | null = null;

async function ensurePlaywrightChromiumInstalled() {
  if (!playwrightInstallPromise) {
    playwrightInstallPromise = (async () => {
      try {
        await execAsync(
          'node -e "const { chromium } = require(\'playwright\'); const fs = require(\'fs\'); const p = chromium.executablePath(); if (!fs.existsSync(p)) process.exit(1);"'
        );
      } catch {
        console.log('[onboarding/import-claude] Playwright Chromium missing, installing...');
        await execAsync('npx playwright install chromium');
      }
    })();
  }
  await playwrightInstallPromise;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json().catch(() => ({}));
    const lookbackDays = Math.max(1, Math.min(30, Number(body?.days) || ONBOARDING_LOOKBACK_DAYS));
    const resetProfile = Boolean(body?.resetProfile);
    const headless = body?.headless !== undefined ? Boolean(body.headless) : true;
    const existing = readSyncStatus(userId, 'claude');
    if (existing.state === 'running') {
      return apiSuccess({ ...existing, alreadyRunning: true });
    }
    const lastSyncedAt = readLastSyncedAt(userId, 'claude');
    if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < 5 * 60 * 1000) {
      return apiSuccess({
        source: 'claude',
        status: 'complete',
        state: 'completed',
        lookbackDays,
        importedMessages: existing.importedMessages || 0,
        message: 'Recent Claude context already synced. Using cached snapshot.',
      });
    }

    console.log('[onboarding/import-claude] Starting Claude scraper...');
    await ensurePlaywrightChromiumInstalled();

    const cmd =
      `node orchestration/scrape-claude.mjs ` +
      `--user=${userId} ` +
      `--max=${ONBOARDING_MAX_CONVERSATIONS} ` +
      `--since-days=${lookbackDays}` +
      (headless ? ' --headless' : '') +
      (resetProfile ? ' --reset-profile' : '');

    const runningStatus: OnboardingSyncStatus = {
      source: 'claude',
      state: 'running',
      startedAt: new Date().toISOString(),
      lookbackDays,
      importedMessages: 0,
    };
    writeSyncStatus(userId, 'claude', runningStatus);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const beforeCount = await db.chatMessage.count({
      where: {
        user: { clerkId: userId },
        source: 'claude',
        timestamp: { gte: cutoffDate },
      },
    });

    const queued = enqueueSyncJob(`claude:${userId}`, async () => {
      await execAsync(cmd)
      .then(async ({ stdout, stderr }) => {
        const afterCount = await db.chatMessage.count({
          where: {
            user: { clerkId: userId },
            source: 'claude',
            timestamp: { gte: cutoffDate },
          },
        });
        const importedMessages = Math.max(0, afterCount - beforeCount);
        const output = `${stdout || ''}\n${stderr || ''}`;
        const needsAuth = output.includes('AUTH_REQUIRED');
        const noConversations = output.includes('No conversations found');

        writeSyncStatus(userId, 'claude', {
          source: 'claude',
          state: needsAuth ? 'auth_required' : noConversations ? 'failed' : 'completed',
          startedAt: runningStatus.startedAt,
          finishedAt: new Date().toISOString(),
          lookbackDays,
          importedMessages,
          message: needsAuth
            ? 'Claude needs sign-in. Open Claude once to authenticate, then retry import.'
            : noConversations
            ? 'No Claude conversations found for current account. Retry with profile reset.'
            : `Imported ${importedMessages} recent Claude messages.`,
        });
        if (!needsAuth && !noConversations) {
          writeLastSyncedAt(userId, 'claude', new Date().toISOString());
        }
      })
      .catch((err: any) => {
        const combined = `${err?.stderr || ''}\n${err?.stdout || ''}\n${err?.message || ''}`;
        const needsAuth = combined.includes('AUTH_REQUIRED');
        console.error('[onboarding/import-claude] Scraper error:', err);
        writeSyncStatus(userId, 'claude', {
          source: 'claude',
          state: needsAuth ? 'auth_required' : 'failed',
          startedAt: runningStatus.startedAt,
          finishedAt: new Date().toISOString(),
          lookbackDays,
          importedMessages: 0,
          message: needsAuth
            ? 'Claude sign-in required before background sync can continue.'
            : combined.includes('No conversations found')
            ? 'No Claude conversations found for current account. Try reset-profile and re-import.'
            : 'Claude import failed. Please retry.',
        });
      });
    });

    if (!queued) {
      return apiSuccess({
        source: 'claude',
        status: 'processing',
        state: 'running',
        lookbackDays,
        message: 'Claude sync already queued.',
      });
    }

    return apiSuccess({
      message: 'Claude import started',
      status: 'processing',
      lookbackDays,
    });
  } catch (error: any) {
    console.error('[onboarding/import-claude] Error:', error);
    return apiError(`Failed to start Claude import: ${error.message}`, 500);
  }
}
