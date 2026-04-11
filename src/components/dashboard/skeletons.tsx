/**
 * Skeleton loading components for dashboard sections.
 * Used as Suspense fallbacks for instant perceived loading.
 */

export function MorningBriefSkeleton() {
  return (
    <div className="rounded-2xl border border-nightshift-border/60 bg-nightshift-bg-card/60 p-6 md:p-8">
      <div className="h-4 w-32 animate-pulse rounded bg-nightshift-bg-light/60 mb-3" />
      <div className="h-6 w-3/4 animate-pulse rounded bg-nightshift-bg-light/80 mb-2" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-nightshift-bg-light/40" />
    </div>
  );
}

export function TasksTodaySkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="h-3 w-28 animate-pulse rounded bg-nightshift-bg-light/50" />
        <div className="h-3 w-16 animate-pulse rounded bg-nightshift-bg-light/30" />
      </div>
      <ul className="space-y-3">
        {[1, 2, 3].map((i) => (
          <li
            key={i}
            className="rounded-xl border border-nightshift-border/40 bg-nightshift-bg-light/30 p-4 md:p-5"
          >
            <div className="flex gap-4">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-nightshift-bg/60" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-16 animate-pulse rounded bg-nightshift-bg-light/50" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-nightshift-bg-light/70" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-nightshift-bg-light/30" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card text-center">
          <div className="h-7 w-12 mx-auto animate-pulse rounded bg-nightshift-bg-light/60 mb-1" />
          <div className="h-3 w-16 mx-auto animate-pulse rounded bg-nightshift-bg-light/30" />
        </div>
      ))}
    </div>
  );
}

export function SuggestedFocusSkeleton() {
  return (
    <div className="card">
      <div className="h-3 w-28 animate-pulse rounded bg-nightshift-bg-light/50 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-nightshift-bg-light/30 p-3">
            <div className="h-2 w-2 mt-1 animate-pulse rounded-full bg-nightshift-bg-light/60" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-1/2 animate-pulse rounded bg-nightshift-bg-light/50" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-nightshift-bg-light/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventsAndGithubSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card">
        <div className="h-3 w-32 animate-pulse rounded bg-nightshift-bg-light/50 mb-4" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg bg-nightshift-bg-light/30 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-nightshift-bg-light/50 mb-1" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-nightshift-bg-light/30" />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="h-3 w-28 animate-pulse rounded bg-nightshift-bg-light/50 mb-4" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg bg-nightshift-bg-light/30 p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-nightshift-bg-light/50 mb-1" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-nightshift-bg-light/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompletedFlaggedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card">
        <div className="h-3 w-36 animate-pulse rounded bg-nightshift-bg-light/50 mb-4" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-nightshift-bg-light/30" />
      </div>
      <div className="card">
        <div className="h-3 w-20 animate-pulse rounded bg-nightshift-bg-light/50 mb-4" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-nightshift-bg-light/30" />
      </div>
    </div>
  );
}
