
import { BulletAnalysis } from '@/components/assistants/types';

// Prepare data for the bullet chart visualization
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  console.log("prepareBulletChartData - Processing bullet:", bullet);
  
  // Add unique timestamp to prevent caching issues
  const timestamp = Date.now();
  
  if (!bullet) {
    console.error("prepareBulletChartData - Received undefined bullet");
    return { 
      dataWithPercent: [],
      bullet_total: 0
    };
  }
  
  const { xyz_scores, word_balance_score, bullet_total } = bullet;
  
  // Add default values to prevent undefined errors
  const safeXYZScores = xyz_scores || { 
    hard_soft: 0, 
    action_words: 0, 
    measurable_results: 0, 
    clarity_focus: 0 
  };
  
  // Calculate XYZ total score
  const xyzTotal = (safeXYZScores.hard_soft || 0) + 
                  (safeXYZScores.action_words || 0) + 
                  (safeXYZScores.measurable_results || 0) + 
                  (safeXYZScores.clarity_focus || 0);
  
  // Theme colors
  const themeColors = {
    hardSoft: "#8B5CF6",     // Vivid Purple
    actionWords: "#F97316",  // Bright Orange
    measurableResults: "#0EA5E9", // Ocean Blue 
    wordBalance: "#D946EF"   // Magenta Pink
  };
  
  // Prepare data for chart with percentages
  const dataWithPercent = [
    {
      name: "Hard & Soft Skills",
      value: safeXYZScores.hard_soft || 0,
      fill: themeColors.hardSoft,
      target: 25,
      percent: Math.round(((safeXYZScores.hard_soft || 0) / 5) * 100),
      key: `hard-soft-${timestamp}`
    },
    {
      name: "Action Words",
      value: safeXYZScores.action_words || 0,
      fill: themeColors.actionWords,
      target: 25,
      percent: Math.round(((safeXYZScores.action_words || 0) / 5) * 100),
      key: `action-words-${timestamp}`
    },
    {
      name: "Measurable Results",
      value: safeXYZScores.measurable_results || 0,
      fill: themeColors.measurableResults,
      target: 25,
      percent: Math.round(((safeXYZScores.measurable_results || 0) / 5) * 100),
      key: `measurable-results-${timestamp}`
    },
    {
      name: "Word Balance",
      value: word_balance_score || 0,
      fill: themeColors.wordBalance,
      target: 25,
      percent: Math.round(((word_balance_score || 0) / 25) * 100),
      key: `word-balance-${timestamp}`
    }
  ];
  
  console.log("prepareBulletChartData - Prepared data:", { dataWithPercent, bullet_total });
  
  return { 
    dataWithPercent,
    bullet_total: bullet_total || 0
  };
};
