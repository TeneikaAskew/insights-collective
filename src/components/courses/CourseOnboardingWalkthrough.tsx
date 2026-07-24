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
    title: 'Welcome — let’s find your first course',
    body:
      'A 30-second tour from picking a course to opening Week 1. Skip any time.',
    cta: "Show me",
  },
  {
    title: 'Search and filter',
    body:
      'Search by title or instructor, then filter by category and level to find a course that fits.',
    targetSelector: '[data-onboarding="course-filters"]',
  },
  {
    title: 'Open a course to enroll',
    body:
      'Click any card to view the overview, then Enroll to unlock every module.',
    targetSelector: '[data-onboarding="course-grid"]',
  },
  {
    title: 'Jump into Week 1',
    body:
      'After enrolling, hit Resume on the course overview to open Lesson 1 of Week 1. Progress saves automatically as you go.',
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
