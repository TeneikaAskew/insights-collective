
export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: Array<{
    title: string;
    description: string;
    salaryRange: string;
    matchPercentage?: number;
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
  }>;
  keyTakeaways: string[];
  nextStepRecommendations?: string;
  potentialRoles?: string[];
}
