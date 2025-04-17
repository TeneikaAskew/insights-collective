
// Add this at the top of the file
console.log('Resume analyzer function hit');

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { safeJsonParse, handleApiError, corsHeaders, handleOptions } from './utils.ts';
import { extractBulletPoints, fallbackExtractBullets } from './bulletExtractor.ts';
import { analyzeWordBalance, xyzCheck } from './bulletAnalysis.ts';
import { rewriteBullet, generateTips, generateThemes } from './bulletSuggestions.ts';
import { improveBullet, serveBulletImprover } from './bulletImprover.ts';

// Function to analyze a single bullet point
async function analyzeBullet(bullet: string) {
  const xyz_scores = xyzCheck(bullet);
  const word_balance = analyzeWordBalance(bullet);
  
  return {
    original: bullet,
    xyz_scores,
    word_balance,
    improved_bullet: await rewriteBullet(bullet, { xyz_scores, word_balance }),
    tips: await generateTips(bullet, { xyz_scores, word_balance })
  };
}

// Main function to process the resume text
async function processResume(resumeText: string, userId: string) {
  try {
    // Extract bullet points from the resume text
    let bullets = await extractBulletPoints(resumeText);
    if (bullets.length === 0) {
      console.warn("No bullets found, attempting fallback extraction");
      bullets = fallbackExtractBullets(resumeText);
    }
    
    if (bullets.length === 0) {
      console.warn("No bullets found after fallback extraction, analysis may be limited");
      return {
        resume_percent: 50,
        letter_grade: "C",
        bullets: [],
        elevator_pitch: "Resume could not be analyzed. Please ensure the text is properly formatted.",
        themes: ["No specific themes could be identified."]
      };
    }
    
    // Analyze each bullet point
    const analyzedBullets = await Promise.all(bullets.map(bullet => analyzeBullet(bullet)));
    
    // Calculate overall resume score
    const totalScore = analyzedBullets.reduce((sum, bullet) => sum + bullet.xyz_scores.xyz_total, 0);
    const resume_percent = Math.min(100, Math.round((totalScore / (analyzedBullets.length * 20)) * 100));
    
    // Determine letter grade
    let letter_grade = "F";
    if (resume_percent >= 90) letter_grade = "A";
    else if (resume_percent >= 80) letter_grade = "B";
    else if (resume_percent >= 70) letter_grade = "C";
    else if (resume_percent >= 60) letter_grade = "D";
    
    // Generate themes for improvement
    const themes = generateThemes(analyzedBullets);
    
    // Return the analysis results
    return {
      resume_percent,
      letter_grade,
      bullets: analyzedBullets,
      elevator_pitch: "This resume demonstrates potential but could benefit from stronger action verbs and quantifiable results.",
      themes
    };
  } catch (error) {
    console.error("Error processing resume:", error);
    throw error; // Re-throw to be caught by the error handler
  }
}

// Supabase Edge Function definition
const handler = async (req: Request): Promise<Response> => {
  // Handle preflight requests
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    // Extract data from the request
    const { resumeText, userId, action } = await req.json();
    
    // Validate the request
    if (!resumeText || typeof resumeText !== 'string' || resumeText.length === 0) {
      throw new Error("Missing or invalid resume text");
    }
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      throw new Error("Missing or invalid user ID");
    }
    
    // Process the resume and return the analysis
    const analysisResults = await processResume(resumeText, userId);
    
    // Respond with the analysis results
    return new Response(
      JSON.stringify(analysisResults),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    // Handle any errors that occur during processing
    const errorMessage = handleApiError(error, "Failed to analyze resume");
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// Start the server
serve(handler);
