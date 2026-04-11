/**
 * Async server component for completed and flagged items.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import db from '@/lib/db';
import CompletedActions from '@/components/brief/CompletedActions';
import FlaggedItems from '@/components/brief/FlaggedItems';

type Props = {
  userId: string;
};

function parseProjectContext(rawContext: string | null): Record<string, unknown> {
  if (!rawContext) return {};
  try {
    return JSON.parse(rawContext) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function CompletedAndFlagged({ userId }: Props) {
  const [completedProjects, stalledProjects] = await Promise.all([
    db.project.findMany({
      where: { userId, status: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        context: true,
        progress: true,
        lastActive: true,
        updatedAt: true,
      },
    }),
    db.project.findMany({
      where: { userId, status: 'stalled' },
      orderBy: { lastActive: 'desc' },
      take: 5,
      select: {
        id: true,
        userId: true,
        name: true,
        context: true,
        lastActive: true,
      },
    }),
  ]);

  const completedActions = completedProjects.map((p) => {
    const ctx = parseProjectContext(p.context);
    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    return {
      id: p.id,
      userId: p.userId,
      type: 'task_completed' as const,
      title: p.name,
      description: p.description || nextStep || 'Project completed',
      app: 'claude',
      confidence: p.progress / 100,
      status: 'completed' as const,
      metadata: null,
      createdAt: p.updatedAt.toISOString(),
    };
  });

  const flaggedItems = stalledProjects.map((p) => {
    const ctx = parseProjectContext(p.context);
    const nextStep = typeof ctx.nextStep === 'string' ? ctx.nextStep : null;
    return {
      id: p.id,
      userId: p.userId,
      type: 'flagged' as const,
      title: `${p.name} — stalled`,
      description: nextStep || 'This project has gone quiet. Review and decide next steps.',
      app: 'claude',
      confidence: 0.4,
      status: 'flagged' as const,
      metadata: null,
      createdAt: p.lastActive.toISOString(),
    };
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {completedActions.length > 0 ? (
        <CompletedActions actions={completedActions} />
      ) : (
        <div className="card">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-text-secondary">
            Completed Overnight
          </h2>
          <p className="text-sm text-nightshift-text-muted">
            No completed projects yet. Projects will appear here once NightShift detects completed
            work.
          </p>
        </div>
      )}
      {flaggedItems.length > 0 ? (
        <FlaggedItems items={flaggedItems} />
      ) : (
        <div className="card border-nightshift-success/20">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-nightshift-success">
            All Clear
          </h2>
          <p className="text-sm text-nightshift-text-muted">
            No stalled projects. Everything looks good!
          </p>
        </div>
      )}
    </div>
  );
}
