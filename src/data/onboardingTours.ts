
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
  
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard & Navigation Tour',
    steps: [
      {
        id: 'sidebar-overview',
        title: 'Your Navigation Hub',
        description: 'This sidebar is your gateway to all platform features. Let\'s explore what each section offers.',
        target: '[data-sidebar="sidebar"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'career-tools',
        title: 'Career Development Tools',
        description: 'Access AI-powered tools: Resume Analyzer for optimization, Interview Prep for practice, and Career Agent for personalized guidance.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'learning-resources',
        title: 'Learning & Growth',
        description: 'Enhance your skills with curated courses, explore career pathways, and access learning resources tailored to data careers.',
        target: '[data-tour="learning-resources"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'portfolio-community',
        title: 'Portfolio & Community',
        description: 'Showcase your projects with Portfolio Explorer and connect with peers through Forums and Community features.',
        target: '[data-tour="portfolio-community"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'dashboard-overview',
        title: 'Your Personal Dashboard',
        description: 'Track your progress, view enrolled courses, upcoming deadlines, and notifications all in one place.',
        target: '[data-tour="dashboard-overview"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'quick-actions',
        title: 'Quick Access Metrics',
        description: 'Click on any metric card to jump directly to that section. Start with Resume Analyzer for immediate value!',
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
        id: 'sidebar-career-tools',
        title: 'Career Tools Section',
        description: 'You\'re in the Career Tools section. This includes Resume Analyzer, Interview Prep, and Career Agent - your core career development toolkit.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'resume-analyzer-overview',
        title: 'AI-Powered Resume Analysis',
        description: 'Get comprehensive analysis of your resume with ATS scoring, keyword optimization, and personalized improvement suggestions.',
        target: '[data-tour="resume-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'upload-section',
        title: 'Upload Your Resume',
        description: 'Upload your PDF or DOCX resume file here. Our AI will extract and analyze the content automatically.',
        target: '[data-tour="resume-upload"]',
        position: 'top',
        highlight: true,
      },
      {
        id: 'analysis-tabs',
        title: 'Analysis Features',
        description: 'Once analyzed, explore Overview for general insights, Storytelling for bullet point improvements, ATS Score for applicant tracking system compatibility, and Chat for personalized advice.',
        target: '[data-tour="analysis-tabs"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'next-steps',
        title: 'Your Next Steps',
        description: 'After optimizing your resume, try Interview Prep to practice behavioral questions or visit Career Agent for personalized career guidance.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  },

  'interview-prep': {
    id: 'interview-prep',
    name: 'Interview Preparation Tour',
    steps: [
      {
        id: 'sidebar-career-tools',
        title: 'Career Tools Hub',
        description: 'Interview Prep is part of your career toolkit alongside Resume Analyzer and Career Agent for comprehensive career preparation.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'interview-overview',
        title: 'Master Your Interviews',
        description: 'Practice behavioral questions, learn the STAR method, and get personalized feedback to ace your data career interviews.',
        target: '[data-tour="interview-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'practice-options',
        title: 'Practice Options',
        description: 'Choose from behavioral questions, technical scenarios, or upload job descriptions for tailored practice sessions.',
        target: '[data-tour="practice-tabs"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'star-method',
        title: 'STAR Method Training',
        description: 'Learn and practice the Situation, Task, Action, Result framework for answering behavioral questions effectively.',
        target: '[data-tour="star-method"]',
        position: 'top',
        highlight: true,
      },
      {
        id: 'ai-feedback',
        title: 'AI-Powered Feedback',
        description: 'Get detailed scoring and suggestions on your responses to improve your interview performance.',
        target: '[data-tour="ai-feedback"]',
        position: 'top',
        highlight: true,
      }
    ]
  },

  'career-agent': {
    id: 'career-agent',
    name: 'Career Agent Tour',
    steps: [
      {
        id: 'sidebar-navigation',
        title: 'AI Career Guidance',
        description: 'Career Agent provides personalized AI guidance for your data career journey, complementing Resume Analyzer and Interview Prep.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'agent-overview',
        title: 'Your Personal Career AI',
        description: 'Get personalized advice on career transitions, skill development, and strategic career planning tailored to data roles.',
        target: '[data-tour="agent-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'chat-interface',
        title: 'Interactive Career Coaching',
        description: 'Ask questions about career paths, salary negotiations, skill gaps, or any career-related concerns.',
        target: '[data-tour="agent-chat"]',
        position: 'bottom',
        highlight: true,
      }
    ]
  },

  courses: {
    id: 'courses',
    name: 'Learning Resources Tour',
    steps: [
      {
        id: 'sidebar-learning',
        title: 'Learning & Growth Section',
        description: 'Explore Courses, Career Pathway, and Data Blueprint - your learning hub for continuous skill development.',
        target: '[data-tour="learning-resources"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'courses-overview',
        title: 'Curated Learning Content',
        description: 'Access expert-designed courses covering data analysis, machine learning, and career development topics.',
        target: '[data-tour="courses-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'course-categories',
        title: 'Learning Paths',
        description: 'Courses are organized by skill level and specialization to match your career goals and current expertise.',
        target: '[data-tour="course-filters"]',
        position: 'top',
        highlight: true,
      },
      {
        id: 'next-learning',
        title: 'Complete Your Learning Journey',
        description: 'After courses, visit Career Pathway to see how skills connect to roles, or Data Blueprint for industry insights.',
        target: '[data-tour="learning-resources"]',
        position: 'right',
        highlight: true,
      }
    ]
  },

  'career-pathway': {
    id: 'career-pathway',
    name: 'Career Pathway Tour',
    steps: [
      {
        id: 'sidebar-learning',
        title: 'Learning Resources Hub',
        description: 'Career Pathway works with Courses and Data Blueprint to provide a complete learning and career planning experience.',
        target: '[data-tour="learning-resources"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'pathway-overview',
        title: 'Your Career Roadmap',
        description: 'Discover clear paths from your current skills to your dream data career, with step-by-step guidance and skill requirements.',
        target: '[data-tour="pathway-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'skills-assessment',
        title: 'Skills Gap Analysis',
        description: 'Identify which skills you need to develop for your target role and get personalized learning recommendations.',
        target: '[data-tour="skills-assessment"]',
        position: 'top',
        highlight: true,
      }
    ]
  },

  'portfolio-explorer': {
    id: 'portfolio-explorer',
    name: 'Portfolio Explorer Tour',
    steps: [
      {
        id: 'sidebar-portfolio',
        title: 'Portfolio & Community',
        description: 'Portfolio Explorer helps you showcase your work alongside Forums for community engagement and networking.',
        target: '[data-tour="portfolio-community"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'portfolio-overview',
        title: 'Showcase Your Projects',
        description: 'Create a professional portfolio to highlight your data projects, skills, and achievements to potential employers.',
        target: '[data-tour="portfolio-main"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'project-templates',
        title: 'Portfolio Building Tools',
        description: 'Use templates and guided workflows to create compelling project presentations that stand out to hiring managers.',
        target: '[data-tour="portfolio-tools"]',
        position: 'top',
        highlight: true,
      }
    ]
  },

  navigation: {
    id: 'navigation',
    name: 'Quick Navigation Guide',
    steps: [
      {
        id: 'sidebar-structure',
        title: 'Platform Organization',
        description: 'The sidebar is organized into three main areas: Career Tools (top), Learning Resources (middle), and Portfolio & Community (bottom).',
        target: '[data-sidebar="sidebar"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'career-tools-group',
        title: 'Career Development Tools',
        description: 'Resume Analyzer, Interview Prep, and Career Agent provide AI-powered assistance for immediate career needs.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'learning-group',
        title: 'Learning & Skill Building',
        description: 'Courses, Career Pathway, and Data Blueprint help you develop skills and plan your career progression.',
        target: '[data-tour="learning-resources"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'community-group',
        title: 'Portfolio & Community',
        description: 'Portfolio Explorer, Forums, and networking features help you showcase work and connect with peers.',
        target: '[data-tour="portfolio-community"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'getting-started',
        title: 'Recommended Starting Point',
        description: 'New users should start with Resume Analyzer for immediate value, then explore Interview Prep and Career Agent.',
        target: '[data-tour="career-tools"]',
        position: 'right',
        highlight: true,
      }
    ]
  }
};
