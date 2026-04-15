'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const slideLeft = {
  hidden: { opacity: 0, x: -60, rotateY: -8 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

const slideRight = {
  hidden: { opacity: 0, x: 60, rotateY: 8 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.15 },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AlterWhyNow() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      className="alter-snap-section alter-section border-t border-alter-border/60 bg-gradient-to-b from-alter-bg via-alter-surface/30 to-alter-bg"
      style={{ perspective: 1200 }}
    >
      <div ref={ref} className="alter-container">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <motion.div
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={slideLeft}
          >
            <p className="alter-eyebrow mb-3">Why this matters · why now</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
              Tools got smarter.{' '}
              <span className="text-alter-text-secondary">You got fragmented.</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-alter-text-secondary">
              Every new model resets context. Every tab is a different &quot;you.&quot; Alter is the layer that
              remembers — so intelligence compounds instead of evaporating when you switch apps or
              vendors.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={slideRight}
          >
            <motion.div
              className="alter-card space-y-4 p-6 md:p-8"
              variants={stagger}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
            >
              {[
                'Make humans better, not just agents better — judgment preserved, not replaced.',
                'Second mind for daily briefings and unfinished work — continuity without clutter.',
                'Preserve voice instead of blandifying it — taste and constraints as first-class data.',
              ].map((line) => (
                <motion.div
                  key={line}
                  variants={fadeIn}
                  className="flex gap-3 text-sm leading-relaxed text-alter-text-secondary"
                >
                  <span className="mt-0.5 font-mono text-alter-gold-light">/</span>
                  <span>{line}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
