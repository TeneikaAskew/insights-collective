// Add this at the top of the file
console.log('Resume Roast and Analyzer function hit');
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
import { detectSentences } from "./sentenceDetector.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { supabase, callLLMWithRetry, corsHeaders } from './utils.ts';
// To:
import { config as bulletImproverConfig } from "./bulletImprover.ts";
const roastCache = new Map();
const bulletCache = new Map();
export { detectSentences };
// export { serveBulletImprover };
export { bulletImproverConfig };
// Generate a resume roast and store it
async function getResumeRoast(resumeText, userId) {
  console.log('Running Resume Roast');
  const startTime = Date.now();
  const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
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
    // const groqApiKey = Deno.env.get('GROQ');
    // if (!groqApiKey) throw new Error('GROQ API key not found');
    // const prompt = `I'm looking at this resume text:        
    //     ${resumeText.substring(0, 3500)}        
    //     Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
    //     Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.`
    //   ; 
    // const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     Authorization: `Bearer ${groqApiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     model: 'compound-beta-mini', //'llama-3.1-8b-instant',//'llama3-70b-8192',
    //     messages: [  
    //       { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
    //       { role: "user", content: prompt }
    //               ],
    //     temperature: 0.7,
    //     max_tokens: 750
    //   })
    // });
    // if (!resp.ok) throw new Error('GROQ API error');
    // const result = await resp.json();
    // const roastText = result.choices[0].message.content.trim();
    const system = "You are a brutally honest resume critic. " + "Your job is to point out the real issues in a resume without sugarcoating, " + "then provide actionable advice.";
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
    // 2. Call the helper with retry/backoff
    const roastText = await callLLMWithRetry(system, user);
    console.log("Roast/Assessment: ", roastText);
    const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();
    console.log("Cleaned Roast/Assessment: ", cleanRoast);
    roastCache.set(cacheKey, cleanRoast);
    if (userId) {
      await supabase.from('resumes').update({
        resume_roast: cleanRoast
      }).eq('user_id', userId);
      console.log('Roast/Assessment stored in database for user:', userId);
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
/**
 * Analyze a user's resume by processing provided sentences or extracting bullet points.
 * @param {string} resumeText - Raw resume text.
 * @param {string} userId - User identifier for DB operations.
 * @param {string[]} sentences - Array of pre-detected sentences to use as bullet points.
 * @returns {Promise<object>} Enhanced analysis results.
 */ export async function analyzeResume(resumeText, userId, sentences = []) {
  console.log('Running Resume Analyzer');
  let text = resumeText || '';
  console.log('Provided text:', text.length, 'characters');
  // Initialize bulletPoints from passed-in sentences
  let bulletPoints = Array.isArray(sentences) && sentences.length > 0 ? sentences : [];
  if (bulletPoints.length) {
    console.log(`Using ${bulletPoints.length} pre-detected sentences for analysis`);
  }
  try {
    // If no bullets and userId is present, try retrieving from database
    if (bulletPoints.length === 0 && userId) {
      console.log('No bullets passed in; checking database for userId=', userId);
      const { data: existing, error: fetchError } = await supabase.from('resumes').select('text, sentences').eq('user_id', userId).order('uploaded_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (fetchError) console.error('DB fetch error:', fetchError);
      if (existing) {
        if (!text && existing.text) {
          text = existing.text;
          console.log('Retrieved text from database:', text.length, 'chars');
        }
        if (Array.isArray(existing.sentences) && existing.sentences.length > 0) {
          bulletPoints = existing.sentences;
          console.log(`Retrieved ${bulletPoints.length} bullets from database`);
        }
      }
    }
    // If still no bullets, extract from text
    if (!text) throw new Error('No resume text provided or found');
    if (bulletPoints.length === 0) {
      console.log('Extracting bullets from text');
      bulletPoints = await extractBulletPoints(text);
      console.log('Extracted', bulletPoints.length, 'bullets from text');
      if (bulletPoints.length === 0) {
        bulletPoints = fallbackExtractBullets(text);
        console.log('Fallback extracted', bulletPoints.length, 'bullets');
      }
      // Persist new bullets to DB
      if (bulletPoints.length > 0 && userId) {
        await supabase.from('resumes').update({
          sentences: bulletPoints,
          sentences_updated_at: new Date().toISOString()
        }).eq('user_id', userId);
        console.log('Saved bullets to database');
      }
    }
    // If still no bullets, return default C-response
    if (bulletPoints.length === 0) {
      return {
        bullets: [],
        resume_average: 0,
        resume_percent: 0,
        letter_grade: 'Err',
        themes: [
          'Format your resume with clear bullet points'
        ],
        elevator_pitch: 'We couldn\'t detect formatted bullet points.',
        explanation: 'Please organize your experience in clear bullet points.'
      };
    }
    // Core bullet-by-bullet analysis
    console.log('Analyzing', bulletPoints.length, 'bullet points');
    const analyzed = await Promise.all(bulletPoints.map(async (bullet)=>{
      try {
        const wb = analyzeWordBalance(bullet);
        const xyz = xyzCheck(bullet);
        // const total = wb.word_balance_score + xyz.xyz_total;
        // Use the new xyz_total directly instead of adding it to word_balance_score
        // const total = xyz.xyz_total; // Now on a 0-100 scale
        // const rewritten = await rewriteBullet(bullet, { xyz_scores: xyz });
        // const tips = await generateTips(bullet, { xyz_scores: xyz, word_balance_score: wb.word_balance_score });
        // return { original: bullet, word_balance: wb, xyz_scores: xyz, bullet_total: total, rewritten, tips };
        // Add minimum content requirements
        const hasMinimumContent = bullet.length > 20 && bullet.split(/\s+/).length > 4;
        const contentPenalty = hasMinimumContent ? 0 : 25;
        // Use the new xyz_total directly instead of adding it to word_balance_score
        // Apply minimum content penalty
        const total = Math.max(0, xyz.xyz_total - contentPenalty);
        return {
          original: bullet,
          word_balance: wb,
          xyz_scores: xyz,
          bullet_total: total
        };
      } catch (err) {
        console.error('Error on bullet:', err);
        // return { original: bullet, word_balance: {}, xyz_scores: {}, bullet_total: 10, rewritten: bullet, tips: 'Analysis failed.' };
        return {
          original: bullet,
          word_balance: {},
          xyz_scores: {},
          bullet_total: 10
        };
      }
    }));
    // Aggregate scores
    const totalScore = analyzed.reduce((sum, b)=>sum + b.bullet_total, 0);
    const avg = totalScore / analyzed.length;
    // const percent = Math.max(Math.min((avg / 45) * 100, 100), 30);
    // Recommended change
    // Sort bullets by score (highest first)
    const sortedBullets = analyzed.sort((a, b)=>b.bullet_total - a.bullet_total);
    // Step 1: Determine how many high-quality bullets exist (score > 80)
    const highQualityBullets = sortedBullets.filter((b)=>b.bullet_total > 80).length;
    const totalBullets = sortedBullets.length;
    const highQualityRatio = totalBullets > 0 ? highQualityBullets / totalBullets : 0;
    // Calculate weighted average (giving more weight to top bullets)
    const weightedScores = sortedBullets.map((bullet, index)=>{
      // Apply descending weights: 1.5, 1.4, 1.3, etc.
      // const weight = Math.max(1.5 - (index * 0.1), 1.0);
      // Apply stronger descending weights: 2.0, 1.8, 1.6, etc. for top bullets
      const weight = Math.max(2.0 - index * 0.2, 1.0);
      return bullet.bullet_total * weight;
    });
    const weightedTotal = weightedScores.reduce((sum, score)=>sum + score, 0);
    const weightedAverage = weightedTotal / weightedScores.length;
    // Convert to percentage (60% baseline + up to 60% from performance)
    // const percent = 40 + (weightedAverage / 100 * 60);
    // Step 3: Use a much lower baseline (30%) and give more weight to bullet quality
    let percent = 30 + weightedAverage / 100 * 70;
    // Step 4: Add a bonus for having a high percentage of quality bullets
    // This rewards resumes with consistently good content
    const qualityBonus = highQualityRatio * 15; // Up to 15% bonus for all high-quality bullets
    percent += qualityBonus;
    // Cap at 100%
    percent = Math.min(100, percent);
    // // Convert to percentage (60% baseline + up to 40% from performance)
    // const percent = 60 + (weightedAverage / 45 * 40);
    let grade = getLetterGrade(percent);
    if (grade === 'F') grade = 'D';
    // Base response
    const basic = {
      bullets: analyzed,
      resume_average: avg,
      resume_percent: parseFloat(percent.toFixed(1)),
      letter_grade: grade,
      // themes,
      elevator_pitch: 'Experienced professional ...',
      explanation: `Your resume received a ${grade} grade (${percent}%).`
    };
    // enhance via GROQ
    let enhanced;
    try {
      enhanced = await enhanceWithGroq(text, basic);
    } catch (err) {
      console.error('GROQ enhancement error:', err);
      const themes = generateThemes(analyzed);
      enhanced = {
        bullets: analyzed,
        resume_average: avg,
        resume_percent: parseFloat(percent.toFixed(1)),
        letter_grade: grade,
        themes,
        elevator_pitch: 'Experienced professional ...',
        explanation: `Your resume received a ${grade} grade (${percent}%).`
      };
      // Save the fallback analysis to the database for future use
      if (userId) {
        try {
          await supabase.from('resumes').update({
            fallback_analysis: enhanced,
            fallback_updated_at: new Date().toISOString()
          }).eq('user_id', userId);
          console.log('Successfully saved fallback analysis to database');
        } catch (dbError) {
          console.error('Error saving fallback analysis:', dbError);
        }
      }
    }
    // Persist analysis and trigger roast
    if (userId) {
      await supabase.from('resumes').update({
        analysis: enhanced,
        analysis_complete: true,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
      console.log('Saved analysis to database');
    }
    console.log('Successfully updated analysis_complete to TRUE for user:', userId);
    return enhanced;
  } catch (err) {
    console.error('Analysis error:', err);
    return {
      bullets: [],
      resume_average: 25,
      resume_percent: 50,
      letter_grade: 'C',
      themes: [
        'Error during analysis'
      ],
      elevator_pitch: 'Error occurred',
      explanation: `Error: ${err.message}`
    };
  }
}
export async function bulletImprover(userId, enhanced = null) {
  try {
    console.log(`Starting parallel bullet improvement for userId: ${userId}`);
    const { processBatchQueue } = await import('./bulletImprover.ts');
    
    let bullets;
    // First try to use the provided enhanced analysis if available
    if (enhanced?.bullets && enhanced.bullets.length > 0) {
      console.log('Using provided enhanced analysis');
      bullets = enhanced.bullets;
    } else {
      // Fall back to fetching from database
      console.log('No enhanced analysis provided, fetching from database');
      const { data: currentData, error: fetchError } = await supabase.from('resumes')
        .select('analysis, text')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current analysis:', fetchError);
        return { success: false, error: 'Failed to fetch analysis' };
      }

      if (!currentData?.analysis?.bullets || !currentData.analysis.bullets.length) {
        console.error('No bullets found in analysis');
        return { success: false, error: 'No bullets found' };
      }

      bullets = currentData.analysis.bullets;
    }

    console.log(`Found ${bullets.length} bullets to improve`);

    // Sort bullets by score so we process the highest scoring ones first
    const sortedBullets = [...bullets].sort((a, b) => b.bullet_total - a.bullet_total);
    
    // Process bullets in parallel
    const enhancedBullets = await processBatchQueue(sortedBullets, userId);
    
    // Map the enhanced bullets back to their original positions
    const finalBullets = bullets.map(originalBullet => {
      const enhanced = enhancedBullets.find(eb => eb.id === originalBullet.id);
      return enhanced || {
        ...originalBullet,
        rewritten: originalBullet.original,
        tips: "This bullet wasn't processed."
      };
    });

    const processedCount = finalBullets.filter(b => b.rewritten !== b.original).length;
    console.log(`Successfully processed ${processedCount} out of ${bullets.length} bullets`);

    // Store the enhanced bullets in a separate column
    const result = await supabase.from('resumes')
      .update({
        enhanced_analysis: finalBullets,
        improvements_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (result.error) {
      throw result.error;
    }

    console.log('Successfully saved improved bullets to database');
    return {
      success: true,
      count: finalBullets.length,
      processed: processedCount
    };

  } catch (error) {
    console.error('Bullet improver error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  console.log('URL:', url, 'Path:', path);
  try {
    // Parse the request body once
    const { action, resumeText, text, userId } = await req.json();
    console.log('Action:', action, 'User:', userId, 'Text length:', (resumeText || text)?.length || 0);
    // Special endpoint for improving bullets - handle this first before any other processing
    if (action === 'improve-bullets' && userId) {
      console.log('Running bullet improver only');
      const result = await bulletImprover(userId);
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // For all other actions, proceed with standard analysis flow
    const resolvedText = resumeText || text;
    console.log('User:', userId, 'Text length:', resolvedText?.length || 0);
    // Consolidated sentence detection + analysis (main flow)
    if (!action && (path === 'detect-sentences' || path === 'analyze' || path === 'resume-analyzer' || !path)) {
      console.log('Running sentence detection + analysis');
      // Optionally trigger the roast in the background 
      if (resolvedText) {
        getResumeRoast(resolvedText, userId);
      }
      // Only run sentence detection if we have text
      let sentences = [];
      if (resolvedText) {
        sentences = await detectSentences(resolvedText, userId);
        console.log('Direct detectSentences():', sentences.length);
      } else if (userId) {
        // If no text but we have userId, try to load sentences from database
        console.log('No text provided, attempting to load sentences from database');
        try {
          const { data: existingData } = await supabase.from('resumes').select('sentences').eq('user_id', userId).order('uploaded_at', {
            ascending: false
          }).limit(1).maybeSingle();
          if (existingData?.sentences && Array.isArray(existingData.sentences)) {
            sentences = existingData.sentences;
            console.log(`Loaded ${sentences.length} sentences from database`);
          }
        } catch (error) {
          console.error('Error loading sentences from database:', error);
        }
      }
      // Run resume analysis 
      const analysisResult = await analyzeResume(resolvedText, userId, sentences);
      // Prepare the response
      const response = new Response(JSON.stringify(analysisResult), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
      return response;
    }
    // Fallback: unrecognized path or action
    console.log('No handler for path:', path, 'or action:', action);
    return new Response(JSON.stringify({
      error: 'Not found'
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({
      error: err.message || 'Internal error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
