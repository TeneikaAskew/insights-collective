
import { BulletAnalysis } from '@/components/assistants/types';

// Prepare data for the bullet chart visualization
export const prepareBulletChartData = (bullet: BulletAnalysis) => {
  // Make sure bullet data is not null or undefined
  if (!bullet) {
    console.warn("Received null or undefined bullet for chart data preparation");
    // Return default values to prevent rendering errors
    return {
      dataWithPercent: [],
      bullet_total: 0
    };
  }
  
  // Safely extract scores with fallbacks
  const xyz_scores = bullet.xyz_scores || { 
    hard_soft: 0, 
    action_words: 0, 
    measurable_results: 0, 
    clarity_focus: 0 
  };
  
  const word_balance_score = bullet.word_balance_score || 0;
  const bullet_total = bullet.bullet_total || 0;
  
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
      value: xyz_scores.hard_soft || 0,
      fill: themeColors.hardSoft,
      target: 25,
      percent: Math.round(((xyz_scores.hard_soft || 0) / 5) * 100)
    },
    {
      name: "Action Words",
      value: xyz_scores.action_words || 0,
      fill: themeColors.actionWords,
      target: 25,
      percent: Math.round(((xyz_scores.action_words || 0) / 5) * 100)
    },
    {
      name: "Measurable Results",
      value: xyz_scores.measurable_results || 0,
      fill: themeColors.measurableResults,
      target: 25,
      percent: Math.round(((xyz_scores.measurable_results || 0) / 5) * 100)
    },
    {
      name: "Word Balance",
      value: word_balance_score || 0,
      fill: themeColors.wordBalance,
      target: 25,
      percent: Math.round(((word_balance_score || 0) / 25) * 100)
    }
  ];
  
  return { 
    dataWithPercent,
    bullet_total
  };
};
