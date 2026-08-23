
// console.log("Bullet Suggestions Endpoint hit")
import { actionWords } from './bulletAnalysis.ts';
import { improveBullet } from './bulletImprover.ts';
import { skillsKeywords } from './bulletAnalysis.ts';

// Rewrite bullet function using GROQ
export async function rewriteBullet(bullet: string, analysis: any): Promise<string> {
  console.log("Bullet Rewrite Endpoint hit")
  const startTime = Date.now();
  try {
    // Use the GROQ-based bullet improver
    console.log("Beginning rewrite of bullet points")
    const result = await improveBullet({
      original: bullet,
      xyz_scores: analysis.xyz_scores,
      word_balance_score: analysis.word_balance_score || 0,
      word_balance: analysis.word_balance || {
        industry_pct: 0,
        common_pct: 0,
        action_pct: 0,
        metric_pct: 0
      }
    });
    if (!result) {
      throw new Error("Empty result from improveBullet");
    }
    console.log("Bullet Rewrite Result:", result.rewritten);
    const endTime = Date.now();
    console.log(`[rewriteBullet]: Function completed in ${(endTime - startTime)/1000}s`);
    return result.rewritten;
  } catch (error) {
    console.error("Error using GROQ bullet improvement, falling back to basic rewrite:", error);
    // Fallback to simple rewriting logic
    return fallbackRewriteBullet(bullet, analysis);
  }
}

// Generate tips for improvement using GROQ
export async function generateTips(bullet: string, analysis: any): Promise<string> {
  console.log("Generate Tips Endpoint hit")
  const startTime = Date.now();
  try {
    // Use the GROQ-based bullet improver
    const result = await improveBullet({
      original: bullet,
      xyz_scores: analysis.xyz_scores,
      word_balance_score: analysis.word_balance_score || 0,
      word_balance: analysis.word_balance || {
        industry_pct: 0,
        common_pct: 0,
        action_pct: 0,
        metric_pct: 0
      }
    });
    if (!result) {
      throw new Error("Empty result from improveBullet");
    }
    console.log("Generate Tips Result:", result.tips);
    const endTime = Date.now();
    console.log(`[generateTips]: Function completed in ${(endTime - startTime)/1000}s`);
    return result.tips;
  } catch (error) {
    console.error("Error using GROQ tips generation, falling back to basic tips:", error);
    // Fallback to simple tips logic
    return fallbackGenerateTips(analysis);
  }
}

// Fallback rewrite function if GROQ is unavailable
function fallbackRewriteBullet(bullet: string, analysis: any): string {
  console.log("Fallback Bullet Rewrite Endpoint hit")
  // Simple rewriting logic
  let rewritten = bullet;
  
  // If the bullet doesn't start with an action word, try to add one
  if (analysis.xyz_scores.action_words < 5) {
    const strongActionWords = ["Developed", "Implemented", "Delivered", "Achieved", "Improved", 
                             "Spearheaded", "Led", "Pioneered", "Orchestrated", "Transformed"];
    const randomAction = strongActionWords[Math.floor(Math.random() * strongActionWords.length)];
    
    // Check if it already starts with an action word
    const startsWithAction = actionWords.some(word => 
      bullet.toLowerCase().startsWith(word.toLowerCase())
    );
    
    if (!startsWithAction) {
      rewritten = `${randomAction} ${rewritten.charAt(0).toLowerCase() + rewritten.slice(1)}`;
    } else {
      // Replace weak action word with stronger one
      const firstWord = bullet.split(' ')[0];
      rewritten = bullet.replace(firstWord, randomAction);
    }
  }
  
  // If there are no metrics, suggest adding them
  if (analysis.xyz_scores.measurable_results < 5) {
    const metrics = [
      "resulting in 15% improvement in efficiency",
      "increasing productivity by 20%",
      "generating $50K in additional revenue",
      "reducing costs by 30%",
      "saving 25 hours per week"
    ];
    const randomMetric = metrics[Math.floor(Math.random() * metrics.length)];
    
    // Only add if no percentage or dollar sign exists
    if (!rewritten.includes("%") && !rewritten.includes("$")) {
      rewritten += `, ${randomMetric}`;
    }
  }
  
  // If the bullet is too long, try to shorten it
  if (analysis.xyz_scores.clarity_focus < 5) {
    const words = rewritten.split(" ");
    if (words.length > 25) {
      rewritten = words.slice(0, 22).join(" ") + ".";
    }
  }
  
  // If lacking technical or leadership skills, try to incorporate them
  if (analysis.xyz_scores.hard_soft < 5) {
    const skills = skillsKeywords
      
    //   [
    //   "using advanced data analysis techniques",
    //   "leveraging agile methodology",
    //   "through cross-functional leadership",
    //   "by implementing automated workflows",
    //   "utilizing cloud infrastructure"
    // ];
    
    const randomSkill = skills[Math.floor(Math.random() * skills.length)];
    
    if (!rewritten.includes("using") && !rewritten.includes("leveraging") && !rewritten.includes("implementing")) {
      // Add before any metric if one exists
      if (rewritten.includes("resulting in") || rewritten.includes("increasing") || rewritten.includes("reducing")) {
        const parts = rewritten.split(/resulting in|increasing|reducing/);
        rewritten = `${parts[0]} ${randomSkill} ${rewritten.substring(parts[0].length)}`;
      } else {
        rewritten += ` ${randomSkill}`;
      }
    }
  }
  
  return rewritten;
}

// Fallback tips generation if GROQ is unavailable
function fallbackGenerateTips(analysis: any): string {
  console.log("Fallback Generate Tips Endpoint hit")
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
  console.log("Generate Themes Endpoint hit")
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
    // Branding & Positioning
    "Open with a sharp professional summary that clearly states your unique value proposition",
    "Tailor every section to the specific job description instead of using a one‑size‑fits‑all resume",
    "Highlight a consistent personal brand across your resume, LinkedIn profile, and portfolio",
  
    // Impact & Metrics
    "Quantify results wherever possible—use numbers, percentages, or dollar figures to prove impact",
    "Translate technical accomplishments into business outcomes that executives will understand",
    "Show progression: illustrate how each role built on the last in scope, scale, or complexity",
  
    // Storytelling & Structure
    "Group bullets by theme (e.g., Growth, Efficiency, Leadership) to create a clear narrative arc",
    "Lead every bullet with a powerful action verb and follow the 'challenge‑action‑result' structure",
    "Remove redundant or outdated experience that doesn't serve your current career goals",
  
    // ATS & Keyword Optimization
    "Mirror critical keywords from the job posting to pass Applicant Tracking Systems (ATS)",
    "Spell out acronyms on first use so both humans and ATS parsers recognize them",
    "Use consistent formatting (dates, headings, bullet style) to prevent ATS parsing errors",
  
    // Design & Readability
    "Keep the resume to one or two pages—recruiters spend <10 seconds on the first pass",
    "Use whitespace, bolding, and section headers strategically to guide the reader's eye",
    "Avoid dense blocks of text; aim for 2–3 lines per bullet and plenty of white space",
  
    // Leadership & Soft Skills
    "Demonstrate leadership and cross‑functional collaboration, not just individual contribution",
    "Incorporate soft‑skill wins (mentoring, stakeholder management) alongside technical feats",
  
    // Modern Extras
    "Link to relevant work samples, GitHub repos, or a personal website to showcase proof of skill",
    "Add a concise 'Key Technologies' or 'Core Competencies' section for quick scanning"
  ];

  while (themes.length < 3) {
    const newTheme = generalThemes.shift();
    if (newTheme) themes.push(newTheme);
    else break;
  }
  
  return themes;
}