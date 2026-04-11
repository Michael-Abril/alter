import Link from 'next/link';
import { IdentityVisual } from './IdentityVisual';

export function AlterHero() {
  return (
    <section className="relative pt-16 md:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-alter-radial bg-cover" />
      <div className="pointer-events-none absolute inset-0 bg-alter-radial-cyan bg-cover opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[length:48px_48px] bg-alter-grid opacity-[0.18] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]" />

      <div className="alter-container relative pb-16 md:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <p className="alter-eyebrow mb-4 animate-alter-fade-up opacity-0 [animation-fill-mode:forwards]">
              Portable AI identity
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-alter-text md:text-5xl lg:text-[3.25rem] animate-alter-fade-up opacity-0 [animation-delay:80ms] [animation-fill-mode:forwards]">
              Every AI tool knows what to do.{' '}
              <span className="bg-gradient-to-r from-alter-text via-white to-alter-cyan bg-clip-text text-transparent">
                Alter knows who you are.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-alter-text-secondary animate-alter-fade-up opacity-0 [animation-delay:140ms] [animation-fill-mode:forwards]">
              A local-first personality layer that learns how you think, write, and decide — then
              acts on your behalf across models. Infrastructure for your digital mind, not another
              chat surface.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center animate-alter-fade-up opacity-0 [animation-delay:200ms] [animation-fill-mode:forwards]">
              <Link href="/sign-up" className="alter-btn-primary text-center">
                Request early access
              </Link>
              <Link href="/sign-in" className="alter-btn-secondary text-center">
                Sign in
              </Link>
            </div>
            <p className="mt-6 max-w-md text-sm text-alter-muted animate-alter-fade-up opacity-0 [animation-delay:260ms] [animation-fill-mode:forwards]">
              Your profile stays on your device. Model-agnostic. Cross-platform. Built for people who
              outlast the hype cycle.
            </p>
          </div>
          <div className="animate-alter-fade-up opacity-0 [animation-delay:120ms] [animation-fill-mode:forwards]">
            <IdentityVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
