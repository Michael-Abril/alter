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

  return apiSuccess({ daemonRunning, completedRecent });
}
