import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function HandoffLoading() {
  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Header skeleton */}
            <div>
              <div className="h-7 w-28 animate-pulse rounded bg-nightshift-bg-card/80 mb-2" />
              <div className="h-4 w-96 animate-pulse rounded bg-nightshift-bg-card/50" />
            </div>
            {/* Status card skeleton */}
            <div className="card">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-nightshift-bg-light/60" />
                <div className="space-y-2">
                  <div className="h-5 w-32 animate-pulse rounded bg-nightshift-bg-light/70" />
                  <div className="h-4 w-48 animate-pulse rounded bg-nightshift-bg-light/40" />
                </div>
              </div>
              <div className="h-10 w-40 animate-pulse rounded bg-nightshift-accent/20" />
            </div>
            {/* Tasks skeleton */}
            <div className="card">
              <div className="h-5 w-28 animate-pulse rounded bg-nightshift-bg-light/60 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-nightshift-bg-light/30" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
