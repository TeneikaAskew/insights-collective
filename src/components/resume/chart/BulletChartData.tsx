
import { BulletAnalysis } from '@/components/assistants/types';

// Define bullet categories
export const BULLET_CATEGORIES = {
  action: { label: 'Action', color: '#3498db' },
  metrics: { label: 'Metrics', color: '#2ecc71' },
  clarity: { label: 'Clarity', color: '#9b59b6' },
  industry: { label: 'Industry', color: '#e67e22' },
  achievement: { label: 'Achievement', color: '#f1c40f' }
};

// Function to prepare chart data from bullet analysis
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  // Use existing calculated percentages from the bullet
  const { xyz_scores = {} } = bullet;
  
  // Format the data for the charts
  const donutChartData = Object.entries(xyz_scores).map(([key, value]) => {
    const category = key as keyof typeof BULLET_CATEGORIES;
    return {
      name: BULLET_CATEGORIES[category]?.label || key,
      value: value || 0,
      color: BULLET_CATEGORIES[category]?.color || '#cccccc'
    };
  });

  // Return the chart data
  return {
    donutChartData,
    distributionData: [
      { name: 'Action', value: xyz_scores.action || 0 },
      { name: 'Metrics', value: xyz_scores.metrics || 0 },
      { name: 'Clarity', value: xyz_scores.clarity || 0 },
      { name: 'Industry', value: xyz_scores.industry || 0 },
      { name: 'Achievement', value: xyz_scores.achievement || 0 }
    ]
  };
};
