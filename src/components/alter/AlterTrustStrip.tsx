'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const items = [
  'Identity infrastructure',
  'Local-first by design',
  'Model-agnostic',
  'Cross-platform aggregation',
  'Identity infrastructure',
  'Local-first by design',
  'Model-agnostic',
  'Cross-platform aggregation',
];

export function AlterTrustStrip() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <motion.section
      ref={ref}
      className="relative border-y border-alter-border bg-alter-surface/40 py-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Gold accent lines */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-alter-primary/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-alter-primary/20 to-transparent" />

      <div className="overflow-hidden">
        <div className="flex animate-alter-marquee whitespace-nowrap">
          {items.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="mx-8 inline-flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-alter-gold-light/80 md:mx-12"
            >
              <span className="h-1 w-1 rounded-full bg-alter-primary/60" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
