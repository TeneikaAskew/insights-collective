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
  
  // If no matches are found, try to find sentences that might be bullet points
  if (matches.length === 0) {
    // Look for sentences that start with action verbs (common in resumes)
    const actionRegex = /^(Managed|Developed|Created|Led|Implemented|Designed|Achieved|Increased|Reduced|Improved)[^.;:]*/gm;
    const actionMatches = [...text.matchAll(actionRegex)];
    return actionMatches.map(match => match[0].trim());
  }
  
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

// Use GROQ API to enhance analysis with AI
async function enhanceWithGroq(resumeText: string, analysis: any): Promise<any> {
  try {
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      console.log("GROQ API key not found. Returning basic analysis.");
      return analysis;
    }
    
    // Limit the text to send to GROQ to reduce token usage
    const maxResumeLength = 2500; // Limit resume text to ~2500 chars
    const truncatedResume = resumeText.length > maxResumeLength ? 
      resumeText.substring(0, maxResumeLength) + "..." : 
      resumeText;
    
    // For bullet analysis, just send a summary of the scores
    const bulletSummary = analysis.bullets.map((b: any) => {
      return {
        text: b.original.substring(0, 100), // First 100 chars of each bullet
        score: b.bullet_total,
        issues: b.tips
      };
    }).slice(0, 5); // Only include up to 5 bullets to save tokens
    
    // Prepare a condensed version of the analysis to send to GROQ
    const condensedAnalysis = {
      resume_percent: analysis.resume_percent,
      letter_grade: analysis.letter_grade,
      bullet_count: analysis.bullets.length,
      bullet_samples: bulletSummary
    };
    
    // Call the GROQ API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Using a smaller model to reduce costs
        messages: [
          {
            role: 'system',
            content: `You are an expert resume analyst. Based on the provided resume text and basic analysis, 
            provide three key outputs:
            1. A professional elevator pitch (max 2 sentences)
            2. Three specific improvement themes (one sentence each)
            3. A brief explanation of the resume grade (max 2 sentences)
            
            Be specific, professional, and concise. Focus on actionable advice.`
          },
          {
            role: 'user',
            content: `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
          }
        ],
        max_tokens: 500, // Limiting tokens for efficiency
        temperature: 0.4, // Lower temperature for more consistent results
      })
    });
    
    if (!response.ok) {
      throw new Error(`GROQ API returned ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse AI response - simple approach, in production would use more robust parsing
    const sections = aiResponse.split(/\d+\.\s+/);
    
    if (sections.length >= 4) {
      // Extract elevator pitch from section 1 (after the split)
      const elevatorPitch = sections[1].trim();
      
      // Extract themes - assuming they're in section 2, split by newlines or bullet points
      const themeText = sections[2].trim();
      const themeMatches = themeText.match(/[^.!?]+[.!?]+/g) || [];
      const themes = themeMatches.map(t => t.trim()).filter(t => t.length > 10);
      
      // Extract explanation from section 3
      const explanation = sections[3].trim();
      
      // Update the analysis with AI-generated content
      if (elevatorPitch) analysis.elevator_pitch = elevatorPitch;
      if (themes.length > 0) analysis.themes = themes.slice(0, 3);
      if (explanation) analysis.explanation = explanation;
    }
    
    return analysis;
  } catch (error) {
    console.error("Error enhancing analysis with GROQ:", error);
    return analysis; // Return original analysis on error
  }
}

// Main function to analyze resume
async function analyzeResume(resumeText: string) {
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
    
    // Generate rewritten bullet
    const rewritten = rewriteBullet(bullet, { xyz_scores: xyzScores });
    
    // Generate tips
    const tips = generateTips(bullet, { xyz_scores: xyzScores, word_balance_score: wordBalance.word_balance_score });
    
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
  
  // Create basic analysis
  const basicAnalysis = {
    bullets: analyzedBullets,
    resume_average: resumeAverage,
    resume_percent: resumePercent,
    letter_grade: letterGrade,
    themes,
    elevator_pitch: "Experienced professional with a track record of delivering results and driving business outcomes through effective problem-solving and collaborative teamwork.", // default
    explanation: `Your resume received a ${letterGrade} grade (${resumePercent}%), indicating ${letterGrade >= 'C' ? 'reasonable' : 'significant room for'} improvement. Focus on the suggested themes to enhance your resume's effectiveness.` // default
  };
  
  // Enhance with GROQ if available
  const enhancedAnalysis = await enhanceWithGroq(resumeText, basicAnalysis);
  
  return enhancedAnalysis;
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
    const analysis = await analyzeResume(resumeText);
    
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
