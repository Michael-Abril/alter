'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export function AlterFooter() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <footer className="border-t border-alter-border bg-alter-bg/90 backdrop-blur-sm pb-10 pt-16">
      {/* Gold accent line */}
      <div className="pointer-events-none mx-auto mb-8 h-px w-[min(80%,40rem)] bg-gradient-to-r from-transparent via-alter-primary/30 to-transparent" />

      <motion.div
        ref={ref}
        className="alter-container"
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        variants={fadeUp}
      >
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div>
            <p className="font-display text-xl font-semibold tracking-tight alter-text-gradient inline-block">
              Alter
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-alter-text-secondary">
              Portable AI identity — local-first, model-agnostic, built for continuity.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-alter-text-secondary">
            <Link href="/sign-in" className="transition-colors duration-300 hover:text-alter-gold-light">
              Sign in
            </Link>
            <Link href="/sign-up" className="transition-colors duration-300 hover:text-alter-gold-light">
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-alter-border pt-8 text-xs text-alter-muted md:flex-row md:items-center md:justify-between">
          <span>&copy; {new Date().getFullYear()} Alter. All rights reserved.</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-alter-gold-dark/60">
            Identity infrastructure for the next decade of AI
          </span>
        </div>
      </motion.div>
    </footer>
  );
}
