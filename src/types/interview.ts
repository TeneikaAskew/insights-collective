
export interface JobDescription {
  id: string;
  user_id: string;
  source_type: 'manual' | 'url';
  source_url?: string;
  raw_text: string;
  parsed_fields: JobDescriptionParsedFields;
  created_at: string;
}

export interface JobDescriptionParsedFields {
  title?: string;
  responsibilities?: string[];
  required_qualifications?: string[];
  preferred_qualifications?: string[];
  technical_keywords?: string[];
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

export interface Competency {
  id: string;
  name: string;
  description: string;
}

export interface BehavioralQuestion {
  id: string;
  question: string;
  competency_id: string;
  sample_answer?: STARResponse;
}

export interface STARResponse {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface TechnicalChecklistItem {
  id: string;
  name: string;
  category: string;
  is_reviewed?: boolean;
  priority: 'high' | 'medium' | 'low';
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

export interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

export interface CodeAttempt {
  id: string;
  user_id: string;
  challenge_id: string;
  code: string;
  language: string;
  duration?: number;
  passed_tests: boolean;
  ai_review?: AIReview;
  created_at: string;
}

export interface AIReview {
  score: number;
  feedback: string;
  suggestions: string[];
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
    [key: string]: number;
  };
  notes?: string;
  created_at: string;
}
