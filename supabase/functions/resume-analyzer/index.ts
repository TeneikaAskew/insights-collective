import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { serveBulletImprover } from "./bulletImprover.ts";
import { detectSentences } from "./sentenceDetector.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0"

// Define CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory cache for bullet points (simple implementation)
const bulletCache = new Map();
const roastCache = new Map();

// Export important functions for other services
export { detectSentences };
export { serveBulletImprover };

// Service handler for sentence detection
export function serveSentenceDetector() {
  return async (req: Request) => {
    try {
      const { text } = await req.json();
      
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid text parameter" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const sentences = await detectSentences(text);
      
      return new Response(
        JSON.stringify({ sentences }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Error in sentence detector service:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to detect sentences" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  };
}

// Function to get a resume roast using GROQ
async function getResumeRoast(resumeText: string, userId?: string) {
  try {
    // Check cache first if userId is provided
    const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
    
    if (roastCache.has(cacheKey)) {
      console.log("Using cached roast");
      return { roast: roastCache.get(cacheKey) };
    }
    
    // If no text, return a default message
    if (!resumeText) {
      return { 
        roast: "I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it."
      };
    }
    
    try {
      // Call GROQ API for roast
      const groqApiKey = Deno.env.get('GROQ');
      if (!groqApiKey) {
        throw new Error("GROQ API key not found");
      }
      
      const prompt = `
        I'm looking at this resume text:
        
        ${resumeText.substring(0, 4000)}
        
        Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
        
        Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.
      `;
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [
            { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 750
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`GROQ API error: ${result.error?.message || 'Unknown error'}`);
      }
      
      const roastText = result.choices[0].message.content.trim();
      
      // Clean up the response - remove any markdown or formatting artifacts
      const cleanRoast = roastText
        .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
        .replace(/^[–\-\*\s]*|:/g, '')
        .trim();
      
      // Cache the roast if userId is provided
      if (cacheKey) {
        roastCache.set(cacheKey, cleanRoast);
        console.log(`Cached roast for ${cacheKey}`);
      }
      
      // If userId is provided, store the assessment in the database
      if (userId) {
        try {
          const { error } = await supabase
            .from('resumes')
            .update({ initial_assessment: cleanRoast })
            .eq('user_id', userId);
            
          if (error) {
            console.error('Error storing assessment in database:', error);
          } else {
            console.log('Assessment stored in database for user:', userId);
          }
        } catch (dbError) {
          console.error('Error updating database with assessment:', dbError);
        }
      }
      
      return { roast: cleanRoast };
    } catch (groqError) {
      console.error("Error getting resume roast with GROQ:", groqError);
      
      // Return a fallback roast
      return { 
        roast: "Your resume needs more specific accomplishments and metrics. The language is too generic and doesn't highlight your unique value. Try quantifying your achievements and using more powerful action verbs. Also, make sure your resume is tailored for each specific role you apply for rather than using a one-size-fits-all approach."
      };
    }
  } catch (error) {
    console.error('Error in getResumeRoast:', error);
    return { 
      error: error.message,
      roast: "I couldn't analyze your resume properly. Please ensure your resume has proper formatting and try again."
    };
  }
}

// Main function to analyze resume
async function analyzeResume(resumeText: string, userId?: string) {
  try {
    // Step 1: Check if userId is provided and get resume text from the database if needed
    let resumeId = null;
    if (userId) {
      try {
        // Check if user already has a resume
        const { data: existingResume, error: fetchError } = await supabase
          .from('resumes')
          .select('id, text')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (fetchError) {
          console.error("Error fetching existing resume:", fetchError);
        }
        
        // If we have a resume record but no resumeText was provided, use the stored text
        if (existingResume?.id) {
          resumeId = existingResume.id;
          
          // If no resumeText was provided but we have stored text, use it
          if (!resumeText && existingResume.text) {
            console.log("Using stored resume text from database");
            resumeText = existingResume.text;
          }
        }
      } catch (fetchError) {
        console.error("Error fetching resume data:", fetchError);
      }
    }
    
    if (!resumeText) {
      console.error("No resume text provided and none found in database");
      return {
        bullets: [],
        resume_average: 25,
        resume_percent: 50,
        letter_grade: "C",
        themes: ["Please upload a resume with text content"],
        elevator_pitch: "We couldn't find any text to analyze. Please upload a valid resume document.",
        explanation: "We couldn't find any text to analyze. Make sure your document contains readable text content."
      };
    }
    
    // Get and store assessment if userId is provided
    if (userId) {
      try {
        const assessment = await getResumeRoast(resumeText, userId);
        console.log('Generated and stored assessment');
      } catch (assessmentError) {
        console.error('Error generating assessment:', assessmentError);
      }
    }
    
    // Step 2: Extract bullets with fallback
    let bulletPoints = [];
    
    // First check cache if userId is provided
    if (userId && bulletCache.has(`user:${userId}:bullets`)) {
      console.log("Using cached bullets for user:", userId);
      bulletPoints = bulletCache.get(`user:${userId}:bullets`);
    } else {
      try {
        // Try primary extraction method
        bulletPoints = await extractBulletPoints(resumeText);
        
        // If no bullets found, use fallback
        if (!bulletPoints || bulletPoints.length === 0) {
          console.log("Primary bullet extraction failed, using fallback");
          bulletPoints = fallbackExtractBullets(resumeText);
        }
        
        // Cache bullets if userId is provided and bullets were found
        if (userId && bulletPoints.length > 0) {
          bulletCache.set(`user:${userId}:bullets`, bulletPoints);
          console.log(`Cached ${bulletPoints.length} bullets for user:${userId}`);
        }
      } catch (extractError) {
        console.error("Error extracting bullets:", extractError);
        // Return a minimal partial analysis with explanation
        return {
          bullets: [],
          resume_average: 0,
          resume_percent: 50, // Default to 50% instead of 0% to avoid "F"
          letter_grade: "C", // Default to "C" instead of "F"
          themes: ["Try reorganizing your resume into clear bullet points for better analysis"],
          elevator_pitch: "Unable to extract bullet points from your resume. Please format your resume with clear bullet points for analysis.",
          explanation: "We couldn't properly analyze your resume format. Please ensure your experience is organized in bullet points starting with •, –, —, -, or *."
        };
      }
    }
    
    if (bulletPoints.length === 0) {
      console.warn("No bullet points found in resume after all extraction attempts");
      // Return friendly response instead of error
      return {
        bullets: [],
        resume_average: 0,
        resume_percent: 50, // Default to 50% instead of 0% to avoid "F"
        letter_grade: "C", // Default to "C" instead of "F"
        themes: ["Format your resume with clear bullet points", "Start each bullet with an action verb", "Include measurable achievements"],
        elevator_pitch: "We couldn't detect formatted bullet points in your resume. For a complete analysis, consider organizing your experience in clear bullet points.",
        explanation: "Your resume needs to be formatted with clear bullet points for our analysis tool to work effectively. Each bullet should start with an action verb and describe a specific achievement."
      };
    }
    
    // Step 3: Analyze each bullet
    try {
      const analyzedBullets = await Promise.all(bulletPoints.map(async bullet => {
        try {
          // Word balance analysis
          const wordBalance = analyzeWordBalance(bullet);
          
          // XYZ check
          const xyzScores = xyzCheck(bullet);
          
          // Calculate total score
          const bulletTotal = wordBalance.word_balance_score + xyzScores.xyz_total;
          
          // Generate rewritten bullet
          const rewritten = await rewriteBullet(bullet, { xyz_scores: xyzScores });
          
          // Generate tips
          const tips = await generateTips(bullet, { xyz_scores: xyzScores, word_balance_score: wordBalance.word_balance_score });
          
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
        } catch (bulletError) {
          console.error("Error analyzing individual bullet:", bulletError);
          // Return a minimal bullet analysis to avoid breaking the whole process
          return {
            original: bullet,
            word_balance: { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
            word_balance_score: 5, // Minimal score to avoid zeros
            xyz_scores: { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
            bullet_total: 10, // Minimal score to avoid zeros
            rewritten: bullet,
            tips: "We had trouble analyzing this bullet. Consider rephrasing it with more action verbs and specific metrics."
          };
        }
      }));
      
      // Calculate resume average
      const totalScore = analyzedBullets.reduce((sum, bullet) => sum + bullet.bullet_total, 0);
      const resumeAverage = analyzedBullets.length > 0 ? totalScore / analyzedBullets.length : 25; // Avoid division by zero, default to 25
      
      // Calculate resume percentage (never return 0%)
      const resumePercent = Math.max(Math.min(parseFloat((resumeAverage / 45 * 100).toFixed(1)), 100), 30); // Clamp between 30% and 100%
      
      // Get letter grade (never return "F")
      let letterGrade = getLetterGrade(resumePercent);
      if (letterGrade === "F") letterGrade = "D"; // Avoid returning "F"
      
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
      let enhancedAnalysis;
      try {
        enhancedAnalysis = await enhanceWithGroq(resumeText, basicAnalysis);
      } catch (groqError) {
        console.error("Error enhancing with GROQ, using basic analysis:", groqError);
        enhancedAnalysis = basicAnalysis;
      }
      
      // If userId is provided, update the resume analysis in the database
      if (userId && resumeId) {
        try {
          const { error } = await supabase
            .from('resumes')
            .update({ 
              analysis: enhancedAnalysis,
              updated_at: new Date().toISOString()
            })
            .eq('id', resumeId);
          
          if (error) {
            console.error("Error updating resume analysis:", error);
          } else {
            console.log("Successfully updated resume analysis in database");
          }
        } catch (updateError) {
          console.error("Error updating resume analysis:", updateError);
        }
      }
      
      return enhancedAnalysis;
    } catch (analysisError) {
      console.error("Error during analysis:", analysisError);
      // Return a partial analysis with a helpful message
      return {
        bullets: [],
        resume_average: 25,
        resume_percent: 50, // Default to 50% instead of 0%
        letter_grade: "C", // Default to "C" instead of "F"
        themes: ["Format your resume with clear bullet points", "Start each bullet with an action verb", "Include measurable achievements"],
        elevator_pitch: "We encountered an issue analyzing your resume. For best results, ensure your resume uses clear bullet points with action verbs and metrics.",
        explanation: "Our analysis tool had difficulty processing your resume. For better results, format your experiences as bullet points starting with action verbs and include specific achievements with metrics."
      };
    }
  } catch (error) {
    console.error('Error processing resume:', error);
    // Return a minimal valid response
    return {
      bullets: [],
      resume_average: 25,
      resume_percent: 50,
      letter_grade: "C",
      themes: ["Error during analysis, please try again"],
      elevator_pitch: "We encountered an error analyzing your resume. Please try uploading again or contact support if the issue persists.",
      explanation: `Error analyzing resume: ${error.message || "Unknown error"}`
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Get the request path
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  
  // Route to the appropriate service based on the path
  if (path === 'detect-sentences') {
    return await serveSentenceDetector()(req);
  } else if (path === 'improve-bullet') {
    return await serveBulletImprover()(req);
  } else {
    try {
      // Parse the request body
      const requestData = await req.json();
      
      // Check if this is a request for a resume roast
      if (requestData.action === 'get-roast') {
        const { resumeText, userId } = requestData;
        const roastData = await getResumeRoast(resumeText, userId);
        
        return new Response(
          JSON.stringify(roastData),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
      
      // Otherwise, proceed with resume analysis
      const { resumeText, userId } = requestData;
      
      // Analyze the resume
      const analysis = await analyzeResume(resumeText, userId);
      
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
        JSON.stringify({ 
          error: error.message,
          // Minimal valid analysis to prevent frontend crashes
          resume_percent: 50,
          letter_grade: "C",
          themes: ["Error during analysis, please try again"],
          elevator_pitch: "We encountered an error. Please try again with a different resume format.",
          explanation: `Error: ${error.message}`,
          bullets: []
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }
})
