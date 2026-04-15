import type { SuggestedAutomation } from '@/lib/tasks-focus';

export default function SuggestedAutomations({ items }: { items: SuggestedAutomation[] }) {
  const block = items[0];
  if (!block) return null;

  return (
    <section
      className="rounded-xl border border-alter-border/70 bg-alter-surface/50 px-5 py-5 md:px-6"
      aria-labelledby="let-alter-handle-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-alter-muted">Automations</p>
      <h2
        id="let-alter-handle-heading"
        className="mt-1 font-display text-xl font-bold tracking-tight text-alter-text md:text-2xl"
      >
        {block.headline}
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-alter-text-secondary">
        {block.bullets.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-alter-gold-light" aria-hidden>
              –
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
