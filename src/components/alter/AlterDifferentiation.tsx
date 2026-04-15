'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const rows = [
  {
    label: 'Generic assistants',
    alter: 'Identity substrate — who you are travels with you.',
    other: 'Fresh context every session; "you" re-explained endlessly.',
  },
  {
    label: 'Productivity suites',
    alter: 'Thinks in your voice and constraints — not just tasks.',
    other: 'Optimizes throughput; blurs the person behind the work.',
  },
  {
    label: 'Model vendors',
    alter: 'Model-agnostic — swap engines without retraining your life.',
    other: 'Incentivized to keep you inside their stack.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 40, rotateX: 6 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const rowSlide = {
  hidden: { opacity: 0, x: -40, rotateY: -4 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export function AlterDifferentiation() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      className="alter-snap-section alter-section border-t border-alter-border/60 bg-alter-surface/20"
      style={{ perspective: 1200 }}
    >
      <motion.div
        ref={ref}
        className="alter-container"
        variants={stagger}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        <motion.div className="mx-auto max-w-2xl text-center" variants={fadeUp}>
          <p className="alter-eyebrow mb-3">Differentiation</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            Same planet.{' '}
            <span className="alter-text-gradient">Different category.</span>
          </h2>
          <p className="mt-4 text-alter-text-secondary">
            Clear positioning: Alter is not competing on chat — it&apos;s competing on continuity.
          </p>
        </motion.div>

        <motion.div
          className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-alter-border bg-alter-bg/80 shadow-alter-card"
          variants={fadeUp}
        >
          <div className="grid grid-cols-3 gap-0 border-b border-alter-border bg-alter-surface/60 px-4 py-3 text-xs font-mono uppercase tracking-wider text-alter-muted md:px-6">
            <span className="col-span-1" />
            <span className="text-alter-gold-light">Alter</span>
            <span className="text-alter-text-secondary">Typical stack</span>
          </div>
          {rows.map((row) => (
            <motion.div
              key={row.label}
              variants={rowSlide}
              className="grid grid-cols-1 gap-4 border-b border-alter-border px-4 py-5 last:border-b-0 md:grid-cols-3 md:items-center md:gap-0 md:px-6 transition-colors duration-300 hover:bg-alter-surface/30"
            >
              <div className="font-mono text-xs text-alter-muted md:col-span-1">{row.label}</div>
              <p className="text-sm text-alter-text md:border-l md:border-alter-border md:pl-6">{row.alter}</p>
              <p className="text-sm text-alter-text-secondary md:border-l md:border-alter-border md:pl-6">
                {row.other}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
