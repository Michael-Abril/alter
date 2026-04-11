/**
 * Async server component for pending drafts banner.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import db from '@/lib/db';

type Props = {
  userId: string;
};

export default async function DraftsBanner({ userId }: Props) {
  const pendingDrafts = await db.draft.count({
    where: { userId, status: 'pending' },
  });

  if (pendingDrafts === 0) {
    return null;
  }

  return (
    <a
      href="/dashboard/drafts"
      className="card border-nightshift-warning/30 hover:border-nightshift-warning/60 transition-colors block"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">📝</span>
        <div>
          <span className="font-medium text-nightshift-text-primary">
            {pendingDrafts} draft{pendingDrafts > 1 ? 's' : ''} awaiting review
          </span>
          <p className="text-xs text-nightshift-text-muted">
            NightShift created drafts overnight — review and approve them
          </p>
        </div>
      </div>
    </a>
  );
}
