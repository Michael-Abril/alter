/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GitHub activity sync endpoint — pulls commits, PRs, issues and upserts into DB
 * DEPENDENCIES: Prisma, @clerk/nextjs, github-ingest
 * STATUS: LIVE — called by dashboard to refresh GitHub activity
 */

import { auth } from '@clerk/nextjs/server';
import { syncGitHubActivity } from '@/lib/github-ingest';
import { loadGitHubConfig } from '@/lib/github';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return apiError('User not found', 404);

    const config = loadGitHubConfig(user.id);
    if (!config || !config.token) {
      return apiError('GitHub not connected', 400);
    }

    const repoName = `${config.defaultOwner}/${config.defaultRepo}`;
    const activities = await syncGitHubActivity(user.id);

    let commits = 0;
    let prs = 0;
    let issues = 0;

    for (const item of activities) {
      await db.githubActivity.upsert({
        where: { githubId: item.githubId },
        create: {
          userId: user.id,
          repoName,
          type: item.type,
          title: item.title,
          body: item.body,
          url: item.url,
          githubId: item.githubId,
          authoredAt: new Date(item.authoredAt),
        },
        update: {
          title: item.title,
          body: item.body,
        },
      });

      if (item.type === 'commit') commits++;
      else if (item.type === 'pr') prs++;
      else if (item.type === 'issue') issues++;
    }

    console.log(`[github/sync] Synced ${activities.length} items for user ${user.id} (${commits} commits, ${prs} PRs, ${issues} issues)`);

    return apiSuccess({ synced: activities.length, commits, prs, issues });
  } catch (error) {
    console.error('[github/sync] Error:', error);
    return apiError('Failed to sync GitHub activity', 500);
  }
}
