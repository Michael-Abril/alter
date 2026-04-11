import Link from 'next/link';
import { AlterWordmark } from '@/components/brand/AlterLogo';

export function AlterSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-alter-border/80 bg-alter-bg/80 backdrop-blur-xl">
      <div className="alter-container flex h-14 items-center justify-between md:h-16">
        <Link
          href="/"
          className="min-w-0 rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-alter-primary/50"
        >
          <AlterWordmark tone="marketing" compact className="gap-2" />
        </Link>
        <nav className="flex shrink-0 items-center gap-4 text-sm">
          <Link href="/sign-in" className="text-alter-text-secondary transition hover:text-alter-text">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-alter-primary px-3 py-1.5 font-medium text-white shadow-sm shadow-alter-primary/20 transition hover:bg-alter-primary/90"
          >
            Early access
          </Link>
        </nav>
      </div>
    </header>
  );
}
