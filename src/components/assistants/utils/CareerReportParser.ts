
// ABOUTME: Utility functions for parsing career report data from AI responses
// ABOUTME: Includes text processing and data structure transformation for career recommendations

import { CareerReportData, RecommendedRole, SkillCourse, CareerPathStep } from './types';

import { createLogger } from '@/utils/logger';

const logger = createLogger('parseCareerReport');

// Helper function to clean and capitalize focus areas
const cleanFocusAreas = (focusAreas: string[]): string[] => {
  return focusAreas.map(area => {
    // Remove common connector words and clean the text
    const cleaned = area
      .replace(/\b(and|or|the|a|an|in|on|at|to|for|of|with|by)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Capitalize each word
    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }).filter(area => area.length > 0); // Remove empty strings
};

// Helper function to extract text between two delimiters
const extractTextBetween = (text: string, start: string, end: string): string => {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return '';

  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex === -1) return '';

  return text.substring(startIndex + start.length, endIndex).trim();
};

// Helper function to extract an array of items between two delimiters
const extractListBetween = (text: string, start: string, end: string): string[] => {
  const content = extractTextBetween(text, start, end);
  return content.split('\n')
                .map(item => item.replace(/^\s*[-•]\s*/, '').trim())
                .filter(item => item !== '');
};

// Helper function to extract skills and courses from a given text
const extractSkillsAndCourses = (text: string): SkillCourse[] => {
  const skillsAndCourses: SkillCourse[] = [];
  const skillRegex = /Skill:\s*(.*?)\s*Courses:\s*(.*?)(?=\nSkill:|\n|$)/gs;
  let match;

  while ((match = skillRegex.exec(text)) !== null) {
    const skillName = match[1].trim();
    const coursesText = match[2].trim();
    const courseList = coursesText.split('\n')
      .map(course => course.replace(/^\s*[-•]\s*/, '').trim())
      .filter(course => course !== '');

    skillsAndCourses.push({
      skill: skillName,
      courses: courseList,
    });
  }

  return skillsAndCourses;
};

// Helper function to extract career path steps from a given text
const extractCareerPathSteps = (text: string): CareerPathStep[] => {
  const careerPathSteps: CareerPathStep[] = [];
  const stepRegex = /Step\s*\d+:\s*(.*?)(?=\nStep\s*\d+:|\n|$)/gs;
  let match;

  while ((match = stepRegex.exec(text)) !== null) {
    const stepText = match[1].trim();
    const [title, ...descriptionParts] = stepText.split('\n');
    const description = descriptionParts.join('\n').trim();

    careerPathSteps.push({
      title: title.trim(),
      description: description,
    });
  }

  return careerPathSteps;
};

/**
 * The single place a model-supplied role becomes a report role.
 *
 * Builds an explicit object rather than spreading the input, so a field the
 * model volunteers cannot reach the page just because nobody thought to strip
 * it. A `salaryRange` is exactly that case: pay is resolved from
 * `career_role_wages` by slug, and a figure arriving from the LLM has no source
 * behind it.
 *
 * Roles with no slug are dropped. The old code defaulted them to 'Unknown Role'
 * and 'Not specified', which rendered as an ordinary recommendation carrying no
 * information and no way to tell it apart from a real one.
 */
const normalizeRecommendedRoles = (roles: any): RecommendedRole[] =>
  (Array.isArray(roles) ? roles : [])
    .filter((role: any) => typeof (role?.roleSlug ?? role?.role_slug) === 'string')
    .map((role: any) => ({
      roleSlug: role.roleSlug ?? role.role_slug,
      description: role.description || '',
      focusAreas: cleanFocusAreas(role.focus_areas || role.focusAreas || []),
      responsibilities: role.responsibilities || [],
      requirements: role.requirements || [],
    }));

export const parseCareerReport = (reportText: string): CareerReportData => {
  logger.log("Starting to parse career report...");
  
  try {
    // Try to parse as JSON first
    const jsonData = JSON.parse(reportText);
    logger.log("Successfully parsed as JSON:", jsonData);
    
    // If it's already in the correct format, clean focus areas and return
    if (jsonData.recommendedRoles) {
      // Normalized through the same helper as the other branch. This used to
      // spread `...role` straight through, so anything extra the model emitted
      // — an invented title, a `salaryRange` — survived into the rendered
      // report on this path while being stripped on the other.
      if (Array.isArray(jsonData.recommendedRoles)) {
        jsonData.recommendedRoles = normalizeRecommendedRoles(jsonData.recommendedRoles);
      }

      // Clean focus areas for potential roles too
      if (Array.isArray(jsonData.potentialRoles)) {
        jsonData.potentialRoles = jsonData.potentialRoles.map((role: any) => ({
          ...role,
          focusAreas: Array.isArray(role.focusAreas) ? cleanFocusAreas(role.focusAreas) : []
        }));
      }
      
      return jsonData;
    }
    
    return extractDataFromJSON(jsonData);
  } catch (error) {
    logger.log("Not valid JSON, attempting text parsing...");
    return extractDataFromText(reportText);
  }
};

// Export the function for formatting career pathway reports
export const formatCareerPathwayReport = (reportData: any): CareerReportData => {
  return parseCareerReport(JSON.stringify(reportData));
};

const extractDataFromJSON = (data: any): CareerReportData => {
  const recommendedRoles = normalizeRecommendedRoles(
    data.recommended_roles || data.recommendedRoles || [],
  );

  const potentialRoles = (data.potential_roles || data.potentialRoles || []).map((role: string) => role);

  return {
    userName: data.user_name || data.userName || 'there',
    summary: data.summary || 'No summary available',
    recommendedRoles,
    skillsAndCourses: data.skills_and_courses || data.skillsAndCourses || [],
    careerPathSteps: data.career_path_steps || data.careerPathSteps || [],
    keyTakeaways: data.key_takeaways || data.keyTakeaways || [],
    nextStepRecommendations: data.next_step_recommendations || data.nextStepRecommendations || '',
    potentialRoles,
    futureCareerPath: data.future_career_path || data.futureCareerPath || []
  };
};

const extractDataFromText = (text: string): CareerReportData => {
  // When extracting focus areas from text, make sure to clean them
  const extractFocusAreas = (text: string): string[] => {
    const focusAreaRegex = /focus\s+areas?[:\-\s]*(.*?)(?:\n|$)/gi;
    const matches = text.match(focusAreaRegex);
    if (matches) {
      const areas = matches[0]
        .replace(/focus\s+areas?[:\-\s]*/gi, '')
        .split(/[,;]/)
        .map(area => area.trim())
        .filter(area => area.length > 0);
      return cleanFocusAreas(areas);
    }
    return [];
  };

  return {
    userName: 'there',
    summary: 'Career report analysis completed.',
    recommendedRoles: [],
    skillsAndCourses: [],
    careerPathSteps: [],
    keyTakeaways: [],
    nextStepRecommendations: '',
    potentialRoles: []
  };
};
