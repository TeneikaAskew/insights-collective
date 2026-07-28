import { useRef } from 'react';
import { useScroll, useTransform, MotionValue } from 'framer-motion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Drifts a decorative element against the scroll. Transform only — never
 * animate layout properties here, these run on every frame.
 *
 * Returns a ref for the element whose progress drives the effect, plus the
 * MotionValue to hand to `style={{ y }}`.
 */
export function useParallax(distance = 80): {
  ref: React.RefObject<HTMLDivElement>;
  y: MotionValue<number>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : distance]);

  return { ref, y };
}

export default useParallax;
