
interface OnboardingTourStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  highlight: boolean;
}

interface OnboardingTour {
  name: string;
  steps: OnboardingTourStep[];
}

export const onboardingTours: Record<string, OnboardingTour> = {
  home: {
    name: 'Welcome Tour',
    steps: [
      {
        target: '[data-tour="hero"]',
        title: 'Welcome to Insights Collective',
        description: 'This is your starting point for data science career success.',
        position: 'bottom',
        highlight: true,
      },
      {
        target: '[data-tour="quiz"]',
        title: 'Career Assessment',
        description: 'Take our AI-powered assessment to discover your ideal data science career path.',
        position: 'top',
        highlight: true,
      },
      {
        target: '[data-tour="courses"]',
        title: 'Learning Resources',
        description: 'Explore our comprehensive course catalog to build your skills.',
        position: 'top',
        highlight: true,
      },
      {
        target: '[data-tour="tools"]',
        title: 'Professional Tools',
        description: 'Access resume analysis, interview prep, and career guidance tools.',
        position: 'top',
        highlight: true,
      },
    ],
  },
  dashboard: {
    name: 'Dashboard Tour',
    steps: [
      {
        target: '[data-tour="navigation"]',
        title: 'Navigation Menu',
        description: 'Use this sidebar to navigate between different sections of the platform.',
        position: 'right',
        highlight: true,
      },
      {
        target: '[data-tour="progress"]',
        title: 'Your Progress',
        description: 'Track your learning progress and achievements here.',
        position: 'bottom',
        highlight: true,
      },
    ],
  },
};
