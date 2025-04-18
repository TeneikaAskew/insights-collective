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
const bulletCache = new Map(); // Added missing declaration
export { detectSentences };
export { serveBulletImprover };

// Helper function to save sentences to database
async function saveSentencesToDatabase(userId, sentences) {
  if (userId) {
    try {
      await supabase.from('resumes').update({
        sentences: sentences,
        sentences_updated_at: new Date().toISOString()
      }).eq('user_id', userId);
      console.log('Sentences stored in database for user:', userId);
    } catch (error) {
      console.error('Error saving sentences to database:', error);
    }
  }
}

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
      
      if (userId) {
        await saveSentencesToDatabase(userId, sentences);
      }
      
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
    const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();
    roastCache.set(cacheKey, cleanRoast);
    if (userId) {
      await supabase.from('resumes').update({
        initial_assessment: cleanRoast
      }).eq('user_id', userId);
      console.log('Assessment stored in database for user:', userId);
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

// Main resume analysis logic
async function analyzeResume(resumeText, userId) {
  let text = resumeText;
  console.log("Text", text)
  try {
    if (userId) {
      console.log("Run analyze resume for user: ", userId)
      const { data: existing, error: fetchError } = await supabase
        .from('resumes')
        .select('id,text')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })  // Order by upload date, newest first
        .limit(1)  // Only get the most recent record
        .maybeSingle();
      if (fetchError) console.error(fetchError);
      if (existing?.id) {
        if (!text) text = existing.text;
      }
    }
    if (!text) throw new Error('No resume text provided');

    // Bullets
    let bulletPoints = [];
    if (userId && bulletCache.has(`user:${userId}:bullets`)) {
      console.log('Using cached bullets for user:', userId);
      bulletPoints = bulletCache.get(`user:${userId}:bullets`);
    } else {
      bulletPoints = await extractBulletPoints(text);
      console.log('Bullet Points:', bulletPoints.length);
      if (bulletPoints.length === 0) bulletPoints = fallbackExtractBullets(text);
      if (bulletPoints.length > 0 && userId) {
        bulletCache.set(`user:${userId}:bullets`, bulletPoints);
        await saveSentencesToDatabase(userId, bulletPoints);
      }
    }
    console.log("1")
    if (bulletPoints.length === 0) {
      return {
        bullets: [],
        resume_average: 0,
        resume_percent: 50,
        letter_grade: 'C',
        themes: [
          'Format your resume with clear bullet points'
        ],
        elevator_pitch: 'We couldn\'t detect formatted bullet points.',
        explanation: 'Please organize your experience in clear bullet points.'
      };
    }
    console.log("2")
    const analyzed = await Promise.all(bulletPoints.map(async (bullet) => {
      try {
        const wb = analyzeWordBalance(bullet);
        const xyz = xyzCheck(bullet);
        const total = wb.word_balance_score + xyz.xyz_total;
        const rewritten = await rewriteBullet(bullet, {
          xyz_scores: xyz
        });
        const tips = await generateTips(bullet, {
          xyz_scores: xyz,
          word_balance_score: wb.word_balance_score
        });
        return {
          original: bullet,
          word_balance: wb,
          xyz_scores: xyz,
          bullet_total: total,
          rewritten,
          tips
        };
        console.log("3")
      } catch (_) {
        return {
          original: bullet,
          word_balance: {
            industry_pct: 0,
            common_pct: 0,
            action_pct: 0,
            metric_pct: 0
          },
          xyz_scores: {
            hard_soft: 0,
            action_words: 0,
            measurable_results: 0,
            clarity_focus: 0
          },
          bullet_total: 10,
          rewritten: bullet,
          tips: 'Analysis failed for this bullet.'
        };
      }
    }));
    console.log("4")
    const totalScore = analyzed.reduce((sum, b) => sum + b.bullet_total, 0);
    const avg = totalScore / analyzed.length;
    const percent = Math.max(Math.min(parseFloat((avg / 45 * 100).toFixed(1)), 100), 30);
    let grade = getLetterGrade(percent);
    if (grade === 'F') grade = 'D';
    const themes = generateThemes(analyzed);
    let basic = {
      bullets: analyzed,
      resume_average: avg,
      resume_percent: percent,
      letter_grade: grade,
      themes,
      elevator_pitch: 'Experienced professional ...',
      explanation: `Your resume received a ${grade} grade (${percent}%).`
    };
    let enhanced;
    console.log("Text: ", text, " Basic Analysis: ", basic)
    try {
      enhanced = await enhanceWithGroq(text, basic);
      console.log("Enhanced Scoring: ", enhanced)
    } catch {
      enhanced = basic;
    }
    if (userId) {
      await supabase.from('resumes').update({
        analysis: enhanced,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
      console.log('Successfully updated resume analysis in database');
    }    

    getResumeRoast(text, userId).catch(err => console.error('Roast failed:', err));
    
    return enhanced;
    
  } catch (err) {
    console.error('Error analyzing resume:', err);
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

// HTTP server entrypoint
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  console.log("URL: ", url, " Path: ", path);

  try {
    // Read the request body ONCE and store it
    const requestData = await req.json();
    const { action, resumeText, text, userId } = requestData;
    
    // Use either resumeText or text parameter, whichever is provided
    const resolvedText = resumeText || text;
    const resolvedUserId = userId;
    
    console.log("Logged in user:", resolvedUserId, " Text length:", resolvedText ? resolvedText.length : 0);

    // Handle specific paths
    if (path === 'detect-sentences') {
      return await serveSentenceDetector(resolvedText, resolvedUserId)(new Request(req.url, {
        method: req.method,
        headers: req.headers
      }));
    }
    
    if (path === 'improve-bullet') {
      return await serveBulletImprover()(new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(requestData)
      }));
    }

     // Default to resume analysis
    console.log(`Analyzing resume for ${resolvedUserId || 'anonymous'}`);
    const analysis = await analyzeResume(resolvedText, resolvedUserId);
    return new Response(JSON.stringify(analysis), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
   
        }
      });
    }
    
    // Handle resume roast
    if (action === 'get-roast') {
        const roastData = await getResumeRoast(resolvedText, resolvedUserId);
        return new Response(JSON.stringify(roastData), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
      });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({
      error: error.message,
      bullets: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// // Add this at the top of the file
// console.log('Resume analyzer function hit');
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
// import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
// import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
// import { getLetterGrade } from "./gradeHelper.ts";
// import { enhanceWithGroq } from "./aiEnhancer.ts";
// import { serveBulletImprover } from "./bulletImprover.ts";
// import { detectSentences } from "./sentenceDetector.ts";
// import { corsHeaders } from "./utils.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";
// const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
// const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// const supabase = createClient(supabaseUrl, supabaseKey);
// const roastCache = new Map();
// export { detectSentences };
// export { serveBulletImprover };

// // Sentence detector endpoint
// export function serveSentenceDetector(resumeText, userId) {
//   return async (req)=>{
//     if (req.method === 'OPTIONS') {
//       return new Response(null, {
//         status: 200,
//         headers: corsHeaders
//       });
//     }
//     try {
//       const { text, userId: userId } = await req.json();
//       console.log(userId, " - User to get sentences")
//       if (!text || typeof text !== 'string') {
//         return new Response(JSON.stringify({
//           error: 'Missing or invalid text parameter'
//         }), {
//           status: 400,
//           headers: {
//             'Content-Type': 'application/json',
//             ...corsHeaders
//           }
//         });
//       }
//       // Extract sentences
//       const sentences = await detectSentences(resumeText, userId);
//       console.log("User: ", userId, "Sentences: ", sentences);
//       return new Response(JSON.stringify({
//         sentences
//       }), {
//         headers: {
//           'Content-Type': 'application/json',
//           ...corsHeaders
//         }
//       });

//       if (userId) {
//         await saveSentencesToDatabase(userId, sentences)
//       // await supabase.from('resumes').update({
//       //   sentences: sentences,
//       //   sentences_updated_at: new Date().toISOString()
//       // }).eq('user_id', userId);
//       console.log('Sentences stored in database for user:', userId);
//     }

      
      
//     } catch (error) {
//       console.error('Error in sentence detector service:', error);
//       return new Response(JSON.stringify({
//         error: error.message || 'Failed to detect sentences'
//       }), {
//         status: 500,
//         headers: {
//           'Content-Type': 'application/json',
//           ...corsHeaders
//         }
//       });
//     }
//   };
// }



// // Generate a resume roast and store it
// async function getResumeRoast(resumeText, userId) {
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
//     const groqApiKey = Deno.env.get('GROQ');
//     if (!groqApiKey) throw new Error('GROQ API key not found');
//     const prompt = `I'm looking at this resume text:        
//         ${resumeText.substring(0, 4000)}        
//         Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
//         Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.`
//       ; 
//     const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${groqApiKey}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         model: 'llama3-70b-8192',
//         messages: [  
//           { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
//           { role: "user", content: prompt }
//                   ],
//         temperature: 0.7,
//         max_tokens: 750
//       })
//     });
//     if (!resp.ok) throw new Error('GROQ API error');
//     const result = await resp.json();
//     const roastText = result.choices[0].message.content.trim();
//     const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();
//     roastCache.set(cacheKey, cleanRoast);
//     if (userId) {
//       await supabase.from('resumes').update({
//         initial_assessment: cleanRoast
//       }).eq('user_id', userId);
//       console.log('Assessment stored in database for user:', userId);
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


// // Main resume analysis logic
// async function analyzeResume(resumeText, userId) {
//   let text = resumeText;
//   try {
//     if (userId) {
//       console.log("Run analyze resume for user: ", userId)
//       // const { data: existing, error: fetchError } = await supabase.from('resumes').select('id,text').eq('user_id', userId).maybeSingle();
//       const { data: existing, error: fetchError } = await supabase
//         .from('resumes')
//         .select('id,text')
//         .eq('user_id', userId)
//         .order('uploaded_at', { ascending: false })  // Order by upload date, newest first
//         .limit(1)  // Only get the most recent record
//         .maybeSingle();
//       if (fetchError) console.error(fetchError);
//       if (existing?.id) {
//         if (!text) text = existing.text;
//       }
//     }
//     if (!text) throw new Error('No resume text provided');
//     // Roast
//     if (userId) await getResumeRoast(text, userId);
//     // Bullets
//     let bulletPoints = [];
//     if (userId && bulletCache.has(`user:${userId}:bullets`)) {
//       console.log('Using cached bullets for user:', userId);
//       bulletPoints = bulletCache.get(`user:${userId}:bullets`);
//     } else {
//       bulletPoints = await extractBulletPoints(text);
//       console.log('Bullet Points:', bulletPoints.length);
//       if (bulletPoints.length === 0) bulletPoints = fallbackExtractBullets(text);
//       if (bulletPoints.length > 0 && userId) {
//         bulletCache.set(`user:${userId}:bullets`, bulletPoints);
//       await saveSentencesToDatabase(userId, bulletPoints);
//       }
//     }
//     if (bulletPoints.length === 0) {
//       return {
//         bullets: [],
//         resume_average: 0,
//         resume_percent: 50,
//         letter_grade: 'C',
//         themes: [
//           'Format your resume with clear bullet points'
//         ],
//         elevator_pitch: 'We couldn\'t detect formatted bullet points.',
//         explanation: 'Please organize your experience in clear bullet points.'
//       };
//     }
//     const analyzed = await Promise.all(bulletPoints.map(async (bullet)=>{
//       try {
//         const wb = analyzeWordBalance(bullet);
//         const xyz = xyzCheck(bullet);
//         const total = wb.word_balance_score + xyz.xyz_total;
//         const rewritten = await rewriteBullet(bullet, {
//           xyz_scores: xyz
//         });
//         const tips = await generateTips(bullet, {
//           xyz_scores: xyz,
//           word_balance_score: wb.word_balance_score
//         });
//         return {
//           original: bullet,
//           word_balance: wb,
//           xyz_scores: xyz,
//           bullet_total: total,
//           rewritten,
//           tips
//         };
//       } catch (_) {
//         return {
//           original: bullet,
//           word_balance: {
//             industry_pct: 0,
//             common_pct: 0,
//             action_pct: 0,
//             metric_pct: 0
//           },
//           xyz_scores: {
//             hard_soft: 0,
//             action_words: 0,
//             measurable_results: 0,
//             clarity_focus: 0
//           },
//           bullet_total: 10,
//           rewritten: bullet,
//           tips: 'Analysis failed for this bullet.'
//         };
//       }
//     }));
//     const totalScore = analyzed.reduce((sum, b)=>sum + b.bullet_total, 0);
//     const avg = totalScore / analyzed.length;
//     const percent = Math.max(Math.min(parseFloat((avg / 45 * 100).toFixed(1)), 100), 30);
//     let grade = getLetterGrade(percent);
//     if (grade === 'F') grade = 'D';
//     const themes = generateThemes(analyzed);
//     let basic = {
//       bullets: analyzed,
//       resume_average: avg,
//       resume_percent: percent,
//       letter_grade: grade,
//       themes,
//       elevator_pitch: 'Experienced professional ...',
//       explanation: `Your resume received a ${grade} grade (${percent}%).`
//     };
//     let enhanced;
//     try {
//       enhanced = await enhanceWithGroq(text, basic);
//     } catch  {
//       enhanced = basic;
//     }
//     if (userId) {
//       await supabase.from('resumes').update({
//         analysis: enhanced,
//         updated_at: new Date().toISOString()
//       }).eq('user_id', userId);
//       console.log('Successfully updated resume analysis in database');
//     }
//     return enhanced;
//   } catch (err) {
//     console.error('Error analyzing resume:', err);
//     return {
//       bullets: [],
//       resume_average: 25,
//       resume_percent: 50,
//       letter_grade: 'C',
//       themes: [
//         'Error during analysis'
//       ],
//       elevator_pitch: 'Error occurred',
//       explanation: `Error: ${err.message}`
//     };
//   }
// }

// // console.log("🧪  Sentence–detector test server listening on http://localhost:8000");

// // serve(async (req) => {
// //   const url = new URL(req.url);
// //   const { text, userId } = await req.json();
// //   console.log("Logged in user:", userId, " Text: ", text);
// //   console.log("URL: ", url)

// //   // CORS preflight
// //   if (req.method === "OPTIONS") {
// //     return new Response(null, { status: 200, headers: corsHeaders });
// //   }

// //   // Only handle /detect-sentences
  
// //   if (url.pathname === "/detect-sentences") {
// //     // will log userId and sentences internally
// //     return await serveSentenceDetector()(req);
// //   }

// //   return new Response("Not Found", { status: 404, headers: corsHeaders });
// // });

// // HTTP server entrypoint
// serve(async (req)=>{
//   if (req.method === 'OPTIONS') {
//     return new Response(null, {
//       status: 200,
//       headers: corsHeaders
//     });
//   }
//   const url = new URL(req.url);
//   const path = url.pathname.split('/').pop();
//   console.log("URL: ", url, " Path: ", path)
//   const { text, userId } = await req.json();
//   console.log("Logged in user:", userId, " Text: ", text); //or is it resumeText


  
//   if (path === 'detect-sentences') {
//     return await serveSentenceDetector(resumeText, userId)(req);
//   }
//   if (path === 'improve-bullet') {
//     return await serveBulletImprover()(req);
//   }
//   try {
//     const { action, resumeText, userId: userId1 } = await req.json();
//     if (action === 'get-roast') {
//       const roastData = await getResumeRoast(resumeText, userId1);
//       return new Response(JSON.stringify(roastData), {
//         headers: {
//           'Content-Type': 'application/json',
//           ...corsHeaders
//         }
//       });
//     }
//     console.log(`Analyzing resume for ${userId1 || 'anonymous'}`);
//     const analysis = await analyzeResume(resumeText, userId1);
//     return new Response(JSON.stringify(analysis), {
//       headers: {
//         'Content-Type': 'application/json',
//         ...corsHeaders
//       }
//     });
//   } catch (error) {
//     console.error('Error processing request:', error);
//     return new Response(JSON.stringify({
//       error: error.message,
//       bullets: []
//     }), {
//       status: 500,
//       headers: {
//         'Content-Type': 'application/json',
//         ...corsHeaders
//       }
//     });
//   }
// });