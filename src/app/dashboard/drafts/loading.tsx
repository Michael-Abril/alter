import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DraftsLoading() {
  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Header skeleton */}
            <div>
              <div className="h-7 w-36 animate-pulse rounded bg-nightshift-bg-card/80 mb-2" />
              <div className="h-4 w-80 animate-pulse rounded bg-nightshift-bg-card/50" />
            </div>
            {/* Draft cards skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 animate-pulse rounded bg-nightshift-bg-light/60" />
                      <div className="space-y-2">
                        <div className="h-5 w-48 animate-pulse rounded bg-nightshift-bg-light/70" />
                        <div className="h-3 w-32 animate-pulse rounded bg-nightshift-bg-light/40" />
                      </div>
                    </div>
                    <div className="h-6 w-24 animate-pulse rounded-full bg-nightshift-bg-light/50" />
                  </div>
                  <div className="h-32 animate-pulse rounded-lg bg-nightshift-bg-light/30 mb-4" />
                  <div className="flex gap-3">
                    <div className="h-9 w-24 animate-pulse rounded bg-nightshift-accent/20" />
                    <div className="h-9 w-20 animate-pulse rounded bg-nightshift-bg-light/40" />
                    <div className="h-9 w-20 animate-pulse rounded bg-nightshift-bg-light/40" />
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
