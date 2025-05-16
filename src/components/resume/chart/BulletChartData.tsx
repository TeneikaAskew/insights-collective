import { BulletAnalysis } from '@/components/assistants/types';

// Define bullet categories
export const BULLET_CATEGORIES = {
  action: { label: 'Action', color: '#1F75FE' },    // insight-blue
  metrics: { label: 'Metrics', color: '#5ED3B5' },  // aqua-teal
  clarity: { label: 'Clarity', color: '#C7BCF5' },  // vira-purple
  industry: { label: 'Industry', color: '#F9A826' }, // energetic-amber
  achievement: { label: 'Achievement', color: '#8A8F9E' }, // slate-gray
  common: { label: 'Common', color: '#2C2C2C' }     // slate-gray
};

// Define type for xyz_scores to avoid empty object type error
interface XYZScores {
  action?: number;
  metrics?: number;
  clarity?: number;
  industry?: number;
  achievement?: number;
}

// Function to prepare chart data from bullet analysis
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  if (!bullet) {
    console.error("Received null or undefined bullet data");
    return {
      dataWithPercent: [],
      bullet_total: 0,
      distributionData: []
    };
  }

  // Use existing calculated percentages from the bullet with proper type
  const xyz_scores: XYZScores = bullet.xyz_scores || {};
  
  // Calculate the total score by summing up all the actual values
  const bullet_total = (xyz_scores.action || 0) +
                      (xyz_scores.metrics || 0) +
                      (xyz_scores.clarity || 0) +
                      (xyz_scores.industry || 0) +
                      (xyz_scores.achievement || 0);
  
  // Format the data for the charts
  const dataWithPercent = [
    {
      name: 'Action Words',
      value: xyz_scores.action || 0,
      fill: BULLET_CATEGORIES.action.color,
      category: 'action',
      target: 10,
      percent: (xyz_scores.action || 0)
    },
    {
      name: 'Metrics/Results',
      value: xyz_scores.metrics || 0,
      fill: BULLET_CATEGORIES.metrics.color,
      category: 'metrics',
      target: 30,
      percent: (xyz_scores.metrics || 0)
    },
    {
      name: 'Clarity/Conciseness',
      value: xyz_scores.clarity || 0,
      fill: BULLET_CATEGORIES.clarity.color,
      category: 'clarity',
      target: 15,
      percent: (xyz_scores.clarity || 0)
    },
    {
      name: 'Industry Keywords',
      value: xyz_scores.industry || 0,
      fill: BULLET_CATEGORIES.industry.color,
      category: 'industry',
      target: 25,
      percent: (xyz_scores.industry || 0)
    },
    {
      name: 'Achievement Focus',
      value: xyz_scores.achievement || 0,
      fill: BULLET_CATEGORIES.achievement.color,
      category: 'achievement',
      target: 20,
      percent: (xyz_scores.achievement || 0)
    }
  ];

  // Return the chart data
  return {
    dataWithPercent,
    bullet_total,
    distributionData: [
      { name: 'Action', value: xyz_scores.action || 0 },
      { name: 'Metrics', value: xyz_scores.metrics || 0 },
      { name: 'Clarity', value: xyz_scores.clarity || 0 },
      { name: 'Industry', value: xyz_scores.industry || 0 },
      { name: 'Achievement', value: xyz_scores.achievement || 0 }
    ]
  };
};
