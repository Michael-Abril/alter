'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlterWordmark } from '@/components/brand/AlterLogo';

export function AlterSiteHeader() {
  return (
    <header
      className="fixed top-0 z-50 w-full border-b border-alter-primary/20 bg-alter-bg/80 backdrop-blur-xl"
    >
      <div className="alter-container flex h-14 items-center justify-between md:h-16">
        <Link
          href="/"
          className="min-w-0 rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-alter-primary/50"
        >
          <AlterWordmark tone="marketing" compact className="gap-2" />
        </Link>
        <nav className="flex shrink-0 items-center gap-4 text-sm">
          <Link
            href="/sign-in"
            className="text-alter-text-secondary transition-colors duration-300 hover:text-alter-gold-light"
          >
            Sign in
          </Link>
          <motion.div
            whileHover={{ y: -1, scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Link
              href="/sign-up"
              className="alter-btn-primary !px-4 !py-1.5 !text-sm"
            >
              Early access
            </Link>
          </motion.div>
        </nav>
      </div>
    </header>
  );
}
