import { auth } from '@clerk/nextjs/server';
import { apiError, apiSuccess } from '@/lib/utils';
import db from '@/lib/db';
import { deleteGitHubConfig } from '@/lib/github';
import { clearOnboardingSyncForUser } from '@/lib/onboarding-sync';
import fs from 'fs';
import path from 'path';

function safeRemove(targetPath: string) {
  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup errors for test reset
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (user) {
      await db.$transaction([
        db.project.deleteMany({ where: { userId: user.id } }),
        db.chatMessage.deleteMany({ where: { userId: user.id } }),
        db.email.deleteMany({ where: { userId: user.id } }),
        db.draft.deleteMany({ where: { userId: user.id } }),
        db.action.deleteMany({ where: { userId: user.id } }),
        db.boundary.deleteMany({ where: { userId: user.id } }),
        db.user.update({
          where: { id: user.id },
          data: {
            gmailConnected: false,
            gmailToken: null,
            gmailRefreshToken: null,
          },
        }),
      ]);
    }

    // Clear per-user integration config and ingestion/sync caches.
    deleteGitHubConfig(userId);
    clearOnboardingSyncForUser(userId);

    // Clear scraper trackers/profiles so auth/account selection can be retested.
    safeRemove(path.join(process.cwd(), 'data', 'scraped-sessions.json'));
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      safeRemove(path.join(homeDir, '.nightshift-browser-claude'));
      safeRemove(path.join(homeDir, '.nightshift-browser-chatgpt'));
    }

    return apiSuccess({
      reset: true,
      message: 'Onboarding test state reset. You can now run the full first-time flow again.',
    });
  } catch (error: any) {
    console.error('[onboarding/test-reset] Error:', error);
    return apiError(`Failed to reset onboarding test state: ${error.message}`, 500);
  }
}
