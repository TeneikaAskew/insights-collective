import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to extract bullet points from resume text
function extractBulletPoints(text: string): string[] {
  // Match lines that begin with bullet symbols (•, –, —, -, *) followed by whitespace
  const bulletRegex = /^[\s]*[•\-–—*][\s]+(.*)/gm;
  const matches = [...text.matchAll(bulletRegex)];
  return matches.map(match => match[1].trim());
}

// Analyze word balance
function analyzeWordBalance(bullet: string): {
  industry_pct: number;
  common_pct: number;
  action_pct: number;
  metric_pct: number;
  word_balance_score: number;
} {
  // Simple word classification - in production would use NLP or a more sophisticated approach
  const words = bullet.split(/\s+/);
  
  // Action words list (simplified version)
  const actionWords = [
    "achieved", "delivered", "improved", "increased", "reduced", "developed", "created", 
    "managed", "led", "built", "designed", "implemented", "transformed", "spearheaded", 
    "drove", "executed", "launched", "initiated", "generated", "optimized", "streamlined"
  ];
  
  // Industry words (simplified - would be more comprehensive in production)
  const industryWords = [
    "data", "analysis", "analytics", "python", "sql", "tableau", "powerbi", "excel",
    "database", "algorithms", "machine", "learning", "ai", "visualization", "dashboard",
    "kpi", "metrics", "statistics", "engineering", "etl", "cloud", "aws", "azure", 
    "pipeline", "hadoop", "spark", "agile", "scrum", "software", "development", "api"
  ];
  
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

// XYZ ATS Quality Check
function xyzCheck(bullet: string): {
  hard_soft: number;
  action_words: number;
  measurable_results: number;
  clarity_focus: number;
  xyz_total: number;
} {
  // 1. Hard & Soft Skills check
  const skillsKeywords = ["managed", "led", "developed", "created", "analyzed", "designed", "implemented"];
  const hasSkills = skillsKeywords.some(keyword => bullet.toLowerCase().includes(keyword));
  const hard_soft = hasSkills ? 5 : 0;
  
  // 2. Action Words check
  const startsWithAction = /^(Achieved|Improved|Increased|Reduced|Developed|Created|Managed|Led|Built|Designed|Implemented)/i.test(bullet);
  const noWeakPhrasing = !/(responsible for|duties include|helped with)/i.test(bullet);
  const action_words = (startsWithAction && noWeakPhrasing) ? 5 : (startsWithAction || noWeakPhrasing ? 3 : 0);
  
  // 3. Measurable Results check
  const hasNumbers = /\d+%|\d+x|\$\d+|\d+ percent|\d+k|\d+M|\d+B/i.test(bullet);
  const measurable_results = hasNumbers ? 5 : 0;
  
  // 4. Clarity & Focus check
  const wordCount = bullet.split(/\s+/).length;
  const isConcise = wordCount <= 25;
  const clarity_focus = isConcise ? 5 : (wordCount <= 30 ? 3 : 0);
  
  // Calculate total XYZ score
  const xyz_total = hard_soft + action_words + measurable_results + clarity_focus;
  
  return {
    hard_soft,
    action_words,
    measurable_results,
    clarity_focus,
    xyz_total
  };
}

// Rewrite bullet function
function rewriteBullet(bullet: string, analysis: any): string {
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
function generateTips(bullet: string, analysis: any): string {
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

// Generate letter grade based on percentage
function getLetterGrade(percentage: number): string {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}

// Generate improvement themes
function generateThemes(bullets: any[]): string[] {
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

// Generate elevator pitch
function generateElevatorPitch(bullets: any[]): string {
  // This is simplified and would use NLP in a real implementation
  return "Experienced data professional with a track record of delivering impactful analytics solutions and driving business decisions through data insights. Skilled at translating complex data into actionable strategies that improve operational efficiency and business outcomes.";
}

// Generate explanation for resume rating
function generateExplanation(letterGrade: string, resumePercent: number): string {
  const explanations: Record<string, string> = {
    "A": "Your resume demonstrates exceptional clarity, quantifiable achievements, and a strong balance of industry-specific language and action words. It effectively communicates your impact and is well-optimized for ATS systems.",
    "B": "Your resume is strong with good use of action verbs and some quantifiable results. There's room for improvement in balancing industry terminology and ensuring all achievements are measurable.",
    "C": "Your resume has some effective elements but needs more consistent use of action verbs, quantifiable achievements, and industry-specific terminology. Focus on demonstrating your impact with metrics.",
    "D": "Your resume requires significant improvement in multiple areas. Focus on starting bullets with strong action verbs, including metrics for all achievements, and balancing technical terms with clear results.",
    "F": "Your resume needs a comprehensive overhaul. Prioritize using strong action verbs, including quantifiable results, focusing on achievements rather than duties, and using relevant industry terminology."
  };
  
  return explanations[letterGrade] || 
    `Your resume scored ${resumePercent}%, indicating there are opportunities for significant improvement. Focus on using strong action verbs, quantifying your achievements, and clearly demonstrating your impact.`;
}

// Main function to analyze resume
function analyzeResume(resumeText: string) {
  // Extract bullets
  const bulletPoints = extractBulletPoints(resumeText);
  
  // Analyze each bullet
  const analyzedBullets = bulletPoints.map(bullet => {
    // Word balance analysis
    const wordBalance = analyzeWordBalance(bullet);
    
    // XYZ check
    const xyzScores = xyzCheck(bullet);
    
    // Calculate total score
    const bulletTotal = wordBalance.word_balance_score + xyzScores.xyz_total;
    
    // Analysis object
    const bulletAnalysis = {
      xyz_scores: xyzScores,
      word_balance: wordBalance
    };
    
    // Generate rewritten bullet
    const rewritten = rewriteBullet(bullet, bulletAnalysis);
    
    // Generate tips
    const tips = generateTips(bullet, bulletAnalysis);
    
    return {
      original: bullet,
      word_balance: {
        industry_pct: wordBalance.industry_pct,
        common_pct: wordBalance.common_pct,
        action_pct: wordBalance.action_pct,
        metric_pct: wordBalance.metric_pct
      },
      word_balance_score: wordBalance.word_balance_score,
      xyz_scores: {
        hard_soft: xyzScores.hard_soft,
        action_words: xyzScores.action_words,
        measurable_results: xyzScores.measurable_results,
        clarity_focus: xyzScores.clarity_focus
      },
      bullet_total: bulletTotal,
      rewritten,
      tips
    };
  });
  
  // Calculate resume average
  const totalScore = analyzedBullets.reduce((sum, bullet) => sum + bullet.bullet_total, 0);
  const resumeAverage = analyzedBullets.length > 0 ? totalScore / analyzedBullets.length : 0;
  
  // Calculate resume percentage
  const resumePercent = parseFloat((resumeAverage / 45 * 100).toFixed(1));
  
  // Get letter grade
  const letterGrade = getLetterGrade(resumePercent);
  
  // Generate themes
  const themes = generateThemes(analyzedBullets);
  
  // Generate elevator pitch
  const elevatorPitch = generateElevatorPitch(analyzedBullets);
  
  // Generate explanation
  const explanation = generateExplanation(letterGrade, resumePercent);
  
  return {
    bullets: analyzedBullets,
    resume_average: resumeAverage,
    resume_percent: resumePercent,
    letter_grade: letterGrade,
    themes,
    elevator_pitch: elevatorPitch,
    explanation
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse the request body
    const requestData = await req.json();
    const { resumeText } = requestData;
    
    if (!resumeText) {
      throw new Error('Resume text is required');
    }
    
    // Analyze the resume
    const analysis = analyzeResume(resumeText);
    
    // Return the analysis
    return new Response(
      JSON.stringify(analysis),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
    
  } catch (error) {
    console.error('Error processing request:', error.message);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
})
