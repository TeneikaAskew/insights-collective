import {
  BarChart2,
  BookOpen,
  BrainCircuit,
  Code,
  FileText,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { Assistant } from "@/types/assistants";

export const careerExplorerAssistant: Assistant = {
  id: 'career-explorer',
  name: 'Career Explorer',
  description: 'Discover ideal data career paths based on your skills and interests.',
  icon: {
    component: BarChart2,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'career'
};

export const careerCoachAssistant: Assistant = {
  id: 'career-coach',
  name: 'Career Coach',
  description: 'Personalized guidance based on your career quiz results.',
  icon: {
    component: MessageSquare,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'career'
};

export const courseSuggestorAssistant: Assistant = {
  id: 'course-suggestor',
  name: 'Course Suggestor',
  description: 'Find the right courses for your learning journey.',
  icon: {
    component: BookOpen,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'coding'
};

export const resumeAnalyzerAssistant: Assistant = {
  id: 'resume-analyzer',
  name: 'Resume Analyzer',
  description: 'Get feedback and improvements for your resume.',
  icon: {
    component: FileText,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'career'
};

export const dataAnalystAssistant: Assistant = {
  id: 'data-analyst',
  name: 'Data Analyst',
  description: 'Help with data analysis, visualization, and interpretation.',
  icon: {
    component: BarChart2,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'analytics'
};

export const contentCreatorAssistant: Assistant = {
  id: 'content-creator',
  name: 'Content Creator',
  description: 'Generate high-quality content for blogs and social media.',
  icon: {
    component: Lightbulb,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'content'
};

export const codingAssistant: Assistant = {
  id: 'coding-helper',
  name: 'Coding Helper',
  description: 'Get help with coding problems and learn programming concepts.',
  icon: {
    component: Code,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'coding'
};

export const aiExpertAssistant: Assistant = {
  id: 'ai-expert',
  name: 'AI Expert',
  description: 'Learn about machine learning, neural networks, and AI applications.',
  icon: {
    component: BrainCircuit,
    props: {
      className: "h-4 w-4"
    }
  },
  category: 'analytics'
};

export const allAssistants: Assistant[] = [
  careerCoachAssistant,
  courseSuggestorAssistant,
  resumeAnalyzerAssistant,
  dataAnalystAssistant,
  contentCreatorAssistant,
  codingAssistant,
  aiExpertAssistant
];
