
export interface ResumeAnalysis {
  resume_id?: string;
  letter_grade: string;
  resume_percent: number;
  elevator_pitch?: string;
  themes?: string[];
  explanation?: string;
  bullets?: BulletPointAnalysis[];
  career_alignment?: number;
  target_role?: string;
  ai_ml_keywords_count?: number;
  analytics_keywords_count?: number;
  data_engineering_keywords_count?: number;
  bi_keywords_count?: number;
}

export interface BulletPointAnalysis {
  original: string;
  improved_bullet?: string;
  bullet_impact?: number;
  bullet_clarity?: number;
  bullet_relevance?: number;
  bullet_total?: number;
  explanation?: string;
  tips?: string;
}

export interface AssistantMessage {
  id: string;
  content: string;
  sender_type: 'user' | 'assistant';
  created_at: string;
}

export interface AssistantConversation {
  id: string;
  session_id?: string;
  user_id?: string;
  quiz_attempt_id?: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  messages?: AssistantMessage[];
}
