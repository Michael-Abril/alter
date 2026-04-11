/**
 * Async server component for dashboard stats.
 * Fetches its own data - wrap in Suspense for streaming.
 * Uses cached queries for request-level deduplication.
 */

import {
  getCachedProjectCount,
  getCachedChatCount,
  getCachedEmbeddedCount,
  getCachedSessionCount,
} from '@/lib/cached-queries';

type Props = {
  userId: string;
};

export default async function DashboardStats({ userId }: Props) {
  const [projectCount, chatCount, embeddedCount, sessionCount] = await Promise.all([
    getCachedProjectCount(userId),
    getCachedChatCount(userId),
    getCachedEmbeddedCount(userId),
    getCachedSessionCount(userId),
  ]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="card text-center">
        <div className="text-2xl font-bold text-nightshift-accent">{projectCount}</div>
        <div className="text-xs text-nightshift-text-secondary">Projects</div>
      </div>
      <div className="card text-center">
        <div className="text-2xl font-bold text-nightshift-accent">{chatCount}</div>
        <div className="text-xs text-nightshift-text-secondary">Messages</div>
      </div>
      <div className="card text-center">
        <div className="text-2xl font-bold text-nightshift-accent">{embeddedCount}</div>
        <div className="text-xs text-nightshift-text-secondary">Embedded</div>
      </div>
      <div className="card text-center">
        <div className="text-2xl font-bold text-nightshift-accent">{sessionCount}</div>
        <div className="text-xs text-nightshift-text-secondary">Conversations</div>
      </div>
    </div>
  );
}
