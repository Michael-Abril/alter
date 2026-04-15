'use client';

import { type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ParallaxLayerProps {
  children?: ReactNode;
  className?: string;
  /** Speed multiplier: 0 = fixed, 0.5 = half speed, 1 = normal, 2 = double */
  speed?: number;
  /** Direction of parallax movement */
  direction?: 'vertical' | 'horizontal';
  /** Reference element for scroll tracking (defaults to viewport) */
  scrollRef?: React.RefObject<HTMLElement | null>;
}

export function ParallaxLayer({
  children,
  className = '',
  speed = 0.5,
  direction = 'vertical',
  scrollRef,
}: ParallaxLayerProps) {
  const { scrollYProgress } = useScroll(
    scrollRef ? { container: scrollRef } : undefined
  );

  const yRange = useTransform(scrollYProgress, [0, 1], [0, -200 * speed]);
  const xRange = useTransform(scrollYProgress, [0, 1], [0, -100 * speed]);

  return (
    <motion.div
      className={`pointer-events-none ${className}`}
      style={direction === 'vertical' ? { y: yRange } : { x: xRange }}
    >
      {children}
    </motion.div>
  );
}
