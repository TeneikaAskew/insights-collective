
export type Message = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: Date;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  assistantId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface PersonalizationSettings {
  careerFocus: string;
  careerPath: string;
  salaryCap: number;
}

export interface BulletAnalysis {
  original: string;
  word_balance: {
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
  word_balance_score: number;
  // Updated xyz_scores to match usage in UI components
  xyz_scores: {
    action: number;
    metrics: number;
    clarity: number;
    industry: number;
    achievement: number;
  };
  bullet_total: number;
  rewritten: string;
  tips: string;
}

export interface ResumeAnalysis {
  bullets: BulletAnalysis[];
  resume_average: number;
  resume_percent: number;
  letter_grade: string;
  themes: string[];
  elevator_pitch: string;
  explanation: string;
  resume_id?: string;
  
  // Adding the missing keyword count properties
  ai_ml_keywords_count?: number;
  analytics_keywords_count?: number;
  data_engineering_keywords_count?: number;
  bi_keywords_count?: number;
}
