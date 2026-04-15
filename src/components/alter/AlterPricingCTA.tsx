'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';

const zoomIn = {
  hidden: { opacity: 0, scale: 0.85, y: 40 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AlterPricingCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section
      className="alter-snap-section alter-section border-t border-alter-border/60"
      style={{ perspective: 1200 }}
    >
      <div ref={ref} className="alter-container">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={zoomIn}
          className="relative overflow-hidden rounded-3xl border border-alter-border-strong bg-gradient-to-br from-alter-primary/15 via-alter-surface to-alter-bg p-8 shadow-alter-glow md:p-12"
        >
          {/* Ambient glow orbs */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-alter-gold-light/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-alter-gold-dark/12 blur-3xl" />

          {/* Gold shimmer border */}
          <div className="alter-shimmer-border pointer-events-none absolute inset-0 rounded-3xl" />

          <div className="relative mx-auto max-w-2xl text-center">
            <p className="alter-eyebrow mb-3">Early access</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
              We&apos;re onboarding in{' '}
              <span className="alter-text-gradient">small cohorts</span>
            </h2>
            <p className="mt-4 text-alter-text-secondary">
              Pricing will follow real usage — local profile storage, model routing, and team controls.
              Join the waitlist to get release notes and a path to the first build.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <motion.div
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Link href="/sign-up" className="alter-btn-primary min-w-[200px]">
                  Join waitlist
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Link href="/sign-in" className="alter-btn-secondary alter-shimmer-border min-w-[200px]">
                  Already invited?
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
