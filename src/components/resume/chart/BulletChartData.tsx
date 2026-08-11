import { useMemo } from 'react';
import { BulletAnalysis } from '@/components/assistants/types';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BULLET_CATEGORIES');

// Define bullet categories — colors from the Soft Studio palette.
// Labels are logic keys consumed by BulletTextParser; recolor only, never rename.
// Any color change here must be mirrored in chart/ChartComponents.tsx class maps.
export const BULLET_CATEGORIES = {
  action: { label: 'Action', color: 'hsl(var(--ss-peach-deep))' },      // ss-peach-deep
  metrics: { label: 'Metrics', color: 'hsl(var(--ss-teal))' },    // ss-teal
  clarity: { label: 'Clarity', color: 'hsl(var(--ss-lav))' },    // ss-lav
  industry: { label: 'Industry', color: 'hsl(var(--ss-lav-deep))' },  // ss-lav-deep
  achievement: { label: 'Achievement', color: 'hsl(var(--ss-good))' }, // ss-good
  common: { label: 'Common', color: 'hsl(var(--muted-foreground))' }       // ss-muted
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
    logger.error("Received null or undefined bullet data");
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

// Export a hook to memoize the chart data preparation
export const useBulletChartData = (bullet: BulletAnalysis) => {
  return useMemo(() => prepareBulletChartData(bullet), [bullet]);
};
