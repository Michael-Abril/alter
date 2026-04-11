export function AlterWhyNow() {
  return (
    <section className="alter-section border-t border-alter-border/80 bg-gradient-to-b from-alter-bg via-alter-surface/30 to-alter-bg">
      <div className="alter-container">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="alter-eyebrow mb-3">Why this matters · why now</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
              Tools got smarter.{' '}
              <span className="text-alter-text-secondary">You got fragmented.</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-alter-text-secondary">
              Every new model resets context. Every tab is a different “you.” Alter is the layer that
              remembers — so intelligence compounds instead of evaporating when you switch apps or
              vendors.
            </p>
          </div>
          <div className="alter-card space-y-4 p-6 md:p-8">
            {[
              'Make humans better, not just agents better — judgment preserved, not replaced.',
              'Second mind for daily briefings and unfinished work — continuity without clutter.',
              'Preserve voice instead of blandifying it — taste and constraints as first-class data.',
            ].map((line) => (
              <div key={line} className="flex gap-3 text-sm leading-relaxed text-alter-text-secondary">
                <span className="mt-0.5 font-mono text-alter-success">/</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
