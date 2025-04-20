// Add this at the top of the file
console.log('Resume analyzer function hit');
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { serveBulletImprover } from "./bulletImprover.ts";
import { detectSentences } from "./sentenceDetector.ts";
import { corsHeaders } from "./utils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const roastCache = new Map();
const bulletCache = new Map();
export { detectSentences };
export { serveBulletImprover };

// Sentence detector endpoint
export function serveSentenceDetector(resumeText, userId) {
  return async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }
    try {
      // We'll use the params passed in from the main handler
      if (!resumeText || typeof resumeText !== 'string') {
        return new Response(JSON.stringify({
          error: 'Missing or invalid text parameter'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // Extract sentences
      const sentences = await detectSentences(resumeText, userId);
      console.log("User: ", userId, "Sentences: ", sentences);      
      return new Response(JSON.stringify({
        sentences
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error in sentence detector service:', error);
      return new Response(JSON.stringify({
        error: error.message || 'Failed to detect sentences'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  };
}

// Generate a resume roast and store it
async function getResumeRoast(resumeText, userId) {
  console.log('Running resume roast');
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
    const groqApiKey = Deno.env.get('GROQ');
    if (!groqApiKey) throw new Error('GROQ API key not found');
    const prompt = `I'm looking at this resume text:        
        ${resumeText.substring(0, 4000)}        
        Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
        Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.`
      ; 
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [  
          { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
          { role: "user", content: prompt }
                  ],
        temperature: 0.7,
        max_tokens: 750
      })
    });
    if (!resp.ok) throw new Error('GROQ API error');
    const result = await resp.json();
    const roastText = result.choices[0].message.content.trim();
    console.log("Roast/Assessment: ", roastText)
    const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();
    console.log("Cleaned Roast/Assessment: ", cleanRoast)
    roastCache.set(cacheKey, cleanRoast);
    if (userId) {
      await supabase.from('resumes').update({
        initial_assessment: cleanRoast
      }).eq('user_id', userId);
      console.log('Roast/Assessment stored in database for user:', userId);
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
 */
export async function analyzeResume(resumeText, userId, sentences = []) {
  let text = resumeText || '';
  console.log('Provided text:', text.length, 'characters');

  // Initialize bulletPoints from passed-in sentences
  // let bulletPoints = Array.isArray(sentences) && sentences.length > 0 ? sentences : [];
  // if (bulletPoints.length) {
  //   console.log(`Using ${bulletPoints.length} pre-detected sentences for analysis`);
  // }

  let bulletPoints = []

  try {
    // If no bullets and userId is present, try retrieving from database
    if (bulletPoints.length === 0 && userId) {
      console.log('No bullets passed in; checking database for userId=', userId);
      const { data: existing, error: fetchError } = await supabase
        .from('resumes')
        .select('text, sentences')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
        resume_percent: 50,
        letter_grade: 'C',
        themes: ['Format your resume with clear bullet points'],
        elevator_pitch: 'We couldn\'t detect formatted bullet points.',
        explanation: 'Please organize your experience in clear bullet points.'
      };
    }

    // Core bullet-by-bullet analysis
    console.log('Analyzing', bulletPoints.length, 'bullet points');
    const analyzed = await Promise.all(bulletPoints.map(async (bullet) => {
      try {
        const wb = analyzeWordBalance(bullet);
        const xyz = xyzCheck(bullet);
        const total = wb.word_balance_score + xyz.xyz_total;
        const rewritten = await rewriteBullet(bullet, { xyz_scores: xyz });
        const tips = await generateTips(bullet, { xyz_scores: xyz, word_balance_score: wb.word_balance_score });
        return { original: bullet, word_balance: wb, xyz_scores: xyz, bullet_total: total, rewritten, tips };
      } catch (err) {
        console.error('Error on bullet:', err);
        return { original: bullet, word_balance: {}, xyz_scores: {}, bullet_total: 10, rewritten: bullet, tips: 'Analysis failed.' };
      }
    }));

    // Aggregate scores
    const totalScore = analyzed.reduce((sum, b) => sum + b.bullet_total, 0);
    const avg = totalScore / analyzed.length;
    const percent = Math.max(Math.min((avg / 45) * 100, 100), 30);
    let grade = getLetterGrade(percent);
    if (grade === 'F') grade = 'D';
    const themes = generateThemes(analyzed);

    // Base response
    const basic = {
      bullets: analyzed,
      resume_average: avg,
      resume_percent: parseFloat(percent.toFixed(1)),
      letter_grade: grade,
      themes,
      elevator_pitch: 'Experienced professional ...',
      explanation: `Your resume received a ${grade} grade (${percent}%).`
    };

    // Optionally enhance via GROQ
    let enhanced;
    try {
      enhanced = await enhanceWithGroq(text, basic);
      console.log('Enhanced analysis:', enhanced);
    } catch (err) {
      console.error('GROQ enhancement error:', err);
      enhanced = basic;
    }

    // Persist analysis and trigger roast
    if (userId) {
      await supabase.from('resumes').update({ analysis: enhanced, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      console.log('Saved analysis to database');
      getResumeRoast(text, userId);
    }

    return enhanced;

  } catch (err) {
    console.error('Analysis error:', err);
    return {
      bullets: [],
      resume_average: 25,
      resume_percent: 50,
      letter_grade: 'C',
      themes: ['Error during analysis'],
      elevator_pitch: 'Error occurred',
      explanation: `Error: ${err.message}`
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  console.log("Sentences passed in: ")

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  console.log('URL:', url, 'Path:', path);

  try {
    // Parse the request body once
    const { action, resumeText, text, userId } = await req.json();
    const resolvedText = resumeText || text;
    console.log('User:', userId, 'Text length:', resolvedText?.length || 0);

    // Consolidated sentence detection + analysis
    if (path === 'detect-sentences' || path === 'analyze' || path === 'resume-analyzer' || !path) {
      console.log('Running sentence detection + analysis');

      // Invoke the sentence detector
      const detectRequest = new Request(new URL('/detect-sentences', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ text: resolvedText, userId })
      });

      const detectRes = await serveSentenceDetector(resolvedText, userId)(detectRequest);
      if (!detectRes.ok) {
        return detectRes;
      }

      // Parse out the array of sentences
      const { sentences } = await detectRes.json();
      console.log('Detected', sentences.length, 'sentences');

      // Run resume analysis
      const analysisResult = await analyzeResume(resolvedText, userId, sentences);
      return new Response(JSON.stringify(analysisResult), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Fallback: unrecognized path or action
    console.log('No handler for path:', path, 'or action:', action);
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});