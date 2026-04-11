import type { SuggestedAutomation } from '@/lib/tasks-focus';

export default function SuggestedAutomations({ items }: { items: SuggestedAutomation[] }) {
  const block = items[0];
  if (!block) return null;

  return (
    <section
      className="rounded-xl border border-nightshift-border/70 bg-nightshift-bg-card/50 px-5 py-5 md:px-6"
      aria-labelledby="let-alter-handle-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nightshift-text-muted">Automations</p>
      <h2
        id="let-alter-handle-heading"
        className="mt-1 font-display text-xl font-bold tracking-tight text-nightshift-text-primary md:text-2xl"
      >
        {block.headline}
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-nightshift-text-secondary">
        {block.bullets.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-nightshift-highlight" aria-hidden>
              –
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
