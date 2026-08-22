import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { generateThemes } from "./bulletSuggestions.ts";
import { detectSentences } from "./sentenceDetector.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { supabase, callLLMWithRetry, corsHeaders } from './utils.ts';
import { requireUser } from '../_shared/auth.ts';
// To:
import { config as bulletImproverConfig, processBulletsInParallel   } from "./bulletImprover.ts";
const roastCache = new Map();
const bulletCache = new Map();
export { detectSentences };
// export { serveBulletImprover };
export { bulletImproverConfig };
serve(async (req) => {
  const startTime = Date.now();
  // Handle CORS pre-flight with early return
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Identity comes from the JWT, never from the request body. This function
  // reads and overwrites resume analyses with a service-role client, so a
  // caller-supplied userId let anyone read or destroy anyone else's analysis.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const userId = auth.user.id;

  // Parse request body with error handling
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
                      { status: 400, headers: corsHeaders });
  }

  // Destructure and normalize inputs
  const { action, resumeText = '', text = '', sentences = [] } = body;
  const resolvedText = resumeText || text;

  try {
    // Use a request cache map with composite keys to avoid duplicate processing
    const cacheKey = `${action}:${userId}:${resolvedText.substring(0, 50)}`;
    const requestCache = new Map();
    
    if (requestCache.has(cacheKey)) {
      console.log('Using cached request result');
      return new Response(JSON.stringify(requestCache.get(cacheKey)), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let payload;

    // Fire off getResumeRoast early for action='analyze' but don't await.
    // getResumeRoast now throws on failure (see below), so attach a catch here:
    // the roast is supplemental to 'analyze' and its failure is logged, not fatal.
    let roastPromise;
    if (action === 'analyze' && resolvedText) {
      roastPromise = getResumeRoast(resolvedText, userId).catch((err) => {
        console.warn('Background roast generation failed during analyze:', err?.message || err);
      });
    }

    switch (action) {
      case 'improve-bullets': {
        if (!userId) throw new Error('userId is required for improve-bullets');
        payload = await bulletImprover(userId);
        break;
      }
      
      case 'get-roast': {
        if (!resolvedText) throw new Error('resumeText is required for get-roast');
        payload = await getResumeRoast(resolvedText, userId);
        break;
      }
      
      case 'analyze': {
        // Input validation
        if (!resolvedText && sentences.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'resumeText or sentences required for analyze' 
          }), { status: 400, headers: corsHeaders });
        }

        // 1. Detect sentences only if necessary - avoid if provided
        const finalSentences = sentences.length > 0
          ? sentences
          : await detectSentences(resolvedText, userId);
        
        // 2. Run core analysis
        payload = await analyzeResume(resolvedText, userId, finalSentences);
        
        // Store in cache for 5 minutes
        requestCache.set(cacheKey, payload);
        setTimeout(() => requestCache.delete(cacheKey), 5 * 60 * 1000);
        break;
      }
      
      case 'detect-sentences': {
        payload = await detectSentences(resolvedText, userId);
        break;
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }),
                          { status: 404, headers: corsHeaders });
    }
    const endTime = Date.now();
    console.log(`Resume analyzer completed in ${(endTime - startTime) / 1000}s`);
    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }),
                      { status: 500, headers: corsHeaders });
  }
  
});

// Optimize the resume analysis function to process in batches with parallelism
export async function analyzeResume(resumeText, userId, sentences = []) {
  console.log('Running Resume Analyzer');
  const startTime = Date.now();
  // Early return for empty inputs
  if (!resumeText && (!Array.isArray(sentences) || sentences.length === 0)) {
    return getDefaultErrorResponse();
  }
  
  // Initialize bulletPoints from passed-in sentences
  let bulletPoints = Array.isArray(sentences) && sentences.length > 0 ? sentences : [];

  // If no bullets provided, try to load from database first (if userId is available)
  if (bulletPoints.length === 0 && userId) {
    console.log('No sentences provided, attempting to load from database');
    try {
      const { data: existingData } = await supabase
        .from('resumes')
        .select('sentences')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (existingData?.sentences && Array.isArray(existingData.sentences)) {
        bulletPoints = existingData.sentences;
        console.log(`Loaded ${bulletPoints.length} bullet points from database`);
      }
    } catch (error) {
      console.error('Error loading sentences from database:', error);
    }
  }
  
  // If no bullets provided, try to extract them
  if (bulletPoints.length === 0) {
    try {
      // Use Promise.race with timeout for bullet extraction
      const extractionPromise = extractBulletPoints(resumeText);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Bullet extraction timed out')), 15000) // Reduced timeout
      );
      
      bulletPoints = await Promise.race([extractionPromise, timeoutPromise]);
      console.log(`Extracted ${bulletPoints.length} bullet points`);
      
      // Fallback extraction if main method fails or returns empty
      if (!bulletPoints || bulletPoints.length === 0) {
        bulletPoints = fallbackExtractBullets(resumeText);
        console.log(`Fallback extracted ${bulletPoints.length} bullet points`);
      }
    } catch (err) {
      console.error('Error extracting bullet points:', err);
      bulletPoints = fallbackExtractBullets(resumeText);
      console.log(`Fallback extracted ${bulletPoints.length} bullet points`);
    }
  }
  
  // If still no bullets, return default response
  if (bulletPoints.length === 0) {
    return getDefaultErrorResponse();
  }
  
  // Process bullets in parallel with optimal batch size and concurrency control
  const analyzed = await analyzeBulletsInParallel(bulletPoints);
  
  // Calculate scores, grades, etc.
  const results = calculateScoresAndGrades(analyzed);
  
  // Get AI analysis asynchronously while saving to DB
  const aiAnalysisPromise = enhanceWithGroq(resumeText, {
    bullets: results.bullets,
    letter_grade: results.letter_grade,
    resume_percent: results.resume_percent,
  });
  
  // Start DB save operation in parallel if userId provided
  let dbSavePromise;
  if (userId) {
    const analysisData = {
      bullets: results.bullets,
      resume_average: results.weightedAverage,
      resume_percent: results.resume_percent,  // Use the snake_case property
      letter_grade: results.letter_grade
    };
    
    dbSavePromise = saveAnalysisToDatabase(userId, analysisData);
  }
  
  // Wait for AI analysis to complete
  const aiAnalysis = await aiAnalysisPromise;

  // Complete the results with AI analysis
  const completeResults = {
    ...results,
    themes: aiAnalysis.themes,
    elevator_pitch: aiAnalysis.elevator_pitch,
    explanation: aiAnalysis.explanation
  };

  // If we started a DB save, update with complete results.
  // BEHAVIOR CHANGE (silent-failure audit): both save helpers swallow their
  // errors into a boolean; previously that boolean was ignored and the response
  // implied the analysis was persisted. Downstream (improve-bullets) reads the
  // analysis back from the DB, so a failed save produced baffling follow-up
  // errors. The response now carries an explicit analysis_saved flag.
  let analysisSaved = null;
  if (dbSavePromise && userId) {
    const initialSaved = await dbSavePromise;
    // Update DB with AI analysis results
    const finalAnalysisData = {
      bullets: results.bullets,
      resume_average: results.weightedAverage,
      resume_percent: results.resume_percent,  // Use the snake_case property
      letter_grade: results.letter_grade,
      themes: aiAnalysis.themes,
      elevator_pitch: aiAnalysis.elevator_pitch,
      explanation: aiAnalysis.explanation
    };

    const updated = await updateAnalysisInDatabase(userId, finalAnalysisData);
    analysisSaved = Boolean(initialSaved && updated);
    if (!analysisSaved) {
      console.error(`Resume analysis for user ${userId} was NOT fully persisted (initial save: ${initialSaved}, final update: ${updated})`);
    }
  }
  const endTime = Date.now();
  console.log(`Analyze resume completed in ${(endTime - startTime) / 1000}s`);
  return userId ? { ...completeResults, analysis_saved: analysisSaved } : completeResults;
}

// Helper function to analyze bullets in parallel with controlled concurrency
async function analyzeBulletsInParallel(bulletPoints) {
  const BATCH_SIZE = 10; // Increased from 5
  const MAX_CONCURRENT_BATCHES = 3;
  const analyzed = [];
  const startTime = Date.now();
  
  // Process in batches with controlled concurrency
  for (let i = 0; i < bulletPoints.length; i += BATCH_SIZE * MAX_CONCURRENT_BATCHES) {
    const batchPromises = [];
    // const batchPromises: Promise<any>[] = [];
    
    // Create multiple batch promises
    for (let j = 0; j < MAX_CONCURRENT_BATCHES; j++) {
      const startIndex = i + (j * BATCH_SIZE);
      if (startIndex < bulletPoints.length) {
        const batch = bulletPoints.slice(startIndex, startIndex + BATCH_SIZE);
        console.log(`[ANALYZE]Processing batch ${startIndex} to ${startIndex + BATCH_SIZE}`);
        console.log(`[ANALYZE]Batch: ${batch}`);
        batchPromises.push(processBulletBatch(batch));
      }
    }
    
    // Process batches concurrently
    const batchResults = await Promise.all(batchPromises);
    analyzed.push(...batchResults.flat());
  }
  const endTime = Date.now();
  console.log(`Analyze bullets completed in ${(endTime - startTime) / 1000}s`);
  return analyzed;
}

// Process a single batch of bullets
async function processBulletBatch(batch) {
  const batchPromises = batch.map(bullet => analyzeOneBullet(bullet));
  
  try {
    // Process batch with timeout
    return await Promise.race([
      Promise.all(batchPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Batch analysis timed out')), 15000) // Reduced timeout
      )
    ]);
  } catch (err) {
    console.error('Error processing batch:', err);
    // Add default analysis for failed batch
    return batch.map(bullet => ({
      original: bullet,
      word_balance: {},
      xyz_scores: {},
      bullet_total: 10
    }));
  }
}

// Analyze a single bullet point
async function analyzeOneBullet(bullet) {
  try {
    const wb = analyzeWordBalance(bullet);
    const xyz = xyzCheck(bullet);
    
    // Add minimum content requirements
    const hasMinimumContent = bullet.length > 20 && bullet.split(/\s+/).length > 4;
    const contentPenalty = hasMinimumContent ? 0 : 25;
    
    // Calculate total score
    const total = Math.max(0, xyz.xyz_total - contentPenalty);
    
    return {
      original: bullet,
      word_balance: wb,
      xyz_scores: xyz,
      bullet_total: total,
      id: bullet.id
      // id: generateBulletId(bullet) // Add unique ID for tracking
    };
  } catch (err) {
    console.error('Error on bullet:', err);
    return {
      original: bullet,
      word_balance: {},
      xyz_scores: {},
      bullet_total: 10,
      id: bullet.id
      // id: generateBulletId(bullet)
    };
  }
}

// Generate a unique ID for a bullet based on its content
function generateBulletId(bullet) {
  return `bullet-${Math.random().toString(36).substring(2, 9)}`;
}

// Calculate scores and grades based on analyzed bullets
function calculateScoresAndGrades(analyzed) {
  // Sort bullets by score (highest first)
  const sortedBullets = analyzed.sort((a, b) => b.bullet_total - a.bullet_total);
  
  // Determine how many high-quality bullets exist (score > 80)
  const highQualityBullets = sortedBullets.filter(b => b.bullet_total > 80).length;
  const totalBullets = sortedBullets.length;
  const highQualityRatio = totalBullets > 0 ? highQualityBullets / totalBullets : 0;
  
  // Calculate weighted average (giving more weight to top bullets)
  const weightedScores = sortedBullets.map((bullet, index) => {
    const weight = Math.max(2.0 - index * 0.2, 1.0);
    return bullet.bullet_total * weight;
  });
  
  const weightedTotal = weightedScores.reduce((sum, score) => sum + score, 0);
  const weightedAverage = weightedTotal / weightedScores.length;
  
  // Calculate final score with quality bonus
  let percent = 30 + weightedAverage / 100 * 70;
  const qualityBonus = highQualityRatio * 15;
  percent = Math.min(100, percent + qualityBonus);
  
  // Determine letter grade using helper function
  const letterGrade = getLetterGrade(percent);
  
  return {
    bullets: sortedBullets,
    weightedAverage,
    resume_percent: Math.round(percent * 100) / 100,    // Rounded to 2 decimal places
    letter_grade: letterGrade 
  };
}

// Save analysis to database
async function saveAnalysisToDatabase(userId, analysisData) {
  try {
    const { error: updateError } = await supabase.from('resumes').update({
      analyzed_at: new Date().toISOString(),
      analysis_complete: true,
      analysis: analysisData
    }).eq('user_id', userId);
    
    if (updateError) {
      console.error('Error saving analysis to database:', updateError);
      throw new Error('Failed to save analysis results');
    }
    
    return true;
  } catch (error) {
    console.error('Error saving to database:', error);
    return false;
  }
}

// Update analysis in database with AI results
async function updateAnalysisInDatabase(userId, finalAnalysisData) {
  try {
    const { error: updateError } = await supabase.from('resumes').update({
      analysis: finalAnalysisData
    }).eq('user_id', userId);
    
    if (updateError) {
      console.error('Error updating analysis in database:', updateError);
    }
    
    return !updateError;
  } catch (error) {
    console.error('Error updating database:', error);
    return false;
  }
}

// Get default error response
function getDefaultErrorResponse() {
  return {
    bullets: [],
    resume_average: 0,
    resume_percent: 0,
    letter_grade: 'Err',
    themes: ['Format your resume with clear bullet points'],
    elevator_pitch: 'We couldn\'t detect formatted bullet points.',
    explanation: 'Please organize your experience in clear bullet points.'
  };
}

// Optimized version of bulletImprover with improved caching and execution
export async function bulletImprover(userId, enhanced = null) {
  console.log('Running bullet improver');
  const startTime = Date.now();
  // Use cache if available (keyed by userId)
  const cacheKey = `improve-bullets:${userId}`;
  if (bulletCache.has(cacheKey)) {
    console.log('Using cached bullet improvements');
    return bulletCache.get(cacheKey);
  }
  
  // Get analysis data - use enhanced if provided or fetch from DB
  const analysisData = await getAnalysisData(userId, enhanced);
  if (!analysisData.success) {
    return analysisData;
  }
  
  const { bullets, analysis } = analysisData;
  
  // Process bullets in parallel
  try {
    const enhancedBullets = await processBulletsInParallel(bullets, userId);
    
    // Update analysis with enhanced bullets
    const updatedAnalysis = mapEnhancementsToBullets(bullets, enhancedBullets)
    // Save to database
    await saveEnhancedAnalysis(userId, updatedAnalysis);
    console.log('Enhanced analysis saved to database');
    
    // Cache the result
    const result = {
      success: true,
      analysis: updatedAnalysis
    };
    bulletCache.set(cacheKey, result);
    
    // Set cache expiration (10 minutes)
    setTimeout(() => bulletCache.delete(cacheKey), 10 * 60 * 1000);
    const endTime = Date.now();
    console.log(`Bullet improver completed in ${(endTime - startTime) / 1000}s`);
    
    return result;
  } catch (error) {
    console.error('Error processing bullets:', error);
    return {
      success: false,
      error: 'Failed to process bullets'
    };
  }
}

// Helper function to get analysis data
async function getAnalysisData(userId, enhanced = null) {
  // Use provided enhanced analysis if available
  if (enhanced?.bullets && enhanced.bullets.length > 0) {
    console.log('Using provided enhanced analysis');
    return {
      success: true,
      bullets: enhanced.bullets,
      analysis: enhanced
    };
  }
  
  // Otherwise fetch from database
  console.log('Fetching analysis from database');
  const { data: currentData, error: fetchError } = await supabase
    .from('resumes')
    .select('analysis, text, analyzed_at, analysis_complete, improvements_complete')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (fetchError) {
    console.error('Error fetching current analysis:', fetchError);
    return {
      success: false,
      error: 'Failed to fetch analysis'
    };
  }
  
  // // Check if analysis is complete
  // if (!currentData?.analysis_complete) {
  //   console.error('Analysis not complete');
  //   return {
  //     success: false,
  //     error: 'Analysis not complete - please wait for analysis to finish'
  //   };
  // }
  
  // // Check if improvements are already complete
  // if (currentData?.improvements_complete) {
  //   console.log('Improvements already complete');
  //   return {
  //     success: true,
  //     analysis: currentData.analysis
  //   };
  // }
  console.log("Current Bullet Data", currentData?.analysis?.bullets);
  // Check if we have valid bullets
  if (!currentData?.analysis?.bullets || !currentData.analysis.bullets.length) {
    console.error('No bullets found in analysis');
    return {
      success: false,
      error: 'No bullets found - please ensure analysis is complete first'
    };
  }

  // // Check if we have valid bullets
  // if (!currentData?.enhanced_analysis?.bullets || !currentData.enhanced_analysis.bullets.length) {
  //   console.error('No bullets found in enhanced analysis');
  //   return {
  //     success: true,
  //     error: 'No improved bullets found - please ensure analysis is complete first'
  //   };
  // }
  
  return {
    success: true,
    bullets: currentData.analysis.bullets,
    analysis: currentData.analysis
  };
}

// Helper function to map enhancements back to original bullets
function mapEnhancementsToBullets(originalBullets, enhancedBullets) {
  return originalBullets.map(originalBullet => {
    const enhanced = enhancedBullets.find(eb => eb.id === originalBullet.id);
    return enhanced || {
      ...originalBullet,
      rewritten: originalBullet.original,
      tips: "Could not generate improvements for this bullet point.",
      id: originalBullet.id
    };
  });
}

// Helper function to save enhanced analysis
async function saveEnhancedAnalysis(userId, updatedAnalysis) {
  const { error: updateError } = await supabase
    .from('resumes')
    .update({ 
      enhanced_analysis: updatedAnalysis,
      improvements_complete: true
    })
    .eq('user_id', userId);
  
  if (updateError) {
    console.error('Error saving enhanced analysis:', updateError);
    throw new Error('Failed to save enhanced analysis');
  }
  
  return true;
}

// Optimized getResumeRoast function with better caching and timeouts
async function getResumeRoast(resumeText, userId) {
  console.log('Running Resume Roast');
  const startTime = Date.now();
  
  // Use caching effectively
  const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 50)}:roast`;
  if (roastCache.has(cacheKey)) {
    console.log('Using cached roast');
    return {
      roast: roastCache.get(cacheKey)
    };
  }
  
  if (!resumeText) {
    return {
      roast: 'I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it.'
    };
  }
  
  try {
    
    // Set up timeout promise to abort if taking too long
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Roast generation timed out')), 45000)
    );
    
    // Set up AI call promise
    const system = "You are a brutally honest resume critic. " + 
                   "Your job is to point out the real issues in a resume without sugarcoating, " + 
                   "then provide actionable advice.";
    
    const user = `
    I'm looking at this resume text:
    ${resumeText.substring(0, 3500)}
    
    Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. 
    Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager 
    who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, 
    what's missing, what makes you roll your eyes, and what makes you scroll past me? 
    Give me the real — and then tell me how to fix it so I actually start landing opportunities.
    
    Be specific and provide actionable advice. Format your response with no markdown, just clean text. 
    Keep it to 3-4 paragraphs maximum.
    `.trim();
    
    // Call LLM with timeout
    const roastTextPromise = callLLMWithRetry(system, user, 1, 3, "RESUME_ANALYZER");
    const roastText = await Promise.race([roastTextPromise, timeoutPromise]);
    
    // Clean up the response
    const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
                               .replace(/^[–\-*\s]*|:/g, '')
                               .trim();
    
    // Cache the result
    roastCache.set(cacheKey, cleanRoast);
    
    // Set cache expiration (30 minutes)
    setTimeout(() => roastCache.delete(cacheKey), 30 * 60 * 1000);
    
    // Store in database if user ID provided (supabase-js returns errors, it
    // does not throw — check the result instead of assuming success)
    if (userId) {
      const { error: roastSaveError } = await supabase.from('resumes').update({
        resume_roast: cleanRoast
      }).eq('user_id', userId);
      if (roastSaveError) {
        console.warn('Failed to persist resume roast:', roastSaveError.message);
      }

      const endTime = Date.now();
      console.log(`Roast/Assessment: Function completed in ${(endTime - startTime) / 1000}s`);
    }

    return {
      roast: cleanRoast
    };
  } catch (err) {
    // BEHAVIOR CHANGE (silent-failure audit): AI failures used to be replaced
    // by a canned one-liner ("Your resume needs more specific accomplishments
    // and metrics.") returned with HTTP 200 as if it were the model's roast.
    // Rethrow so the handler returns an explicit error; the background caller
    // for action='analyze' attaches its own .catch.
    console.error('Error getting resume roast:', err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}