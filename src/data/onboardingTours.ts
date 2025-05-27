
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlight?: boolean;
}

export interface OnboardingTour {
  id: string;
  name: string;
  description: string;
  steps: OnboardingStep[];
}

export const onboardingTours: Record<string, OnboardingTour> = {
  home: {
    id: 'home',
    name: 'Welcome to Insights Collective',
    description: 'Let\'s get you started on your data career journey',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Your Data Career Platform! 🚀',
        description: 'We help data professionals and career changers navigate their path to success. Let\'s take a quick tour of the key features.',
        position: 'bottom'
      },
      {
        id: 'navigation',
        title: 'Easy Navigation',
        description: 'Use the sidebar to access all our career tools. Click the menu icon to expand or collapse it.',
        target: '[data-testid="sidebar-trigger"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'career-assessment',
        title: 'Start with Career Assessment',
        description: 'Take our AI-powered quiz to get personalized career recommendations based on your skills and goals.',
        target: '[href="/career-agent"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'resume-analyzer',
        title: 'Optimize Your Resume',
        description: 'Upload your resume for AI-powered analysis and improvement suggestions.',
        target: '[href="/resume-analyzer"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'portfolio',
        title: 'Showcase Your Work',
        description: 'Create and manage your data portfolio to impress potential employers.',
        target: '[href="/portfolio-explorer"]',
        position: 'top',
        highlight: true
      }
    ]
  },

  careerAgent: {
    id: 'career-agent',
    name: 'Career Assessment Guide',
    description: 'Learn how to use our AI career advisor',
    steps: [
      {
        id: 'chat-interface',
        title: 'AI Career Conversation',
        description: 'This is your personal AI career advisor. Answer questions honestly to get the best recommendations.',
        target: '[data-component="chat-interface"]',
        position: 'top'
      },
      {
        id: 'message-input',
        title: 'Share Your Goals',
        description: 'Type your responses here. Be specific about your experience, skills, and career aspirations.',
        target: '[data-component="message-input"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'conversation-flow',
        title: 'Guided Assessment',
        description: 'The AI will ask about your background, skills, interests, and goals. This usually takes 5-10 minutes.',
        position: 'bottom'
      }
    ]
  },

  careerPathway: {
    id: 'career-pathway',
    name: 'Understanding Your Career Report',
    description: 'Learn how to interpret your personalized career insights',
    steps: [
      {
        id: 'overview-tab',
        title: 'Your Career Summary',
        description: 'Start here for a high-level overview of your career recommendations and key insights.',
        target: '[data-state="active"][value="overview"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'skills-tab',
        title: 'Skills Development',
        description: 'See which skills to develop next, with specific course recommendations.',
        target: '[value="skills"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'roles-tab',
        title: 'Matching Roles',
        description: 'Explore data roles that match your profile and interests.',
        target: '[value="roles"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'pathway-tab',
        title: 'Your Career Path',
        description: 'Follow a step-by-step plan to reach your aspirational role.',
        target: '[value="pathway"]',
        position: 'bottom',
        highlight: true
      }
    ]
  },

  resumeAnalyzer: {
    id: 'resume-analyzer',
    name: 'Resume Optimization Guide',
    description: 'Learn how to improve your resume with AI analysis',
    steps: [
      {
        id: 'upload-area',
        title: 'Upload Your Resume',
        description: 'Drag and drop your resume (PDF format) or click to browse. We support various resume formats.',
        target: '[data-component="file-upload"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'analysis-process',
        title: 'AI Analysis Process',
        description: 'Our AI will analyze your resume for content, formatting, ATS compatibility, and industry alignment.',
        position: 'bottom'
      },
      {
        id: 'improvement-tips',
        title: 'Actionable Improvements',
        description: 'Get specific suggestions for keywords, formatting, and content to make your resume stand out.',
        position: 'bottom'
      }
    ]
  },

  portfolioExplorer: {
    id: 'portfolio-explorer',
    name: 'Portfolio Creation Guide',
    description: 'Build an impressive data portfolio',
    steps: [
      {
        id: 'portfolio-overview',
        title: 'Showcase Your Data Projects',
        description: 'A strong portfolio demonstrates your skills better than any resume. Let\'s build yours!',
        position: 'bottom'
      },
      {
        id: 'project-creation',
        title: 'Add Your Projects',
        description: 'Click here to add data analysis, visualization, or machine learning projects.',
        target: '[data-component="add-project"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'project-templates',
        title: 'Use Our Templates',
        description: 'Choose from data science, analytics, or visualization templates to structure your projects professionally.',
        position: 'bottom'
      }
    ]
  },

  resources: {
    id: 'resources',
    name: 'Learning Resources Guide',
    description: 'Discover valuable learning materials and opportunities',
    steps: [
      {
        id: 'resource-tabs',
        title: 'Explore Different Content Types',
        description: 'Browse curated resources, top tweets from data professionals, and LinkedIn updates.',
        target: '[role="tablist"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'search-filters',
        title: 'Find Relevant Content',
        description: 'Use search and filters to find resources specific to your career goals and skill level.',
        target: '[data-component="search-filters"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'save-resources',
        title: 'Save for Later',
        description: 'Bookmark valuable resources to build your personal learning library.',
        position: 'bottom'
      }
    ]
  }
};
