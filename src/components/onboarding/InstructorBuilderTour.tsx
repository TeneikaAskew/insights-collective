// ABOUTME: First-run guided walkthrough for instructors visiting the course builder.
// ABOUTME: Highlights nav, curriculum authoring, preview, and publish using tooltip copy.

import { SpotlightTour, type SpotlightStep } from '@/components/onboarding/SpotlightTour';

const DISMISS_KEY = 'ic:builder-onboarding:dismissed:v1';

const STEPS: SpotlightStep[] = [
  {
    title: 'Welcome to your course builder',
    body:
      "A one-minute tour of the tools you'll use to build, preview, and publish a course. You can skip any time.",
    cta: "Let's go",
  },
  {
    title: 'Move between builder views',
    body:
      'The left rail switches between Setup, Curriculum, Information, Design, and Certificates. Setup is a checklist that walks you through the essentials.',
    targetSelector: '[data-onboarding="builder-nav"]',
  },
  {
    title: 'Preview the student experience',
    body:
      'Preview opens the course exactly as a student sees it — including locked, dripped, and unpublished states.',
    targetSelector: '[data-onboarding="builder-preview"]',
  },
  {
    title: 'Publish when you are ready',
    body:
      'Publishing makes the course visible to students. You can Unpublish at any time to hide it again without losing your work.',
    targetSelector: '[data-onboarding="builder-publish"]',
    cta: 'Start building',
  },
];

export function InstructorBuilderTour({ active }: { active: boolean }) {
  return (
    <SpotlightTour
      dismissKey={DISMISS_KEY}
      steps={STEPS}
      active={active}
      eyebrow="Instructor tour"
    />
  );
}

export default InstructorBuilderTour;
