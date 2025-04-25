
export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: Array<{
    title: string;
    description: string;
    salaryRange: string;
    matchPercentage: number;  // Making this required for consistency
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
  nextStepRecommendations: string;  // Making this required
  potentialRoles: string[];  // Making this required
}
