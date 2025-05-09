
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
}

export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: Array<{
    title: string;
    description: string;
    salaryRange: string;
    matchPercentage: number;
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
    // Let's add the timeframe property that was expected in the CareerPathway component
    timeframe?: string;
  }>;
  keyTakeaways: string[];
  nextStepRecommendations: string;  // Making this required
  potentialRoles: string[];  // Making this required
}
