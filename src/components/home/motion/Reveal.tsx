import React from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

interface RevealProps {
  children: React.ReactNode;
  /** Seconds to hold before animating, so a grid can stagger its children. */
  delay?: number;
  /** Travel distance in px. Headings use a little more than body content. */
  distance?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'span';
  id?: string;
}

/**
 * Fade-and-rise on entry. Animates once, and only when the element is properly
 * in view — `amount: 0.2` stops tall sections from firing while still offscreen.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 16,
  className,
  as = 'div',
  id,
}: RevealProps) {
  const reduced = usePrefersReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (reduced) {
    const Plain = as as React.ElementType;
    return (
      <Plain className={className} id={id}>
        {children}
      </Plain>
    );
  }

  return (
    <Tag
      id={id}
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 0.7, 0.3, 1] }}
    >
      {children}
    </Tag>
  );
}

/** Convenience for grids: index * step, capped so long lists don't crawl in. */
export function stagger(index: number, step = 0.06, max = 0.36): number {
  return Math.min(index * step, max);
}

export default Reveal;
