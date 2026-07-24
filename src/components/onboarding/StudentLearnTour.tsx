// ABOUTME: First-run guided walkthrough for students inside a course lesson player.
// ABOUTME: Highlights the curriculum rail, progress strip, and Complete-and-Continue action.

import { SpotlightTour, type SpotlightStep } from '@/components/onboarding/SpotlightTour';

const DISMISS_KEY = 'ic:learn-onboarding:dismissed:v1';

const STEPS: SpotlightStep[] = [
  {
    title: "You're inside your course",
    body:
      'Quick tour of the lesson player — how to navigate lessons, track progress, and mark work complete. Skip any time.',
    cta: "Show me",
  },
  {
    title: 'Your curriculum',
    body:
      'Every section and lesson lives here. Locked lessons open as you finish their prerequisites.',
    targetSelector: '[data-onboarding="learn-rail"]',
  },
  {
    title: 'Track your progress',
    body:
      'This strip shows your current lesson and overall course completion. It updates as you finish lessons and assignments.',
    targetSelector: '[data-onboarding="learn-progress"]',
  },
  {
    title: 'Complete and continue',
    body:
      'Click here to mark the lesson done and move on. Finish every lesson and this same button hands you your certificate.',
    targetSelector: '[data-onboarding="learn-continue"]',
    cta: 'Start learning',
  },
];

export function StudentLearnTour({ active }: { active: boolean }) {
  return (
    <SpotlightTour
      dismissKey={DISMISS_KEY}
      steps={STEPS}
      active={active}
      eyebrow="Student tour"
    />
  );
}

export default StudentLearnTour;
