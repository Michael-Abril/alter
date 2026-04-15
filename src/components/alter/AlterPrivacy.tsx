'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Lock, ServerOff } from 'lucide-react';
import { Tilt3DCard } from './Tilt3DCard';

const slideLeft = {
  hidden: { opacity: 0, x: -60, rotateY: -6 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};

const vaultReveal = {
  hidden: { opacity: 0, rotateY: -15, x: 40 },
  visible: {
    opacity: 1,
    rotateY: 0,
    x: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AlterPrivacy() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      className="alter-snap-section alter-section border-t border-alter-border/60"
      style={{ perspective: 1200 }}
    >
      <div ref={ref} className="alter-container">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <motion.div
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={slideLeft}
          >
            <p className="alter-eyebrow mb-3">Privacy · architecture</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
              Your data doesn&apos;t leave your device.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-alter-text-secondary">
              We send the intelligence to you — you don&apos;t send yourself to us. The profile is
              designed to live locally, with portability and control as the default posture — not an
              afterthought buried in a settings screen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-alter-success/30 bg-alter-success/10 px-3 py-1.5 text-xs font-medium text-alter-success">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                Local-first storage
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-alter-border-strong bg-alter-surface/80 px-3 py-1.5 text-xs font-medium text-alter-text-secondary">
                <ServerOff className="h-3.5 w-3.5" strokeWidth={2} />
                No &quot;upload your life&quot; moat
              </span>
            </div>
          </motion.div>

          <motion.div
            className="space-y-4"
            variants={stagger}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          >
            {[
              {
                title: 'On-device profile',
                body: 'Structured identity — voice, thinking patterns, priorities, context, boundaries — stays where you can audit it.',
              },
              {
                title: 'Aggregation without surrender',
                body: 'Connect sources to learn from your footprint; the durable artifact remains yours to move or delete.',
              },
              {
                title: 'Trust as product',
                body: "Privacy and portability aren't marketing adjectives — they're the reason identity infrastructure can exist at all.",
              },
            ].map((row) => (
              <motion.div key={row.title} variants={vaultReveal}>
                <Tilt3DCard className="group" tiltDeg={8}>
                  <div className="alter-card-hover rounded-2xl p-5 md:p-6">
                    <h3 className="font-display text-base font-semibold text-alter-text">{row.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-alter-text-secondary">{row.body}</p>
                  </div>
                </Tilt3DCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
