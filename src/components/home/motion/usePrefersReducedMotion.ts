import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Single source of truth for motion on the landing page. Every reveal, stagger
 * and parallax defers to this, so turning the OS setting on collapses the whole
 * choreography to instant rather than leaving half of it running.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);

    // Safari < 14 only has the deprecated listener API.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return reduced;
}

export default usePrefersReducedMotion;
