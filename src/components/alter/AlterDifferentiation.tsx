const rows = [
  {
    label: 'Generic assistants',
    alter: 'Identity substrate — who you are travels with you.',
    other: 'Fresh context every session; “you” re-explained endlessly.',
  },
  {
    label: 'Productivity suites',
    alter: 'Thinks in your voice and constraints — not just tasks.',
    other: 'Optimizes throughput; blurs the person behind the work.',
  },
  {
    label: 'Model vendors',
    alter: 'Model-agnostic — swap engines without retraining your life.',
    other: 'Incentivized to keep you inside their stack.',
  },
];

export function AlterDifferentiation() {
  return (
    <section className="alter-section border-t border-alter-border/80 bg-alter-surface/20">
      <div className="alter-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="alter-eyebrow mb-3">Differentiation</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            Same planet. Different category.
          </h2>
          <p className="mt-4 text-alter-text-secondary">
            Clear positioning: Alter is not competing on chat — it’s competing on continuity.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-alter-border bg-alter-bg/80 shadow-alter-card">
          <div className="grid grid-cols-3 gap-0 border-b border-alter-border bg-alter-surface/60 px-4 py-3 text-xs font-mono uppercase tracking-wider text-alter-muted md:px-6">
            <span className="col-span-1" />
            <span className="text-alter-cyan">Alter</span>
            <span className="text-alter-text-secondary">Typical stack</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 gap-4 border-b border-alter-border px-4 py-5 last:border-b-0 md:grid-cols-3 md:items-center md:gap-0 md:px-6"
            >
              <div className="font-mono text-xs text-alter-muted md:col-span-1">{row.label}</div>
              <p className="text-sm text-alter-text md:border-l md:border-alter-border md:pl-6">{row.alter}</p>
              <p className="text-sm text-alter-text-secondary md:border-l md:border-alter-border md:pl-6">
                {row.other}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
