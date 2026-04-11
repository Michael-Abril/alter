/**
 * Async server component for GitHub activity.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import db from '@/lib/db';

type Props = {
  userId: string;
};

type GithubActivityItem = {
  id: string;
  type: string;
  title: string;
  url: string;
  authoredAt: Date;
};

export default async function GithubActivity({ userId }: Props) {
  let recentGithub: GithubActivityItem[] = [];

  try {
    const dbWithGithub = db as {
      githubActivity?: {
        findMany: (args: object) => Promise<GithubActivityItem[]>;
      };
    };

    if (dbWithGithub.githubActivity) {
      recentGithub = await dbWithGithub.githubActivity.findMany({
        where: { userId },
        orderBy: { authoredAt: 'desc' },
        take: 5,
      });
    }
  } catch {
    // GitHub table may not exist
  }

  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
        GitHub Activity
      </h2>
      {recentGithub.length > 0 ? (
        <div className="space-y-2">
          {recentGithub.map((gh, idx) => (
            <div key={gh.id ?? `gh-${idx}`} className="rounded-lg bg-nightshift-bg-light p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {gh.type === 'commit' ? '📦' : gh.type === 'pr' ? '🔀' : '🐛'}
                </span>
                <a
                  href={gh.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-nightshift-accent hover:underline truncate"
                >
                  {gh.title || 'Activity'}
                </a>
              </div>
              <p className="text-xs text-nightshift-text-muted mt-1 ml-6">
                {gh.type || 'item'} &middot;{' '}
                {gh.authoredAt ? new Date(gh.authoredAt).toLocaleDateString() : '—'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-nightshift-text-muted">
          No recent activity. Connect GitHub in Settings.
        </p>
      )}
    </div>
  );
}
