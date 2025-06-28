import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { generateThemes } from "./bulletSuggestions.ts";
import { detectSentences } from "./sentenceDetector.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { supabase, callLLMWithRetry, corsHeaders } from './utils.ts';
// To:
import { config as bulletImproverConfig, processBulletsInParallel   } from "./bulletImprover.ts";
const roastCache = new Map();
const bulletCache = new Map();
export { detectSentences };
// export { serveBulletImprover };
export { bulletImproverConfig };
// Generate a resume roast and store it
// async function getResumeRoast(resumeText, userId) {
//   console.log('Running Resume Roast');
//   const startTime = Date.now();
//   const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
//   if (roastCache.has(cacheKey)) {
//     console.log('Using cached roast');
//     return {
//       roast: roastCache.get(cacheKey)
//     };
//   }
//   if (!resumeText) {
//     return {
//       roast: 'I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it.'
//     };
//   }
//   try {
//     callTracking.addCall(); // Add API call tracking
//     // const groqApiKey = Deno.env.get('GROQ');
//     // if (!groqApiKey) throw new Error('GROQ API key not found');
//     // const prompt = `I'm looking at this resume text:        
//     //     ${resumeText.substring(0, 3500)}        
//     //     Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
//     //     Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.`
//     //   ; 
//     // const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//     //   method: 'POST',
//     //   headers: {
//     //     Authorization: `Bearer ${groqApiKey}`,
//     //     'Content-Type': 'application/json'
//     //   },
//     //   body: JSON.stringify({
//     //     model: 'compound-beta-mini', //'llama-3.1-8b-instant',//'llama3-70b-8192',
//     //     messages: [  
//     //       { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
//     //       { role: "user", content: prompt }
//     //               ],
//     //     temperature: 0.7,
//     //     max_tokens: 750
//     //   })
//     // });
//     // if (!resp.ok) throw new Error('GROQ API error');
//     // const result = await resp.json();
//     // const roastText = result.choices[0].message.content.trim();
//     const system = "You are a brutally honest resume critic. " + "Your job is to point out the real issues in a resume without sugarcoating, " + "then provide actionable advice.";
//     const user = `
//     I'm looking at this resume text:
//     ${resumeText.substring(0, 3500)}
    
//     Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. 
//     Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager 
//     who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, 
//     what's missing, what makes you roll your eyes, and what makes you scroll past me? 
//     Give me the real — and then tell me how to fix it so I actually start landing opportunities.
    
//     Be specific and provide actionable advice. Format your response with no markdown, just clean text. 
//     Keep it to 3-4 paragraphs maximum.
//       `.trim();
//     // 2. Call the helper with retry/backoff
//     const roastText = await callLLMWithRetry(system, user);
//     console.log("Roast/Assessment: ", roastText);
//     const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();
//     console.log("Cleaned Roast/Assessment: ", cleanRoast);
//     roastCache.set(cacheKey, cleanRoast);
//     if (userId) {
//       await supabase.from('resumes').update({
//         resume_roast: cleanRoast
//       }).eq('user_id', userId);
//       console.log('Roast/Assessment stored in database for user:', userId);
//       const endTime = Date.now();
//       console.log(`Roast/Assessment: Function completed in ${(endTime - startTime) / 1000}s`);
//     }
//     return {
//       roast: cleanRoast
//     };
//   } catch (err) {
//     console.error('Error getting resume roast:', err);
//     return {
//       roast: 'Your resume needs more specific accomplishments and metrics.'
//     };
//   }
// }
// /**
//  * Analyze a user's resume by processing provided sentences or extracting bullet points.
//  * @param {string} resumeText - Raw resume text.
//  * @param {string} userId - User identifier for DB operations.
//  * @param {string[]} sentences - Array of pre-detected sentences to use as bullet points.
//  * @returns {Promise<object>} Enhanced analysis results.
//  */ 
// /////////////
// export async function analyzeResume(resumeText, userId, sentences = []) {
//   console.log('Running Resume Analyzer');
//   const startTime = Date.now();
//   // let text = resumeText || '';
//   console.log('Provided text:', resumeText.length, 'characters');
  
//   // Initialize bulletPoints from passed-in sentences
//   let bulletPoints = Array.isArray(sentences) && sentences.length > 0 ? sentences : [];
//   if (bulletPoints.length) {
//     console.log(`Using ${bulletPoints.length} pre-detected sentences for analysis`);
//   }

//   // If no bullets provided, try to extract them
//   if (bulletPoints.length === 0) {
//     try {
//       // Extract bullet points with a timeout
//       const extractionPromise = extractBulletPoints(resumeText);
//       const timeoutPromise = new Promise((_, reject) => 
//         setTimeout(() => reject(new Error('Bullet extraction timed out')), 30000)
//       );
      
//       bulletPoints = await Promise.race([extractionPromise, timeoutPromise]);
//       console.log(`Extracted ${bulletPoints.length} bullet points`);
//     } catch (err) {
//       console.error('Error extracting bullet points:', err);
//       bulletPoints = [];
//     }
//   }

//   // If still no bullets, return default C-response
//   if (bulletPoints.length === 0) {
//     return {
//       bullets: [],
//       resume_average: 0,
//       resume_percent: 0,
//       letter_grade: 'Err',
//       themes: [
//         'Format your resume with clear bullet points'
//       ],
//       elevator_pitch: 'We couldn\'t detect formatted bullet points.',
//       explanation: 'Please organize your experience in clear bullet points.'
//     };
//   }

//   // Core bullet-by-bullet analysis with batching
//   console.log('Analyzing', bulletPoints.length, 'bullet points');
  
//   // Process bullets in batches of 5 to avoid overwhelming the system
//   const BATCH_SIZE = 5;
//   const analyzed = [];
  
//   for (let i = 0; i < bulletPoints.length; i += BATCH_SIZE) {
//     const batch = bulletPoints.slice(i, i + BATCH_SIZE);
//     const batchPromises = batch.map(async (bullet) => {
//       try {
//         const wb = analyzeWordBalance(bullet);
//         const xyz = xyzCheck(bullet);
//         // const total = wb.word_balance_score + xyz.xyz_total;
//         // Use the new xyz_total directly instead of adding it to word_balance_score
//         // const total = xyz.xyz_total; // Now on a 0-100 scale
//         // const rewritten = await rewriteBullet(bullet, { xyz_scores: xyz });
//         // const tips = await generateTips(bullet, { xyz_scores: xyz, word_balance_score: wb.word_balance_score });
//         // return { original: bullet, word_balance: wb, xyz_scores: xyz, bullet_total: total, rewritten, tips };
        
//         // Add minimum content requirements
//         const hasMinimumContent = bullet.length > 20 && bullet.split(/\s+/).length > 4;
//         const contentPenalty = hasMinimumContent ? 0 : 25;
//         // Use the new xyz_total directly instead of adding it to word_balance_score      
//         // Apply minimum content penalty
//         const total = Math.max(0, xyz.xyz_total - contentPenalty);
        
//         return {
//           original: bullet,
//           word_balance: wb,
//           xyz_scores: xyz,
//           bullet_total: total
//         };
//       } catch (err) {
//         console.error('Error on bullet:', err);
//         return {
//           original: bullet,
//           word_balance: {},
//           xyz_scores: {},
//           bullet_total: 10
//         };
//       }
//     });

//     // Process batch with timeout
//     try {
//       const batchResults = await Promise.race([
//         Promise.all(batchPromises),
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error('Batch analysis timed out')), 30000)
//         )
//       ]);
//       analyzed.push(...batchResults);
//     } catch (err) {
//       console.error('Error processing batch:', err);
//       // Add default analysis for failed batch
//       batch.forEach(bullet => {
//         analyzed.push({
//           original: bullet,
//           word_balance: {},
//           xyz_scores: {},
//           bullet_total: 10
//         });
//       });
//     }
//   }

//   // Sort bullets by score (highest first)
//   const sortedBullets = analyzed.sort((a, b) => b.bullet_total - a.bullet_total);
  
//   // Step 1: Determine how many high-quality bullets exist (score > 80)
//   const highQualityBullets = sortedBullets.filter(b => b.bullet_total > 80).length;
//   const totalBullets = sortedBullets.length;
//   const highQualityRatio = totalBullets > 0 ? highQualityBullets / totalBullets : 0;

//   // Calculate weighted average (giving more weight to top bullets)
//   const weightedScores = sortedBullets.map((bullet, index) => {
//     const weight = Math.max(2.0 - index * 0.2, 1.0);
//     return bullet.bullet_total * weight;
//   });
  
//   const weightedTotal = weightedScores.reduce((sum, score) => sum + score, 0);
//   const weightedAverage = weightedTotal / weightedScores.length;
// // Convert to percentage (60% baseline + up to 60% from performance)
//     // const percent = 40 + (weightedAverage / 100 * 60);
//     // Step 3: Use a much lower baseline (30%) and give more weight to bullet quality
    
//   // Calculate final score
//   let percent = 30 + weightedAverage / 100 * 70;
//     // Step 4: Add a bonus for having a high percentage of quality bullets
//     // This rewards resumes with consistently good content
//   const qualityBonus = highQualityRatio * 15;
//   // Up to 15% bonus for all high-quality bullets
//   // Cap at 100%
//   percent = Math.min(100, percent + qualityBonus);
//   // // Convert to percentage (60% baseline + up to 40% from performance)
//     // const percent = 60 + (weightedAverage / 45 * 40);

//   // Determine letter grade
//   let letterGrade;
//   if (percent >= 98) letterGrade = 'A+';
//   else if (percent >= 95) letterGrade = 'A';
//   else if (percent >= 90) letterGrade = 'A-';
//   else if (percent >= 88) letterGrade = 'B+';
//   else if (percent >= 85) letterGrade = 'B';
//   else if (percent >= 80) letterGrade = 'B-';
//   else if (percent >= 78) letterGrade = 'C+';
//   else if (percent >= 75) letterGrade = 'C';
//   else if (percent >= 70) letterGrade = 'C-';
//   else if (percent >= 65) letterGrade = 'D+';
//   else if (percent >= 60) letterGrade = 'D';
//   else letterGrade = 'F';


//   // Get elevator pitch and explanation from AI
//   const aiAnalysis = await enhanceWithGroq(resumeText, {
//     bullets: sortedBullets,
//     letter_grade: letterGrade,
//     percent: percent,
//   });

//   // Store results in database if userId provided
//   if (userId) {
//     const analysisData = {
//       bullets: sortedBullets,
//       resume_average: weightedAverage,
//       resume_percent: percent,
//       letter_grade: letterGrade,
//       themes: aiAnalysis.themes,
//       elevator_pitch: aiAnalysis.elevator_pitch,
//       explanation: aiAnalysis.explanation
//     };

//     console.log('Attempting to save analysis data to database');

//     const { error: updateError } = await supabase.from('resumes').update({
//       analyzed_at: new Date().toISOString(),
//       analysis_complete: true,
//       analysis: analysisData
//     }).eq('user_id', userId);

//     if (updateError) {
//       console.error('Error saving analysis to database:', updateError);
//       throw new Error('Failed to save analysis results');
//     }

//     // Verify the update was successful
//     const { data: verifyData, error: verifyError } = await supabase
//       .from('resumes')
//       .select('analysis_complete, analysis')
//       .eq('user_id', userId)
//       .single();

    

//     if (verifyError || !verifyData?.analysis_complete || !verifyData?.analysis) {
//       console.error('Failed to verify analysis was saved:', verifyError);
//       throw new Error('Failed to verify analysis was saved');
//     }
//     if (!verifyError && verifyData?.analysis_complete && verifyData?.analysis) {
//       console.log(`Analysis successfully saved: user ${userId} and grade = ${verifyData.analysis.letter_grade}`);
//     }
//   }
//   const endTime = Date.now();
//   console.log(`[analyzeResume]: Function completed in ${(endTime - startTime)/1000}s`);

//   return {
//     bullets: sortedBullets,
//     resume_average: weightedAverage,
//     resume_percent: percent,
//     letter_grade: letterGrade,
//     themes: aiAnalysis.themes,
//     elevator_pitch: aiAnalysis.elevator_pitch,
//     explanation: aiAnalysis.explanation
//   };
// }
// export async function bulletImprover(userId, enhanced = null) {
//   console.log('Running bullet improver only');
//   const startTime = Date.now();
//   // First check if we have a valid analysis
//   let bullets;
//   let analysis;
  
//   // First try to use the provided enhanced analysis if available
//   if (enhanced?.bullets && enhanced.bullets.length > 0) {
//     console.log('Using provided enhanced analysis');
//     bullets = enhanced.bullets;
//     analysis = enhanced;
//   } else {
//     // Fall back to fetching from database
//     console.log('No enhanced analysis provided, fetching from database');
//     const { data: currentData, error: fetchError } = await supabase
//       .from('resumes')
//       .select('analysis, text, analyzed_at, analysis_complete, improvements_complete')
//       .eq('user_id', userId)
//       .order('uploaded_at', { ascending: false })
//       .limit(1)
//       .maybeSingle();

//     if (fetchError) {
//       console.error('Error fetching current analysis:', fetchError);
//       return {
//         success: false,
//         error: 'Failed to fetch analysis'
//       };
//     }

//     // Check if analysis is complete
//     if (!currentData?.analysis_complete) {
//       console.error('Analysis not complete');
//       return {
//         success: false,
//         error: 'Analysis not complete - please wait for analysis to finish'
//       };
//     }

//     // Check if improvements are already complete
//     if (currentData?.improvements_complete) {
//       console.log('Improvements already complete');
//       return {
//         success: true,
//         analysis: currentData.analysis
//       };
//     }

//     // Check if we have a valid analysis with bullets
//     if (!currentData?.analysis?.bullets || !currentData.analysis.bullets.length) {
//       console.error('No bullets found in analysis');
//       return {
//         success: false,
//         error: 'No bullets found - please ensure analysis is complete first'
//       };
//     }

//     // Check if analysis was completed recently (within last 5 minutes)
//     const analysisTime = currentData.analyzed_at;
//     if (!analysisTime) {
//       console.error('No analysis timestamp found');
//       return {
//         success: false,
//         error: 'Analysis timestamp not found - please ensure analysis is complete first'
//       };
//     }

//     const analysisAge = Date.now() - new Date(analysisTime).getTime();
//     if (analysisAge > 5 * 60 * 1000) { // 5 minutes
//       console.log('Analysis is older than 5 minutes, checking if it needs to be refreshed');
//       // Trigger a new analysis if the current one is too old
//       try {
//         const analysisResult = await analyzeResume(currentData.text, userId);
//         if (!analysisResult) {
//           return {
//             success: false,
//             error: 'Analysis needs to be refreshed - please try again in a moment'
//           };
//         }
//         bullets = analysisResult.bullets;
//         analysis = analysisResult;
//       } catch (error) {
//         console.error('Error refreshing analysis:', error);
//         return {
//           success: false,
//           error: 'Failed to refresh analysis - please try again'
//         };
//       }
//     } else {
//       bullets = currentData.analysis.bullets;
//       analysis = currentData.analysis;
//     }
//   }

//   // Verify we have valid bullets to process
//   if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
//     console.error('Invalid bullets data');
//     return {
//       success: false,
//       error: 'Invalid bullets data'
//     };
//   }

//   console.log(`Found ${bullets.length} bullets to improve`);
  
//   // Sort bullets by score so we process the highest scoring ones first
//   const sortedBullets = [...bullets].sort((a, b) => b.bullet_total - a.bullet_total);
  
//   // Process bullets in parallel with proper error handling
//   try {
//     const enhancedBullets = await processBulletsInParallel(sortedBullets, userId);
    
//     // Map the enhanced bullets back to their original positions
//     const finalBullets = bullets.map(originalBullet => {
//       const enhanced = enhancedBullets.find(eb => eb.id === originalBullet.id);
//       return enhanced || {
//         ...originalBullet,
//         rewritten: originalBullet.original,
//         tips: "Could not generate improvements for this bullet point."
//       };
//     });

//     // Update the analysis with enhanced bullets
//     const updatedAnalysis = {
//       ...analysis,
//       bullets: finalBullets,
//       updated_at: new Date().toISOString()
//     };

//     // Save the enhanced analysis back to the database
//     const { error: updateError } = await supabase
//       .from('resumes')
//       .update({ 
//         analysis: updatedAnalysis,
//         improvements_complete: true
//       })
//       .eq('user_id', userId);

//     if (updateError) {
//       console.error('Error saving enhanced analysis:', updateError);
//       return {
//         success: false,
//         error: 'Failed to save enhanced analysis'
//       };
//     }
//     const endTime = Date.now();
//     console.log(`[bulletImprover]: Function completed in ${(endTime - startTime)/1000}s`);
//     return {
//       success: true,
//       analysis: updatedAnalysis
//     };
//   } catch (error) {
//     console.error('Error processing bullets:', error);
//     return {
//       success: false,
//       error: 'Failed to process bullets'
//     };
//   }
// }
// // serve(async (req)=>{
// //   // Handle CORS preflight
// //   if (req.method === 'OPTIONS') {
// //     return new Response(null, {
// //       status: 200,
// //       headers: corsHeaders
// //     });
// //   }
// //   const url = new URL(req.url);
// //   const path = url.pathname.split('/').pop();
// //   console.log('URL:', url, 'Path:', path);
// //   try {
// //     // Parse the request body once
// //     const { action, resumeText, text, userId } = await req.json();
// //     console.log('Action:', action, 'User:', userId, 'Text length:', (resumeText || text)?.length || 0);
// //     // Special endpoint for improving bullets - handle this first before any other processing
// //     // if (action === 'improve-bullets' && userId) {
// //     //   console.log('Running bullet improver only');
// //     //   const result = await bulletImprover(userId);
// //     //   return new Response(JSON.stringify(result), {
// //     //     headers: {
// //     //       'Content-Type': 'application/json',
// //     //       ...corsHeaders
// //     //     }
// //     //   });
// //     // }
// //     // For all other actions, proceed with standard analysis flow
// //     const resolvedText = resumeText || text;
// //     console.log('User:', userId, 'Text length:', resolvedText?.length || 0);
// //     // Consolidated sentence detection + analysis (main flow)
// //     if (action == 'analyze' || path === 'detect-sentences' || path === 'resume-analyzer' || !path || !action === 'improve-bullets') {
// //       console.log('Running sentence detection + analysis');
// //       // Optionally trigger the roast in the background 
// //       if (resolvedText) {
// //         getResumeRoast(resolvedText, userId);
// //       }
// //       // Only run sentence detection if we have text
// //       let sentences = [];
// //       if (resolvedText) {
// //         sentences = await detectSentences(resolvedText, userId);
// //         console.log('Direct detectSentences():', sentences.length);
// //       } else if (userId) {
// //         // If no text but we have userId, try to load sentences from database
// //         console.log('No text provided, attempting to load sentences from database');
// //         try {
// //           const { data: existingData } = await supabase.from('resumes').select('sentences').eq('user_id', userId).order('uploaded_at', {
// //             ascending: false
// //           }).limit(1).maybeSingle();
// //           if (existingData?.sentences && Array.isArray(existingData.sentences)) {
// //             sentences = existingData.sentences;
// //             console.log(`Loaded ${sentences.length} sentences from database`);
// //           }
// //         } catch (error) {
// //           console.error('Error loading sentences from database:', error);
// //         }
// //       }
// //       // Run resume analysis 
// //       const analysisResult = await analyzeResume(resolvedText, userId, sentences);
// //       // Prepare the response
// //       const response = new Response(JSON.stringify(analysisResult), {
// //         headers: {
// //           'Content-Type': 'application/json',
// //           ...corsHeaders
// //         }
// //       });
// //       return response;
// //     }
// //     // Fallback: unrecognized path or action
// //     console.log('No handler for path:', path, 'or action:', action);
// //     return new Response(JSON.stringify({
// //       error: 'Not found'
// //     }), {
// //       status: 404,
// //       headers: {
// //         'Content-Type': 'application/json',
// //         ...corsHeaders
// //       }
// //     });
// //   } catch (err) {
// //     console.error('Error:', err);
// //     return new Response(JSON.stringify({
// //       error: err.message || 'Internal error'
// //     }), {
// //       status: 500,
// //       headers: {
// //         'Content-Type': 'application/json',
// //         ...corsHeaders
// //       }
// //     });
// //   }
// // });
// // // serve(async (req) => {
// // //   // Handle CORS preflight requests
// // //   if (req.method === 'OPTIONS') {
// // //     return new Response('ok', { headers: corsHeaders });
// // //   }

// // //   try {
// // //     const { action,  resumeText, userId, sentences } = await req.json();
// // //     console.log(`Action: ${action} User: ${userId} Text length: ${resumeText?.length || 0}`);

// // //     // Validate required fields
// // //     if (!userId) {
// // //       throw new Error('User ID is required');
// // //     }

// // //     let result;
    
// // //     // Handle different actions
// // //     switch (action) {
// // //       case 'analyze':
// // //         // Run analysis first
// // //         result = await analyzeResume(resumeText, userId, sentences);
        
// // //         // Only run bullet improvement if analysis was successful
// // //         // if (result.success && result.analysis?.bullets?.length > 0) {
// // //         //   console.log('Analysis complete, starting bullet improvement');
// // //         //   const improvedResult = await bulletImprover(userId, result.analysis);
// // //         //   if (improvedResult.success) {
// // //         //     result.analysis = improvedResult.analysis;
// // //         //   }
// // //         // }
// // //         // break;

// // //       case 'improve-bullets':
// // //         // Only run bullet improvement if we have an existing analysis
// // //         result = await bulletImprover(userId);
// // //         break;

// // //       // case 'detect-sentences':
// // //       //   result = await detectSentences(text, userId);
// // //       //   break;

// // //       case 'roast':
// // //         result = await getResumeRoast(resumeText, userId);
// // //         break;

// // //       default:
// // //         throw new Error(`Unknown action: ${action}`);
// // //     }

// // //     return new Response(JSON.stringify(result), {
// // //       headers: corsHeaders
// // //     });
// // //   } catch (error) {
// // //     console.error('Error:', error);
// // //     return new Response(
// // //       JSON.stringify({
// // //         success: false,
// // //         error: error.message
// // //       }),
// // //       {
// // //         status: 500,
// // //         headers: corsHeaders
// // //       }
// // //     );
// // //   }
// // // });
// serve(async (req) => {
//   // ────────── CORS pre-flight ──────────
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { status: 200, headers: corsHeaders });
//   }

//   // ────────── Parse body once ──────────
//   let body;
//   try { body = await req.json(); }
//   catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }

//   const { action, resumeText = '', text = '', userId = '', sentences = [] } = body;
//   const resolvedText = resumeText || text;               // one name is enough

//   try {
//     let payload;

//     switch (action) {

//       // ===== improve-bullets =================================================
//       case 'improve-bullets': {
//         if (!userId) throw new Error('userId is required for improve-bullets');
//         payload = await bulletImprover(userId);
//         break;
//       }

//       // ===== get-roast =======================================================
//       case 'get-roast': {
//         if (!resolvedText) throw new Error('resumeText is required for get-roast');
//         payload = getResumeRoast(resolvedText, userId);   // nothing else
//         break;
//       }

//       // ===== analyze =========================================================
//       case 'analyze': {

//         if (resolvedText) {
//           getResumeRoast(resolvedText, userId);
//         }
//         if (!resolvedText && sentences.length === 0) {
//           return new Response(JSON.stringify({ error: 'resumeText or sentences required for analyze' }),
//                               { status: 400, headers: corsHeaders });
//         }

//         // 1. Get sentences (use supplied list if you passed it)
//         const finalSentences = sentences.length
//           ? sentences
//           : await detectSentences(resolvedText, userId);

//         // 2. Run core analysis
//         payload = await analyzeResume(resolvedText, userId, finalSentences);
//         break;
//       }

//       // ===== detect-sentences only (optional) ================================
//       case 'detect-sentences': {
//         payload = await detectSentences(resolvedText, userId);
//         break;
//       }

//       // ===== unknown =========================================================
//       default:
//         return new Response(JSON.stringify({ error: 'Unknown action' }),
//                             { status: 404, headers: corsHeaders });
//     }

//     return new Response(JSON.stringify(payload), {
//       headers: { 'Content-Type': 'application/json', ...corsHeaders },
//     });

//   } catch (err) {
//     console.error(err);
//     return new Response(JSON.stringify({ error: err.message }),
//                         { status: 500, headers: corsHeaders });
//   }
// });
serve(async (req) => {
  const startTime = Date.now();
  // Handle CORS pre-flight with early return
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Parse request body with error handling
  let body;
  try { 
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), 
                      { status: 400, headers: corsHeaders });
  }

  // Destructure and normalize inputs
  const { action, resumeText = '', text = '', userId = '', sentences = [] } = body;
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

    // Fire off getResumeRoast early for action='analyze' but don't await
    let roastPromise;
    if (action === 'analyze' && resolvedText) {
      roastPromise = getResumeRoast(resolvedText, userId);
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
      const timeoutPromise = new Promise((_, reject) => 
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
  
  // If we started a DB save, update with complete results
  if (dbSavePromise && userId) {
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
    
    await updateAnalysisInDatabase(userId, finalAnalysisData);
  }
  const endTime = Date.now();
  console.log(`Analyze resume completed in ${(endTime - startTime) / 1000}s`);
  return completeResults;
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
    resume_percent: percent,    // Changed from percent
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
    const timeoutPromise = new Promise((_, reject) => 
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
    const roastTextPromise = callLLMWithRetry(system, user);
    const roastText = await Promise.race([roastTextPromise, timeoutPromise]);
    
    // Clean up the response
    const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
                               .replace(/^[–\-*\s]*|:/g, '')
                               .trim();
    
    // Cache the result
    roastCache.set(cacheKey, cleanRoast);
    
    // Set cache expiration (30 minutes)
    setTimeout(() => roastCache.delete(cacheKey), 30 * 60 * 1000);
    
    // Store in database if user ID provided
    if (userId) {
      await supabase.from('resumes').update({
        resume_roast: cleanRoast
      }).eq('user_id', userId);
      
      const endTime = Date.now();
      console.log(`Roast/Assessment: Function completed in ${(endTime - startTime) / 1000}s`);
    }
    
    return {
      roast: cleanRoast
    };
  } catch (err) {
    console.error('Error getting resume roast:', err);
    return {
      roast: 'Your resume needs more specific accomplishments and metrics.'
    };
  }
}
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
// import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
// import { generateThemes } from "./bulletSuggestions.ts";
// import { detectSentences } from "./sentenceDetector.ts";
// import { getLetterGrade } from "./gradeHelper.ts";
// import { enhanceWithGroq } from "./aiEnhancer.ts";
// import { supabase, callLLMWithRetry, corsHeaders, callTracking } from './utils.ts';
// // To:
// import { config as bulletImproverConfig, processBulletsInParallel   } from "./bulletImprover.ts";
// const roastCache = new Map();
// const bulletCache = new Map();
// export { detectSentences };
// // export { serveBulletImprover };
// export { bulletImproverConfig };
// // Generate a resume roast and store it
// // async function getResumeRoast(resumeText, userId) {
// //   console.log('Running Resume Roast');
// //   const startTime = Date.now();
// //   const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
// //   if (roastCache.has(cacheKey)) {
// //     console.log('Using cached roast');
// //     return {
// //       roast: roastCache.get(cacheKey)
// //     };
// //   }
// //   if (!resumeText) {
// //     return {
// //       roast: 'I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it.'
// //     };
// //   }
// //   try {
// //     callTracking.addCall(); // Add API call tracking
// //     // const groqApiKey = Deno.env.get('GROQ');
// //     // if (!groqApiKey) throw new Error('GROQ API key not found');
// //     // const prompt = `I'm looking at this resume text:        
// //     //     ${resumeText.substring(0, 3500)}        
// //     //     Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
// //     //     Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.`
// //     //   ; 
// //     // const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
// //     //   method: 'POST',
// //     //   headers: {
// //     //     Authorization: `Bearer ${groqApiKey}`,
// //     //     'Content-Type': 'application/json'
// //     //   },
// //     //   body: JSON.stringify({
// //     //     model: 'compound-beta-mini', //'llama-3.1-8b-instant',//'llama3-70b-8192',
// //     //     messages: [  
// //     //       { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
// //     //       { role: "user", content: prompt }
// //     //               ],
// //     //     temperature: 0.7,
// //     //     max_tokens: 750
// //     //   })
// //     // });
// //     // if (!resp.ok) throw new Error('GROQ API error');
// //     // const result = await resp.json();
// //     // const roastText = result.choices[0].message.content.trim();
// //     const system = "You are a brutally honest resume critic. " + "Your job is to point out the real issues in a resume without sugarcoating, " + "then provide actionable advice.";
// //     const user = `
// //     I'm looking at this resume text:
// //     ${resumeText.substring(0, 3500)}
    
// //     Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. 
// //     Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager 
// //     who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, 
// //     what's missing, what makes you roll your eyes, and what makes you scroll past me? 
// //     Give me the real — and then tell me how to fix it so I actually start landing opportunities.
    
// //     Be specific and provide actionable advice. Format your response with no markdown, just clean text. 
// //     Keep it to 3-4 paragraphs maximum.
// //       `.trim();
// //     // 2. Call the helper with retry/backoff
// //     const roastText = await callLLMWithRetry(system, user);
// //     console.log("Roast/Assessment: ", roastText);
// //     const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();
// //     console.log("Cleaned Roast/Assessment: ", cleanRoast);
// //     roastCache.set(cacheKey, cleanRoast);
// //     if (userId) {
// //       await supabase.from('resumes').update({
// //         resume_roast: cleanRoast
// //       }).eq('user_id', userId);
// //       console.log('Roast/Assessment stored in database for user:', userId);
// //       const endTime = Date.now();
// //       console.log(`Roast/Assessment: Function completed in ${(endTime - startTime) / 1000}s`);
// //     }
// //     return {
// //       roast: cleanRoast
// //     };
// //   } catch (err) {
// //     console.error('Error getting resume roast:', err);
// //     return {
// //       roast: 'Your resume needs more specific accomplishments and metrics.'
// //     };
// //   }
// // }
// // /**
// //  * Analyze a user's resume by processing provided sentences or extracting bullet points.
// //  * @param {string} resumeText - Raw resume text.
// //  * @param {string} userId - User identifier for DB operations.
// //  * @param {string[]} sentences - Array of pre-detected sentences to use as bullet points.
// //  * @returns {Promise<object>} Enhanced analysis results.
// //  */ 
// // /////////////
// // export async function analyzeResume(resumeText, userId, sentences = []) {
// //   console.log('Running Resume Analyzer');
// //   const startTime = Date.now();
// //   // let text = resumeText || '';
// //   console.log('Provided text:', resumeText.length, 'characters');
  
// //   // Initialize bulletPoints from passed-in sentences
// //   let bulletPoints = Array.isArray(sentences) && sentences.length > 0 ? sentences : [];
// //   if (bulletPoints.length) {
// //     console.log(`Using ${bulletPoints.length} pre-detected sentences for analysis`);
// //   }

// //   // If no bullets provided, try to extract them
// //   if (bulletPoints.length === 0) {
// //     try {
// //       // Extract bullet points with a timeout
// //       const extractionPromise = extractBulletPoints(resumeText);
// //       const timeoutPromise = new Promise((_, reject) => 
// //         setTimeout(() => reject(new Error('Bullet extraction timed out')), 30000)
// //       );
      
// //       bulletPoints = await Promise.race([extractionPromise, timeoutPromise]);
// //       console.log(`Extracted ${bulletPoints.length} bullet points`);
// //     } catch (err) {
// //       console.error('Error extracting bullet points:', err);
// //       bulletPoints = [];
// //     }
// //   }

// //   // If still no bullets, return default C-response
// //   if (bulletPoints.length === 0) {
// //     return {
// //       bullets: [],
// //       resume_average: 0,
// //       resume_percent: 0,
// //       letter_grade: 'Err',
// //       themes: [
// //         'Format your resume with clear bullet points'
// //       ],
// //       elevator_pitch: 'We couldn\'t detect formatted bullet points.',
// //       explanation: 'Please organize your experience in clear bullet points.'
// //     };
// //   }

// //   // Core bullet-by-bullet analysis with batching
// //   console.log('Analyzing', bulletPoints.length, 'bullet points');
  
// //   // Process bullets in batches of 5 to avoid overwhelming the system
// //   const BATCH_SIZE = 5;
// //   const analyzed = [];
  
// //   for (let i = 0; i < bulletPoints.length; i += BATCH_SIZE) {
// //     const batch = bulletPoints.slice(i, i + BATCH_SIZE);
// //     const batchPromises = batch.map(async (bullet) => {
// //       try {
// //         const wb = analyzeWordBalance(bullet);
// //         const xyz = xyzCheck(bullet);
// //         // const total = wb.word_balance_score + xyz.xyz_total;
// //         // Use the new xyz_total directly instead of adding it to word_balance_score
// //         // const total = xyz.xyz_total; // Now on a 0-100 scale
// //         // const rewritten = await rewriteBullet(bullet, { xyz_scores: xyz });
// //         // const tips = await generateTips(bullet, { xyz_scores: xyz, word_balance_score: wb.word_balance_score });
// //         // return { original: bullet, word_balance: wb, xyz_scores: xyz, bullet_total: total, rewritten, tips };
        
// //         // Add minimum content requirements
// //         const hasMinimumContent = bullet.length > 20 && bullet.split(/\s+/).length > 4;
// //         const contentPenalty = hasMinimumContent ? 0 : 25;
// //         // Use the new xyz_total directly instead of adding it to word_balance_score      
// //         // Apply minimum content penalty
// //         const total = Math.max(0, xyz.xyz_total - contentPenalty);
        
// //         return {
// //           original: bullet,
// //           word_balance: wb,
// //           xyz_scores: xyz,
// //           bullet_total: total
// //         };
// //       } catch (err) {
// //         console.error('Error on bullet:', err);
// //         return {
// //           original: bullet,
// //           word_balance: {},
// //           xyz_scores: {},
// //           bullet_total: 10
// //         };
// //       }
// //     });

// //     // Process batch with timeout
// //     try {
// //       const batchResults = await Promise.race([
// //         Promise.all(batchPromises),
// //         new Promise((_, reject) => 
// //           setTimeout(() => reject(new Error('Batch analysis timed out')), 30000)
// //         )
// //       ]);
// //       analyzed.push(...batchResults);
// //     } catch (err) {
// //       console.error('Error processing batch:', err);
// //       // Add default analysis for failed batch
// //       batch.forEach(bullet => {
// //         analyzed.push({
// //           original: bullet,
// //           word_balance: {},
// //           xyz_scores: {},
// //           bullet_total: 10
// //         });
// //       });
// //     }
// //   }

// //   // Sort bullets by score (highest first)
// //   const sortedBullets = analyzed.sort((a, b) => b.bullet_total - a.bullet_total);
  
// //   // Step 1: Determine how many high-quality bullets exist (score > 80)
// //   const highQualityBullets = sortedBullets.filter(b => b.bullet_total > 80).length;
// //   const totalBullets = sortedBullets.length;
// //   const highQualityRatio = totalBullets > 0 ? highQualityBullets / totalBullets : 0;

// //   // Calculate weighted average (giving more weight to top bullets)
// //   const weightedScores = sortedBullets.map((bullet, index) => {
// //     const weight = Math.max(2.0 - index * 0.2, 1.0);
// //     return bullet.bullet_total * weight;
// //   });
  
// //   const weightedTotal = weightedScores.reduce((sum, score) => sum + score, 0);
// //   const weightedAverage = weightedTotal / weightedScores.length;
// // // Convert to percentage (60% baseline + up to 60% from performance)
// //     // const percent = 40 + (weightedAverage / 100 * 60);
// //     // Step 3: Use a much lower baseline (30%) and give more weight to bullet quality
    
// //   // Calculate final score
// //   let percent = 30 + weightedAverage / 100 * 70;
// //     // Step 4: Add a bonus for having a high percentage of quality bullets
// //     // This rewards resumes with consistently good content
// //   const qualityBonus = highQualityRatio * 15;
// //   // Up to 15% bonus for all high-quality bullets
// //   // Cap at 100%
// //   percent = Math.min(100, percent + qualityBonus);
// //   // // Convert to percentage (60% baseline + up to 40% from performance)
// //     // const percent = 60 + (weightedAverage / 45 * 40);

// //   // Determine letter grade
// //   let letterGrade;
// //   if (percent >= 98) letterGrade = 'A+';
// //   else if (percent >= 95) letterGrade = 'A';
// //   else if (percent >= 90) letterGrade = 'A-';
// //   else if (percent >= 88) letterGrade = 'B+';
// //   else if (percent >= 85) letterGrade = 'B';
// //   else if (percent >= 80) letterGrade = 'B-';
// //   else if (percent >= 78) letterGrade = 'C+';
// //   else if (percent >= 75) letterGrade = 'C';
// //   else if (percent >= 70) letterGrade = 'C-';
// //   else if (percent >= 65) letterGrade = 'D+';
// //   else if (percent >= 60) letterGrade = 'D';
// //   else letterGrade = 'F';


// //   // Get elevator pitch and explanation from AI
// //   const aiAnalysis = await enhanceWithGroq(resumeText, {
// //     bullets: sortedBullets,
// //     letter_grade: letterGrade,
// //     percent: percent,
// //   });

// //   // Store results in database if userId provided
// //   if (userId) {
// //     const analysisData = {
// //       bullets: sortedBullets,
// //       resume_average: weightedAverage,
// //       resume_percent: percent,
// //       letter_grade: letterGrade,
// //       themes: aiAnalysis.themes,
// //       elevator_pitch: aiAnalysis.elevator_pitch,
// //       explanation: aiAnalysis.explanation
// //     };

// //     console.log('Attempting to save analysis data to database');

// //     const { error: updateError } = await supabase.from('resumes').update({
// //       analyzed_at: new Date().toISOString(),
// //       analysis_complete: true,
// //       analysis: analysisData
// //     }).eq('user_id', userId);

// //     if (updateError) {
// //       console.error('Error saving analysis to database:', updateError);
// //       throw new Error('Failed to save analysis results');
// //     }

// //     // Verify the update was successful
// //     const { data: verifyData, error: verifyError } = await supabase
// //       .from('resumes')
// //       .select('analysis_complete, analysis')
// //       .eq('user_id', userId)
// //       .single();

    

// //     if (verifyError || !verifyData?.analysis_complete || !verifyData?.analysis) {
// //       console.error('Failed to verify analysis was saved:', verifyError);
// //       throw new Error('Failed to verify analysis was saved');
// //     }
// //     if (!verifyError && verifyData?.analysis_complete && verifyData?.analysis) {
// //       console.log(`Analysis successfully saved: user ${userId} and grade = ${verifyData.analysis.letter_grade}`);
// //     }
// //   }
// //   const endTime = Date.now();
// //   console.log(`[analyzeResume]: Function completed in ${(endTime - startTime)/1000}s`);

// //   return {
// //     bullets: sortedBullets,
// //     resume_average: weightedAverage,
// //     resume_percent: percent,
// //     letter_grade: letterGrade,
// //     themes: aiAnalysis.themes,
// //     elevator_pitch: aiAnalysis.elevator_pitch,
// //     explanation: aiAnalysis.explanation
// //   };
// // }
// // export async function bulletImprover(userId, enhanced = null) {
// //   console.log('Running bullet improver only');
// //   const startTime = Date.now();
// //   // First check if we have a valid analysis
// //   let bullets;
// //   let analysis;
  
// //   // First try to use the provided enhanced analysis if available
// //   if (enhanced?.bullets && enhanced.bullets.length > 0) {
// //     console.log('Using provided enhanced analysis');
// //     bullets = enhanced.bullets;
// //     analysis = enhanced;
// //   } else {
// //     // Fall back to fetching from database
// //     console.log('No enhanced analysis provided, fetching from database');
// //     const { data: currentData, error: fetchError } = await supabase
// //       .from('resumes')
// //       .select('analysis, text, analyzed_at, analysis_complete, improvements_complete')
// //       .eq('user_id', userId)
// //       .order('uploaded_at', { ascending: false })
// //       .limit(1)
// //       .maybeSingle();

// //     if (fetchError) {
// //       console.error('Error fetching current analysis:', fetchError);
// //       return {
// //         success: false,
// //         error: 'Failed to fetch analysis'
// //       };
// //     }

// //     // Check if analysis is complete
// //     if (!currentData?.analysis_complete) {
// //       console.error('Analysis not complete');
// //       return {
// //         success: false,
// //         error: 'Analysis not complete - please wait for analysis to finish'
// //       };
// //     }

// //     // Check if improvements are already complete
// //     if (currentData?.improvements_complete) {
// //       console.log('Improvements already complete');
// //       return {
// //         success: true,
// //         analysis: currentData.analysis
// //       };
// //     }

// //     // Check if we have a valid analysis with bullets
// //     if (!currentData?.analysis?.bullets || !currentData.analysis.bullets.length) {
// //       console.error('No bullets found in analysis');
// //       return {
// //         success: false,
// //         error: 'No bullets found - please ensure analysis is complete first'
// //       };
// //     }

// //     // Check if analysis was completed recently (within last 5 minutes)
// //     const analysisTime = currentData.analyzed_at;
// //     if (!analysisTime) {
// //       console.error('No analysis timestamp found');
// //       return {
// //         success: false,
// //         error: 'Analysis timestamp not found - please ensure analysis is complete first'
// //       };
// //     }

// //     const analysisAge = Date.now() - new Date(analysisTime).getTime();
// //     if (analysisAge > 5 * 60 * 1000) { // 5 minutes
// //       console.log('Analysis is older than 5 minutes, checking if it needs to be refreshed');
// //       // Trigger a new analysis if the current one is too old
// //       try {
// //         const analysisResult = await analyzeResume(currentData.text, userId);
// //         if (!analysisResult) {
// //           return {
// //             success: false,
// //             error: 'Analysis needs to be refreshed - please try again in a moment'
// //           };
// //         }
// //         bullets = analysisResult.bullets;
// //         analysis = analysisResult;
// //       } catch (error) {
// //         console.error('Error refreshing analysis:', error);
// //         return {
// //           success: false,
// //           error: 'Failed to refresh analysis - please try again'
// //         };
// //       }
// //     } else {
// //       bullets = currentData.analysis.bullets;
// //       analysis = currentData.analysis;
// //     }
// //   }

// //   // Verify we have valid bullets to process
// //   if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
// //     console.error('Invalid bullets data');
// //     return {
// //       success: false,
// //       error: 'Invalid bullets data'
// //     };
// //   }

// //   console.log(`Found ${bullets.length} bullets to improve`);
  
// //   // Sort bullets by score so we process the highest scoring ones first
// //   const sortedBullets = [...bullets].sort((a, b) => b.bullet_total - a.bullet_total);
  
// //   // Process bullets in parallel with proper error handling
// //   try {
// //     const enhancedBullets = await processBulletsInParallel(sortedBullets, userId);
    
// //     // Map the enhanced bullets back to their original positions
// //     const finalBullets = bullets.map(originalBullet => {
// //       const enhanced = enhancedBullets.find(eb => eb.id === originalBullet.id);
// //       return enhanced || {
// //         ...originalBullet,
// //         rewritten: originalBullet.original,
// //         tips: "Could not generate improvements for this bullet point."
// //       };
// //     });

// //     // Update the analysis with enhanced bullets
// //     const updatedAnalysis = {
// //       ...analysis,
// //       bullets: finalBullets,
// //       updated_at: new Date().toISOString()
// //     };

// //     // Save the enhanced analysis back to the database
// //     const { error: updateError } = await supabase
// //       .from('resumes')
// //       .update({ 
// //         analysis: updatedAnalysis,
// //         improvements_complete: true
// //       })
// //       .eq('user_id', userId);

// //     if (updateError) {
// //       console.error('Error saving enhanced analysis:', updateError);
// //       return {
// //         success: false,
// //         error: 'Failed to save enhanced analysis'
// //       };
// //     }
// //     const endTime = Date.now();
// //     console.log(`[bulletImprover]: Function completed in ${(endTime - startTime)/1000}s`);
// //     return {
// //       success: true,
// //       analysis: updatedAnalysis
// //     };
// //   } catch (error) {
// //     console.error('Error processing bullets:', error);
// //     return {
// //       success: false,
// //       error: 'Failed to process bullets'
// //     };
// //   }
// // }
// // // serve(async (req)=>{
// // //   // Handle CORS preflight
// // //   if (req.method === 'OPTIONS') {
// // //     return new Response(null, {
// // //       status: 200,
// // //       headers: corsHeaders
// // //     });
// // //   }
// // //   const url = new URL(req.url);
// // //   const path = url.pathname.split('/').pop();
// // //   console.log('URL:', url, 'Path:', path);
// // //   try {
// // //     // Parse the request body once
// // //     const { action, resumeText, text, userId } = await req.json();
// // //     console.log('Action:', action, 'User:', userId, 'Text length:', (resumeText || text)?.length || 0);
// // //     // Special endpoint for improving bullets - handle this first before any other processing
// // //     // if (action === 'improve-bullets' && userId) {
// // //     //   console.log('Running bullet improver only');
// // //     //   const result = await bulletImprover(userId);
// // //     //   return new Response(JSON.stringify(result), {
// // //     //     headers: {
// // //     //       'Content-Type': 'application/json',
// // //     //       ...corsHeaders
// // //     //     }
// // //     //   });
// // //     // }
// // //     // For all other actions, proceed with standard analysis flow
// // //     const resolvedText = resumeText || text;
// // //     console.log('User:', userId, 'Text length:', resolvedText?.length || 0);
// // //     // Consolidated sentence detection + analysis (main flow)
// // //     if (action == 'analyze' || path === 'detect-sentences' || path === 'resume-analyzer' || !path || !action === 'improve-bullets') {
// // //       console.log('Running sentence detection + analysis');
// // //       // Optionally trigger the roast in the background 
// // //       if (resolvedText) {
// // //         getResumeRoast(resolvedText, userId);
// // //       }
// // //       // Only run sentence detection if we have text
// // //       let sentences = [];
// // //       if (resolvedText) {
// // //         sentences = await detectSentences(resolvedText, userId);
// // //         console.log('Direct detectSentences():', sentences.length);
// // //       } else if (userId) {
// // //         // If no text but we have userId, try to load sentences from database
// // //         console.log('No text provided, attempting to load sentences from database');
// // //         try {
// // //           const { data: existingData } = await supabase.from('resumes').select('sentences').eq('user_id', userId).order('uploaded_at', {
// // //             ascending: false
// // //           }).limit(1).maybeSingle();
// // //           if (existingData?.sentences && Array.isArray(existingData.sentences)) {
// // //             sentences = existingData.sentences;
// // //             console.log(`Loaded ${sentences.length} sentences from database`);
// // //           }
// // //         } catch (error) {
// // //           console.error('Error loading sentences from database:', error);
// // //         }
// // //       }
// // //       // Run resume analysis 
// // //       const analysisResult = await analyzeResume(resolvedText, userId, sentences);
// // //       // Prepare the response
// // //       const response = new Response(JSON.stringify(analysisResult), {
// // //         headers: {
// // //           'Content-Type': 'application/json',
// // //           ...corsHeaders
// // //         }
// // //       });
// // //       return response;
// // //     }
// // //     // Fallback: unrecognized path or action
// // //     console.log('No handler for path:', path, 'or action:', action);
// // //     return new Response(JSON.stringify({
// // //       error: 'Not found'
// // //     }), {
// // //       status: 404,
// // //       headers: {
// // //         'Content-Type': 'application/json',
// // //         ...corsHeaders
// // //       }
// // //     });
// // //   } catch (err) {
// // //     console.error('Error:', err);
// // //     return new Response(JSON.stringify({
// // //       error: err.message || 'Internal error'
// // //     }), {
// // //       status: 500,
// // //       headers: {
// // //         'Content-Type': 'application/json',
// // //         ...corsHeaders
// // //       }
// // //     });
// // //   }
// // // });
// // // // serve(async (req) => {
// // // //   // Handle CORS preflight requests
// // // //   if (req.method === 'OPTIONS') {
// // // //     return new Response('ok', { headers: corsHeaders });
// // // //   }

// // // //   try {
// // // //     const { action,  resumeText, userId, sentences } = await req.json();
// // // //     console.log(`Action: ${action} User: ${userId} Text length: ${resumeText?.length || 0}`);

// // // //     // Validate required fields
// // // //     if (!userId) {
// // // //       throw new Error('User ID is required');
// // // //     }

// // // //     let result;
    
// // // //     // Handle different actions
// // // //     switch (action) {
// // // //       case 'analyze':
// // // //         // Run analysis first
// // // //         result = await analyzeResume(resumeText, userId, sentences);
        
// // // //         // Only run bullet improvement if analysis was successful
// // // //         // if (result.success && result.analysis?.bullets?.length > 0) {
// // // //         //   console.log('Analysis complete, starting bullet improvement');
// // // //         //   const improvedResult = await bulletImprover(userId, result.analysis);
// // // //         //   if (improvedResult.success) {
// // // //         //     result.analysis = improvedResult.analysis;
// // // //         //   }
// // // //         // }
// // // //         // break;

// // // //       case 'improve-bullets':
// // // //         // Only run bullet improvement if we have an existing analysis
// // // //         result = await bulletImprover(userId);
// // // //         break;

// // // //       // case 'detect-sentences':
// // // //       //   result = await detectSentences(text, userId);
// // // //       //   break;

// // // //       case 'roast':
// // // //         result = await getResumeRoast(resumeText, userId);
// // // //         break;

// // // //       default:
// // // //         throw new Error(`Unknown action: ${action}`);
// // // //     }

// // // //     return new Response(JSON.stringify(result), {
// // // //       headers: corsHeaders
// // // //     });
// // // //   } catch (error) {
// // // //     console.error('Error:', error);
// // // //     return new Response(
// // // //       JSON.stringify({
// // // //         success: false,
// // // //         error: error.message
// // // //       }),
// // // //       {
// // // //         status: 500,
// // // //         headers: corsHeaders
// // // //       }
// // // //     );
// // // //   }
// // // // });
// // serve(async (req) => {
// //   // ────────── CORS pre-flight ──────────
// //   if (req.method === 'OPTIONS') {
// //     return new Response(null, { status: 200, headers: corsHeaders });
// //   }

// //   // ────────── Parse body once ──────────
// //   let body;
// //   try { body = await req.json(); }
// //   catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }

// //   const { action, resumeText = '', text = '', userId = '', sentences = [] } = body;
// //   const resolvedText = resumeText || text;               // one name is enough

// //   try {
// //     let payload;

// //     switch (action) {

// //       // ===== improve-bullets =================================================
// //       case 'improve-bullets': {
// //         if (!userId) throw new Error('userId is required for improve-bullets');
// //         payload = await bulletImprover(userId);
// //         break;
// //       }

// //       // ===== get-roast =======================================================
// //       case 'get-roast': {
// //         if (!resolvedText) throw new Error('resumeText is required for get-roast');
// //         payload = getResumeRoast(resolvedText, userId);   // nothing else
// //         break;
// //       }

// //       // ===== analyze =========================================================
// //       case 'analyze': {

// //         if (resolvedText) {
// //           getResumeRoast(resolvedText, userId);
// //         }
// //         if (!resolvedText && sentences.length === 0) {
// //           return new Response(JSON.stringify({ error: 'resumeText or sentences required for analyze' }),
// //                               { status: 400, headers: corsHeaders });
// //         }

// //         // 1. Get sentences (use supplied list if you passed it)
// //         const finalSentences = sentences.length
// //           ? sentences
// //           : await detectSentences(resolvedText, userId);

// //         // 2. Run core analysis
// //         payload = await analyzeResume(resolvedText, userId, finalSentences);
// //         break;
// //       }

// //       // ===== detect-sentences only (optional) ================================
// //       case 'detect-sentences': {
// //         payload = await detectSentences(resolvedText, userId);
// //         break;
// //       }

// //       // ===== unknown =========================================================
// //       default:
// //         return new Response(JSON.stringify({ error: 'Unknown action' }),
// //                             { status: 404, headers: corsHeaders });
// //     }

// //     return new Response(JSON.stringify(payload), {
// //       headers: { 'Content-Type': 'application/json', ...corsHeaders },
// //     });

// //   } catch (err) {
// //     console.error(err);
// //     return new Response(JSON.stringify({ error: err.message }),
// //                         { status: 500, headers: corsHeaders });
// //   }
// // });
// serve(async (req) => {
//   const startTime = Date.now();
//   // Handle CORS pre-flight with early return
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { status: 200, headers: corsHeaders });
//   }

//   // Parse request body with error handling
//   let body;
//   try { 
//     body = await req.json();
//   } catch {
//     return new Response(JSON.stringify({ error: 'Invalid JSON' }), 
//                       { status: 400, headers: corsHeaders });
//   }

//   // Destructure and normalize inputs
//   const { action, resumeText = '', text = '', userId = '', sentences = [] } = body;
//   const resolvedText = resumeText || text;

//   try {
//     // Use a request cache map with composite keys to avoid duplicate processing
//     const cacheKey = `${action}:${userId}:${resolvedText.substring(0, 50)}`;
//     const requestCache = new Map();
    
//     if (requestCache.has(cacheKey)) {
//       console.log('Using cached request result');
//       return new Response(JSON.stringify(requestCache.get(cacheKey)), {
//         headers: { 'Content-Type': 'application/json', ...corsHeaders },
//       });
//     }

//     let payload;

//     // Fire off getResumeRoast early for action='analyze' but don't await
//     let roastPromise;
//     if (action === 'analyze' && resolvedText) {
//       roastPromise = getResumeRoast(resolvedText, userId);
//     }

//     switch (action) {
//       case 'improve-bullets': {
//         if (!userId) throw new Error('userId is required for improve-bullets');
//         payload = await bulletImprover(userId);
//         break;
//       }
      
//       case 'get-roast': {
//         if (!resolvedText) throw new Error('resumeText is required for get-roast');
//         payload = await getResumeRoast(resolvedText, userId);
//         break;
//       }
      
//       case 'analyze': {
//         // Input validation
//         if (!resolvedText && sentences.length === 0) {
//           return new Response(JSON.stringify({ 
//             error: 'resumeText or sentences required for analyze' 
//           }), { status: 400, headers: corsHeaders });
//         }

//         // 1. Detect sentences only if necessary - avoid if provided
//         const finalSentences = sentences.length > 0
//           ? sentences
//           : await detectSentences(resolvedText, userId);
        
//         // 2. Run core analysis
//         payload = await analyzeResume(resolvedText, userId, finalSentences);
        
//         // Store in cache for 5 minutes
//         requestCache.set(cacheKey, payload);
//         setTimeout(() => requestCache.delete(cacheKey), 5 * 60 * 1000);
//         break;
//       }
      
//       case 'detect-sentences': {
//         payload = await detectSentences(resolvedText, userId);
//         break;
//       }
      
//       default:
//         return new Response(JSON.stringify({ error: 'Unknown action' }),
//                           { status: 404, headers: corsHeaders });
//     }
//     const endTime = Date.now();
//     console.log(`Resume analyzer completed in ${(endTime - startTime) / 1000}s`);
//     return new Response(JSON.stringify(payload), {
//       headers: { 'Content-Type': 'application/json', ...corsHeaders },
//     });
//   } catch (err) {
//     console.error(err);
//     return new Response(JSON.stringify({ error: err.message }),
//                       { status: 500, headers: corsHeaders });
//   }
  
// });

// // Optimize the resume analysis function to process in batches with parallelism
// export async function analyzeResume(resumeText, userId, sentences = []) {
//   console.log('Running Resume Analyzer');
//   const startTime = Date.now();
//   // Early return for empty inputs
//   if (!resumeText && (!Array.isArray(sentences) || sentences.length === 0)) {
//     return getDefaultErrorResponse();
//   }
  
//   // Initialize bulletPoints from passed-in sentences
//   let bulletPoints = Array.isArray(sentences) && sentences.length > 0 ? sentences : [];

//   // If no bullets provided, try to load from database first (if userId is available)
//   if (bulletPoints.length === 0 && userId) {
//     console.log('No sentences provided, attempting to load from database');
//     try {
//       const { data: existingData } = await supabase
//         .from('resumes')
//         .select('sentences')
//         .eq('user_id', userId)
//         .order('uploaded_at', { ascending: false })
//         .limit(1)
//         .maybeSingle();
        
//       if (existingData?.sentences && Array.isArray(existingData.sentences)) {
//         bulletPoints = existingData.sentences;
//         console.log(`Loaded ${bulletPoints.length} bullet points from database`);
//       }
//     } catch (error) {
//       console.error('Error loading sentences from database:', error);
//     }
//   }
  
//   // If no bullets provided, try to extract them
//   if (bulletPoints.length === 0) {
//     try {
//       // Use Promise.race with timeout for bullet extraction
//       const extractionPromise = extractBulletPoints(resumeText);
//       const timeoutPromise = new Promise((_, reject) => 
//         setTimeout(() => reject(new Error('Bullet extraction timed out')), 15000) // Reduced timeout
//       );
      
//       bulletPoints = await Promise.race([extractionPromise, timeoutPromise]);
//       console.log(`Extracted ${bulletPoints.length} bullet points`);
      
//       // Fallback extraction if main method fails or returns empty
//       if (!bulletPoints || bulletPoints.length === 0) {
//         bulletPoints = fallbackExtractBullets(resumeText);
//         console.log(`Fallback extracted ${bulletPoints.length} bullet points`);
//       }
//     } catch (err) {
//       console.error('Error extracting bullet points:', err);
//       bulletPoints = fallbackExtractBullets(resumeText);
//       console.log(`Fallback extracted ${bulletPoints.length} bullet points`);
//     }
//   }
  
//   // If still no bullets, return default response
//   if (bulletPoints.length === 0) {
//     return getDefaultErrorResponse();
//   }
  
//   // Process bullets in parallel with optimal batch size and concurrency control
//   const analyzed = await analyzeBulletsInParallel(bulletPoints);
  
//   // Calculate scores, grades, etc.
//   const results = calculateScoresAndGrades(analyzed);
  
//   // Get AI analysis asynchronously while saving to DB
//   const aiAnalysisPromise = enhanceWithGroq(resumeText, {
//     bullets: results.bullets,
//     letter_grade: results.letter_grade,
//     resume_percent: results.resume_percent,
//   });
  
//   // Start DB save operation in parallel if userId provided
//   let dbSavePromise;
//   if (userId) {
//     const analysisData = {
//       bullets: results.bullets,
//       resume_average: results.weightedAverage,
//       resume_percent: results.resume_percent,  // Use the snake_case property
//       letter_grade: results.letter_grade
//     };
    
//     dbSavePromise = saveAnalysisToDatabase(userId, analysisData);
//   }
  
//   // Wait for AI analysis to complete
//   const aiAnalysis = await aiAnalysisPromise;
  
//   // Complete the results with AI analysis
//   const completeResults = {
//     ...results,
//     themes: aiAnalysis.themes,
//     elevator_pitch: aiAnalysis.elevator_pitch,
//     explanation: aiAnalysis.explanation
//   };
  
//   // If we started a DB save, update with complete results
//   if (dbSavePromise && userId) {
//     // Update DB with AI analysis results
//     const finalAnalysisData = {
//       bullets: results.bullets,
//       resume_average: results.weightedAverage,
//       resume_percent: results.resume_percent,  // Use the snake_case property
//       letter_grade: results.letter_grade,
//       themes: aiAnalysis.themes,
//       elevator_pitch: aiAnalysis.elevator_pitch,
//       explanation: aiAnalysis.explanation
//     };
    
//     await updateAnalysisInDatabase(userId, finalAnalysisData);
//   }
//   const endTime = Date.now();
//   console.log(`Analyze resume completed in ${(endTime - startTime) / 1000}s`);
//   return completeResults;
// }

// // Helper function to analyze bullets in parallel with controlled concurrency
// async function analyzeBulletsInParallel(bulletPoints) {
//   const BATCH_SIZE = 10; // Increased from 5
//   const MAX_CONCURRENT_BATCHES = 3;
//   const analyzed = [];
//   const startTime = Date.now();
  
//   // Process in batches with controlled concurrency
//   for (let i = 0; i < bulletPoints.length; i += BATCH_SIZE * MAX_CONCURRENT_BATCHES) {
//     const batchPromises = [];
    
//     // Create multiple batch promises
//     for (let j = 0; j < MAX_CONCURRENT_BATCHES; j++) {
//       const startIndex = i + (j * BATCH_SIZE);
//       if (startIndex < bulletPoints.length) {
//         const batch = bulletPoints.slice(startIndex, startIndex + BATCH_SIZE);
//         batchPromises.push(processBulletBatch(batch));
//       }
//     }
    
//     // Process batches concurrently
//     const batchResults = await Promise.all(batchPromises);
//     analyzed.push(...batchResults.flat());
//   }
//   const endTime = Date.now();
//   console.log(`Analyze bullets completed in ${(endTime - startTime) / 1000}s`);
//   return analyzed;
// }

// // Process a single batch of bullets
// async function processBulletBatch(batch) {
//   const batchPromises = batch.map(bullet => analyzeOneBullet(bullet));
  
//   try {
//     // Process batch with timeout
//     return await Promise.race([
//       Promise.all(batchPromises),
//       new Promise((_, reject) => 
//         setTimeout(() => reject(new Error('Batch analysis timed out')), 15000) // Reduced timeout
//       )
//     ]);
//   } catch (err) {
//     console.error('Error processing batch:', err);
//     // Add default analysis for failed batch
//     return batch.map(bullet => ({
//       original: bullet,
//       word_balance: {},
//       xyz_scores: {},
//       bullet_total: 10
//     }));
//   }
// }

// // Analyze a single bullet point
// async function analyzeOneBullet(bullet) {
//   try {
//     const wb = analyzeWordBalance(bullet);
//     const xyz = xyzCheck(bullet);
    
//     // Add minimum content requirements
//     const hasMinimumContent = bullet.length > 20 && bullet.split(/\s+/).length > 4;
//     const contentPenalty = hasMinimumContent ? 0 : 25;
    
//     // Calculate total score
//     const total = Math.max(0, xyz.xyz_total - contentPenalty);
    
//     return {
//       original: bullet,
//       word_balance: wb,
//       xyz_scores: xyz,
//       bullet_total: total,
//       id: bullets[i].id,
//       // id: generateBulletId(bullet) // Add unique ID for tracking
//     };
//   } catch (err) {
//     console.error('Error on bullet:', err);
//     return {
//       original: bullet,
//       word_balance: {},
//       xyz_scores: {},
//       bullet_total: 10,
//       id: bullets[i].id,
//       // id: generateBulletId(bullet)
//     };
//   }
// }

// // Calculate scores and grades based on analyzed bullets
// function calculateScoresAndGrades(analyzed) {
//   // Sort bullets by score (highest first)
//   const sortedBullets = analyzed.sort((a, b) => b.bullet_total - a.bullet_total);
  
//   // Determine how many high-quality bullets exist (score > 80)
//   const highQualityBullets = sortedBullets.filter(b => b.bullet_total > 80).length;
//   const totalBullets = sortedBullets.length;
//   const highQualityRatio = totalBullets > 0 ? highQualityBullets / totalBullets : 0;
  
//   // Calculate weighted average (giving more weight to top bullets)
//   const weightedScores = sortedBullets.map((bullet, index) => {
//     const weight = Math.max(2.0 - index * 0.2, 1.0);
//     return bullet.bullet_total * weight;
//   });
  
//   const weightedTotal = weightedScores.reduce((sum, score) => sum + score, 0);
//   const weightedAverage = weightedTotal / weightedScores.length;
  
//   // Calculate final score with quality bonus
//   let percent = 30 + weightedAverage / 100 * 70;
//   const qualityBonus = highQualityRatio * 15;
//   percent = Math.min(100, percent + qualityBonus);
  
//   // Determine letter grade using helper function
//   const letterGrade = getLetterGrade(percent);
  
//   return {
//     bullets: sortedBullets,
//     weightedAverage,
//     resume_percent: percent,    // Changed from percent
//     letter_grade: letterGrade 
//   };
// }

// // Save analysis to database
// async function saveAnalysisToDatabase(userId, analysisData) {
//   try {
//     const { error: updateError } = await supabase.from('resumes').update({
//       analyzed_at: new Date().toISOString(),
//       analysis_complete: true,
//       analysis: analysisData
//     }).eq('user_id', userId);
    
//     if (updateError) {
//       console.error('Error saving analysis to database:', updateError);
//       throw new Error('Failed to save analysis results');
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Error saving to database:', error);
//     return false;
//   }
// }

// // Update analysis in database with AI results
// async function updateAnalysisInDatabase(userId, finalAnalysisData) {
//   try {
//     const { error: updateError } = await supabase.from('resumes').update({
//       analysis: finalAnalysisData
//     }).eq('user_id', userId);
    
//     if (updateError) {
//       console.error('Error updating analysis in database:', updateError);
//     }
    
//     return !updateError;
//   } catch (error) {
//     console.error('Error updating database:', error);
//     return false;
//   }
// }

// // Get default error response
// function getDefaultErrorResponse() {
//   return {
//     bullets: [],
//     resume_average: 0,
//     resume_percent: 0,
//     letter_grade: 'Err',
//     themes: ['Format your resume with clear bullet points'],
//     elevator_pitch: 'We couldn\'t detect formatted bullet points.',
//     explanation: 'Please organize your experience in clear bullet points.'
//   };
// }

// // Optimized version of bulletImprover with improved caching and execution
// export async function bulletImprover(userId, enhanced = null) {
//   console.log('Running bullet improver');
//   const startTime = Date.now();
//   // Use cache if available (keyed by userId)
//   const cacheKey = `improve-bullets:${userId}`;
//   if (bulletCache.has(cacheKey)) {
//     console.log('Using cached bullet improvements');
//     return bulletCache.get(cacheKey);
//   }
  
//   // Get analysis data - use enhanced if provided or fetch from DB
//   const analysisData = await getAnalysisData(userId, enhanced);
//   if (!analysisData.success) {
//     return analysisData;
//   }
  
//   const { bullets, analysis } = analysisData;
  
//   // Process bullets in parallel
//   try {
//     console.log(`Found ${bullets.length} bullets to improve`);
//     const sortedBullets = [...bullets].sort((a, b) => b.bullet_total - a.bullet_total);

//     console.log(`Sorted ${sortedBullets.length} bullets by score. ${sortedBullets[0]?.bullet_total} is the highest score. ${sortedBullets[0]?.original}`); 
//     // 2. Process bullets in parallel with proper error handling
//     const enhancedBullets = await processBulletsInParallel(sortedBullets, userId);
//     console.log(`Enhanced ${enhancedBullets.length} bullets`);

//     // 3. Map the enhanced bullets back to their original positions using id
//     const finalBullets = bullets.map(originalBullet => {
//       const enhanced = enhancedBullets.find(eb => eb.id === originalBullet.id);
//       return enhanced || {
//         ...originalBullet,
//         rewritten: originalBullet.original,
//         tips: "Could not generate improvements for this bullet point."
//       };
//     });

//     console.log(`Mapped ${finalBullets.length} bullets back to their original positions`);

//     // 4. Update the analysis with enhanced bullets
//     const updatedAnalysis = {
//       ...analysis,
//       bullets: finalBullets,
//       updated_at: new Date().toISOString()
//     };

//     console.log(`Updated analysis with ${updatedAnalysis.bullets.length} enhanced bullets`);  

//     // 5. Save the enhanced analysis back to the database
//     await supabase
//       .from('resumes')
//       .update({ 
//         analysis: updatedAnalysis,
//         improvements_complete: true
//       })
//       .eq('user_id', userId);
//     console.log('Enhanced analysis saved to database');

//     return {
//       success: true,
//       analysis: updatedAnalysis
//     };
//     // const enhancedBullets = await processBulletsInParallel(bullets, userId);
    
//     // // Update analysis with enhanced bullets
//     // const updatedAnalysis = mapEnhancementsToBullets(bullets, enhancedBullets)
//     // // Save to database
//     // await saveEnhancedAnalysis(userId, updatedAnalysis);
//     // console.log('Enhanced analysis saved to database');
    
//     // // Cache the result
//     // const result = {
//     //   success: true,
//     //   analysis: updatedAnalysis
//     // };
//     // bulletCache.set(cacheKey, result);
    
//     // // Set cache expiration (10 minutes)
//     // setTimeout(() => bulletCache.delete(cacheKey), 10 * 60 * 1000);
//     // const endTime = Date.now();
//     // console.log(`Bullet improver completed in ${(endTime - startTime) / 1000}s`);
    
//     // return result;
//   } catch (error) {
//     console.error('Error processing bullets:', error);
//     return {
//       success: false,
//       error: 'Failed to process bullets'
//     };
//   }
// }

// // Helper function to get analysis data
// async function getAnalysisData(userId, enhanced = null) {
//   // Use provided enhanced analysis if available
//   if (enhanced?.bullets && enhanced.bullets.length > 0) {
//     console.log('Using provided enhanced analysis');
//     return {
//       success: true,
//       bullets: enhanced.bullets,
//       analysis: enhanced
//     };
//   }
  
//   // Otherwise fetch from database
//   console.log('Fetching analysis from database');
//   const { data: currentData, error: fetchError } = await supabase
//     .from('resumes')
//     .select('analysis, text, analyzed_at, analysis_complete, improvements_complete')
//     .eq('user_id', userId)
//     .order('uploaded_at', { ascending: false })
//     .limit(1)
//     .maybeSingle();
  
//   if (fetchError) {
//     console.error('Error fetching current analysis:', fetchError);
//     return {
//       success: false,
//       error: 'Failed to fetch analysis'
//     };
//   }
  
//   // // Check if analysis is complete
//   // if (!currentData?.analysis_complete) {
//   //   console.error('Analysis not complete');
//   //   return {
//   //     success: false,
//   //     error: 'Analysis not complete - please wait for analysis to finish'
//   //   };
//   // }
  
//   // // Check if improvements are already complete
//   // if (currentData?.improvements_complete) {
//   //   console.log('Improvements already complete');
//   //   return {
//   //     success: true,
//   //     analysis: currentData.analysis
//   //   };
//   // }
//   console.log("Current Bullet Data", currentData?.analysis?.bullets);
//   // Check if we have valid bullets
//   if (!currentData?.analysis?.bullets || !currentData.analysis.bullets.length) {
//     console.error('No bullets found in analysis');
//     return {
//       success: false,
//       error: 'No bullets found - please ensure analysis is complete first'
//     };
//   }

//   // // Check if we have valid bullets
//   // if (!currentData?.enhanced_analysis?.bullets || !currentData.enhanced_analysis.bullets.length) {
//   //   console.error('No bullets found in enhanced analysis');
//   //   return {
//   //     success: true,
//   //     error: 'No improved bullets found - please ensure analysis is complete first'
//   //   };
//   // }
  
//   return {
//     success: true,
//     bullets: currentData.analysis.bullets,
//     analysis: currentData.analysis
//   };
// }

// // Helper function to map enhancements back to original bullets
// function mapEnhancementsToBullets(originalBullets, enhancedBullets) {
//   return originalBullets.map(originalBullet => {
//     const enhanced = enhancedBullets.find(eb => eb.id === originalBullet.id);
//     return enhanced || {
//       ...originalBullet,
//       rewritten: originalBullet.original,
//       tips: "Could not generate improvements for this bullet point.",
//       id: originalBullet.id
//     };
//   });
// }

// // Helper function to save enhanced analysis
// async function saveEnhancedAnalysis(userId, updatedAnalysis) {
//   const { error: updateError } = await supabase
//     .from('resumes')
//     .update({ 
//       enhanced_analysis: updatedAnalysis,
//       improvements_complete: true
//     })
//     .eq('user_id', userId);
  
//   if (updateError) {
//     console.error('Error saving enhanced analysis:', updateError);
//     throw new Error('Failed to save enhanced analysis');
//   }
  
//   return true;
// }

// // Optimized getResumeRoast function with better caching and timeouts
// async function getResumeRoast(resumeText, userId) {
//   console.log('Running Resume Roast');
//   const startTime = Date.now();
  
//   // Use caching effectively
//   const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 50)}:roast`;
//   if (roastCache.has(cacheKey)) {
//     console.log('Using cached roast');
//     return {
//       roast: roastCache.get(cacheKey)
//     };
//   }
  
//   if (!resumeText) {
//     return {
//       roast: 'I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it.'
//     };
//   }
  
//   try {
//     callTracking.addCall();
    
//     // Set up timeout promise to abort if taking too long
//     const timeoutPromise = new Promise((_, reject) => 
//       setTimeout(() => reject(new Error('Roast generation timed out')), 45000)
//     );
    
//     // Set up AI call promise
//     const system = "You are a brutally honest resume critic. " + 
//                    "Your job is to point out the real issues in a resume without sugarcoating, " + 
//                    "then provide actionable advice.";
    
//     const user = `
//     I'm looking at this resume text:
//     ${resumeText.substring(0, 3500)}
    
//     Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. 
//     Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager 
//     who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, 
//     what's missing, what makes you roll your eyes, and what makes you scroll past me? 
//     Give me the real — and then tell me how to fix it so I actually start landing opportunities.
    
//     Be specific and provide actionable advice. Format your response with no markdown, just clean text. 
//     Keep it to 3-4 paragraphs maximum.
//     `.trim();
    
//     // Call LLM with timeout
//     const roastTextPromise = callLLMWithRetry(system, user);
//     const roastText = await Promise.race([roastTextPromise, timeoutPromise]);
    
//     // Clean up the response
//     const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
//                                .replace(/^[–\-*\s]*|:/g, '')
//                                .trim();
    
//     // Cache the result
//     roastCache.set(cacheKey, cleanRoast);
    
//     // Set cache expiration (30 minutes)
//     setTimeout(() => roastCache.delete(cacheKey), 30 * 60 * 1000);
    
//     // Store in database if user ID provided
//     if (userId) {
//       await supabase.from('resumes').update({
//         resume_roast: cleanRoast
//       }).eq('user_id', userId);
      
//       const endTime = Date.now();
//       console.log(`Roast/Assessment: Function completed in ${(endTime - startTime) / 1000}s`);
//     }
    
//     return {
//       roast: cleanRoast
//     };
//   } catch (err) {
//     console.error('Error getting resume roast:', err);
//     return {
//       roast: 'Your resume needs more specific accomplishments and metrics.'
//     };
//   }
// }