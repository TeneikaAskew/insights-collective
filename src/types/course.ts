
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

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
  difficulty_level?: CourseDifficulty;
  difficultyLevel?: CourseDifficulty;
  estimated_hours?: number;
  estimatedHours?: number;
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
  difficulty_level?: CourseDifficulty;
  estimated_hours?: number;
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
  difficulty_level?: CourseDifficulty;
  estimated_hours?: number;
  module_count?: number;
  assignment_count?: number;
  lesson_count?: number;
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
  user_id: string;
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
  difficulty_level?: CourseDifficulty;
  estimated_hours?: number;
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

export interface ZoomRecurrence {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  repeat_interval?: number;
  end_date?: string;
  end_times?: number;
  weekly_days?: number[];
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
  // The id the destination route expects. For assignments that is the
  // assignment id; for quizzes it is the CONTENT ITEM id, not the quiz id —
  // CanvasQuizTaking loads by content item (getContentItem/getQuiz both take
  // contentItemId), so the quiz id routes nowhere.
  related_id?: string;
  // Assignment and quiz pages live under a module. Without this the only URL
  // that can be built is one that matches no route.
  module_id?: string;
  location?: string;
  all_day?: boolean;
  link?: string;
  zoom_meeting_id?: number;
  zoom_start_url?: string;
  zoom_recurrence?: ZoomRecurrence;
}

// Question Bank Types
export interface QuestionBank {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  created_by: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  categories?: QuestionBankCategory[];
  question_count?: number;
}

export interface QuestionBankQuestion {
  id: string;
  bank_id: string;
  question_type: QuestionType;
  question_text: string;
  rich_content?: any;
  points: number;
  difficulty_level?: 'easy' | 'medium' | 'hard';
  topic_tags?: string[];
  options?: any;
  correct_answer?: any;
  explanation?: string;
  feedback?: any;
  usage_count: number;
  success_rate?: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface QuestionBankCategory {
  id: string;
  bank_id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  children?: QuestionBankCategory[];
  question_count?: number;
}

export interface QuizQuestionPool {
  id: string;
  quiz_id: string;
  bank_id: string;
  category_id?: string;
  number_of_questions: number;
  points_per_question: number;
  difficulty_filter?: 'easy' | 'medium' | 'hard' | 'mixed';
  topic_tags_filter?: string[];
  position: number;
  created_at: string;
}

export type QuestionType = 
  | 'multiple_choice' 
  | 'true_false' 
  | 'short_answer' 
  | 'essay'
  | 'matching'
  | 'fill_blank'
  | 'ordering'
  | 'multiple_answer'
  | 'calculated';

export interface MatchingQuestion {
  pairs: Array<{
    id: string;
    left: string;
    right: string;
  }>;
}

export interface FillBlankQuestion {
  text: string; // Text with [blank] placeholders
  blanks: Array<{
    id: string;
    answers: string[]; // Accepted answers
    caseSensitive?: boolean;
  }>;
}

export interface OrderingQuestion {
  items: Array<{
    id: string;
    text: string;
    correctOrder: number;
  }>;
}

export interface MultipleAnswerQuestion {
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  partialCredit?: boolean;
}

export interface CalculatedQuestion {
  formula: string;
  variables: Array<{
    name: string;
    min: number;
    max: number;
    decimals?: number;
  }>;
  tolerance: number;
  toleranceType: 'absolute' | 'percentage';
}
