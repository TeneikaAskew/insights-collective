
import { Brain, BookOpen, Code, Compass, Cpu, PieChart, Text, Video } from "lucide-react";
import { Assistant } from "@/types/assistants";

// Career Explorer Assistant definition (featured)
export const careerExplorerAssistant: Assistant = {
  id: "0",
  name: "Career Discovery GPT",
  icon: <Compass className="h-5 w-5" />,
  description: "Your personalized career guide in data science and analytics. This assistant analyzes your quiz results, skills, interests, and values to recommend ideal career paths. It acts as your career coach, providing insights into aligned roles and learning paths.",
  category: "career",
  popular: true,
};

export const allAssistants: Assistant[] = [
  {
    id: "1",
    name: "Data Analyst",
    icon: <PieChart className="h-5 w-5" />,
    description: "Get help with data analysis, visualization, and interpretation.",
    category: "analytics",
    popular: true,
  },
  {
    id: "2",
    name: "Code Companion",
    icon: <Code className="h-5 w-5" />,
    description: "Assistance with coding problems, debugging and optimization.",
    category: "coding",
    popular: true,
  },
  {
    id: "3",
    name: "Study Guide Creator",
    icon: <BookOpen className="h-5 w-5" />,
    description: "Generate personalized study guides based on your learning goals.",
    category: "content",
  },
  {
    id: "4",
    name: "Algorithm Tutor",
    icon: <Brain className="h-5 w-5" />,
    description: "Learn algorithms and data structures with step-by-step explanations.",
    category: "coding",
  },
  {
    id: "5",
    name: "Data Visualization Expert",
    icon: <PieChart className="h-5 w-5" />,
    description: "Turn your data into compelling visualizations with expert guidance.",
    category: "analytics",
  },
  {
    id: "6",
    name: "Content Summarizer",
    icon: <Text className="h-5 w-5" />,
    description: "Summarize articles, papers, and learning materials for quick review.",
    category: "content",
  },
  {
    id: "7",
    name: "Machine Learning Guide",
    icon: <Cpu className="h-5 w-5" />,
    description: "Guidance on building and optimizing machine learning models.",
    category: "analytics",
  },
  {
    id: "8",
    name: "Video Tutorial Finder",
    icon: <Video className="h-5 w-5" />,
    description: "Discover the best video tutorials for any data science topic.",
    category: "content",
  },
  {
    id: "9",
    name: "Python Helper",
    icon: <Code className="h-5 w-5" />,
    description: "Get help with Python programming for data science applications.",
    category: "coding",
  },
];
