export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-nightshift-bg">
      <div className="hidden w-[17rem] shrink-0 border-r border-nightshift-border bg-[#0F172A] md:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b border-nightshift-border bg-nightshift-bg/90 backdrop-blur-md" />
        <main className="flex-1 bg-nightshift-bg px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-nightshift-bg-card" />
            <div className="h-24 animate-pulse rounded-2xl bg-nightshift-bg-card/80" />
            <div className="h-64 animate-pulse rounded-2xl bg-nightshift-bg-card/90" />
            <div className="h-14 animate-pulse rounded-xl bg-nightshift-bg-card/60" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
