
import { useMemo } from 'react';
import { BulletAnalysis } from '@/components/assistants/types';

// Define bullet categories with proper structure
export const BULLET_CATEGORIES = {
  xyz_scores: {
    action: { label: 'Action', color: '#1F75FE', maxValue: 10 },    // insight-blue
    metrics: { label: 'Metrics', color: '#5ED3B5', maxValue: 30 },  // aqua-teal
    clarity: { label: 'Clarity', color: '#C7BCF5', maxValue: 15 },  // vira-purple
    industry: { label: 'Industry', color: '#F9A826', maxValue: 25 }, // energetic-amber
    achievement: { label: 'Achievement', color: '#8A8F9E', maxValue: 20 }, // slate-gray
  },
  word_balance: { label: 'Word Balance', color: '#2C2C2C' },     // slate-gray
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
      word_balance_score: 0,
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
  
  // Calculate word balance score (you can adjust this logic as needed)
  const word_balance_score = bullet.word_balance_score || 0;
  
  // Format the data for the charts
  const dataWithPercent = [
    {
      name: 'Action Words',
      value: xyz_scores.action || 0,
      fill: BULLET_CATEGORIES.xyz_scores.action.color,
      category: 'action',
      target: BULLET_CATEGORIES.xyz_scores.action.maxValue,
      percent: (xyz_scores.action || 0)
    },
    {
      name: 'Metrics/Results',
      value: xyz_scores.metrics || 0,
      fill: BULLET_CATEGORIES.xyz_scores.metrics.color,
      category: 'metrics',
      target: BULLET_CATEGORIES.xyz_scores.metrics.maxValue,
      percent: (xyz_scores.metrics || 0)
    },
    {
      name: 'Clarity/Conciseness',
      value: xyz_scores.clarity || 0,
      fill: BULLET_CATEGORIES.xyz_scores.clarity.color,
      category: 'clarity',
      target: BULLET_CATEGORIES.xyz_scores.clarity.maxValue,
      percent: (xyz_scores.clarity || 0)
    },
    {
      name: 'Industry Keywords',
      value: xyz_scores.industry || 0,
      fill: BULLET_CATEGORIES.xyz_scores.industry.color,
      category: 'industry',
      target: BULLET_CATEGORIES.xyz_scores.industry.maxValue,
      percent: (xyz_scores.industry || 0)
    },
    {
      name: 'Achievement Focus',
      value: xyz_scores.achievement || 0,
      fill: BULLET_CATEGORIES.xyz_scores.achievement.color,
      category: 'achievement',
      target: BULLET_CATEGORIES.xyz_scores.achievement.maxValue,
      percent: (xyz_scores.achievement || 0)
    }
  ];

  // Return the chart data
  return {
    dataWithPercent,
    bullet_total,
    word_balance_score,
    distributionData: [
      { name: 'Action', value: xyz_scores.action || 0 },
      { name: 'Metrics', value: xyz_scores.metrics || 0 },
      { name: 'Clarity', value: xyz_scores.clarity || 0 },
      { name: 'Industry', value: xyz_scores.industry || 0 },
      { name: 'Achievement', value: xyz_scores.achievement || 0 }
    ]
  };
};

// Export a hook to memoize the chart data preparation
export const useBulletChartData = (bullet: BulletAnalysis) => {
  return useMemo(() => prepareBulletChartData(bullet), [bullet]);
};
