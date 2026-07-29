// ABOUTME: Static Coursera catalog used as the SECONDARY course source — it fills
// ABOUTME: subject gaps that Insights Collective's own published courses do not
// ABOUTME: cover. Coursera has no free public catalog API (the old
// ABOUTME: `api.coursera.org/api/courses.v1` endpoint is gone and the affiliate
// ABOUTME: API needs partner credentials), so this table is curated by hand.
// ABOUTME: Run `npm run verify:coursera` after editing to catch dead slugs.

import type { LearningSubject } from './learningSubjects';

export interface CourseraCourse {
  /** Coursera URL slug. Also this entry's stable id. */
  slug: string;
  title: string;
  /** The organization that authors the course, not "Coursera". */
  partner: string;
  /** Coursera calls these "Course", "Specialization" and "Professional Certificate". */
  format: 'Course' | 'Specialization' | 'Professional Certificate';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Subjects this course actually teaches, most central first. */
  subjects: LearningSubject[];
  description: string;
}

/**
 * Which URL shape a slug uses. Coursera serves specializations and professional
 * certificates from /specializations/<slug> and single courses from
 * /learn/<slug>; getting this wrong is the most common cause of a 404.
 */
export function courseraUrl(course: CourseraCourse): string {
  const path = course.format === 'Course' ? 'learn' : 'specializations';
  return `https://www.coursera.org/${path}/${course.slug}`;
}

export const courseraCatalog: CourseraCourse[] = [
  // ---- Analytics foundations -------------------------------------------------
  {
    slug: 'google-data-analytics',
    title: 'Google Data Analytics Professional Certificate',
    partner: 'Google',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['data-analysis', 'sql', 'data-visualization', 'excel'],
    description: 'Entry-level analytics track covering spreadsheets, SQL, Tableau and R, ending in a portfolio case study.',
  },
  {
    slug: 'ibm-data-analyst',
    title: 'IBM Data Analyst Professional Certificate',
    partner: 'IBM',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['data-analysis', 'python', 'sql', 'excel', 'data-visualization'],
    description: 'Python-first analytics path through Excel, SQL, pandas and dashboarding.',
  },
  {
    slug: 'excel-basics-data-analysis-ibm',
    title: 'Excel Basics for Data Analysis',
    partner: 'IBM',
    format: 'Course',
    level: 'Beginner',
    subjects: ['excel', 'data-analysis'],
    description: 'Spreadsheet fundamentals for cleaning, filtering and summarizing real datasets.',
  },
  {
    slug: 'data-analysis-with-python',
    title: 'Data Analysis with Python',
    partner: 'IBM',
    format: 'Course',
    level: 'Intermediate',
    subjects: ['python', 'data-analysis', 'statistics'],
    description: 'pandas, NumPy and scikit-learn applied to cleaning, exploring and modeling tabular data.',
  },

  // ---- SQL & modeling --------------------------------------------------------
  {
    slug: 'sql-for-data-science',
    title: 'SQL for Data Science',
    partner: 'University of California, Davis',
    format: 'Course',
    level: 'Beginner',
    subjects: ['sql', 'data-analysis'],
    description: 'The standard first SQL course: filtering, joins, aggregation and subqueries against real tables.',
  },
  {
    slug: 'learn-sql-basics-data-science',
    title: 'Learn SQL Basics for Data Science',
    partner: 'University of California, Davis',
    format: 'Specialization',
    level: 'Beginner',
    subjects: ['sql', 'data-modeling', 'data-analysis'],
    description: 'Four-course SQL sequence ending in distributed computing with Spark SQL.',
  },
  {
    slug: 'ibm-data-warehouse-engineer',
    title: 'IBM Data Warehouse Engineer Professional Certificate',
    partner: 'IBM',
    format: 'Professional Certificate',
    level: 'Intermediate',
    subjects: ['data-modeling', 'etl', 'sql', 'data-engineering'],
    description: 'Warehouse design, dimensional modeling and BI-facing ETL on relational platforms.',
  },

  // ---- BI & visualization ----------------------------------------------------
  {
    slug: 'google-business-intelligence',
    title: 'Google Business Intelligence Professional Certificate',
    partner: 'Google',
    format: 'Professional Certificate',
    level: 'Intermediate',
    subjects: ['business-intelligence', 'etl', 'data-visualization', 'sql'],
    description: 'BI pipelines, data models and dashboards aimed at analysts moving into BI roles.',
  },
  {
    slug: 'microsoft-power-bi-data-analyst',
    title: 'Microsoft Power BI Data Analyst Professional Certificate',
    partner: 'Microsoft',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['business-intelligence', 'data-visualization', 'data-modeling'],
    description: 'Power Query, DAX and report design, mapped to the PL-300 certification.',
  },
  {
    slug: 'data-visualization',
    title: 'Data Visualization with Tableau',
    partner: 'University of California, Davis',
    format: 'Specialization',
    level: 'Beginner',
    subjects: ['data-visualization', 'business-intelligence'],
    description: 'Visual design principles and Tableau mechanics, from single charts to executive dashboards.',
  },

  // ---- Statistics & data science --------------------------------------------
  {
    slug: 'statistics-with-python',
    title: 'Statistics with Python',
    partner: 'University of Michigan',
    format: 'Specialization',
    level: 'Beginner',
    subjects: ['statistics', 'python'],
    description: 'Inference, hypothesis testing and fitting statistical models, taught in Python.',
  },
  {
    slug: 'data-science-python',
    title: 'Applied Data Science with Python',
    partner: 'University of Michigan',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['python', 'data-analysis', 'machine-learning', 'data-visualization'],
    description: 'Five courses spanning pandas, plotting, applied machine learning, text mining and networks.',
  },
  {
    slug: 'ibm-data-science',
    title: 'IBM Data Science Professional Certificate',
    partner: 'IBM',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['data-analysis', 'python', 'machine-learning', 'statistics', 'sql'],
    description: 'End-to-end data science track from Python and SQL through to a capstone model.',
  },

  // ---- Machine learning & AI -------------------------------------------------
  {
    slug: 'machine-learning-introduction',
    title: 'Machine Learning Specialization',
    partner: 'DeepLearning.AI & Stanford University',
    format: 'Specialization',
    level: 'Beginner',
    subjects: ['machine-learning', 'python', 'statistics'],
    description: "Andrew Ng's rebuilt ML course: regression, classification, trees and recommenders in Python.",
  },
  {
    slug: 'deep-learning',
    title: 'Deep Learning Specialization',
    partner: 'DeepLearning.AI',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['deep-learning', 'machine-learning', 'nlp'],
    description: 'Neural network foundations through CNNs, sequence models and transformer attention.',
  },
  {
    slug: 'natural-language-processing',
    title: 'Natural Language Processing Specialization',
    partner: 'DeepLearning.AI',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['nlp', 'deep-learning', 'machine-learning'],
    description: 'Classification, vector spaces, sequence models and attention applied to language tasks.',
  },
  {
    slug: 'generative-ai-with-llms',
    title: 'Generative AI with Large Language Models',
    partner: 'DeepLearning.AI & AWS',
    format: 'Course',
    level: 'Intermediate',
    subjects: ['generative-ai', 'nlp', 'deep-learning'],
    description: 'LLM lifecycle in depth: pretraining, fine-tuning, RLHF and deployment trade-offs.',
  },
  {
    slug: 'ai-for-everyone',
    title: 'AI For Everyone',
    partner: 'DeepLearning.AI',
    format: 'Course',
    level: 'Beginner',
    subjects: ['business-strategy', 'machine-learning', 'ai-ethics'],
    description: 'Non-technical framing of what AI can and cannot do, written for people who scope AI work.',
  },
  {
    slug: 'machine-learning-engineering-for-production-mlops',
    title: 'Machine Learning Engineering for Production (MLOps)',
    partner: 'DeepLearning.AI',
    format: 'Specialization',
    level: 'Advanced',
    subjects: ['mlops', 'machine-learning', 'software-engineering'],
    description: 'Production ML: data pipelines, model serving, drift monitoring and deployment strategy.',
  },
  {
    slug: 'mlops-machine-learning-duke',
    title: 'MLOps | Machine Learning Operations',
    partner: 'Duke University',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['mlops', 'cloud', 'software-engineering'],
    description: 'Operationalizing models with Python tooling, containers and the major cloud ML platforms.',
  },

  // ---- Engineering & cloud ---------------------------------------------------
  {
    slug: 'ibm-data-engineer',
    title: 'IBM Data Engineering Professional Certificate',
    partner: 'IBM',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['data-engineering', 'etl', 'sql', 'python', 'data-modeling'],
    description: 'Relational and NoSQL stores, warehouse design, Airflow, Kafka and Spark in one track.',
  },
  {
    slug: 'gcp-data-machine-learning',
    title: 'Data Engineering, Big Data, and Machine Learning on GCP',
    partner: 'Google Cloud',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['data-engineering', 'cloud', 'etl', 'machine-learning'],
    description: 'BigQuery, Dataflow and Vertex AI for pipelines and models on Google Cloud.',
  },
  {
    slug: 'aws-fundamentals',
    title: 'AWS Fundamentals',
    partner: 'Amazon Web Services',
    format: 'Specialization',
    level: 'Beginner',
    subjects: ['cloud', 'security', 'software-engineering'],
    description: 'Core AWS compute, storage, networking and identity, with cost and migration basics.',
  },
  {
    slug: 'google-cybersecurity',
    title: 'Google Cybersecurity Professional Certificate',
    partner: 'Google',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['security', 'cloud'],
    description: 'Threat models, SIEM tooling, IAM and incident response for entry-level security roles.',
  },
  {
    slug: 'ibm-full-stack-cloud-developer',
    title: 'IBM Full Stack Software Developer Professional Certificate',
    partner: 'IBM',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['software-engineering', 'cloud'],
    description: 'Front end, back end, containers and cloud deployment in one application-building track.',
  },
  {
    slug: 'meta-front-end-developer',
    title: 'Meta Front-End Developer Professional Certificate',
    partner: 'Meta',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['software-engineering'],
    description: 'HTML, CSS, JavaScript and React through to a deployable portfolio project.',
  },
  {
    slug: 'meta-back-end-developer',
    title: 'Meta Back-End Developer Professional Certificate',
    partner: 'Meta',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['software-engineering', 'sql'],
    description: 'Python, Django, REST APIs and database work for server-side development.',
  },

  // ---- Governance, product, business ----------------------------------------
  {
    slug: 'data-privacy-fundamentals',
    title: 'Data Privacy Fundamentals',
    partner: 'Northeastern University',
    format: 'Course',
    level: 'Beginner',
    subjects: ['data-governance', 'ai-ethics', 'security'],
    description: 'Privacy regulation, consent and the obligations that attach to handling personal data.',
  },
  {
    slug: 'uva-darden-digital-product-management',
    title: 'Digital Product Management',
    partner: 'University of Virginia (Darden)',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['product-analytics', 'experimentation', 'business-strategy'],
    description: 'Modern product practice: discovery, hypothesis-driven iteration and outcome metrics.',
  },
  {
    slug: 'wharton-customer-analytics',
    title: 'Customer Analytics',
    partner: 'University of Pennsylvania (Wharton)',
    format: 'Course',
    level: 'Beginner',
    subjects: ['product-analytics', 'experimentation', 'business-strategy', 'data-analysis'],
    description: 'Descriptive, predictive and prescriptive analytics tied to customer decisions and experiments.',
  },
  {
    slug: 'google-project-management',
    title: 'Google Project Management Professional Certificate',
    partner: 'Google',
    format: 'Professional Certificate',
    level: 'Beginner',
    subjects: ['business-strategy'],
    description: 'Project lifecycle, stakeholder management and Agile delivery for people running programs.',
  },
  {
    slug: 'wharton-business-financial-modeling',
    title: 'Business and Financial Modeling',
    partner: 'University of Pennsylvania (Wharton)',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['finance', 'business-strategy', 'excel'],
    description: 'Spreadsheet modeling, scenario analysis and valuation for investment decisions.',
  },
  {
    slug: 'financial-markets-global',
    title: 'Financial Markets',
    partner: 'Yale University',
    format: 'Course',
    level: 'Beginner',
    subjects: ['finance', 'business-strategy'],
    description: "Robert Shiller's survey of risk, behavioral finance and how capital markets function.",
  },

  // ---- Research --------------------------------------------------------------
  {
    slug: 'algorithms-part1',
    title: 'Algorithms, Part I',
    partner: 'Princeton University',
    format: 'Course',
    level: 'Intermediate',
    subjects: ['research', 'software-engineering'],
    description: 'Sorting, searching and data structures with the analysis rigor research roles expect.',
  },
  {
    slug: 'mathematics-machine-learning',
    title: 'Mathematics for Machine Learning',
    partner: 'Imperial College London',
    format: 'Specialization',
    level: 'Intermediate',
    subjects: ['research', 'statistics', 'machine-learning'],
    description: 'Linear algebra, multivariate calculus and PCA — the math ML papers assume you have.',
  },
];

/** Catalog indexed by slug, for O(1) lookup and duplicate detection in tests. */
export const courseraCatalogBySlug: Record<string, CourseraCourse> = Object.fromEntries(
  courseraCatalog.map((course) => [course.slug, course]),
);

/**
 * Catalog entries that teach `subject`, best-first.
 *
 * "Best" means the subject sits earlier in the course's own `subjects` list — a
 * course whose first subject is `sql` is a better SQL recommendation than one
 * that merely touches SQL in passing.
 */
export function courseraCoursesForSubject(subject: LearningSubject): CourseraCourse[] {
  return courseraCatalog
    .filter((course) => course.subjects.includes(subject))
    .sort((a, b) => a.subjects.indexOf(subject) - b.subjects.indexOf(subject));
}
