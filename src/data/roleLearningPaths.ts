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
 * Keep each role to roughly 4-6 subjects — a list that covers everything ranks
 * nothing.
 */
export const roleLearningPaths: Record<string, LearningSubject[]> = {
  // Analytics
  'data-analyst': ['sql', 'data-analysis', 'data-visualization', 'statistics', 'excel'],
  'insights-analyst': ['data-analysis', 'sql', 'data-visualization', 'business-strategy', 'statistics'],
  'data-metrics-analyst': ['business-intelligence', 'sql', 'data-analysis', 'data-visualization', 'statistics'],
  'product-insights-analyst': ['product-analytics', 'experimentation', 'sql', 'data-analysis', 'data-visualization'],
  'private-equity-analyst': ['finance', 'excel', 'data-analysis', 'business-strategy'],
  'decision-scientist': ['statistics', 'data-analysis', 'business-strategy', 'python', 'experimentation'],
  'data-governance-analyst': ['data-governance', 'data-modeling', 'business-strategy', 'sql'],
  'mdm-analyst': ['data-governance', 'data-modeling', 'etl', 'sql'],
  'solution-engineer-data-ai': ['cloud', 'business-strategy', 'machine-learning', 'software-engineering', 'data-engineering'],

  // Business Intelligence
  'bi-analyst': ['business-intelligence', 'data-visualization', 'sql', 'data-modeling', 'data-analysis'],
  'data-visualization-specialist': ['data-visualization', 'business-intelligence', 'data-analysis', 'software-engineering'],
  'information-architect': ['data-modeling', 'data-governance', 'data-engineering', 'sql'],
  'intelligence-analyst': ['data-analysis', 'research', 'data-visualization', 'business-strategy'],
  'ai-governance-officer': ['ai-ethics', 'data-governance', 'business-strategy', 'machine-learning'],

  // Data Engineering
  'data-engineer': ['data-engineering', 'sql', 'etl', 'python', 'cloud', 'data-modeling'],
  'cloud-data-engineer': ['cloud', 'data-engineering', 'etl', 'sql', 'data-modeling'],
  'sql-developer': ['sql', 'data-modeling', 'etl', 'data-engineering'],
  'metadata-specialist': ['data-governance', 'data-modeling', 'etl', 'data-engineering'],
  'cloud-engineer': ['cloud', 'software-engineering', 'security', 'data-engineering'],
  'cloud-security-engineer': ['security', 'cloud', 'data-governance', 'software-engineering'],
  'full-stack-developer': ['software-engineering', 'sql', 'cloud'],
  'software-engineer-ai-ml': ['software-engineering', 'machine-learning', 'mlops', 'python', 'cloud'],

  // AI / ML
  'data-scientist': ['machine-learning', 'python', 'statistics', 'sql', 'data-visualization'],
  'machine-learning-engineer': ['machine-learning', 'mlops', 'python', 'software-engineering', 'deep-learning'],
  'ai-engineer': ['machine-learning', 'software-engineering', 'cloud', 'deep-learning', 'generative-ai'],
  'mlops-engineer': ['mlops', 'cloud', 'machine-learning', 'software-engineering'],
  'generative-ai-scientist': ['generative-ai', 'deep-learning', 'nlp', 'machine-learning', 'research'],
  'research-scientist': ['research', 'machine-learning', 'deep-learning', 'statistics', 'python'],
  'computer-information-research-scientist': ['research', 'software-engineering', 'machine-learning', 'statistics'],
  'ai-consultant': ['business-strategy', 'machine-learning', 'ai-ethics', 'cloud', 'data-analysis'],
  'customer-engineer-data-ai': ['cloud', 'business-strategy', 'machine-learning', 'data-engineering', 'software-engineering'],
  'ai-test-engineer': ['software-engineering', 'ai-ethics', 'machine-learning', 'python', 'mlops'],
  'qa-engineer-ai': ['software-engineering', 'ai-ethics', 'machine-learning', 'python'],
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
    return ['machine-learning', 'python', 'statistics', 'deep-learning'];
  }
  if (normalized.includes('engineering')) {
    return ['data-engineering', 'sql', 'etl', 'cloud'];
  }
  if (normalized.includes('intelligence')) {
    return ['business-intelligence', 'data-visualization', 'sql', 'data-modeling'];
  }
  return ['data-analysis', 'sql', 'data-visualization', 'statistics'];
}
