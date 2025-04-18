
import { BulletAnalysis } from '@/components/assistants/types';

// Define categories for consistent use across components
export const BULLET_CATEGORIES = {
  HARD_SOFT: 'hard_soft',
  ACTION: 'action',
  MEASURABLE: 'measurable',
  COMMON: 'common'
};

// Helper function to prepare chart data
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  if (!bullet) {
    console.error("Received null or undefined bullet data");
    // Return default safe values to prevent crashes
    return {
      dataWithPercent: [],
      bullet_total: 0,
      xyz_scores: { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
      word_balance: { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
      totalScore: 0
    };
  }
  
  // Add fallback for when bullet properties are undefined
  const {
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    bullet_total = 0,
    xyz_scores = { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
  } = bullet || {};

  // Format data for the chart with colors matching the brand theme
  const data = [
    {
      name: 'Skills',
      value: xyz_scores.hard_soft || 0,
      fill: 'var(--color-hard-soft)',
      category: BULLET_CATEGORIES.HARD_SOFT,
      target: 35,
      percent: 0
    },
    {
      name: 'Action Verbs',
      value: xyz_scores.action_words || 0,
      fill: 'var(--color-action)',
      category: BULLET_CATEGORIES.ACTION,
      target: 15,
      percent: 0
    },
    {
      name: 'Measurable Impact',
      value: xyz_scores.measurable_results || 0,
      fill: 'var(--color-measurable)',
      category: BULLET_CATEGORIES.MEASURABLE,
      target: 15,
      percent: 0
    },
    {
      name: 'Common Words',
      value: xyz_scores.clarity_focus || 0,
      fill: 'var(--color-common)',
      category: BULLET_CATEGORIES.COMMON,
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
