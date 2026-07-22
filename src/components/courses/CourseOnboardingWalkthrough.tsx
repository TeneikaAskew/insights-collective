// ABOUTME: First-run guided walkthrough shown on /courses for users who have never completed a course.
// ABOUTME: Spotlight overlay that walks from the catalog to enrollment and the first weekly module.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseOnboardingWalkthrough');
const DISMISS_KEY = 'ic:course-onboarding:dismissed:v1';

type Step = {
  title: string;
  body: string;
  targetSelector?: string; // if omitted, renders as a centered modal
  cta?: string;
};

const STEPS: Step[] = [
  {
    title: 'Welcome to your course catalog',
    body:
      "This quick tour shows you how to go from picking a course to your first weekly module — in under a minute. You can skip it any time.",
    cta: "Let's go",
  },
  {
    title: 'Find a course that fits',
    body:
      'Search by title or instructor, and use the filters to narrow by category, level, or schedule.',
    targetSelector: '[data-onboarding="course-filters"]',
  },
  {
    title: 'Open a course to enroll',
    body:
      'Click any course card to see the overview. From there you can enroll and unlock all modules.',
    targetSelector: '[data-onboarding="course-grid"]',
  },
  {
    title: 'Jump into week one',
    body:
      'After enrolling, the overview page shows a Resume button that drops you directly into the first lesson of Week 1. Progress saves automatically.',
    cta: 'Start browsing',
  },
];

function useEligibility() {
  const { user } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        setChecked(true);
        return;
      }
      if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY)) {
        setChecked(true);
        return;
      }
      try {
        // "Completed a course" = has any issued certificate.
        const { count, error } = await supabase
          .from('certificates')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (error) throw error;
        if (!cancelled) setEligible((count ?? 0) === 0);
      } catch (e) {
        logger.warn('Eligibility check failed; suppressing walkthrough', e);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { eligible, checked };
}

export function CourseOnboardingWalkthrough() {
  const { eligible, checked } = useEligibility();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (checked && eligible) setOpen(true);
  }, [checked, eligible]);

  const step = STEPS[stepIdx];
  const total = STEPS.length;

  // Track target element position on step change / resize / scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const sel = step?.targetSelector;
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
    const interval = window.setInterval(schedule, 300); // handle lazy content

    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.clearInterval(interval);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [open, stepIdx, step?.targetSelector]);

  const finish = (persist = true) => {
    setOpen(false);
    if (persist && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    }
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
    // Approximate card height for overflow check.
    const approxH = 220;
    if (top + approxH > vh - 16) {
      top = Math.max(16, rect.top - approxH - gap);
    }
    return { left, top, width: cardW };
  }, [rect]);

  if (!open) return null;

  const overlay = (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dim background with a spotlight cutout */}
      {rect ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          onClick={() => finish(false)}
          aria-hidden
        >
          <defs>
            <mask id="ic-onboard-mask">
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
            mask="url(#ic-onboard-mask)"
          />
          {/* Ring around spotlight */}
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

      {/* Tour card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ic-onboard-title"
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
              Getting started · {stepIdx + 1} / {total}
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
          <h2 id="ic-onboard-title" className="font-display text-xl mb-2 leading-tight">
            {step.title}
          </h2>
          <p className="text-sm text-neutral-600 mb-5 leading-relaxed">{step.body}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4" aria-hidden>
            {STEPS.map((_, i) => (
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

export default CourseOnboardingWalkthrough;
