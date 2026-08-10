// ABOUTME: Maps every career role in `dataCareerRoles` to the subjects someone
// ABOUTME: needs to learn for it, in priority order. This is the join key between
// ABOUTME: a role and both course sources — platform courses are scored against
// ABOUTME: it, and any subject the platform does not cover falls back to Coursera.

import type { LearningSubject } from './learningSubjects';

/**
 * Role id (from `dataCareerRoles`) to its subjects, MOST IMPORTANT FIRST.
 *
 * Order matters twice over: it weights platform-course scoring, and it decides
 * which Coursera course fills a gap first when the recommendation list is capped.
 * Keep each role to roughly 4-6 technical subjects — a list that covers
 * everything ranks nothing. Each role additionally ends with ONE business
 * subject (communication, project-management, stakeholder-management, or
 * negotiation): last position = lowest priority weight, so it fills the final
 * recommendation slot without displacing the technical path.
 */
export const roleLearningPaths: Record<string, LearningSubject[]> = {
  // Analytics
  'data-analyst': ['sql', 'data-analysis', 'data-visualization', 'statistics', 'excel', 'communication'],
  'insights-analyst': ['data-analysis', 'sql', 'data-visualization', 'business-strategy', 'statistics', 'communication'],
  'data-metrics-analyst': ['business-intelligence', 'sql', 'data-analysis', 'data-visualization', 'statistics', 'communication'],
  'product-insights-analyst': ['product-analytics', 'experimentation', 'sql', 'data-analysis', 'data-visualization', 'communication'],
  'private-equity-analyst': ['finance', 'excel', 'data-analysis', 'business-strategy', 'negotiation'],
  'decision-scientist': ['statistics', 'data-analysis', 'business-strategy', 'python', 'experimentation', 'communication'],
  'data-governance-analyst': ['data-governance', 'data-modeling', 'business-strategy', 'sql', 'stakeholder-management'],
  'mdm-analyst': ['data-governance', 'data-modeling', 'etl', 'sql', 'stakeholder-management'],
  'solution-engineer-data-ai': ['cloud', 'business-strategy', 'machine-learning', 'software-engineering', 'data-engineering', 'stakeholder-management'],

  // Business Intelligence
  'bi-analyst': ['business-intelligence', 'data-visualization', 'sql', 'data-modeling', 'data-analysis', 'communication'],
  'data-visualization-specialist': ['data-visualization', 'business-intelligence', 'data-analysis', 'web-development', 'communication'],
  'information-architect': ['data-modeling', 'data-governance', 'data-engineering', 'sql', 'stakeholder-management'],
  'intelligence-analyst': ['data-analysis', 'research', 'data-visualization', 'business-strategy', 'communication'],
  'ai-governance-officer': ['ai-ethics', 'data-governance', 'business-strategy', 'machine-learning', 'stakeholder-management'],

  // Data Engineering
  'data-engineer': ['data-engineering', 'sql', 'etl', 'python', 'cloud', 'data-modeling', 'project-management'],
  'cloud-data-engineer': ['cloud', 'data-engineering', 'etl', 'sql', 'data-modeling', 'project-management'],
  'sql-developer': ['sql', 'data-modeling', 'etl', 'data-engineering', 'project-management'],
  'metadata-specialist': ['data-governance', 'data-modeling', 'etl', 'data-engineering', 'stakeholder-management'],
  'cloud-engineer': ['cloud', 'software-engineering', 'security', 'data-engineering', 'project-management'],
  'cloud-security-engineer': ['security', 'cloud', 'data-governance', 'software-engineering', 'project-management'],
  'full-stack-developer': ['web-development', 'software-engineering', 'sql', 'cloud', 'project-management'],
  'software-engineer-ai-ml': ['software-engineering', 'machine-learning', 'mlops', 'python', 'cloud', 'project-management'],

  // AI / ML
  'data-scientist': ['machine-learning', 'python', 'statistics', 'sql', 'data-visualization', 'communication'],
  'machine-learning-engineer': ['machine-learning', 'mlops', 'python', 'software-engineering', 'deep-learning', 'project-management'],
  'ai-engineer': ['machine-learning', 'software-engineering', 'cloud', 'deep-learning', 'generative-ai', 'project-management'],
  'mlops-engineer': ['mlops', 'cloud', 'machine-learning', 'software-engineering', 'project-management'],
  'generative-ai-scientist': ['generative-ai', 'deep-learning', 'nlp', 'machine-learning', 'research', 'communication'],
  'research-scientist': ['research', 'machine-learning', 'deep-learning', 'statistics', 'python', 'communication'],
  'computer-information-research-scientist': ['research', 'software-engineering', 'machine-learning', 'statistics', 'communication'],
  'ai-consultant': ['business-strategy', 'machine-learning', 'ai-ethics', 'cloud', 'data-analysis', 'negotiation'],
  'customer-engineer-data-ai': ['cloud', 'business-strategy', 'machine-learning', 'data-engineering', 'software-engineering', 'stakeholder-management'],
  'ai-test-engineer': ['software-engineering', 'ai-ethics', 'machine-learning', 'python', 'mlops', 'project-management'],
  'qa-engineer-ai': ['software-engineering', 'ai-ethics', 'machine-learning', 'python', 'project-management'],
};

/**
 * Subjects for a role, falling back to its broad category when the role id is
 * unknown — new roles get sensible recommendations before anyone curates a path
 * for them, rather than an empty section.
 */
export function subjectsForRole(roleId: string, category?: string): LearningSubject[] {
  const curated = roleLearningPaths[roleId];
  if (curated) return curated;

  const normalized = (category ?? '').toLowerCase();
  if (normalized.includes('ai') || normalized.includes('ml')) {
    return ['machine-learning', 'python', 'statistics', 'deep-learning', 'communication'];
  }
  if (normalized.includes('engineering')) {
    return ['data-engineering', 'sql', 'etl', 'cloud', 'project-management'];
  }
  if (normalized.includes('intelligence')) {
    return ['business-intelligence', 'data-visualization', 'sql', 'data-modeling', 'communication'];
  }
  return ['data-analysis', 'sql', 'data-visualization', 'statistics', 'communication'];
}
