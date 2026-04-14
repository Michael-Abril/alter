import fs from 'fs';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/utils';
import { tryAuthUser } from '@/lib/clerk-user';
import db from '@/lib/db';

export async function GET() {
  const auth = await tryAuthUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  let daemonRunning = false;
  let alterWorking = false;
  let alterStatus = '';

  // Check daemon status
  try {
    const statusPath = path.join(process.cwd(), 'data', 'daemon-status.json');
    if (fs.existsSync(statusPath)) {
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) as { lastUpdate?: string; running?: boolean };
      const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate) : null;
      const now = new Date();
      const minutesSinceUpdate = lastUpdate ? (now.getTime() - lastUpdate.getTime()) / 1000 / 60 : 999;
      daemonRunning = !!status.running && minutesSinceUpdate <= 2;
    }
  } catch {
    daemonRunning = false;
  }

  // Check handoff status (when Alter is actively working)
  try {
    const handoffPath = path.join(process.cwd(), 'data', `handoff-run-${user.id}.json`);
    if (fs.existsSync(handoffPath)) {
      const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf-8')) as {
        state?: string;
        startedAt?: string;
        projectsContinued?: number;
      };
      if (handoff.state === 'running') {
        alterWorking = true;
        alterStatus = 'working';
      } else if (handoff.state === 'completed' && handoff.projectsContinued && handoff.projectsContinued > 0) {
        // Show completed status for 5 minutes after completion
        const startedAt = handoff.startedAt ? new Date(handoff.startedAt) : null;
        const now = new Date();
        const minutesSinceStart = startedAt ? (now.getTime() - startedAt.getTime()) / 1000 / 60 : 999;
        if (minutesSinceStart <= 10) {
          alterStatus = 'completed';
        }
      }
    }
  } catch {
    // Ignore handoff check errors
  }

  const since = new Date();
  since.setDate(since.getDate() - 3);

  let completedRecent = 0;
  try {
    completedRecent = await db.action.count({
      where: {
        userId: user.id,
        createdAt: { gte: since },
        type: { in: ['work_continued', 'task_completed'] },
      },
    });
  } catch {
    completedRecent = 0;
  }

  return apiSuccess({ daemonRunning, completedRecent, alterWorking, alterStatus });
}
