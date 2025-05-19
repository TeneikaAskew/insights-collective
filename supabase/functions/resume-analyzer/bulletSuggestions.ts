
// Generate themes based on bullet analysis
export function generateThemes(analyzedBullets) {
  if (!analyzedBullets || !Array.isArray(analyzedBullets) || analyzedBullets.length === 0) {
    return ['Enhance your resume with more detail'];
  }

  // Default themes for various situations
  const defaultThemes = [
    'Add more quantifiable achievements',
    'Start each bullet with a strong action verb',
    'Focus on results and impact',
    'Be more specific about your contributions',
    'Use industry-relevant keywords'
  ];

  // Sort bullets by score (lowest first)
  const sortedBullets = [...analyzedBullets].sort((a, b) => a.bullet_total - b.bullet_total);
  
  // Get common issues from the lowest-scoring bullets
  const lowBullets = sortedBullets.slice(0, Math.min(3, sortedBullets.length));
  
  const themesSuggestions = [];
  
  // Check for common issues
  let hasMetricIssues = false;
  let hasActionVerbIssues = false;
  let hasLengthIssues = false;
  let hasStructureIssues = false;
  
  for (const bullet of lowBullets) {
    // Missing metrics or quantifiable results
    if (bullet.xyz_scores?.metrics < 10) {
      hasMetricIssues = true;
    }
    
    // Missing strong action verbs at start
    if (bullet.xyz_scores?.action < 7) {
      hasActionVerbIssues = true;
    }
    
    // Issues with bullet length
    if (bullet.xyz_scores?.clarity < 7) {
      hasLengthIssues = true;
    }
    
    // Look for bullets missing action-result structure
    if (bullet.xyz_scores?.achievement < 10) {
      hasStructureIssues = true;
    }
  }
  
  // Add specific themes based on detected issues
  if (hasMetricIssues) {
    themesSuggestions.push('Add metrics and quantifiable results to your achievements');
  }
  
  if (hasActionVerbIssues) {
    themesSuggestions.push('Start each bullet with a strong action verb');
  }
  
  if (hasLengthIssues) {
    themesSuggestions.push('Keep bullet points concise (10-15 words) but informative');
  }
  
  if (hasStructureIssues) {
    themesSuggestions.push('Structure bullets using the Action-Context-Result format');
  }
  
  // Add generic improvement themes based on overall score patterns
  const avgScore = analyzedBullets.reduce((sum, b) => sum + b.bullet_total, 0) / analyzedBullets.length;
  
  if (avgScore < 40) {
    themesSuggestions.push('Completely restructure your bullet points to focus on achievements');
    themesSuggestions.push('Use industry-specific terminology relevant to target roles');
  } else if (avgScore < 60) {
    themesSuggestions.push('Emphasize your direct contributions and specific skills');
  }
  
  // If we didn't find many specific themes, add some default ones
  if (themesSuggestions.length < 3) {
    // Add default themes until we have at least 3
    for (const theme of defaultThemes) {
      if (!themesSuggestions.includes(theme)) {
        themesSuggestions.push(theme);
        if (themesSuggestions.length >= 3) break;
      }
    }
  }
  
  return themesSuggestions.slice(0, 5); // Return at most 5 themes
}
