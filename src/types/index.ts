export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  avatar?: string;
  bio?: string;
  enrolledCourses?: string[];
  createdCourses?: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: User;
  thumbnail: string;
  enrollmentCount: number;
  rating: number;
  modules: Module[];
  category: string;
  tags: string[];
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  enrollmentStatus: 'Open' | 'Closed' | 'In Progress';
  createdAt: string;
  updatedAt: string;
  prerequisites?: string[];
  objectives?: string[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  lessons: Lesson[];
  assignments: Assignment[];
  quizzes: Quiz[];
  completionStatus: number; // Percentage complete
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  videoUrl?: string;
  duration: string;
  isCompleted: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  points: number;
  status: 'Not Started' | 'In Progress' | 'Submitted' | 'Graded';
  submission?: AssignmentSubmission;
}

export interface AssignmentSubmission {
  id: string;
  userId: string;
  assignmentId: string;
  content: string;
  attachmentUrls?: string[];
  submittedAt: string;
  grade?: number;
  feedback?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  timeLimit?: number; // in minutes
  dueDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  score?: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'assignment' | 'quiz' | 'announcement' | 'feedback';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  issueDate: string;
  certificateUrl: string;
}
