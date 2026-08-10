// ABOUTME: The subject vocabulary shared by career roles, platform courses, and
// ABOUTME: the Coursera fallback catalog. Platform courses carry free-text
// ABOUTME: `category` and `tags` written by instructors, so they cannot be joined
// ABOUTME: to roles directly — this module infers subjects from that text instead.

import subjectKeywords from './subjectKeywords.json';

/**
 * A subject area. Deliberately coarser than a skill: "SQL" is a subject,
 * "window functions" is not. Roles declare the subjects they need
 * (`roleLearningPaths`), courses declare the subjects they teach, and the
 * resolver matches the two.
 */
export type LearningSubject =
  | 'data-analysis'
  | 'sql'
  | 'python'
  | 'excel'
  | 'statistics'
  | 'data-visualization'
  | 'business-intelligence'
  | 'product-analytics'
  | 'experimentation'
  | 'machine-learning'
  | 'deep-learning'
  | 'nlp'
  | 'generative-ai'
  | 'mlops'
  | 'ai-ethics'
  | 'data-engineering'
  | 'etl'
  | 'data-modeling'
  | 'data-governance'
  | 'cloud'
  | 'security'
  | 'software-engineering'
  | 'web-development'
  | 'research'
  | 'finance'
  | 'business-strategy'
  | 'communication'
  | 'leadership'
  | 'stakeholder-management'
  | 'project-management'
  | 'negotiation';

export const LEARNING_SUBJECTS: LearningSubject[] = [
  'data-analysis',
  'sql',
  'python',
  'excel',
  'statistics',
  'data-visualization',
  'business-intelligence',
  'product-analytics',
  'experimentation',
  'machine-learning',
  'deep-learning',
  'nlp',
  'generative-ai',
  'mlops',
  'ai-ethics',
  'data-engineering',
  'etl',
  'data-modeling',
  'data-governance',
  'cloud',
  'security',
  'software-engineering',
  'web-development',
  'research',
  'finance',
  'business-strategy',
  'communication',
  'leadership',
  'stakeholder-management',
  'project-management',
  'negotiation',
];

/**
 * The business/professional subjects. Role paths append exactly one of these
 * in last position; the role resolver reserves the final recommendation slot
 * for it so the technical subjects cannot crowd it out entirely.
 */
export const BUSINESS_SUBJECTS: ReadonlySet<LearningSubject> = new Set([
  'communication',
  'leadership',
  'stakeholder-management',
  'project-management',
  'negotiation',
]);

/** Human labels, for section headings and "why am I seeing this" copy. */
export const SUBJECT_LABELS: Record<LearningSubject, string> = {
  'data-analysis': 'Data Analysis',
  sql: 'SQL',
  python: 'Python',
  excel: 'Excel & Spreadsheets',
  statistics: 'Statistics',
  'data-visualization': 'Data Visualization',
  'business-intelligence': 'Business Intelligence',
  'product-analytics': 'Product Analytics',
  experimentation: 'Experimentation & A/B Testing',
  'machine-learning': 'Machine Learning',
  'deep-learning': 'Deep Learning',
  nlp: 'Natural Language Processing',
  'generative-ai': 'Generative AI',
  mlops: 'MLOps',
  'ai-ethics': 'AI Ethics & Responsible AI',
  'data-engineering': 'Data Engineering',
  etl: 'ETL & Pipelines',
  'data-modeling': 'Data Modeling',
  'data-governance': 'Data Governance',
  cloud: 'Cloud Platforms',
  security: 'Security',
  'software-engineering': 'Software Engineering',
  'web-development': 'Web Development',
  research: 'Research Methods',
  finance: 'Finance & Valuation',
  'business-strategy': 'Business Strategy',
  communication: 'Communication & Presentation',
  leadership: 'Leadership & People Management',
  'stakeholder-management': 'Stakeholder Management',
  'project-management': 'Project Management',
  negotiation: 'Negotiation & Influence',
};

/**
 * Keywords that mark a piece of free text as being about a subject.
 *
 * Lives in JSON rather than here because `scripts/build-coursera-catalog.mjs` —
 * a plain Node script that cannot import TypeScript — needs the same table to
 * classify catalog rows. One file, no drift. `roleCourseResolver.test.ts` asserts
 * that the generated catalog's stored subjects still match what `inferSubjects`
 * produces, so a change to the matching logic on either side fails CI.
 */
const SUBJECT_KEYWORDS = subjectKeywords as unknown as Record<LearningSubject, string[]>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pre-compiled so inference over a whole course list stays cheap. */
const SUBJECT_PATTERNS: Array<[LearningSubject, RegExp[]]> = LEARNING_SUBJECTS.map((subject) => [
  subject,
  (SUBJECT_KEYWORDS[subject] ?? []).map(
    (keyword) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, 'i'),
  ),
]);

/**
 * Subjects mentioned anywhere in the given text fragments.
 *
 * Used on instructor-authored `category`, `tags`, `title` and `description`, none
 * of which follow a controlled vocabulary. Returns subjects in
 * `LEARNING_SUBJECTS` order so the output is stable regardless of input order.
 */
export function inferSubjects(...fragments: Array<string | null | undefined>): LearningSubject[] {
  const haystack = fragments.filter(Boolean).join(' \n ');
  if (!haystack.trim()) return [];

  return SUBJECT_PATTERNS.filter(([, patterns]) =>
    patterns.some((pattern) => pattern.test(haystack)),
  ).map(([subject]) => subject);
}
