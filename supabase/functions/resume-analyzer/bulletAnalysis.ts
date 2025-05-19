
// List of common industry action words
export const actionWords = [
  'achieved', 'administered', 'analyzed', 'assisted', 'built', 'collaborated',
  'conducted', 'coordinated', 'created', 'defined', 'delivered', 'demonstrated',
  'designed', 'developed', 'directed', 'established', 'executed', 'generated',
  'identified', 'implemented', 'improved', 'increased', 'initiated', 'led',
  'maintained', 'managed', 'monitored', 'organized', 'oversaw', 'performed',
  'planned', 'prepared', 'presented', 'produced', 'provided', 'reduced',
  'responsible', 'reviewed', 'scheduled', 'strengthened', 'supervised', 'supported',
  'tested', 'trained', 'transformed', 'utilized', 'won'
];

// Common industry terms and metrics
const industryTerms = [
  'agile', 'automation', 'blockchain', 'budget', 'business', 'cloud', 'compliance',
  'conversion', 'cost', 'customer', 'data', 'database', 'deadline', 'deployment',
  'design', 'develop', 'digital', 'efficiency', 'engagement', 'engineering', 'framework',
  'implementation', 'infrastructure', 'innovation', 'integration', 'iterative',
  'marketing', 'metrics', 'milestone', 'mobile', 'optimization', 'performance',
  'platform', 'process', 'product', 'productivity', 'proficiency', 'project',
  'quality', 'regulatory', 'requirements', 'revenue', 'sales', 'scalable',
  'security', 'service', 'software', 'solution', 'stakeholder', 'standard',
  'strategy', 'system', 'technical', 'technology', 'testing', 'user', 'workflow'
];

// Metrics/quantifiers list
const metricsList = [
  'percent', '%', 'million', 'thousand', 'hundred', 'k', 'm', 'b',
  'annually', 'monthly', 'weekly', 'daily', 'hours', 'days', 'weeks',
  'months', 'years', 'quarter', 'fiscal', 'roi', 'kpi', 'growth',
  'increase', 'decrease', 'reduce', 'improve', 'gain', 'save', 'cut',
  'revenue', 'profit', 'sales', 'cost', 'budget', 'leads', 'conversion'
];

// Common words to ignore in balance calculation
const commonWords = [
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
  'if', 'in', 'into', 'is', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me',
  'more', 'most', 'my', 'myself', 'nor', 'of', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you',
  'your', 'yours', 'yourself', 'yourselves'
];

// Analyze word balance of a single bullet point
export function analyzeWordBalance(text) {
  if (!text || typeof text !== 'string') {
    return {
      industry_pct: 0,
      action_pct: 0,
      common_pct: 0,
      metric_pct: 0,
      word_balance_score: 0,
    };
  }

  // Convert to lowercase and remove punctuation
  const cleanText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  
  // Split into words and remove empty strings
  const words = cleanText.split(' ').filter(word => word.length > 0);
  
  if (words.length === 0) {
    return {
      industry_pct: 0,
      action_pct: 0,
      common_pct: 0,
      metric_pct: 0,
      word_balance_score: 0,
    };
  }

  // Count occurrences of each word type
  const industryCount = words.filter(word => industryTerms.includes(word)).length;
  const actionCount = words.filter(word => actionWords.includes(word)).length;
  const commonCount = words.filter(word => commonWords.includes(word)).length;
  const metricCount = words.filter(word => {
    return metricsList.some(metric => word.includes(metric)) || /\d+/.test(word);
  }).length;
  
  // Calculate percentages
  const industry_pct = Math.round((industryCount / words.length) * 100);
  const action_pct = Math.round((actionCount / words.length) * 100);
  const common_pct = Math.round((commonCount / words.length) * 100);
  const metric_pct = Math.round((metricCount / words.length) * 100);
  
  // Calculate word balance score (0-25)
  // Ideal: ~25% industry terms, ~10% action words, ~10% metrics, <50% common words
  const industryScore = Math.min(12, industry_pct / 3); // Max 12 points for ~36% industry terms
  const actionScore = Math.min(5, action_pct / 3); // Max 5 points for ~15% action words
  const metricScore = Math.min(8, metric_pct * 0.8); // Max 8 points for ~10% metrics
  
  // Penalty for too many common words
  const commonPenalty = Math.max(0, Math.min(10, (common_pct - 40) / 5)); // Up to -10 points
  
  const word_balance_score = Math.max(0, Math.round(industryScore + actionScore + metricScore - commonPenalty));

  return {
    industry_pct,
    action_pct,
    common_pct,
    metric_pct,
    word_balance_score
  };
}

// XYZ Method check: You did X (action) for Y (context) resulting in Z (result)
export function xyzCheck(text) {
  if (!text || typeof text !== 'string') {
    return { 
      action: 0,
      metrics: 0, 
      clarity: 0,
      industry: 0,
      achievement: 0,
      xyz_total: 0
    };
  }

  // Convert to lowercase for analysis
  const lowerText = text.toLowerCase();
  
  // Action score (X component) - does it start with a strong action verb?
  let actionScore = 0;
  const firstWord = lowerText.split(' ')[0].replace(/[^\w]/, '');
  if (actionWords.includes(firstWord)) {
    actionScore = 10; // Full credit for starting with an action word
  } else if (actionWords.some(w => lowerText.split(' ').slice(0, 3).includes(w))) {
    actionScore = 7; // Partial credit for action word in first few words
  } else if (actionWords.some(w => lowerText.includes(w))) {
    actionScore = 5; // Minimal credit for having an action word anywhere
  }
  
  // Metrics score (Z component) - are there specific numbers or metrics?
  let metricsScore = 0;
  // Check for numbers
  const hasNumbers = /\d+/.test(lowerText);
  // Check for percentages
  const hasPercentages = /%|\bpercent\b|\bpercentage\b/.test(lowerText);
  // Check for other metrics terms
  const hasMetricTerms = metricsList.some(term => lowerText.includes(term));
  
  if (hasNumbers && (hasPercentages || hasMetricTerms)) {
    metricsScore = 30; // Full credit for specific quantifiable results with metrics
  } else if (hasNumbers) {
    metricsScore = 20; // Partial credit for having any numbers
  } else if (hasMetricTerms) {
    metricsScore = 10; // Minimal credit for mentioning metrics without specifics
  }
  
  // Clarity score - is it concise and clear?
  const words = lowerText.split(' ').filter(w => w.length > 0);
  let clarityScore = 0;
  if (words.length >= 7 && words.length <= 20) {
    clarityScore = 15; // Good length for a bullet point
  } else if (words.length < 7) {
    clarityScore = Math.max(0, words.length); // Too short
  } else {
    clarityScore = Math.max(0, 25 - (words.length - 20) / 2); // Too long
  }
  
  // Industry relevance score - does it use industry terms?
  const industryTermsCount = industryTerms.filter(term => lowerText.includes(term)).length;
  const industryScore = Math.min(25, industryTermsCount * 5);
  
  // Achievement score - does it show accomplishment or result?
  let achievementScore = 0;
  const resultTerms = ['resulting in', 'achieved', 'improved', 'increased', 'reduced', 
                       'generated', 'delivered', 'produced', 'succeeded', 'won'];
  
  if (resultTerms.some(term => lowerText.includes(term))) {
    achievementScore = 20;
  } else if (lowerText.includes('result')) {
    achievementScore = 15;
  } else if (metricsScore > 0) {
    achievementScore = 10; // Having metrics implies some achievement
  }
  
  // Calculate total XYZ score (0-100 scale)
  const xyzTotal = actionScore + metricsScore + clarityScore + industryScore + achievementScore;
  
  return {
    action: actionScore,
    metrics: metricsScore,
    clarity: clarityScore,
    industry: industryScore,
    achievement: achievementScore,
    xyz_total: Math.min(100, xyzTotal)
  };
}
