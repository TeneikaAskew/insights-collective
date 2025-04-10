import { industryWords, actionWords } from "./industry-data.ts";

// Analyze word balance in a bullet point
export function analyzeWordBalance(bullet: string): {
  industry_pct: number;
  common_pct: number;
  action_pct: number;
  metric_pct: number;
  word_balance_score: number;
} {
  // Simple word classification - in production would use NLP or a more sophisticated approach
  const words = bullet.split(/\s+/);
  
  let industryCount = 0;
  let commonCount = 0;
  let actionCount = 0;
  let metricCount = 0;
  
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // Check if word contains numbers (metrics)
    if (/\d/.test(cleanWord) || /%|\$/.test(cleanWord)) {
      metricCount++;
    }
    // Check if word is an action word
    else if (actionWords.includes(cleanWord)) {
      actionCount++;
    }
    // Check if word is an industry word
    else if (industryWords.includes(cleanWord)) {
      industryCount++;
    }
    // Otherwise it's a common word
    else {
      commonCount++;
    }
  }
  
  const totalWords = words.length;
  const industry_pct = Math.round((industryCount / totalWords) * 100);
  const common_pct = Math.round((commonCount / totalWords) * 100);
  const action_pct = Math.round((actionCount / totalWords) * 100);
  const metric_pct = Math.round((metricCount / totalWords) * 100);
  
  // Calculate word balance score
  // Ideal: Industry 45%, Common 25%, Action 15%, Metric 15%
  const idealIndustry = 45;
  const idealCommon = 25;
  const idealAction = 15;
  const idealMetric = 15;
  
  const industryDev = Math.abs(industry_pct - idealIndustry);
  const commonDev = Math.abs(common_pct - idealCommon);
  const actionDev = Math.abs(action_pct - idealAction);
  const metricDev = Math.abs(metric_pct - idealMetric);
  
  const totalDeviation = industryDev + commonDev + actionDev + metricDev;
  const word_balance_score = Math.max(0, 25 - totalDeviation);
  
  return {
    industry_pct,
    common_pct,
    action_pct,
    metric_pct,
    word_balance_score
  };
}
