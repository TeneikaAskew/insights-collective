// ABOUTME: First-run guided walkthrough for students inside a course lesson player.
// ABOUTME: Highlights the curriculum rail, progress strip, and Complete-and-Continue action.

import { SpotlightTour, type SpotlightStep } from '@/components/onboarding/SpotlightTour';

const DISMISS_KEY = 'ic:learn-onboarding:dismissed:v1';

const STEPS: SpotlightStep[] = [
  {
    title: "You're inside your course",
    body:
      "Quick tour of the lesson player: how to navigate lessons, track progress, and mark work complete. Skip any time.",
    cta: "Show me",
  },
  {
    title: 'Curriculum lives on the left',
    body:
      'Every section and lesson appears here. Locked lessons unlock as you complete their prerequisites.',
    targetSelector: '[data-onboarding="learn-rail"]',
  },
  {
    title: 'Track your progress',
    body:
      'The strip shows the current lesson number and your overall course completion. It updates as you finish lessons and assignments.',
    targetSelector: '[data-onboarding="learn-progress"]',
  },
  {
    title: 'Complete and continue',
    body:
      'When a lesson is done, click here to mark it complete and jump to the next one — the same button also earns you your certificate at the end.',
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
