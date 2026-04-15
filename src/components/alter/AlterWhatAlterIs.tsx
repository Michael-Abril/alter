'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Tilt3DCard } from './Tilt3DCard';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 50, rotateX: 8 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const cardPop = {
  hidden: { opacity: 0, y: 40, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AlterWhatAlterIs() {
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
        <motion.div className="mx-auto max-w-3xl text-center" variants={fadeUp}>
          <p className="alter-eyebrow mb-3">What Alter is</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-alter-text md:text-4xl">
            The persistence layer for your{' '}
            <span className="alter-text-gradient">digital mind</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-alter-text-secondary">
            Alter extracts who you are — how you think, write, decide, and work — from the systems
            you already use. It compiles a structured, on-device profile and uses that identity to
            operate across AI models so your voice stays{' '}
            <span className="text-alter-text">yours</span>, not averaged away.
          </p>
        </motion.div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            {
              title: 'Not a generic assistant',
              body: 'Purpose-built for continuity of self across tools — not task lists dressed as "agents."',
            },
            {
              title: 'Not "just productivity"',
              body: 'A substrate for judgment: priorities, tone, boundaries, and context that follow you.',
            },
            {
              title: 'Identity infrastructure',
              body: 'Models and platforms churn. Your profile is the stable layer they plug into.',
            },
          ].map((card, i) => (
            <motion.div key={card.title} variants={cardPop} custom={i}>
              <Tilt3DCard className="group">
                <div className="alter-card-hover p-6 md:p-7">
                  <h3 className="font-display text-lg font-semibold text-alter-text">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-alter-text-secondary">{card.body}</p>
                </div>
              </Tilt3DCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
