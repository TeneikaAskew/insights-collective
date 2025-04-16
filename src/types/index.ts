
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  enrolledCourses?: string[];
  avatar?: string;
  bio?: string;
  createdCourses?: string[];
}

// Course interface with all required properties
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  students?: number;
  rating?: number;
  published?: boolean;
  imageUrl?: string;
  
  // Adding missing properties used across the application
  instructor?: User;
  thumbnail?: string;
  enrollmentCount?: number;
  modules?: Module[];
  tags?: string[];
  duration?: string;
  enrollmentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Module interface
export interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  completionStatus?: number;
  lessons?: Lesson[];
  assignments?: Assignment[];
  quizzes?: Quiz[];
}

// Lesson interface
export interface Lesson {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  order: number;
  content: string;
  duration: string;
  completed?: boolean;
}

// Assignment interface
export interface Assignment {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  dueDate: string;
  points: number;
  status?: string;
  submission?: {
    content?: string;
    grade?: number;
    feedback?: string;
  };
}

// Quiz interface
export interface Quiz {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  questions: QuizQuestion[];
  timeLimit?: number;
  passingScore?: number;
  dueDate?: string;
  status?: string;
  score?: number;
}

// QuizQuestion interface
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  points?: number;
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'assignment' | 'quiz' | 'announcement' | 'feedback' | string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}
