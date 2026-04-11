export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-nightshift-bg">
      <div className="hidden w-64 shrink-0 border-r border-nightshift-border bg-nightshift-bg-light md:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b border-nightshift-border bg-nightshift-bg-light" />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="h-36 animate-pulse rounded-2xl bg-nightshift-bg-card/80" />
            <div className="h-28 animate-pulse rounded-2xl bg-nightshift-bg-card/60" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-nightshift-bg-card/50" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
