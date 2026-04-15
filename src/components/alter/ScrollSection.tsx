'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';

interface ScrollSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Animation variant: controls how content enters */
  variant?: 'fade-up' | 'fade-left' | 'fade-right' | 'zoom' | 'none';
  /** Stagger children animations */
  stagger?: boolean;
  delay?: number;
}

const variants = {
  'fade-up': {
    hidden: { opacity: 0, y: 60, rotateX: 6 },
    visible: { opacity: 1, y: 0, rotateX: 0 },
  },
  'fade-left': {
    hidden: { opacity: 0, x: -80, rotateY: -8 },
    visible: { opacity: 1, x: 0, rotateY: 0 },
  },
  'fade-right': {
    hidden: { opacity: 0, x: 80, rotateY: 8 },
    visible: { opacity: 1, x: 0, rotateY: 0 },
  },
  zoom: {
    hidden: { opacity: 0, scale: 0.85, z: -100 },
    visible: { opacity: 1, scale: 1, z: 0 },
  },
  none: {
    hidden: {},
    visible: {},
  },
};

const containerVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.1,
    },
  }),
};

export function ScrollSection({
  children,
  className = '',
  id,
  variant = 'fade-up',
  stagger = false,
  delay = 0,
}: ScrollSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  const motionVariant = variants[variant];

  if (stagger) {
    return (
      <motion.section
        ref={ref}
        id={id}
        className={`alter-snap-section ${className}`}
        style={{ perspective: 1200 }}
        variants={containerVariants}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        custom={0.12}
      >
        {children}
      </motion.section>
    );
  }

  return (
    <motion.section
      ref={ref}
      id={id}
      className={`alter-snap-section ${className}`}
      style={{ perspective: 1200 }}
      variants={motionVariant}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
        delay,
      }}
    >
      {children}
    </motion.section>
  );
}

export function ScrollChild({
  children,
  className = '',
  variant = 'fade-up',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  variant?: 'fade-up' | 'fade-left' | 'fade-right' | 'zoom';
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={variants[variant]}
      transition={{
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
