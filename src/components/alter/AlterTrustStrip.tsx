const items = [
  'Identity infrastructure',
  'Local-first by design',
  'Model-agnostic',
  'Cross-platform aggregation',
];

export function AlterTrustStrip() {
  return (
    <section className="border-y border-alter-border bg-alter-surface/40 py-6 backdrop-blur-sm">
      <div className="alter-container">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 md:justify-between">
          {items.map((label) => (
            <span
              key={label}
              className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-alter-text-secondary"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
