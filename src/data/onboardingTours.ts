
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
        id: 'personalized-pathway',
        title: 'Your Personalized Career Path',
        description: 'Get customized recommendations based on your quiz results and career goals.',
        target: '[data-tour="personalizedPathway"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'interactive-showcase',
        title: 'Interactive Learning Experience',
        description: 'Explore our hands-on learning approach with interactive content and real-world projects.',
        target: '[data-tour="interactiveShowcase"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'features',
        title: 'Platform Features',
        description: 'Explore our comprehensive suite of tools designed to accelerate your data career.',
        target: '[data-tour="features"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'blueprint',
        title: 'Data Blueprint Series',
        description: 'Follow our structured learning path with our comprehensive data science blueprint.',
        target: '[data-tour="blueprint"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'learning-journey',
        title: 'Your Learning Journey',
        description: 'Track your progress and see how far you\'ve come in your data science career.',
        target: '[data-tour="journey"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'courses',
        title: 'Learning Resources',
        description: 'Access curated courses and learning materials to build your data skills.',
        target: '[data-tour="courses"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'tools',
        title: 'Career Tools',
        description: 'Use our AI-powered tools for resume analysis, interview prep, and career guidance.',
        target: '[data-tour="tools"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'analytics',
        title: 'Progress Analytics',
        description: 'Monitor your learning progress with detailed analytics and insights.',
        target: '[data-tour="analytics"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'community',
        title: 'Join Our Community',
        description: 'Connect with other data professionals and learn from their experiences.',
        target: '[data-tour="communityShowcase"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'events',
        title: 'Upcoming Events',
        description: 'Stay updated with workshops, webinars, and networking events in the data community.',
        target: '[data-tour="events"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'get-started',
        title: 'Ready to Begin?',
        description: 'Take the first step towards your data career transformation. Click below to get started!',
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
