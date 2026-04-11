/**
 * Abstract “identity layer” visual — models → profile → actions (CSS only).
 */
export function IdentityVisual() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-lg md:max-w-none">
      <div className="pointer-events-none absolute inset-0 bg-alter-radial bg-cover" />
      <div className="pointer-events-none absolute -right-8 top-0 h-48 w-48 rounded-full bg-alter-violet/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-4 bottom-8 h-40 w-40 rounded-full bg-alter-cyan/10 blur-3xl" />

      <div className="relative flex h-full min-h-[280px] items-center justify-center md:min-h-[360px]">
        {/* Stack: base models */}
        <div
          className="absolute z-[1] w-[88%] max-w-md translate-y-7 scale-[0.94] rounded-2xl border border-alter-border-strong bg-alter-bg/90 p-4 shadow-alter-card backdrop-blur-md md:w-[85%]"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-alter-muted">
              Model layer
            </span>
            <span className="rounded-md bg-alter-surface-elevated/80 px-2 py-0.5 font-mono text-[10px] text-alter-text-secondary">
              OSS + frontier
            </span>
          </div>
          <div className="flex gap-2">
            {['Llama', 'Claude', 'GPT'].map((label) => (
              <span
                key={label}
                className="rounded-lg border border-alter-border bg-alter-surface/60 px-2.5 py-1 text-xs text-alter-text-secondary"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-alter-surface-elevated">
            <div className="h-full w-2/3 animate-alter-pulse-soft rounded-full bg-gradient-to-r from-alter-primary/60 to-alter-violet/50" />
          </div>
        </div>

        {/* Identity profile */}
        <div
          className="absolute z-[2] w-[92%] max-w-md translate-y-2 rounded-2xl border border-alter-primary/35 bg-gradient-to-b from-alter-surface to-alter-bg p-5 shadow-alter-glow backdrop-blur-md md:w-[88%]"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-alter-cyan">
              Personality engine
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-alter-success/30 bg-alter-success/10 px-2 py-0.5 font-mono text-[10px] text-alter-success">
              <span className="h-1.5 w-1.5 rounded-full bg-alter-success" />
              Local
            </span>
          </div>
          <div className="space-y-2 font-mono text-[11px] leading-relaxed text-alter-text-secondary">
            <div className="flex gap-2">
              <span className="text-alter-muted">voice</span>
              <span className="text-alter-text">structured profile</span>
            </div>
            <div className="flex gap-2">
              <span className="text-alter-muted">context</span>
              <span className="text-alter-text">priorities · boundaries</span>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-alter-border-strong to-transparent" />
            <div className="text-alter-muted">persistent across models</div>
          </div>
        </div>

        {/* Action surface */}
        <div
          className="absolute z-[3] w-[84%] max-w-sm -translate-y-20 rounded-2xl border border-alter-cyan/25 bg-alter-bg/95 p-4 shadow-alter-card backdrop-blur-md md:-translate-y-28"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-alter-text-secondary">
              Action engine
            </span>
            <span className="text-[10px] text-alter-muted">in your voice</span>
          </div>
          <ul className="space-y-1.5 text-sm text-alter-text">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-alter-cyan" />
              Drafts & briefings
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-alter-violet" />
              Continue unfinished work
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-alter-primary" />
              Filter noise
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
