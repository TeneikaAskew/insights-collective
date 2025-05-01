
// Define categories for bullet point analysis
export const BULLET_CATEGORIES = {
  ACTION: "Action Words",
  METRICS: "Metrics/Results",
  CLARITY: "Clarity/Conciseness",
  INDUSTRY: "Industry Keywords",
  ACHIEVEMENT: "Achievement Focus",
  COMMON: "Common Words"
};

// Define color map for bullet point visualization
export const CATEGORY_COLORS = {
  [BULLET_CATEGORIES.ACTION]: "#D97706", // Amber-600
  [BULLET_CATEGORIES.METRICS]: "#0D9488", // Teal-600
  [BULLET_CATEGORIES.CLARITY]: "#2563EB", // Blue-600
  [BULLET_CATEGORIES.INDUSTRY]: "#1E40AF", // Blue-800
  [BULLET_CATEGORIES.ACHIEVEMENT]: "#059669", // Green-600
  [BULLET_CATEGORIES.COMMON]: "#6B7280" // Gray-500
};
