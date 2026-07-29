// ABOUTME: The subject vocabulary shared by career roles, platform courses, and
// ABOUTME: the Coursera fallback catalog. Platform courses carry free-text
// ABOUTME: `category` and `tags` written by instructors, so they cannot be joined
// ABOUTME: to roles directly — this module infers subjects from that text instead.

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
  | 'research'
  | 'finance'
  | 'business-strategy';

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
  'research',
  'finance',
  'business-strategy',
];

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
  research: 'Research Methods',
  finance: 'Finance & Valuation',
  'business-strategy': 'Business Strategy',
};

/**
 * Keywords that mark a piece of free text as being about a subject.
 *
 * Matching is case-insensitive and word-boundary aware, so `"r"` would match far
 * too much and is deliberately absent — short, ambiguous tokens belong in a
 * course's `tags`, not in inference. Keep entries lowercase.
 */
const SUBJECT_KEYWORDS: Record<LearningSubject, string[]> = {
  'data-analysis': ['data analysis', 'data analytics', 'analytics', 'analyst', 'analysis', 'insights'],
  sql: ['sql', 'postgres', 'postgresql', 'mysql', 'bigquery', 'snowflake', 'redshift', 'query', 'queries'],
  python: ['python', 'pandas', 'numpy', 'jupyter'],
  excel: ['excel', 'spreadsheet', 'spreadsheets', 'google sheets'],
  statistics: ['statistics', 'statistical', 'probability', 'regression', 'hypothesis testing', 'inference'],
  'data-visualization': ['visualization', 'visualisation', 'tableau', 'power bi', 'looker', 'charts', 'charting', 'dashboard', 'dashboards', 'd3'],
  'business-intelligence': ['business intelligence', 'bi', 'reporting', 'kpi', 'kpis', 'metrics'],
  'product-analytics': ['product analytics', 'product management', 'user behavior', 'funnel', 'retention', 'cohort'],
  experimentation: ['experimentation', 'a/b testing', 'ab testing', 'experiment', 'experiments', 'causal inference'],
  'machine-learning': ['machine learning', 'ml', 'scikit-learn', 'sklearn', 'supervised learning', 'predictive modeling', 'classification', 'clustering'],
  'deep-learning': ['deep learning', 'neural network', 'neural networks', 'pytorch', 'tensorflow', 'computer vision', 'transformers'],
  nlp: ['nlp', 'natural language', 'text mining', 'language model', 'language models'],
  'generative-ai': ['generative ai', 'genai', 'llm', 'llms', 'large language model', 'prompt engineering', 'diffusion'],
  mlops: ['mlops', 'model deployment', 'model monitoring', 'mlflow', 'kubeflow', 'feature store'],
  'ai-ethics': ['ai ethics', 'responsible ai', 'fairness', 'bias', 'ai governance', 'explainability', 'interpretability'],
  'data-engineering': ['data engineering', 'data engineer', 'spark', 'kafka', 'airflow', 'data pipeline', 'data pipelines', 'databricks'],
  etl: ['etl', 'elt', 'ingestion', 'data warehouse', 'data warehousing', 'dbt', 'orchestration'],
  'data-modeling': ['data modeling', 'data modelling', 'dimensional modeling', 'schema design', 'database design', 'normalization', 'star schema'],
  'data-governance': ['data governance', 'data quality', 'data catalog', 'metadata', 'master data', 'lineage', 'stewardship', 'compliance', 'gdpr'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'docker', 'terraform', 'serverless', 'infrastructure'],
  security: ['security', 'cybersecurity', 'iam', 'encryption', 'threat', 'vulnerability', 'incident response'],
  'software-engineering': ['software engineering', 'software development', 'programming', 'api', 'apis', 'ci/cd', 'testing', 'full stack', 'full-stack', 'backend', 'frontend', 'javascript', 'react'],
  research: ['research', 'scientific', 'academic', 'literature review', 'experimental design', 'algorithms'],
  finance: ['finance', 'financial', 'valuation', 'private equity', 'investment', 'accounting', 'financial modeling'],
  'business-strategy': ['business strategy', 'strategy', 'consulting', 'stakeholder', 'change management', 'roi', 'business acumen', 'project management'],
};

/** Pre-compiled so inference over a whole course list stays cheap. */
const SUBJECT_PATTERNS: Array<[LearningSubject, RegExp[]]> = (
  Object.entries(SUBJECT_KEYWORDS) as Array<[LearningSubject, string[]]>
).map(([subject, keywords]) => [
  subject,
  keywords.map((keyword) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, 'i')),
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
