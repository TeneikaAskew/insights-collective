
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
  thumbnail?: string;
  enrollmentStatus: string;
  duration: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  
  // Adding missing properties used across the application
  instructor?: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  enrollmentCount?: number;
  modules?: Module[];
}

// User interface
export interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  enrolledCourses?: string[];
  avatar?: string;
  bio?: string;
  createdCourses?: string[];
  // Add any other properties needed
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
  submission?: {
    content?: string;
    grade?: number;
    feedback?: string;
  };
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
  dueDate?: string;
  status?: string;
  score?: number;
  // Add any other properties needed
}

// QuizQuestion interface
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  points?: number;
  // Add any other properties needed
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
  // Add any other properties needed
}

export interface CourseInstructor {
  userId: string;
  courseId: string;
  role: string;
  profile?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string;
  };
}

// Add any other interfaces needed by the application
