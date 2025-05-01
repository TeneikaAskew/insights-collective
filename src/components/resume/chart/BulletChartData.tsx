
import { BulletAnalysis } from '@/components/assistants/types';

// Define bullet categories
export const BULLET_CATEGORIES = {
  action: { label: 'Action', color: '#3498db' },
  metrics: { label: 'Metrics', color: '#2ecc71' },
  clarity: { label: 'Clarity', color: '#9b59b6' },
  industry: { label: 'Industry', color: '#e67e22' },
  achievement: { label: 'Achievement', color: '#f1c40f' },
  common: { label: 'Common', color: '#95a5a6' } // Adding common category that was missing
};

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

  // Use existing calculated percentages from the bullet
  const { xyz_scores = {}, bullet_total = 0 } = bullet;
  
  // Format the data for the charts
  const dataWithPercent = [
    {
      name: 'Action Words',
      value: xyz_scores.action || 0,
      fill: BULLET_CATEGORIES.action.color,
      category: 'action',
      target: 10,
      percent: xyz_scores.action || 0
    },
    {
      name: 'Metrics/Results',
      value: xyz_scores.metrics || 0,
      fill: BULLET_CATEGORIES.metrics.color,
      category: 'metrics',
      target: 30,
      percent: xyz_scores.metrics || 0
    },
    {
      name: 'Clarity/Conciseness',
      value: xyz_scores.clarity || 0,
      fill: BULLET_CATEGORIES.clarity.color,
      category: 'clarity',
      target: 15,
      percent: xyz_scores.clarity || 0
    },
    {
      name: 'Industry Keywords',
      value: xyz_scores.industry || 0,
      fill: BULLET_CATEGORIES.industry.color,
      category: 'industry',
      target: 25,
      percent: xyz_scores.industry || 0
    },
    {
      name: 'Achievement Focus',
      value: xyz_scores.achievement || 0,
      fill: BULLET_CATEGORIES.achievement.color,
      category: 'achievement',
      target: 20,
      percent: xyz_scores.achievement || 0
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
