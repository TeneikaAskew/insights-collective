
import { BulletAnalysis } from '@/components/assistants/types';

// Define categories consistent with the current keys used in bullet analysis
export const BULLET_CATEGORIES = {
  ACTION: 'action',
  METRICS: 'metrics',
  CLARITY: 'clarity',
  INDUSTRY: 'industry',
  ACHIEVEMENT: 'achievement'
};

// Prepare bullet chart data with safety fallback
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  if (!bullet) {
    console.error("Received null or undefined bullet data");
    return {
      dataWithPercent: [],
      bullet_total: 0,
      xyz_scores: { action: 0, metrics: 0, clarity: 0, industry: 0, achievement: 0 },
      totalScore: 0
    };
  }

  const {
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    bullet_total = 0,
    xyz_scores = { action: 0, metrics: 0, clarity: 0, industry: 0, achievement: 0 }
  } = bullet;

  const data = [
    {
      name: 'Action Words',
      value: xyz_scores.action || 0,
      fill: '#D97706',
      category: BULLET_CATEGORIES.ACTION,
      target: 10,
      percent: 0
    },
    {
      name: 'Metrics/Results',
      value: xyz_scores.metrics || 0,
      fill: '#0D9488',
      category: BULLET_CATEGORIES.METRICS,
      target: 30,
      percent: 0
    },
    {
      name: 'Clarity/Conciseness',
      value: xyz_scores.clarity || 0,
      fill: '#2563EB',
      category: BULLET_CATEGORIES.CLARITY,
      target: 15,
      percent: 0
    },
    {
      name: 'Industry Keywords',
      value: xyz_scores.industry || 0,
      fill: '#1E40AF',
      category: BULLET_CATEGORIES.INDUSTRY,
      target: 25,
      percent: 0
    },
    {
      name: 'Achievement Focus',
      value: xyz_scores.achievement || 0,
      fill: '#059669',
      category: BULLET_CATEGORIES.ACHIEVEMENT,
      target: 20,
      percent: 0
    }
  ];

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

