import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function SettingsLoading() {
  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-8">
            {/* Header skeleton */}
            <div className="h-7 w-24 animate-pulse rounded bg-nightshift-bg-card/80" />

            {/* Connected Accounts skeleton */}
            <div className="card">
              <div className="h-5 w-40 animate-pulse rounded bg-nightshift-bg-light/60 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-nightshift-bg-light/60" />
                    <div className="h-4 w-24 animate-pulse rounded bg-nightshift-bg-light/50" />
                    <div className="h-3 w-20 animate-pulse rounded bg-nightshift-bg-light/30" />
                    <div className="ml-auto h-8 w-20 animate-pulse rounded bg-nightshift-bg-light/40" />
                  </div>
                ))}
              </div>
            </div>

            {/* Autonomy Level skeleton */}
            <div className="card">
              <div className="h-5 w-32 animate-pulse rounded bg-nightshift-bg-light/60 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg border border-nightshift-border/30 bg-nightshift-bg-light/20" />
                ))}
              </div>
            </div>

            {/* Wake Time skeleton */}
            <div className="card">
              <div className="h-5 w-24 animate-pulse rounded bg-nightshift-bg-light/60 mb-2" />
              <div className="h-4 w-64 animate-pulse rounded bg-nightshift-bg-light/30 mb-4" />
              <div className="h-10 w-32 animate-pulse rounded bg-nightshift-bg-light/40" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
