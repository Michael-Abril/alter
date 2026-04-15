/**
 * Conversational morning brief — personal note styling (teal accent).
 */

export default function MorningBriefCard({ welcomeLine, narrative }: { welcomeLine: string; narrative?: string }) {
  return (
    <section
      className="rounded-xl border border-nightshift-border/60 border-l-4 border-l-teal-500/90 bg-nightshift-bg-card/80 px-5 py-5 shadow-md md:px-6 md:py-6"
      aria-labelledby="morning-brief-label"
    >
      <p id="morning-brief-label" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-nightshift-text-muted">
        Morning brief
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold text-nightshift-text-primary md:text-2xl">{welcomeLine}</h2>
      {narrative ? (
        <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-nightshift-text-secondary md:text-[15px]">
          {narrative}
        </p>
      ) : null}
    </section>
  );
}
