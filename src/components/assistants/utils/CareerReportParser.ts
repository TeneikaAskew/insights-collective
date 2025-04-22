/**
 * Utility functions to parse static career reports into structured data
 */

export interface RecommendedRole {
  title: string;
  description: string;
  salaryRange: string;
  matchPercentage: number;
}

export interface SkillCourse {
  skill: string;
  course: string;
  provider?: string;
  level?: string;
}

export interface CareerPathStep {
  title: string;
  description: string;
}

export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: RecommendedRole[];
  skillsAndCourses: SkillCourse[];
  nextStepRecommendations: string;
  potentialRoles: string[];
  careerPathSteps: CareerPathStep[];
  keyTakeaways: string[];
}

/**
 * Parses a static text report into structured data
 * This function handles the transformation of the raw text format
 * into a structured object the interactive UI can use
 */
export function parseCareerReport(reportText: string): CareerReportData {
  const report: CareerReportData = {
    userName: extractUserName(reportText),
    summary: extractSummary(reportText),
    recommendedRoles: extractRecommendedRoles(reportText),
    skillsAndCourses: extractSkillsAndCourses(reportText),
    nextStepRecommendations: extractNextStepRecommendations(reportText),
    potentialRoles: extractPotentialRoles(reportText),
    careerPathSteps: extractCareerPathSteps(reportText),
    keyTakeaways: extractKeyTakeaways(reportText)
  };
  
  // Add match percentages if they don't exist in the original report
  if (report.recommendedRoles.length > 0) {
    report.recommendedRoles = report.recommendedRoles.map((role, index) => {
      if (!role.matchPercentage) {
        // Generate decreasing percentages for roles (95%, 88%, 81%, etc.)
        role.matchPercentage = Math.max(50, 95 - (index * 7));
      }
      return role;
    });
  }
  
  return report;
}

/**
 * Extract the user name from the report title
 */
function extractUserName(text: string): string {
  const match = text.match(/Personalized Career Advice Report for ([\w\s\.]+)/i);
  return match ? match[1].trim() : "User";
}

/**
 * Extract the summary section from the report
 */
function extractSummary(text: string): string {
  const summaryMatch = text.match(/Summary:(.*?)(?=Recommended Roles:|$)/is);
  return summaryMatch ? summaryMatch[1].trim() : "";
}

/**
 * Extract the recommended roles section
 */
function extractRecommendedRoles(text: string): RecommendedRole[] {
  const roles: RecommendedRole[] = [];
  
  // Find the recommended roles section
  const rolesSection = text.match(/Recommended Roles:(.*?)(?=Skills and Matching Courses:|$)/is);
  
  if (rolesSection) {
    // Extract each numbered role
    const roleMatches = rolesSection[1].matchAll(/(\d+)\.\s+\*\*(.*?)(?=\*\*):\s+(.*?)(?=Salary band:|$)(
