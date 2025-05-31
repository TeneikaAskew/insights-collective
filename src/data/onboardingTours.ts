
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
    name: 'Navigation Overview',
    steps: [
      {
        id: 'sidebar-overview',
        title: 'Your Navigation Hub',
        description: 'The sidebar contains all the tools and resources you need for your data career journey. Let\'s explore each section.',
        target: '[data-tour-group="navigation"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'career-tools',
        title: 'Core Career Tools',
        description: 'Essential tools for job search success: Resume Analyzer for optimizing your resume, Interview Prep for practice sessions, and Career Agent for personalized guidance.',
        target: '[data-tour-group="career-tools"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'learning-resources',
        title: 'Learning & Development',
        description: 'Build your skills with Courses, Resources library, Data Blueprint for career planning, and Portfolio Explorer to showcase your work.',
        target: '[data-tour-group="learning"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'community-features',
        title: 'Community & Networking',
        description: 'Connect with peers through Forums, attend Events, and stay updated with Messages and Blog posts.',
        target: '[data-tour-group="community"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'personal-management',
        title: 'Personal Management',
        description: 'Manage your account with Profile settings, Calendar for scheduling, and Notifications to stay informed.',
        target: '[data-tour-group="personal"]',
        position: 'right',
        highlight: true
      }
    ]
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard Tour',
    steps: [
      {
        id: 'dashboard-welcome',
        title: 'Welcome to Your Dashboard',
        description: 'Your personal command center for tracking progress and accessing all platform features. The sidebar shows your navigation options.',
        target: '[data-tour="dashboard-overview"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'navigation-context',
        title: 'Quick Navigation',
        description: 'Use the sidebar to access career tools like Resume Analyzer and Interview Prep, or learning resources like Courses and Portfolio Explorer.',
        target: '[data-tour-group="career-tools"]',
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
    name: 'Resume Analyzer Tour',
    steps: [
      {
        id: 'resume-overview',
        title: 'AI-Powered Resume Analysis',
        description: 'Upload your resume to get instant feedback on optimization, keyword matching, and ATS compatibility for data roles.',
        target: '[data-tour="resume-upload"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'resume-career-journey',
        title: 'Part of Your Career Journey',
        description: 'After optimizing your resume here, use Interview Prep to practice for roles, and Career Agent for personalized guidance.',
        target: '[data-tour-group="career-tools"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'resume-analysis',
        title: 'Detailed Analysis',
        description: 'Get comprehensive feedback on content, formatting, keywords, and suggestions for improvement.',
        target: '[data-tour="analysis-results"]',
        position: 'top',
        highlight: true
      }
    ]
  },
  'interview-prep': {
    id: 'interview-prep',
    name: 'Interview Preparation Tour',
    steps: [
      {
        id: 'interview-overview',
        title: 'Master Your Interviews',
        description: 'Practice coding challenges, behavioral questions, and mock interviews specifically designed for data roles.',
        target: '[data-tour="prep-options"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'prep-workflow',
        title: 'Your Preparation Workflow',
        description: 'Start with Resume Analyzer to optimize your application, then use these tools to prepare for interviews, and Portfolio Explorer to showcase projects.',
        target: '[data-tour-group="career-tools"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'practice-tools',
        title: 'Practice Tools',
        description: 'Code practice for technical interviews, STAR method for behavioral questions, and job description analysis.',
        target: '[data-tour="practice-sections"]',
        position: 'top',
        highlight: true
      }
    ]
  },
  'career-agent': {
    id: 'career-agent',
    name: 'Career Agent Tour',
    steps: [
      {
        id: 'agent-overview',
        title: 'Your AI Career Advisor',
        description: 'Get personalized career guidance, skill recommendations, and strategic advice for your data career path.',
        target: '[data-tour="agent-chat"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'career-development',
        title: 'Complete Career Development',
        description: 'Use Career Agent for guidance, Resume Analyzer for applications, Interview Prep for practice, and Courses for skill building.',
        target: '[data-tour-group="career-tools"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'personalized-advice',
        title: 'Personalized Guidance',
        description: 'Ask questions about career transitions, skill gaps, salary negotiations, or industry trends.',
        target: '[data-tour="advice-examples"]',
        position: 'top',
        highlight: true
      }
    ]
  },
  'portfolio-explorer': {
    id: 'portfolio-explorer',
    name: 'Portfolio Explorer Tour',
    steps: [
      {
        id: 'portfolio-overview',
        title: 'Showcase Your Data Projects',
        description: 'Create, plan, and track portfolio projects that demonstrate your data skills to potential employers.',
        target: '[data-tour="portfolio-intro"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'professional-branding',
        title: 'Professional Branding',
        description: 'Build projects here, optimize your resume in Resume Analyzer, and prepare to discuss them in Interview Prep.',
        target: '[data-tour-group="career-tools"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'project-management',
        title: 'Project Management',
        description: 'Track projects from idea to completion with our integrated project management tools.',
        target: '[data-tour="project-tracker"]',
        position: 'top',
        highlight: true
      }
    ]
  },
  courses: {
    id: 'courses',
    name: 'Courses Tour',
    steps: [
      {
        id: 'courses-overview',
        title: 'Learn Data Skills',
        description: 'Access curated courses designed to build the exact skills needed for data careers, from fundamentals to advanced techniques.',
        target: '[data-tour="course-catalog"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'learning-path',
        title: 'Your Learning Journey',
        description: 'Combine courses with hands-on practice in Portfolio Explorer, get career guidance from Career Agent, and prepare for roles with Interview Prep.',
        target: '[data-tour-group="learning"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'skill-development',
        title: 'Skill Development',
        description: 'Learn at your own pace with video lessons, hands-on projects, and progress tracking.',
        target: '[data-tour="learning-features"]',
        position: 'top',
        highlight: true
      }
    ]
  }
};
