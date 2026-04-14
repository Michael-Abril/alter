import Link from 'next/link';

export function AlterPricingCTA() {
  return (
    <section className="alter-section border-t border-alter-border/80">
      <div className="alter-container">
        <div className="relative overflow-hidden rounded-3xl border border-alter-border-strong bg-gradient-to-br from-alter-primary/15 via-alter-surface to-alter-bg p-8 shadow-alter-glow md:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-alter-cyan/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-alter-violet/15 blur-3xl" />
          <div className="relative mx-auto max-w-2xl text-center">
            <p className="alter-eyebrow mb-3">Early access</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
              We&apos;re onboarding in small cohorts
            </h2>
            <p className="mt-4 text-alter-text-secondary">
              Pricing will follow real usage — local profile storage, model routing, and team controls.
              Join the waitlist to get release notes and a path to the first build.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/sign-up" className="alter-btn-primary min-w-[200px]">
                Join waitlist
              </Link>
              <Link href="/sign-in" className="alter-btn-secondary min-w-[200px]">
                Already invited?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
