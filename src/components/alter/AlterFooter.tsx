import Link from 'next/link';

export function AlterFooter() {
  return (
    <footer className="border-t border-alter-border bg-alter-bg pb-10 pt-16">
      <div className="alter-container">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div>
            <p className="font-display text-xl font-semibold tracking-tight text-alter-text">Alter</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-alter-text-secondary">
              Portable AI identity — local-first, model-agnostic, built for continuity.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-alter-text-secondary">
            <Link href="/sign-in" className="transition hover:text-alter-text">
              Sign in
            </Link>
            <Link href="/sign-up" className="transition hover:text-alter-text">
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-alter-border pt-8 text-xs text-alter-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Alter. All rights reserved.</span>
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Identity infrastructure for the next decade of AI
          </span>
        </div>
      </div>
    </footer>
  );
}
