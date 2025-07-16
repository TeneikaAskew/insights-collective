// Course category constants to ensure consistency across the application
export const COURSE_CATEGORIES = {
  DATA_SCIENCE: 'Data Science',
  ANALYTICS_BI: 'Analytics & BI',
  DATA_ENGINEERING: 'Data Engineering',
  ML_AI: 'ML/AI',
  BUSINESS_INTELLIGENCE: 'Business Intelligence',
  AI_ML: 'AI/ML'
} as const;

// Category display mapping for consistent UI display
export const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Analytics & Business Intelligence': 'Analytics & BI',
  'Business Intelligence': 'Analytics & BI',
  'Machine Learning & Artificial Intelligence': 'ML/AI',
  'AI/ML': 'ML/AI',
  'Data Science': 'Data Science',
  'Data Engineering': 'Data Engineering',
  'Analytics & BI': 'Analytics & BI',
  'ML/AI': 'ML/AI'
};

// Get display name for a category
export function getCategoryDisplayName(category: string): string {
  return CATEGORY_DISPLAY_MAP[category] || category;
}

// Valid categories for forms and validation
export const VALID_CATEGORIES = [
  'Data Science',
  'Analytics & BI',
  'Data Engineering',
  'ML/AI'
] as const;

export type CourseCategory = typeof VALID_CATEGORIES[number];