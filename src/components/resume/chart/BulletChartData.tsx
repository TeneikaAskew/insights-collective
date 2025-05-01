
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

// Interface for chart data item
export interface ChartDataItem {
  name: string;
  value: number;
  fill: string;
  target: number;
  percent: number;
  category: string;
}

/**
 * Prepares bullet point chart data for visualization
 * Takes raw bullet analysis data and formats it for charts
 */
export const prepareBulletChartData = (bullet: any) => {
  if (!bullet) {
    return {
      dataWithPercent: [],
      bullet_total: 0
    };
  }

  // Extract and prepare scores from bullet data
  const {
    xyz_scores = {},
    bullet_total = 0
  } = bullet;

  // Define chart data categories with default values if not provided
  const actionScore = xyz_scores.action || 0;
  const metricsScore = xyz_scores.metrics || 0;
  const industryScore = xyz_scores.industry || 0;
  const clarityScore = xyz_scores.clarity || 0;
  const achievementScore = xyz_scores.achievement || 0;

  // Calculate target percentages based on max possible scores
  // Action: 10, Metrics: 30, Industry: 25, Clarity: 15, Achievement: 20
  const actionTarget = 10;
  const metricsTarget = 30;
  const industryTarget = 25; 
  const clarityTarget = 15;
  const achievementTarget = 20;
  const totalTarget = actionTarget + metricsTarget + industryTarget + clarityTarget + achievementTarget;

  // Calculate percentages for each category
  const actionPercent = (actionScore / actionTarget) * 100;
  const metricsPercent = (metricsScore / metricsTarget) * 100;
  const industryPercent = (industryScore / industryTarget) * 100;
  const clarityPercent = (clarityScore / clarityTarget) * 100;
  const achievementPercent = (achievementScore / achievementTarget) * 100;

  // Create data array for visualization
  const dataWithPercent: ChartDataItem[] = [
    {
      name: "Action Words",
      value: actionScore,
      fill: CATEGORY_COLORS[BULLET_CATEGORIES.ACTION],
      target: actionTarget,
      percent: actionPercent,
      category: BULLET_CATEGORIES.ACTION
    },
    {
      name: "Metrics/Results",
      value: metricsScore,
      fill: CATEGORY_COLORS[BULLET_CATEGORIES.METRICS],
      target: metricsTarget,
      percent: metricsPercent,
      category: BULLET_CATEGORIES.METRICS
    },
    {
      name: "Clarity/Conciseness",
      value: clarityScore,
      fill: CATEGORY_COLORS[BULLET_CATEGORIES.CLARITY],
      target: clarityTarget,
      percent: clarityPercent,
      category: BULLET_CATEGORIES.CLARITY
    },
    {
      name: "Industry Keywords",
      value: industryScore,
      fill: CATEGORY_COLORS[BULLET_CATEGORIES.INDUSTRY],
      target: industryTarget,
      percent: industryPercent,
      category: BULLET_CATEGORIES.INDUSTRY
    },
    {
      name: "Achievement Focus",
      value: achievementScore,
      fill: CATEGORY_COLORS[BULLET_CATEGORIES.ACHIEVEMENT],
      target: achievementTarget,
      percent: achievementPercent,
      category: BULLET_CATEGORIES.ACHIEVEMENT
    }
  ];

  return {
    dataWithPercent,
    bullet_total
  };
};
