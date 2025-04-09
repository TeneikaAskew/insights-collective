
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
  xyz_scores: {
    hard_soft: number;
    action_words: number;
    measurable_results: number;
    clarity_focus: number;
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
}
