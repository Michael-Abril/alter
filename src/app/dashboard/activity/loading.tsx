import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function ActivityLoading() {
  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Header skeleton */}
            <div>
              <div className="h-7 w-32 animate-pulse rounded bg-nightshift-bg-card/80 mb-2" />
              <div className="h-4 w-64 animate-pulse rounded bg-nightshift-bg-card/50" />
            </div>
            {/* Filter bar skeleton */}
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-20 animate-pulse rounded bg-nightshift-bg-card/50" />
              ))}
            </div>
            {/* Activity list skeleton */}
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card flex items-start gap-4">
                  <div className="h-10 w-10 animate-pulse rounded bg-nightshift-bg-light/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-nightshift-bg-light/70" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-nightshift-bg-light/40" />
                    <div className="h-3 w-24 animate-pulse rounded bg-nightshift-bg-light/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
