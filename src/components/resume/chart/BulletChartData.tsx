
import { BulletAnalysis } from '@/components/assistants/types';

// Helper function to prepare chart data
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  // Add fallback for when bullet properties are undefined
  const {
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    bullet_total = 0,
    xyz_scores = { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
  } = bullet || {};

  // Format data for the chart with colors matching the theme
  const data = [
    {
      name: 'Hard & Soft Skills',
      value: xyz_scores.hard_soft || 0,
      fill: '#9b87f5', // Primary Purple from theme
      target: 35,
      percent: 0
    },
    {
      name: 'Action Words',
      value: xyz_scores.action_words || 0,
      fill: '#F97316', // Bright Orange from theme
      target: 15,
      percent: 0
    },
    {
      name: 'Measurable Results',
      value: xyz_scores.measurable_results || 0,
      fill: '#0EA5E9', // Ocean Blue from theme
      target: 15,
      percent: 0
    },
    {
      name: 'Common Words',
      value: xyz_scores.clarity_focus || 0,
      fill: '#8E9196', // Neutral Gray from theme
      target: 35,
      percent: 0
    }
  ];

  // Calculate actual percentages (with safety check to avoid division by zero)
  const totalScore = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercent = data.map(item => ({
    ...item,
    percent: Math.round(item.value / (totalScore || 1) * 100)
  }));

  return {
    dataWithPercent,
    bullet_total,
    xyz_scores,
    word_balance,
    totalScore
  };
};
