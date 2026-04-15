'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { IdentityVisual } from './IdentityVisual';

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const fadeUp3D = {
  hidden: { opacity: 0, y: 40, rotateX: 12 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AlterHero() {
  return (
    <section className="alter-snap-section relative flex items-center pt-16 md:pt-24">
      {/* Ambient background layers */}
      <div className="pointer-events-none absolute inset-0 bg-alter-radial bg-cover" />
      <div className="pointer-events-none absolute inset-0 bg-alter-radial-cyan bg-cover opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-alter-radial-warm bg-cover" />
      <div className="pointer-events-none absolute inset-0 bg-[length:48px_48px] bg-alter-grid opacity-[0.12] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]" />

      {/* Gold accent line at top */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(90%,60rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-alter-primary/40 to-transparent" />

      <motion.div
        className="alter-container relative pb-16 md:pb-24"
        style={{ perspective: 1200 }}
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <motion.p
              variants={fadeUp3D}
              className="alter-eyebrow mb-4"
            >
              Portable AI identity
            </motion.p>
            <motion.h1
              variants={fadeUp3D}
              className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-alter-text md:text-5xl lg:text-[3.25rem]"
            >
              Every AI tool knows what to do.{' '}
              <span className="bg-gradient-to-r from-alter-text via-alter-gold-light to-alter-primary bg-clip-text text-transparent">
                Alter knows who you are.
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp3D}
              className="mt-6 max-w-xl text-lg leading-relaxed text-alter-text-secondary"
            >
              A local-first personality layer that learns how you think, write, and decide — then
              acts on your behalf across models. Infrastructure for your digital mind, not another
              chat surface.
            </motion.p>
            <motion.div
              variants={fadeUp3D}
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <motion.div
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Link href="/sign-up" className="alter-btn-primary text-center">
                  Request early access
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Link href="/sign-in" className="alter-btn-secondary alter-shimmer-border text-center">
                  Sign in
                </Link>
              </motion.div>
            </motion.div>
            <motion.p
              variants={fadeUp3D}
              className="mt-6 max-w-md text-sm text-alter-muted"
            >
              Your profile stays on your device. Model-agnostic. Cross-platform. Built for people who
              outlast the hype cycle.
            </motion.p>
          </div>
          <motion.div variants={fadeUp3D}>
            <IdentityVisual />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
