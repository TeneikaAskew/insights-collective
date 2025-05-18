// Job Description Types
export interface JobDescription {
  id: string;
  user_id: string;
  source_type: 'manual' | 'url';
  source_url?: string;
  raw_text: string;
  parsed_fields: {
    role_title?: string;
    responsibilities?: string[];
    required_qualifications?: string[];
    preferred_qualifications?: string[];
    technical_keywords?: string[];
  };
  created_at: string;
}

// Study Guide Types
export interface Competency {
  name: string;
  description: string;
  key_indicators: string[];
}

export interface BehavioralQuestion {
  id: string;
  question: string;
  competency: string;
  sample_answer?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

export interface TechnicalChecklistItem {
  topic: string;
  subtopics: string[];
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface StudyGuide {
  id: string;
  job_description_id: string;
  user_id: string;
  competencies: Competency[];
  questions: BehavioralQuestion[];
  technical_checklist: TechnicalChecklistItem[];
  created_at: string;
}

// STAR Response Types
export interface StarResponse {
  id: string;
  question_id: string;
  user_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  ai_feedback?: {
    clarity_score: number;
    completeness_score: number;
    relevance_score: number;
    feedback: string;
    suggestions: string[];
  };
  submitted_at: string;
}

// Code Challenge Types
export interface TestCase {
  input: string;
  expected_output: string;
  is_hidden?: boolean;
}

export interface CodeChallenge {
  id: string;
  title: string;
  prompt: string;
  test_cases: TestCase[];
  topic_tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
}

export interface CodeAttempt {
  id: string;
  user_id: string;
  challenge_id: string;
  code: string;
  language: string;
  duration: number;
  passed_tests: boolean;
  ai_review?: {
    correctness_score: number;
    performance_score: number;
    clarity_score: number;
    feedback: string;
    optimization_suggestions?: string[];
  };
  created_at: string;
}

// Mock Interview Types
export interface AvailabilitySlot {
  id: string;
  user_id: string;
  weekday: number;
  time_block: 'morning' | 'afternoon' | 'evening';
  is_available: boolean;
  created_at: string;
}

export interface MockSession {
  id: string;
  user1_id: string;
  user2_id: string;
  role1: 'interviewer' | 'interviewee';
  role2: 'interviewer' | 'interviewee';
  session_time: string;
  type: 'behavioral' | 'technical';
  status: 'scheduled' | 'completed' | 'canceled';
  study_guide_id?: string;
  created_at: string;
}

export interface PeerReview {
  id: string;
  session_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rubric_scores: {
    star_completeness: number;
    communication: number;
    problem_solving: number;
    technical_depth?: number;
  };
  notes?: string;
  created_at: string;
}

// Dashboard Types
export interface UserProgress {
  total_sessions: number;
  completed_star_responses: number;
  code_challenges_attempted: number;
  pass_rate: number;
  weekly_goals_progress: {
    target: number;
    completed: number;
    type: 'sessions' | 'responses' | 'challenges';
  }[];
} 