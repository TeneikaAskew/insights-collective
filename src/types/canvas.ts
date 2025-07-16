// Canvas-style course management types

export type ContentItemType = 'page' | 'assignment' | 'quiz' | 'discussion' | 'external_url' | 'external_tool';

export interface ContentItem {
  id: string;
  course_id: string;
  module_id: string | null;
  type: ContentItemType;
  title: string;
  content: string | null; // Rich HTML content from WYSIWYG editor
  position: number;
  published: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  
  // Relations
  assignment?: Assignment;
  quiz?: Quiz;
}

export interface Assignment {
  id: string;
  content_item_id: string;
  points_possible: number | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  submission_types: string[];
  allowed_attempts: number;
  peer_reviews: boolean;
  anonymous_peer_reviews: boolean;
  grading_type: 'points' | 'percent' | 'letter_grade' | 'pass_fail';
  grading_standard_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  content_item_id: string;
  quiz_type: 'assignment' | 'practice' | 'survey';
  points_possible: number | null;
  time_limit: number | null; // in minutes
  allowed_attempts: number;
  shuffle_answers: boolean;
  shuffle_questions: boolean;
  require_lockdown_browser: boolean;
  require_lockdown_browser_for_results: boolean;
  one_question_at_a_time: boolean;
  cant_go_back: boolean;
  show_correct_answers: boolean;
  show_correct_answers_last_attempt: boolean;
  show_correct_answers_at: string | null;
  hide_correct_answers_at: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching' | 'multiple_answers';
  question_text: string; // Rich HTML content
  points: number;
  position: number;
  answers: QuizAnswer[];
  correct_comments: string | null; // Rich HTML feedback
  incorrect_comments: string | null;
  neutral_comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizAnswer {
  id: string;
  text: string; // Can be rich HTML
  correct: boolean;
  weight?: number; // For partial credit
  feedback?: string; // Answer-specific feedback
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  submitted_at: string | null;
  submission_type: string | null;
  body: string | null; // Rich HTML content
  url: string | null;
  grade: number | null;
  score: number | null;
  excused: boolean;
  late: boolean;
  missing: boolean;
  workflow_state: 'unsubmitted' | 'submitted' | 'graded';
  attempt: number;
  created_at: string;
  updated_at: string;
  
  // Relations
  attachments?: SubmissionAttachment[];
}

export interface SubmissionAttachment {
  id: string;
  submission_id: string;
  filename: string;
  content_type: string | null;
  size: number | null;
  url: string;
  created_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  week: number;
  position: number;
  requirements: ModuleRequirement[];
  completion_requirements: CompletionRequirement[];
  prerequisite_module_ids: string[];
  publish_final_grade: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
  
  // Relations
  content_items?: ContentItem[];
}

export interface ModuleRequirement {
  type: 'view' | 'submit' | 'contribute' | 'min_score';
  min_score?: number;
  completed: boolean;
}

export interface CompletionRequirement {
  content_item_id: string;
  type: 'must_view' | 'must_submit' | 'must_contribute' | 'min_score';
  min_score?: number;
}

export interface ModuleProgression {
  id: string;
  user_id: string;
  module_id: string;
  workflow_state: 'locked' | 'started' | 'completed';
  current_position: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentItemProgression {
  id: string;
  user_id: string;
  content_item_id: string;
  workflow_state: 'unread' | 'read' | 'completed';
  created_at: string;
  updated_at: string;
}

// Helper type for creating content
export interface CreateContentItemInput {
  course_id: string;
  module_id: string;
  type: ContentItemType;
  title: string;
  content: string;
  settings?: Record<string, any>;
}

// Helper type for creating assignments
export interface CreateAssignmentInput extends CreateContentItemInput {
  type: 'assignment';
  points_possible?: number;
  due_at?: Date;
  submission_types?: string[];
  allowed_attempts?: number;
}

// Helper type for creating quizzes
export interface CreateQuizInput extends CreateContentItemInput {
  type: 'quiz';
  quiz_type?: 'assignment' | 'practice' | 'survey';
  time_limit?: number;
  questions?: Omit<QuizQuestion, 'id' | 'quiz_id' | 'created_at' | 'updated_at'>[];
}