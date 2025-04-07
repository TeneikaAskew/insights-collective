
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
  instructor: User;
  thumbnail?: string;
  enrollmentCount: number;
  modules: Module[];
  tags: string[];
  duration: string;
  enrollmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  enrolledCourses?: string[];
  avatar?: string;
  bio?: string;
  // Add any other properties needed
}

// Module interface
export interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  completionStatus: number;
  lessons: Lesson[];
  assignments: Assignment[];
  quizzes: Quiz[];
  // Add any other properties needed
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
  // Add any other properties needed
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
  // Add any other properties needed
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
  // Add any other properties needed
}

// QuizQuestion interface
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  // Add any other properties needed
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  // Add any other properties needed
}

// Add any other interfaces needed by the application
