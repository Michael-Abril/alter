export function AlterWhatAlterIs() {
  return (
    <section className="alter-section border-t border-alter-border/80">
      <div className="alter-container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="alter-eyebrow mb-3">What Alter is</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            The persistence layer for your digital mind
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-alter-text-secondary">
            Alter extracts who you are — how you think, write, decide, and work — from the systems
            you already use. It compiles a structured, on-device profile and uses that identity to
            operate across AI models so your voice stays{' '}
            <span className="text-alter-text">yours</span>, not averaged away.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            {
              title: 'Not a generic assistant',
              body: 'Purpose-built for continuity of self across tools — not task lists dressed as “agents.”',
            },
            {
              title: 'Not “just productivity”',
              body: 'A substrate for judgment: priorities, tone, boundaries, and context that follow you.',
            },
            {
              title: 'Identity infrastructure',
              body: 'Models and platforms churn. Your profile is the stable layer they plug into.',
            },
          ].map((card) => (
            <div key={card.title} className="alter-card-hover p-6 md:p-7">
              <h3 className="font-display text-lg font-semibold text-alter-text">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-alter-text-secondary">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
