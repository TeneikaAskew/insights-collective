// ABOUTME: First-run guided walkthrough shown on /courses for users who have never completed a course.
// ABOUTME: Delegates to the shared SpotlightTour; steps map to tooltip surfaces on the catalog.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logger';
import { SpotlightTour, type SpotlightStep } from '@/components/onboarding/SpotlightTour';

const logger = createLogger('CourseOnboardingWalkthrough');
const DISMISS_KEY = 'ic:course-onboarding:dismissed:v1';

const STEPS: SpotlightStep[] = [
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

export function CourseOnboardingWalkthrough() {
  const { user } = useAuth();
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) return;
      if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY)) return;
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
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <SpotlightTour
      dismissKey={DISMISS_KEY}
      steps={STEPS}
      active={eligible}
      eyebrow="Student tour"
    />
  );
}

export default CourseOnboardingWalkthrough;
