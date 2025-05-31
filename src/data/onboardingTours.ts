
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
        highlight: true,
        action: () => {
          const element = document.querySelector('[data-tour="hero"]');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        id: 'career-quiz',
        title: 'Find Your Data Career Path',
        description: 'Take our interactive quiz to discover which data career path aligns with your skills and interests.',
        target: '[data-tour="quiz"]',
        position: 'top',
        highlight: true,
        action: () => {
          const element = document.querySelector('[data-tour="quiz"]');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        id: 'personalized-pathway',
        title: 'Your Personalized Career Path',
        description: 'Get customized recommendations based on your quiz results and career goals.',
        target: '[data-tour="personalizedPathway"]',
        position: 'top',
        highlight: true,
        action: () => {
          const element = document.querySelector('[data-tour="personalizedPathway"]');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        id: 'features',
        title: 'Platform Features',
        description: 'Explore our comprehensive suite of tools designed to accelerate your data career.',
        target: '[data-tour="features"]',
        position: 'top',
        highlight: true,
        action: () => {
          const element = document.querySelector('[data-tour="features"]');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        id: 'courses',
        title: 'Learning Resources',
        description: 'Access curated courses and learning materials to build your data skills.',
        target: '[data-tour="courses"]',
        position: 'top',
        highlight: true,
        action: () => {
          const element = document.querySelector('[data-tour="courses"]');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        id: 'tools',
        title: 'Career Tools',
        description: 'Use our AI-powered tools for resume analysis, interview prep, and career guidance.',
        target: '[data-tour="tools"]',
        position: 'top',
        highlight: true,
        action: () => {
          const element = document.querySelector('[data-tour="tools"]');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    ]
  },
  navigation: {
    id: 'navigation',
    name: 'Navigation Guide',
    steps: [
      {
        id: 'sidebar-overview',
        title: 'Your Navigation Hub',
        description: 'This sidebar is your command center for accessing all platform features. Let me show you what each section offers.',
        target: '[data-tour="sidebar-content"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'career-tools',
        title: 'Career Development Tools',
        description: 'These are your core career advancement tools: Resume Analyzer optimizes your resume, Interview Prep helps you practice, and Career Agent provides AI guidance.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'learning-resources',
        title: 'Learning & Skill Building',
        description: 'Build your data skills with Courses, explore learning Resources, and get structured guidance with the Data Blueprint.',
        target: '[data-tour="learning-section"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'portfolio-showcase',
        title: 'Portfolio & Projects',
        description: 'Portfolio Explorer helps you showcase your work and build a professional data science portfolio that stands out to employers.',
        target: '[data-tour="portfolio-section"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'community-features',
        title: 'Community & Networking',
        description: 'Connect with other data professionals through Forums, attend Events, and stay engaged with Messages.',
        target: '[data-tour="community-section"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'personal-management',
        title: 'Personal Dashboard',
        description: 'Manage your learning journey with Dashboard overview, track progress in Calendar, and stay updated with Notifications.',
        target: '[data-tour="personal-section"]',
        position: 'right',
        highlight: true,
      }
    ]
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard Guide',
    steps: [
      {
        id: 'welcome-dashboard',
        title: 'Welcome to Your Dashboard',
        description: 'This is your personal command center where you can track progress and access all features quickly.',
        target: '[data-tour="dashboard-overview"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'navigation-access',
        title: 'Quick Navigation Access',
        description: 'Use the sidebar to navigate between tools. Start with Resume Analyzer or Career Agent for immediate career impact.',
        target: '[data-tour="sidebar-content"]',
        position: 'right',
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
  },
  resume: {
    id: 'resume',
    name: 'Resume Analyzer Guide',
    steps: [
      {
        id: 'resume-overview',
        title: 'AI-Powered Resume Analysis',
        description: 'Upload your resume to get instant AI analysis with specific improvement recommendations and ATS optimization tips.',
        target: '[data-tour="resume-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'navigation-context',
        title: 'Your Career Development Journey',
        description: 'After optimizing your resume here, use Interview Prep to practice for opportunities and Career Agent for ongoing guidance.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  },
  interviewPrep: {
    id: 'interviewPrep',
    name: 'Interview Preparation Guide',
    steps: [
      {
        id: 'interview-overview',
        title: 'Practice Makes Perfect',
        description: 'Use our AI-powered interview practice tools to prepare for data science interviews with realistic questions and feedback.',
        target: '[data-tour="interview-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'career-workflow',
        title: 'Complete Your Preparation',
        description: 'Combine interview prep with Resume Analyzer for applications and Portfolio Explorer to showcase your work to employers.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  },
  careerAgent: {
    id: 'careerAgent',
    name: 'Career Agent Guide',
    steps: [
      {
        id: 'career-agent-overview',
        title: 'Your AI Career Advisor',
        description: 'Get personalized career guidance, job search strategies, and skill development recommendations from our AI career expert.',
        target: '[data-tour="career-agent-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'integrated-tools',
        title: 'Integrated Career Tools',
        description: 'Use Career Agent insights to guide your resume optimization, interview preparation, and portfolio development.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  },
  portfolioExplorer: {
    id: 'portfolioExplorer',
    name: 'Portfolio Explorer Guide',
    steps: [
      {
        id: 'portfolio-overview',
        title: 'Showcase Your Data Science Work',
        description: 'Build and showcase a professional portfolio that demonstrates your data science skills to potential employers.',
        target: '[data-tour="portfolio-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'career-integration',
        title: 'Complete Your Professional Profile',
        description: 'Combine your portfolio with an optimized resume and strong interview skills for maximum career impact.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  },
  courses: {
    id: 'courses',
    name: 'Learning Platform Guide',
    steps: [
      {
        id: 'courses-overview',
        title: 'Structured Learning Paths',
        description: 'Access curated courses designed to build your data science skills systematically from beginner to advanced levels.',
        target: '[data-tour="courses-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'learning-ecosystem',
        title: 'Complete Learning Ecosystem',
        description: 'Supplement courses with Resources for reference materials and Data Blueprint for structured career guidance.',
        target: '[data-tour="learning-section"]',
        position: 'right',
        highlight: true,
      }
    ]
  },
  careerPathway: {
    id: 'careerPathway',
    name: 'Career Pathway Guide',
    steps: [
      {
        id: 'pathway-overview',
        title: 'Discover Your Data Career Path',
        description: 'Take assessments and get personalized recommendations for your ideal data science career trajectory.',
        target: '[data-tour="pathway-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'implementation-tools',
        title: 'Turn Insights into Action',
        description: 'Use your pathway insights to guide resume optimization, skill building through courses, and career planning with our AI agent.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  }
};
