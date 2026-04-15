/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: trigger ChatGPT scraper or handle file upload for onboarding
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  readSyncStatus,
  readLastSyncedAt,
  writeSyncStatus,
  writeLastSyncedAt,
  type OnboardingSyncStatus,
} from '@/lib/onboarding-sync';
import { enqueueSyncJob } from '@/lib/sync-queue';
import { detectProjectsForUser } from '@/lib/detect-projects-inline';
import { buildVoiceProfileForUser } from '@/lib/voice-profile-builder';

const execAsync = promisify(exec);
const ONBOARDING_LOOKBACK_DAYS = 3;
const ONBOARDING_MAX_CONVERSATIONS = 20;
let playwrightInstallPromise: Promise<void> | null = null;

async function ensurePlaywrightChromiumInstalled() {
  if (!playwrightInstallPromise) {
    playwrightInstallPromise = (async () => {
      try {
        await execAsync(
          'node -e "const { chromium } = require(\'playwright\'); const fs = require(\'fs\'); const p = chromium.executablePath(); if (!fs.existsSync(p)) process.exit(1);"'
        );
      } catch {
        console.log('[onboarding/import-chatgpt] Playwright Chromium missing, installing...');
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
    const contentType = req.headers.get('content-type') || '';

    // Check if this is a scraper trigger (no file upload)
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      const lookbackDays = Math.max(1, Math.min(30, Number(body?.days) || ONBOARDING_LOOKBACK_DAYS));
      const maxConversations = Math.max(
        5,
        Math.min(40, Number(body?.maxConversations) || ONBOARDING_MAX_CONVERSATIONS)
      );
      const resetProfile = Boolean(body?.resetProfile);
      const headless = body?.headless !== undefined ? Boolean(body.headless) : true;
      const existing = readSyncStatus(userId, 'chatgpt');
      if (existing.state === 'running') {
        const staleMs = existing.startedAt ? Date.now() - new Date(existing.startedAt).getTime() : Infinity;
        if (staleMs < 3 * 60 * 1000) {
          return apiSuccess({ ...existing, alreadyRunning: true });
        }
        console.log('[onboarding/import-chatgpt] Stale running state detected, allowing re-trigger');
      }
      const lastSyncedAt = readLastSyncedAt(userId, 'chatgpt');
      if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < 5 * 60 * 1000) {
        return apiSuccess({
          source: 'chatgpt',
          status: 'complete',
          state: 'completed',
          lookbackDays,
          importedMessages: existing.importedMessages || 0,
          message: 'Recent ChatGPT context already synced. Using cached snapshot.',
        });
      }

      console.log('[onboarding/import-chatgpt] Starting ChatGPT scraper...');
      await ensurePlaywrightChromiumInstalled();

      const cmd =
        `node orchestration/scrape-chatgpt.mjs ` +
        `--user=${userId} ` +
        `--max=${maxConversations} ` +
        `--since-days=${lookbackDays}` +
        (headless ? ' --headless' : '') +
        (resetProfile ? ' --reset-profile' : '');

      const runningStatus: OnboardingSyncStatus = {
        source: 'chatgpt',
        state: 'running',
        startedAt: new Date().toISOString(),
        lookbackDays,
        importedMessages: 0,
      };
      writeSyncStatus(userId, 'chatgpt', runningStatus);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      const beforeCount = await db.chatMessage.count({
        where: {
          user: { clerkId: userId },
          source: 'chatgpt',
          timestamp: { gte: cutoffDate },
        },
      });

      const queued = enqueueSyncJob(`chatgpt:${userId}`, async () => {
        await execAsync(cmd)
        .then(async ({ stdout, stderr }) => {
          const afterCount = await db.chatMessage.count({
            where: {
              user: { clerkId: userId },
              source: 'chatgpt',
              timestamp: { gte: cutoffDate },
            },
          });
          const importedMessages = Math.max(0, afterCount - beforeCount);
          const output = `${stdout || ''}\n${stderr || ''}`;
          const needsAuth = output.includes('AUTH_REQUIRED');
          const cloudflareBlocked = output.includes('CLOUDFLARE_BLOCKED');
          const noConversations = output.includes('No conversations found');
          writeSyncStatus(userId, 'chatgpt', {
            source: 'chatgpt',
            state: needsAuth || cloudflareBlocked ? 'auth_required' : noConversations ? 'failed' : 'completed',
            startedAt: runningStatus.startedAt,
            finishedAt: new Date().toISOString(),
            lookbackDays,
            importedMessages,
            message: cloudflareBlocked
              ? 'Cloudflare blocked headless browser. Try again — a browser window will open for you to verify.'
              : needsAuth
              ? 'ChatGPT needs sign-in. Open ChatGPT once to authenticate, then retry import.'
              : noConversations
              ? 'No ChatGPT conversations found for the current signed-in account. Retry with profile reset.'
              : `Imported ${importedMessages} recent ChatGPT messages.`,
          });
          if (!needsAuth && !noConversations) {
            writeLastSyncedAt(userId, 'chatgpt', new Date().toISOString());
            // Keep Morning Brief / Today Focus fresh after chat re-sync.
            try {
              const dbUser = await db.user.findUnique({ where: { clerkId: userId } });
              if (dbUser) {
                await detectProjectsForUser(dbUser.id, {
                  sinceDays: Math.max(lookbackDays, 7),
                  maxConversations: 30,
                });
                await buildVoiceProfileForUser({ clerkId: userId, sampleLimit: 80 });
              }
            } catch (refreshErr) {
              console.warn('[onboarding/import-chatgpt] Post-sync refresh warning:', refreshErr);
            }
          }
        })
        .catch((err: any) => {
          const combined = `${err?.stderr || ''}\n${err?.stdout || ''}\n${err?.message || ''}`;
          const needsAuth = combined.includes('AUTH_REQUIRED');
          console.error('[onboarding/import-chatgpt] Scraper error:', err);
          writeSyncStatus(userId, 'chatgpt', {
            source: 'chatgpt',
            state: needsAuth ? 'auth_required' : 'failed',
            startedAt: runningStatus.startedAt,
            finishedAt: new Date().toISOString(),
            lookbackDays,
            importedMessages: 0,
            message: needsAuth
              ? 'ChatGPT sign-in required before background sync can continue.'
              : combined.includes('No conversations found')
              ? 'No ChatGPT conversations found for current account. Try resetting ChatGPT profile and re-import.'
              : 'ChatGPT import failed. Please retry.',
          });
        });
      });

      if (!queued) {
        return apiSuccess({
          source: 'chatgpt',
          status: 'processing',
          state: 'running',
          lookbackDays,
          message: 'ChatGPT sync already queued.',
        });
      }

      return apiSuccess({
        message: 'ChatGPT import started',
        status: 'processing',
        lookbackDays,
      });
    }

    // Otherwise, handle file upload (fallback option)
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return apiError('No file uploaded', 400);
    }

    // Read the file content
    const content = await file.text();
    const chatData = JSON.parse(content);

    // Find user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return apiError('User not found', 404);
    }

    // Process ChatGPT export format
    // ChatGPT exports are typically an array of conversations
    let messagesImported = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ONBOARDING_LOOKBACK_DAYS);

    if (Array.isArray(chatData)) {
      for (const conversation of chatData) {
        if (conversation.mapping) {
          // ChatGPT export format with mapping
          for (const [nodeId, node] of Object.entries(conversation.mapping as Record<string, any>)) {
            const message = node.message;
            if (message && message.content && message.content.parts) {
              const content = message.content.parts.join('\n');
              const role = message.author?.role || 'unknown';
              const messageTimestamp = message.create_time
                ? new Date(message.create_time * 1000)
                : new Date();
              
              if (content.trim() && messageTimestamp >= cutoffDate) {
                await db.chatMessage.create({
                  data: {
                    userId: user.id,
                    source: 'chatgpt',
                    role: role === 'user' ? 'user' : 'assistant',
                    content,
                    timestamp: messageTimestamp,
                    embedded: false,
                  },
                });
                messagesImported++;
              }
            }
          }
        }
      }
    }

    console.log(`[onboarding/import-chatgpt] Imported ${messagesImported} messages from file`);

    return apiSuccess({
      messagesImported,
      status: 'complete',
    });
  } catch (error: any) {
    console.error('[onboarding/import-chatgpt] Error:', error);
    return apiError(`Failed to import ChatGPT data: ${error.message}`, 500);
  }
}
