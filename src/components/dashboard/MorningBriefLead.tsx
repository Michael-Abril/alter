/**
 * Primary morning narrative — one clean paragraph above the rest of the dashboard.
 */

export default function MorningBriefLead({ lead }: { lead: string }) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-nightshift-border/80 bg-nightshift-bg-card/90 p-6 shadow-lg shadow-black/20 md:p-8"
      aria-labelledby="morning-brief-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-nightshift-accent/5 via-transparent to-transparent"
        aria-hidden
      />
      <h2
        id="morning-brief-heading"
        className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted"
      >
        Morning brief
      </h2>
      <p className="relative max-w-4xl text-lg font-medium leading-relaxed text-nightshift-text-primary md:text-xl md:leading-relaxed">
        {lead}
      </p>
    </section>
  );
}
