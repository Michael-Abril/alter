'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Tilt3DCard } from './Tilt3DCard';

const personas = [
  { label: 'Solo founders', detail: 'Ship in your voice while context stays attached to you.' },
  { label: 'Students', detail: 'Coursework, threads, and voice — without losing yourself to generic prompts.' },
  { label: 'Freelancers', detail: 'Client comms and briefs that stay consistent across tools.' },
  { label: 'Creators', detail: 'Tone and POV preserved — amplification without flattening.' },
  { label: 'Teams (soon)', detail: "Scale a founder's thinking and communication style with consent and control." },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40, rotateX: 6 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const cardPop = {
  hidden: { opacity: 0, scale: 0.88, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AlterWhoFor() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      className="alter-snap-section alter-section border-t border-alter-border/60"
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
          <p className="alter-eyebrow mb-3">Who it&apos;s for</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            Built for people who trade in{' '}
            <span className="alter-text-gradient">judgment</span>
          </h2>
          <p className="mt-4 text-alter-text-secondary">
            If your work depends on how you decide — not just how fast you type — Alter is aimed at
            you.
          </p>
        </motion.div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <motion.div key={p.label} variants={cardPop}>
              <Tilt3DCard className="group h-full" tiltDeg={10}>
                <div className="h-full rounded-2xl border border-alter-border bg-alter-surface/50 p-5 text-left transition-all duration-300 group-hover:border-alter-primary/35 group-hover:bg-alter-surface/80 group-hover:shadow-alter-gold-sm">
                  <h3 className="font-display text-sm font-semibold text-alter-text">{p.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-alter-text-secondary">{p.detail}</p>
                </div>
              </Tilt3DCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
