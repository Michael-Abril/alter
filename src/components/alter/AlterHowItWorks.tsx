'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Cpu, Fingerprint, Zap } from 'lucide-react';
import { Tilt3DCard } from './Tilt3DCard';

const layers = [
  {
    icon: Cpu,
    name: 'Base LLM layer',
    summary: 'Open models for most work; frontier models when quality is non‑negotiable.',
    bullets: ['Cost-aware routing', 'Same identity everywhere', 'No lock-in to one vendor'],
    accent: 'from-alter-primary/20 to-transparent',
  },
  {
    icon: Fingerprint,
    name: 'Personality engine',
    summary:
      'Ingests exports, email, meetings, coursework, files, and voice — then builds a structured profile.',
    bullets: ['Voice & reasoning patterns', 'Priorities & context', 'Explicit boundaries'],
    accent: 'from-alter-gold-dark/20 to-transparent',
  },
  {
    icon: Zap,
    name: 'Action engine',
    summary: 'Uses your profile to execute: drafts, continuations, briefings, triage — in your voice.',
    bullets: ['Email drafts that sound like you', 'Pick up unfinished work', 'Daily signal, less noise'],
    accent: 'from-alter-gold-light/15 to-transparent',
  },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
};

const cascadeCard = {
  hidden: { opacity: 0, y: 60, rotateX: 12, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40, rotateX: 6 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export function AlterHowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section
      className="alter-snap-section alter-section relative border-t border-alter-border/60"
      style={{ perspective: 1200 }}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(100%,72rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-alter-primary/30 to-transparent" />

      <motion.div
        ref={ref}
        className="alter-container"
        variants={stagger}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        <motion.div className="mx-auto max-w-2xl text-center" variants={fadeUp}>
          <p className="alter-eyebrow mb-3">How it works</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            Three layers. One coherent{' '}
            <span className="alter-text-gradient">you</span>.
          </h2>
          <p className="mt-4 text-alter-text-secondary">
            Inference, identity extraction, and execution — separated so you can reason about trust
            and control.
          </p>
        </motion.div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
          {layers.map((layer, i) => (
            <motion.div key={layer.name} variants={cascadeCard} custom={i}>
              <Tilt3DCard className="group h-full">
                <div className="relative h-full overflow-hidden rounded-2xl border border-alter-border bg-alter-surface/60 p-6 shadow-alter-card transition-all duration-300 group-hover:border-alter-border-strong group-hover:shadow-alter-glow md:p-7">
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${layer.accent} opacity-80`}
                  />
                  <div className="relative">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-alter-border-strong bg-alter-bg/80 text-alter-gold-light">
                      <layer.icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-alter-text">{layer.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-alter-text-secondary">{layer.summary}</p>
                    <ul className="mt-5 space-y-2 border-t border-alter-border pt-5">
                      {layer.bullets.map((b) => (
                        <li key={b} className="flex gap-2 text-sm text-alter-text-secondary">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-alter-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Tilt3DCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
