
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { extractBulletPoints } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { corsHeaders } from "./utils.ts";

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
