
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
