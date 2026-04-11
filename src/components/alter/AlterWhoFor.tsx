const personas = [
  { label: 'Solo founders', detail: 'Ship in your voice while context stays attached to you.' },
  { label: 'Students', detail: 'Coursework, threads, and voice — without losing yourself to generic prompts.' },
  { label: 'Freelancers', detail: 'Client comms and briefs that stay consistent across tools.' },
  { label: 'Creators', detail: 'Tone and POV preserved — amplification without flattening.' },
  { label: 'Teams (soon)', detail: 'Scale a founder’s thinking and communication style with consent and control.' },
];

export function AlterWhoFor() {
  return (
    <section className="alter-section border-t border-alter-border/80">
      <div className="alter-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="alter-eyebrow mb-3">Who it&apos;s for</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            Built for people who trade in judgment
          </h2>
          <p className="mt-4 text-alter-text-secondary">
            If your work depends on how you decide — not just how fast you type — Alter is aimed at
            you.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <div
              key={p.label}
              className="rounded-2xl border border-alter-border bg-alter-surface/50 p-5 text-left transition hover:border-alter-primary/35 hover:bg-alter-surface/80"
            >
              <h3 className="font-display text-sm font-semibold text-alter-text">{p.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-alter-text-secondary">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
