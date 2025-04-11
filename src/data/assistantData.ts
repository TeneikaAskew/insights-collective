import { Code, GraduationCap, Search, BarChart4, FileText, Briefcase, Presentation, ListChecks, LayoutDashboard, Rocket, HelpCircle, User2, BrainCircuit, BookOpenCheck, BadgeCheck, LucideIcon } from "lucide-react";
import { Assistant } from "@/types/assistants";

// Define type for icon property
interface IconDefinition {
  component: LucideIcon;
  props?: any;
}

// Career Explorer Assistant
export const careerExplorerAssistant: Assistant = {
  id: "career-explorer",
  name: "Career Explorer",
  description: "Explore career options based on your skills and interests.",
  category: "career",
  icon: {
    component: Search,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a career coach. Help users explore career options based on their skills and interests."
};

// Coding Tutor Assistant
export const codingTutorAssistant: Assistant = {
  id: "coding-tutor",
  name: "Coding Tutor",
  description: "Get help with coding problems and learn new programming concepts.",
  category: "coding",
  icon: {
    component: Code,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a coding tutor. Help users with coding problems and explain programming concepts."
};

// Data Analyst Assistant
export const dataAnalystAssistant: Assistant = {
  id: "data-analyst",
  name: "Data Analyst",
  description: "Analyze data and generate insights from datasets.",
  category: "analytics",
  icon: {
    component: BarChart4,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a data analyst. Help users analyze data and generate insights from datasets."
};

// Resume Writer Assistant
export const resumeWriterAssistant: Assistant = {
  id: "resume-writer",
  name: "Resume Writer",
  description: "Craft a professional resume that highlights your skills and experience.",
  category: "career",
  icon: {
    component: FileText,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a resume writer. Help users craft a professional resume that highlights their skills and experience."
};

// Interview Prep Assistant
export const interviewPrepAssistant: Assistant = {
  id: "interview-prep",
  name: "Interview Prep",
  description: "Prepare for job interviews with practice questions and tips.",
  category: "career",
  icon: {
    component: Briefcase,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are an interview coach. Help users prepare for job interviews with practice questions and tips."
};

// Presentation Coach Assistant
export const presentationCoachAssistant: Assistant = {
  id: "presentation-coach",
  name: "Presentation Coach",
  description: "Improve your presentation skills with feedback and guidance.",
  category: "career",
  icon: {
    component: Presentation,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a presentation coach. Help users improve their presentation skills with feedback and guidance."
};

// Task Manager Assistant
export const taskManagerAssistant: Assistant = {
  id: "task-manager",
  name: "Task Manager",
  description: "Organize your tasks and manage your time effectively.",
  category: "career",
  icon: {
    component: ListChecks,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a task manager. Help users organize their tasks and manage their time effectively."
};

// Project Dashboard Assistant
export const projectDashboardAssistant: Assistant = {
  id: "project-dashboard",
  name: "Project Dashboard",
  description: "Track your project progress and monitor key metrics.",
  category: "analytics",
  icon: {
    component: LayoutDashboard,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a project dashboard. Help users track their project progress and monitor key metrics."
};

// Startup Idea Generator Assistant
export const startupIdeaGeneratorAssistant: Assistant = {
  id: "startup-idea-generator",
  name: "Startup Idea Generator",
  description: "Generate innovative startup ideas based on market trends.",
  category: "career",
  icon: {
    component: Rocket,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a startup idea generator. Help users generate innovative startup ideas based on market trends."
};

// FAQ Assistant
export const faqAssistant: Assistant = {
  id: "faq-assistant",
  name: "FAQ Assistant",
  description: "Answer frequently asked questions and provide helpful information.",
  category: "content",
  icon: {
    component: HelpCircle,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are an FAQ assistant. Answer frequently asked questions and provide helpful information."
};

// Personal Profile Assistant
export const personalProfileAssistant: Assistant = {
  id: "personal-profile",
  name: "Personal Profile",
  description: "Create a professional personal profile to showcase your skills and experience.",
  category: "career",
  icon: {
    component: User2,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a personal profile assistant. Help users create a professional personal profile to showcase their skills and experience."
};

// AI Learning Assistant
export const aiLearningAssistant: Assistant = {
  id: "ai-learning",
  name: "AI Learning",
  description: "Learn about artificial intelligence and its applications.",
  category: "coding",
  icon: {
    component: BrainCircuit,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are an AI learning assistant. Help users learn about artificial intelligence and its applications."
};

// Book Summarizer Assistant
export const bookSummarizerAssistant: Assistant = {
  id: "book-summarizer",
  name: "Book Summarizer",
  description: "Summarize books and extract key insights.",
  category: "content",
  icon: {
    component: BookOpenCheck,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a book summarizer. Help users summarize books and extract key insights."
};

// Skill Assessor Assistant
export const skillAssessorAssistant: Assistant = {
  id: "skill-assessor",
  name: "Skill Assessor",
  description: "Assess your skills and identify areas for improvement.",
  category: "career",
  icon: {
    component: BadgeCheck,
    props: {
      className: "h-4 w-4"
    }
  },
  instructions: "You are a skill assessor. Help users assess their skills and identify areas for improvement."
};

export const allAssistants: Assistant[] = [
  codingTutorAssistant,
  dataAnalystAssistant,
  resumeWriterAssistant,
  interviewPrepAssistant,
  presentationCoachAssistant,
  taskManagerAssistant,
  projectDashboardAssistant,
  startupIdeaGeneratorAssistant,
  faqAssistant,
  personalProfileAssistant,
  aiLearningAssistant,
  bookSummarizerAssistant,
  skillAssessorAssistant,
];
