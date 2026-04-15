'use client';

import { motion } from 'framer-motion';

const cardFloat = {
  hidden: { opacity: 0, y: 30, rotateX: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.4 + i * 0.15,
    },
  }),
};

export function IdentityVisual() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-lg md:max-w-none" style={{ perspective: 900 }}>
      <div className="pointer-events-none absolute inset-0 bg-alter-radial bg-cover" />
      <div className="pointer-events-none absolute -right-8 top-0 h-48 w-48 rounded-full bg-alter-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-4 bottom-8 h-40 w-40 rounded-full bg-alter-gold-light/8 blur-3xl" />

      <div className="relative flex h-full min-h-[280px] items-center justify-center md:min-h-[360px]">
        {/* Base models layer */}
        <motion.div
          custom={0}
          variants={cardFloat}
          initial="hidden"
          animate="visible"
          whileHover={{ rotateY: -4, scale: 1.02, transition: { duration: 0.3 } }}
          className="absolute z-[1] w-[88%] max-w-md translate-y-7 rounded-2xl border border-alter-border-strong bg-alter-bg/90 p-4 shadow-alter-card backdrop-blur-md md:w-[85%]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-alter-muted">
              Model layer
            </span>
            <span className="rounded-md bg-alter-surface-elevated/80 px-2 py-0.5 font-mono text-[10px] text-alter-text-secondary">
              OSS + frontier
            </span>
          </div>
          <div className="flex gap-2">
            {['Llama', 'Claude', 'GPT'].map((label) => (
              <span
                key={label}
                className="rounded-lg border border-alter-border bg-alter-surface/60 px-2.5 py-1 text-xs text-alter-text-secondary"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-alter-surface-elevated">
            <div className="h-full w-2/3 animate-alter-pulse-soft rounded-full bg-gradient-to-r from-alter-primary/60 to-alter-gold-dark/50" />
          </div>
        </motion.div>

        {/* Identity profile */}
        <motion.div
          custom={1}
          variants={cardFloat}
          initial="hidden"
          animate="visible"
          whileHover={{ rotateY: 3, scale: 1.02, transition: { duration: 0.3 } }}
          className="absolute z-[2] w-[92%] max-w-md translate-y-2 rounded-2xl border border-alter-primary/35 bg-gradient-to-b from-alter-surface to-alter-bg p-5 shadow-alter-glow backdrop-blur-md md:w-[88%]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-alter-gold-light">
              Personality engine
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-alter-success/30 bg-alter-success/10 px-2 py-0.5 font-mono text-[10px] text-alter-success">
              <span className="h-1.5 w-1.5 rounded-full bg-alter-success" />
              Local
            </span>
          </div>
          <div className="space-y-2 font-mono text-[11px] leading-relaxed text-alter-text-secondary">
            <div className="flex gap-2">
              <span className="text-alter-muted">voice</span>
              <span className="text-alter-text">structured profile</span>
            </div>
            <div className="flex gap-2">
              <span className="text-alter-muted">context</span>
              <span className="text-alter-text">priorities · boundaries</span>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-alter-border-strong to-transparent" />
            <div className="text-alter-muted">persistent across models</div>
          </div>
        </motion.div>

        {/* Action surface */}
        <motion.div
          custom={2}
          variants={cardFloat}
          initial="hidden"
          animate="visible"
          whileHover={{ rotateY: -2, y: -4, scale: 1.03, transition: { duration: 0.3 } }}
          className="absolute z-[3] w-[84%] max-w-sm -translate-y-20 rounded-2xl border border-alter-gold-light/25 bg-alter-bg/95 p-4 shadow-alter-card backdrop-blur-md md:-translate-y-28"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-alter-text-secondary">
              Action engine
            </span>
            <span className="text-[10px] text-alter-muted">in your voice</span>
          </div>
          <ul className="space-y-1.5 text-sm text-alter-text">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-alter-gold-light" />
              Drafts & briefings
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-alter-primary" />
              Continue unfinished work
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-alter-gold-dark" />
              Filter noise
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
