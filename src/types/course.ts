
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  duration?: string;
  tags?: string[];
  thumbnail?: string;
  image_url?: string;
  imageUrl?: string;
  enrollment_status: 'open' | 'closed' | 'waitlist';
  enrollmentStatus?: 'open' | 'closed' | 'waitlist';
  published: boolean;
  status: 'draft' | 'published' | 'archived';
  instructor_id?: string;
  instructor?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  enrollment_count?: number;
  enrollmentCount?: number;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseFormData {
  title: string;
  description: string;
  category: string;
  level: string;
  duration?: string;
  tags?: string[];
  image_url?: string;
  enrollment_status?: 'open' | 'closed' | 'waitlist';
  published?: boolean;
  status?: 'draft' | 'published' | 'archived';
  instructor_id?: string;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completion_status: number;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface CourseInstructor {
  id: string;
  course_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface CourseStats {
  enrollment_count: number;
  completion_rate: number;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  week: number;
  created_at: string;
  updated_at: string;
}

// Canvas-style course types
export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_type: 'file_upload' | 'text_entry' | 'url' | 'media_recording';
  submission_data: {
    text?: string;
    url?: string;
    file_urls?: string[];
    media_url?: string;
  };
  submitted_at?: string;
  grade?: number;
  graded_at?: string;
  graded_by?: string;
  feedback?: string;
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  attempt_number: number;
  created_at: string;
  updated_at: string;
}

export interface Grade {
  id: string;
  course_id: string;
  student_id: string;
  assignment_id?: string;
  quiz_id?: string;
  grade_type: 'assignment' | 'quiz' | 'participation' | 'final' | 'midterm' | 'other';
  points_earned?: number;
  points_possible?: number;
  percentage?: number;
  letter_grade?: string;
  weight: number;
  comments?: string;
  graded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Rubric {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  criteria?: RubricCriteria[];
}

export interface RubricCriteria {
  id: string;
  rubric_id: string;
  title: string;
  description?: string;
  points: number;
  order_index: number;
  levels: RubricLevel[];
  created_at: string;
}

export interface RubricLevel {
  title: string;
  description: string;
  points: number;
}

export interface CourseAnnouncement {
  id: string;
  course_id: string;
  title: string;
  content: string;
  author_id: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string;
    avatar_url?: string;
  };
}

export interface ModulePrerequisite {
  id: string;
  module_id: string;
  prerequisite_module_id?: string;
  prerequisite_type: 'complete_module' | 'minimum_score' | 'submit_assignment' | 'view_content';
  requirement_data?: {
    minimum_score?: number;
    assignment_id?: string;
    content_id?: string;
  };
  created_at: string;
}

export interface LessonCompletionRequirement {
  id: string;
  lesson_id: string;
  requirement_type: 'view' | 'participate' | 'submit' | 'minimum_score' | 'mark_done';
  requirement_data?: {
    minimum_score?: number;
    minimum_time_seconds?: number;
  };
  created_at: string;
}

export interface LessonCompletion {
  id: string;
  lesson_id: string;
  student_id: string;
  completed_at: string;
  completion_method?: 'manual' | 'automatic' | 'requirement_met';
}

export interface EnhancedAssignment {
  id: string;
  course_id: string;
  module_id?: string;
  title: string;
  description?: string;
  content?: string;
  instructions?: string;
  points?: number;
  due_date?: string;
  submission_types: string[];
  allowed_file_extensions?: string[];
  max_attempts: number;
  late_policy?: {
    deduction_per_day?: number;
    maximum_deduction?: number;
    grace_period_hours?: number;
  };
  peer_review_enabled: boolean;
  peer_review_due_date?: string;
  anonymous_grading: boolean;
  grading_type: 'points' | 'percentage' | 'complete_incomplete' | 'letter_grade' | 'gpa_scale' | 'not_graded';
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnhancedModule {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  order_index: number;
  unlock_at?: string;
  prerequisites_met: boolean;
  completion_requirements: Array<{
    type: 'view_all' | 'complete_all' | 'submit_all' | 'minimum_score';
    details?: any;
  }>;
  created_at: string;
  updated_at: string;
}

export interface EnhancedLesson {
  id: string;
  module_id: string;
  title: string;
  type: string;
  content: any;
  order_index: number;
  estimated_time_minutes?: number;
  is_locked: boolean;
  unlock_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EnhancedCourse {
  id: string;
  title: string;
  description?: string;
  category?: string;
  level?: string;
  duration?: string;
  instructor_id: string;
  is_published: boolean;
  grading_scheme?: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  late_policy?: {
    deduction_per_day?: number;
    maximum_deduction?: number;
    grace_period_hours?: number;
  };
  time_zone: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleProgress {
  total_lessons: number;
  completed_lessons: number;
  total_assignments: number;
  completed_assignments: number;
  total_quizzes: number;
  completed_quizzes: number;
  progress_percentage: number;
}

export interface CourseCalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  type: 'assignment' | 'quiz' | 'event' | 'announcement';
  course_id: string;
  course_title: string;
  course_color?: string;
  related_id?: string; // assignment_id, quiz_id, etc.
  location?: string;
  all_day?: boolean;
}
