
// Rewrite bullet function
export function rewriteBullet(bullet: string, analysis: any): string {
  // In a real application, this would be done with a more sophisticated NLP approach
  // This is a simplified version for demonstration purposes
  
  // Simple rewriting logic
  let rewritten = bullet;
  
  // If the bullet doesn't start with an action word, try to add one
  if (analysis.xyz_scores.action_words < 5) {
    const actionWords = ["Developed", "Implemented", "Delivered", "Achieved", "Improved"];
    const randomAction = actionWords[Math.floor(Math.random() * actionWords.length)];
    rewritten = `${randomAction} ${rewritten.charAt(0).toLowerCase() + rewritten.slice(1)}`;
  }
  
  // If there are no metrics, suggest adding them
  if (analysis.xyz_scores.measurable_results < 5 && !rewritten.includes("%")) {
    rewritten += " resulting in 15% improvement in efficiency";
  }
  
  // If the bullet is too long, try to shorten it
  if (analysis.xyz_scores.clarity_focus < 5) {
    rewritten = rewritten.split(" ").slice(0, 22).join(" ") + ".";
  }
  
  return rewritten;
}

// Generate tips for improvement
export function generateTips(bullet: string, analysis: any): string {
  let tips = "";
  
  if (analysis.xyz_scores.hard_soft < 5) {
    tips += "Add more specific technical skills or leadership traits. ";
  }
  
  if (analysis.xyz_scores.action_words < 5) {
    tips += "Start with a stronger action verb and avoid passive language. ";
  }
  
  if (analysis.xyz_scores.measurable_results < 5) {
    tips += "Include quantifiable results (%, $, or other metrics). ";
  }
  
  if (analysis.xyz_scores.clarity_focus < 5) {
    tips += "Make this more concise, aiming for 25 words or fewer. ";
  }
  
  if (analysis.word_balance_score < 15) {
    tips += "Balance your word choice to include industry terms, metrics, and action words. ";
  }
  
  return tips || "Strong bullet point! Consider adding more specificity if possible.";
}

// Generate improvement themes
export function generateThemes(bullets: any[]): string[] {
  let weakActionWords = 0;
  let weakMeasurableResults = 0;
  let weakClarity = 0;
  
  bullets.forEach(bullet => {
    if (bullet.xyz_scores.action_words < 3) weakActionWords++;
    if (bullet.xyz_scores.measurable_results < 3) weakMeasurableResults++;
    if (bullet.xyz_scores.clarity_focus < 3) weakClarity++;
  });
  
  const themes = [];
  
  if (weakActionWords > bullets.length / 3) {
    themes.push("Start each bullet with strong action verbs and avoid passive language");
  }
  
  if (weakMeasurableResults > bullets.length / 3) {
    themes.push("Include more quantifiable results and metrics throughout your resume");
  }
  
  if (weakClarity > bullets.length / 3) {
    themes.push("Focus on conciseness and clarity, aiming for 20-25 words per bullet");
  }
  
  // If we don't have enough themes, add some general ones
  const generalThemes = [
    "Include more industry-specific keywords relevant to your target role",
    "Focus on achievements rather than responsibilities",
    "Ensure a balanced mix of technical skills and soft skills"
  ];
  
  while (themes.length < 3) {
    const newTheme = generalThemes.shift();
    if (newTheme) themes.push(newTheme);
    else break;
  }
  
  return themes;
}
