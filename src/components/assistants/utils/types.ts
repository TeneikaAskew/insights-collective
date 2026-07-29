
// Import types from the centralized file
import { CareerReportData as CareerReportDataType } from "../../assistants/types";

// Define missing types that are used in CareerReportParser.ts
export interface RecommendedRole {
  /** Slug from the curated career_roles catalog. Pay is joined from BLS on it. */
  roleSlug: string;
  title: string;
  description: string;
  focusAreas?: string[];
  responsibilities?: string[];
  requirements?: string[];
}

export interface SkillCourse {
  skill: string;
  courses: string[];
}

export interface CareerPathStep {
  title: string;
  description: string;
  timeframe?: string;
  step?: string;
  action?: string;
  timeline?: string;
  focusAreas?: string;
}

// Re-export for backward compatibility
export type CareerReportData = CareerReportDataType;
