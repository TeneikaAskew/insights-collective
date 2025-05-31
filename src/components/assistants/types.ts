
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export type Assistant = {
  id: string;
  name: string;
  icon: { 
    component: LucideIcon; 
    props: any;
  };
  description: string;
  category: "analytics" | "coding" | "content" | "career";
  popular?: boolean;
  instructions: string; // Added this property
};

export interface ResumeAnalysis {
  resume_percent?: number;
  letter_grade?: string;
  themes?: string[];
  elevator_pitch?: string;
  explanation?: string;
  bullets?: BulletAnalysis[];
  resume_id?: string;
  ai_ml_keywords_count?: number;
  analytics_keywords_count?: number;
  data_engineering_keywords_count?: number;
  bi_keywords_count?: number;
  career_alignment?: string;
}

export interface BulletAnalysis {
  original: string;
  improved_bullet?: string;
  explanation?: string;
  bullet_total?: number;
  achievement_score?: number;
  clarity_score?: number;
  impact_score?: number;
  brevity_score?: number;
  relevance_score?: number;
  
  // Adding missing properties used in the components
  rewritten?: string;
  tips?: string | string[];
  word_balance?: {
    word_balance_score: any;
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
  word_balance_score?: number;
  xyz_scores?: {
    action: number;
    metrics: number;
    clarity: number;
    industry: number;
    achievement: number;
  };
  // Add improved fields for enhanced analysis
  improved_xyz_scores?: {
    action: number;
    metrics: number;
    clarity: number;
    industry: number;
    achievement: number;
  };
  improved_word_balance?: {
    word_balance_score: any;
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
  improved_bullet_total?: number;
}

export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: Array<{
    title: string;
    description: string;
    salaryRange: string;
    matchPercentage: number;
    focusAreas?: string[];
    responsibilities?: string[];
    requirements?: string[];
  }>;
  skillsAndCourses: Array<{
    skill: string;
    course: string;
    provider?: string;
    level?: string;
  }>;
  careerPathSteps: Array<{
    title: string;
    description: string;
    timeframe?: string;
  }>;
  keyTakeaways: string[];
  nextStepRecommendations: string;
  potentialRoles: string[];
  futureCareerPath?: Array<{
    step: string;
    title: string;
    action: string;
    description: string;
    timeline: string;
    timeframe: string;
    focusAreas?: string;
  }>;
}

// Adding missing types that are imported in assistant components
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
