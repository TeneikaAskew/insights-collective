// ABOUTME: Reusable spotlight walkthrough. Renders a dimmed overlay with a cutout over each
// ABOUTME: step target and a tour card. Tours are dismissed persistently via localStorage key.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';

export type SpotlightStep = {
  title: string;
  body: string;
  /** CSS selector for the highlighted element. When omitted, step is centered. */
  targetSelector?: string;
  /** Optional custom CTA label for the "next" button. */
  cta?: string;
};

interface SpotlightTourProps {
  /** Persist dismissal under this localStorage key. Unique per tour. */
  dismissKey: string;
  /** Ordered list of steps to present. Empty list is a no-op. */
  steps: SpotlightStep[];
  /** Set to true to auto-open on mount if not previously dismissed. */
  active: boolean;
  /** Called when the tour finishes or is skipped. */
  onClose?: () => void;
  /** Short section label at the top of the tour card. */
  eyebrow?: string;
}

/**
 * Spotlight walkthrough that highlights UI targets step-by-step. Requires targets to be
 * addressable via a stable CSS selector (typically `data-onboarding="…"`).
 */
export function SpotlightTour({
  dismissKey,
  steps,
  active,
  onClose,
  eyebrow = 'Getting started',
}: SpotlightTourProps) {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const raf = useRef<number | null>(null);

  const progressKey = `${dismissKey}:step`;

  useEffect(() => {
    if (!active || steps.length === 0) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(dismissKey)) return;
    // E2E bypass: allow test suites to disable all onboarding tours globally
    // so their overlays never intercept clicks on the elements under test.
    if (window.localStorage.getItem('e2e:disable-tours')) return;
    // Resume from the last saved step if the user left mid-tour.
    const savedRaw = window.localStorage.getItem(progressKey);
    const saved = savedRaw ? parseInt(savedRaw, 10) : 0;
    const start = Number.isFinite(saved) ? Math.min(Math.max(0, saved), steps.length - 1) : 0;
    setStepIdx(start);
    setOpen(true);
  }, [active, steps.length, dismissKey, progressKey]);

  const step = steps[stepIdx];
  const total = steps.length;

  // Persist current step so the tour can resume if the user leaves mid-way.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    window.localStorage.setItem(progressKey, String(stepIdx));
  }, [open, stepIdx, progressKey]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const sel = step.targetSelector;
      if (!sel) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setRect(el.getBoundingClientRect());
    };
    const schedule = () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const interval = window.setInterval(schedule, 300);
    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.clearInterval(interval);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [open, stepIdx, step]);

  const finish = (persist = true) => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      if (persist) {
        // Explicit Skip / completion: don't reopen and clear resume state.
        window.localStorage.setItem(dismissKey, new Date().toISOString());
        window.localStorage.removeItem(progressKey);
        setStepIdx(0);
      }
      // If not persisted (e.g. clicked outside), leave the progress key so we
      // resume from the same step next time active becomes true.
    }
    onClose?.();
  };

  const cardPos = useMemo(() => {
    if (!rect) return null;
    const cardW = 380;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(16, Math.min(vw - cardW - 16, left));
    let top = rect.bottom + gap;
    const approxH = 220;
    if (top + approxH > vh - 16) top = Math.max(16, rect.top - approxH - gap);
    return { left, top, width: cardW };
  }, [rect]);

  if (!open || !step) return null;

  const overlay = (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {rect ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          onClick={() => finish(false)}
          aria-hidden
        >
          <defs>
            <mask id={`spotlight-mask-${dismissKey}`}>
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={Math.max(0, rect.left - 8)}
                y={Math.max(0, rect.top - 8)}
                width={rect.width + 16}
                height={rect.height + 16}
                rx={14}
                ry={14}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(15,15,20,0.55)"
            mask={`url(#spotlight-mask-${dismissKey})`}
          />
          <rect
            x={Math.max(0, rect.left - 8)}
            y={Math.max(0, rect.top - 8)}
            width={rect.width + 16}
            height={rect.height + 16}
            rx={14}
            ry={14}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
        </svg>
      ) : (
        <div
          className="absolute inset-0 bg-black/60 pointer-events-auto"
          onClick={() => finish(false)}
          aria-hidden
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`spotlight-title-${dismissKey}`}
        className="pointer-events-auto absolute bg-white text-neutral-900 rounded-2xl shadow-2xl border border-neutral-200"
        style={
          cardPos
            ? { left: cardPos.left, top: cardPos.top, width: cardPos.width }
            : {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 420,
                maxWidth: 'calc(100vw - 32px)',
              }
        }
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              {eyebrow} · {stepIdx + 1} / {total}
            </div>
            <button
              type="button"
              onClick={() => finish(true)}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Skip walkthrough"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h2
            id={`spotlight-title-${dismissKey}`}
            className="font-display text-xl mb-2 leading-tight"
          >
            {step.title}
          </h2>
          <p className="text-sm text-neutral-600 mb-5 leading-relaxed">{step.body}</p>

          <div className="flex items-center gap-1.5 mb-4" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIdx ? 'w-6 bg-primary' : 'w-1.5 bg-neutral-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => finish(true)}
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 px-2 py-1"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {stepIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-700 hover:text-neutral-900 px-3 py-2 rounded-full hover:bg-neutral-100"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {stepIdx < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-full"
                >
                  {step.cta || 'Next'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => finish(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-full"
                >
                  {step.cta || 'Got it'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export default SpotlightTour;
