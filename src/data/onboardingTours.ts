
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlight?: boolean;
  action?: () => void;
}

export interface OnboardingTour {
  id: string;
  name: string;
  steps: OnboardingStep[];
}

export const onboardingTours: Record<string, OnboardingTour> = {
  home: {
    id: 'home',
    name: 'Platform Tour',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Insights Collective',
        description: 'Your AI-powered platform for data career success. Let\'s explore the key features.',
        target: '[data-tour="hero"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'career-quiz',
        title: 'Find Your Data Career Path',
        description: 'Take our interactive quiz to discover which data career path aligns with your skills and interests.',
        target: '[data-tour="quiz"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'career-tools',
        title: 'Career Exploration & Enhancement Tools',
        description: 'Resume review, interview practice, portfolio building and a career coach — all included with a free account.',
        target: '[data-tour="tools"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'get-started',
        title: 'Ready When You Are',
        description: 'Create a free account to save your path and start the first course.',
        target: '[data-tour="cta"]',
        position: 'top',
        highlight: true
      }
    ]
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard Tour',
    steps: [
      {
        id: 'overview',
        title: 'Your Dashboard',
        description: 'This is your personal dashboard where you can track your progress and access all features.',
        target: '[data-tour="dashboard-overview"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'quick-actions',
        title: 'Quick Actions',
        description: 'Access your most-used features quickly from these action buttons.',
        target: '[data-tour="quick-actions"]',
        position: 'bottom',
        highlight: true,
      }
    ]
  }
};
