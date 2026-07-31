
// Import types from the centralized file
import { CareerReportData as CareerReportDataType } from "../../assistants/types";

// Define missing types that are used in CareerReportParser.ts
export interface RecommendedRole {
  /**
   * Key into `career_roles`. The report no longer carries a title or a salary:
   * both are resolved from `career_role_wages` at render time, so the pay shown
   * traces to a BLS occupation instead of to whatever the model wrote.
   */
  roleSlug: string;
  description: string;
  focusAreas?: string[];
  responsibilities?: string[];
  requirements?: string[];
  matchPercentage: number; // Make this required to match the expected type
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
