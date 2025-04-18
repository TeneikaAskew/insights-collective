// Add this at the top of the file
console.log('Resume analyzer function hit', userId);
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
import { getLetterGrade } from "./gradeHelper.ts";
import { enhanceWithGroq } from "./aiEnhancer.ts";
import { serveBulletImprover } from "./bulletImprover.ts";
import { detectSentences } from "./sentenceDetector.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";
import { corsHeaders } from "./utils.ts";

const bulletCache = new Map<string, string[]>();
const roastCache = new Map<string, string>();

export { detectSentences };
export { serveBulletImprover };

// Sentence detector endpoint
export function serveSentenceDetector() {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const { text, userId } = await req.json();
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid text parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Extract sentences
      const sentences = await detectSentences(text, userId);
      console.log("User: ", userId, "Sentences: ", sentences)

      return new Response(
        JSON.stringify({ sentences }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (error) {
      console.error('Error in sentence detector service:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to detect sentences' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  };
}

// Generate a resume roast and store it
async function getResumeRoast(resumeText: string, userId?: string) {
  const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
  if (roastCache.has(cacheKey)) {
    console.log('Using cached roast');
    return { roast: roastCache.get(cacheKey) };
  }

  if (!resumeText) {
    return { roast: 'I need to see your resume first to provide specific feedback.' };
  }

  try {
    const groqApiKey = Deno.env.get('GROQ');
    if (!groqApiKey) throw new Error('GROQ API key not found');

    const prompt = `...`; // truncated for brevity
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3-70b-8192', messages: [ /* system/user */ ], temperature: 0.7, max_tokens: 750 })
    });
    if (!resp.ok) throw new Error('GROQ API error');
    const result = await resp.json();
    const roastText = result.choices[0].message.content.trim();
    const cleanRoast = roastText.replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '').replace(/^[–\-*\s]*|:/g, '').trim();

    roastCache.set(cacheKey, cleanRoast);
    if (userId) {
      await supabase.from('resumes').update({ initial_assessment: cleanRoast }).eq('user_id', userId);
      console.log('Assessment stored in database for user:', userId);
    }

    return { roast: cleanRoast };
  } catch (err) {
    console.error('Error getting resume roast:', err);
    return { roast: 'Your resume needs more specific accomplishments and metrics.' };
  }
}

// Main resume analysis logic
async function analyzeResume(resumeText: string, userId?: string) {
  let text = resumeText;
  try {
    if (userId) {
      const { data: existing, error: fetchError } = await supabase.from('resumes').select('id,text').eq('user_id', userId).maybeSingle();
      if (fetchError) console.error(fetchError);
      if (existing?.id) {
        if (!text) text = existing.text;
      }
    }

    if (!text) throw new Error('No resume text provided');

    // Roast
    if (userId) await getResumeRoast(text, userId);

    // Bullets
    let bulletPoints: string[] = [];
    if (userId && bulletCache.has(`user:${userId}:bullets`)) {
      console.log('Using cached bullets for user:', userId);
      bulletPoints = bulletCache.get(`user:${userId}:bullets`)!;
    } else {
      bulletPoints = await extractBulletPoints(text);
      console.log('Bullet Points:', bulletPoints.length);
      if (bulletPoints.length === 0) bulletPoints = fallbackExtractBullets(text);
      if (bulletPoints.length > 0 && userId) {
        bulletCache.set(`user:${userId}:bullets`, bulletPoints);
        await saveSentencesToDatabase(userId, bulletPoints);
      }
    }

    if (bulletPoints.length === 0) {
      return {
        bullets: [], resume_average: 0, resume_percent: 50, letter_grade: 'C',
        themes: ['Format your resume with clear bullet points'],
        elevator_pitch: 'We couldn\'t detect formatted bullet points.',
        explanation: 'Please organize your experience in clear bullet points.'
      };
    }

    const analyzed = await Promise.all(bulletPoints.map(async bullet => {
      try {
        const wb = analyzeWordBalance(bullet);
        const xyz = xyzCheck(bullet);
        const total = wb.word_balance_score + xyz.xyz_total;
        const rewritten = await rewriteBullet(bullet, { xyz_scores: xyz });
        const tips = await generateTips(bullet, { xyz_scores: xyz, word_balance_score: wb.word_balance_score });
        return { original: bullet, word_balance: wb, xyz_scores: xyz, bullet_total: total, rewritten, tips };
      } catch (_) {
        return { original: bullet, word_balance: { industry_pct:0,common_pct:0,action_pct:0,metric_pct:0}, xyz_scores:{hard_soft:0,action_words:0,measurable_results:0,clarity_focus:0}, bullet_total:10, rewritten:bullet, tips:'Analysis failed for this bullet.' };
      }
    }));

    const totalScore = analyzed.reduce((sum, b) => sum + b.bullet_total, 0);
    const avg = totalScore / analyzed.length;
    const percent = Math.max(Math.min(parseFloat(((avg/45)*100).toFixed(1)),100),30);
    let grade = getLetterGrade(percent);
    if (grade === 'F') grade = 'D';
    const themes = generateThemes(analyzed);

    let basic = { bullets: analyzed, resume_average: avg, resume_percent: percent, letter_grade: grade, themes, elevator_pitch:'Experienced professional ...', explanation:`Your resume received a ${grade} grade (${percent}%).` };
    let enhanced;
    try { enhanced = await enhanceWithGroq(text, basic); } catch { enhanced = basic; }

    if (userId) {
      await supabase.from('resumes').update({ analysis: enhanced, updated_at: new Date().toISOString() }).eq('user_id', userId);
      console.log('Successfully updated resume analysis in database');
    }

    return enhanced;
  } catch (err) {
    console.error('Error analyzing resume:', err);
    return { bullets: [], resume_average:25,resume_percent:50,letter_grade:'C',themes:['Error during analysis'],elevator_pitch:'Error occurred',explanation:`Error: ${err.message}` };
  }
}

// HTTP server entrypoint
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  if (path === 'detect-sentences') {
    return await serveSentenceDetector()(req);
  }
  if (path === 'improve-bullet') {
    return await serveBulletImprover()(req);
  }

  try {
    const { action, resumeText, userId } = await req.json();
    if (action === 'get-roast') {
      const roastData = await getResumeRoast(resumeText, userId);
      return new Response(JSON.stringify(roastData), { headers: { 'Content-Type':'application/json',...corsHeaders } });
    }

    console.log(`Analyzing resume for ${userId || 'anonymous'}`);
    const analysis = await analyzeResume(resumeText, userId);
    return new Response(JSON.stringify(analysis), { headers: { 'Content-Type':'application/json',...corsHeaders } });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message, bullets:[] }), { status:500, headers:{ 'Content-Type':'application/json',...corsHeaders } });
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
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";
// import { corsHeaders } from "./utils.ts";

// const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
// const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// const supabase = createClient(supabaseUrl, supabaseKey);

// const bulletCache = new Map();
// const roastCache = new Map();

// export { detectSentences };
// export { serveBulletImprover };

// export function serveSentenceDetector() {
//   return async (req: Request) => {
//     // Handle CORS preflight requests
//     if (req.method === 'OPTIONS') {
//       return new Response(null, { 
//         status: 200, 
//         headers: corsHeaders 
//         // headers: preflightCorsHeaders
//       });
//     }

//     try {
//       const { text, userId } = await req.json();
      
//       if (!text || typeof text !== 'string') {
//         return new Response(
//           JSON.stringify({ error: "Missing or invalid text parameter" }),
//           { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
//         );
//       }

//       const sentences = await detectSentences(text, userId);

//       if (userId) {
//         try {
//           const { error } = await supabase
//             .from('resumes')
//             .update({ initial_assessment: cleanRoast })
//             .eq('user_id', userId);
            
//           if (error) {
//             console.error('Error storing assessment in database:', error);
//           } else {
//             console.log('Assessment stored in database for user:', userId);
//           }
//         } catch (dbError) {
//           console.error('Error updating database with assessment:', dbError);
//         }
//       }
      
//       return { roast: cleanRoast };

// async function saveSentencesToDatabase(userId: string, sentences: string[]) {
//   if (!userId || !sentences || sentences.length === 0) {
//     console.log("Not saving sentences: Missing userId or no sentences to save");
//     return;
//   }
  
//   try {
//     console.log(`Saving ${sentences.length} sentences for user ${userId}`);
    
//     // Find the user's most recent resume
//     const { data: resumeRecord, error: findError } = await supabase
//       .from('resumes')
//       .select('id')
//       .eq('user_id', userId)
//       .order('updated_at', { ascending: false })
//       .limit(1)
//       .single();
      
//     if (findError) {
//       console.error("Error finding resume record:", findError);
//       return;
//     }
    
//     // Update the resume with the sentences
//     const { error: updateError } = await supabase
//       .from('resumes')
//       .update({
//         sentences: sentences,
//         sentences_updated_at: new Date().toISOString()
//       })
//       .eq('id', resumeRecord.id);
      
//     if (updateError) {
//       console.error("Error updating sentences:", updateError);
//       return;
//     }
    
//     // Verify the update
//     const { data: verifyData, error: verifyError } = await supabase
//       .from('resumes')
//       .select('sentences, sentences_updated_at')
//       .eq('id', resumeRecord.id)
//       .single();
      
//     console.log("Sentences saved to database:", {
//       success: !!verifyData && Array.isArray(verifyData.sentences),
//       count: verifyData?.sentences?.length || 0,
//       updated_at: verifyData?.sentences_updated_at
//     });
    
//   } catch (error) {
//     console.error("Error saving sentences to database:", error);
//   }
// }













      
      
//       return new Response(
//         JSON.stringify({ sentences }),
//         { headers: { "Content-Type": "application/json", ...corsHeaders } }
//       );
//     } catch (error) {
//       console.error("Error in sentence detector service:", error);
//       return new Response(
//         JSON.stringify({ error: error.message || "Failed to detect sentences" }),
//         { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
//       );
//     }
//   };
// }


// // Then in your main analyzeResume function, add this after extracting bullets:
// if (userId && bulletPoints.length > 0) {
//   // Save to cache
//   bulletCache.set(`user:${userId}:bullets`, bulletPoints);
//   console.log(`Cached ${bulletPoints.length} bullets for user:${userId}`);
  
//   // Also save to database
//   await saveSentencesToDatabase(userId, bulletPoints);
// }

// async function getResumeRoast(resumeText: string, userId?: string) {
//   try {
//     const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
    
//     if (roastCache.has(cacheKey)) {
//       console.log("Using cached roast");
//       return { roast: roastCache.get(cacheKey) };
//     }
    
//     if (!resumeText) {
//       return { 
//         roast: "I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it."
//       };
//     }
    
//     try {
//       const groqApiKey = Deno.env.get('GROQ');
//       if (!groqApiKey) {
//         throw new Error("GROQ API key not found");
//       }
      
//       const prompt = `
//         I'm looking at this resume text:
        
//         ${resumeText.substring(0, 4000)}
        
//         Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
        
//         Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.
//       `;
      
//       const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
//         method: "POST",
//         headers: {
//           "Authorization": `Bearer ${groqApiKey}`,
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//           model: "llama3-70b-8192",
//           messages: [
//             { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
//             { role: "user", content: prompt }
//           ],
//           temperature: 0.7,
//           max_tokens: 750
//         })
//       });
      
//       if (!response.ok) {
//         const result = await response.json();
//         throw new Error(`GROQ API error: ${result.error?.message || 'Unknown error'}`);
//       }
      
//       const result = await response.json();
      
//       const roastText = result.choices[0].message.content.trim();
      
//       const cleanRoast = roastText
//         .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
//         .replace(/^[–\-\*\s]*|:/g, '')
//         .trim();
      
//       if (cacheKey) {
//         roastCache.set(cacheKey, cleanRoast);
//         console.log(`Cached roast for ${cacheKey}`);
//       }
      
//       if (userId) {
//         try {
//           const { error } = await supabase
//             .from('resumes')
//             .update({ initial_assessment: cleanRoast })
//             .eq('user_id', userId);
            
//           if (error) {
//             console.error('Error storing assessment in database:', error);
//           } else {
//             console.log('Assessment stored in database for user:', userId);
//           }
//         } catch (dbError) {
//           console.error('Error updating database with assessment:', dbError);
//         }
//       }
      
//       return { roast: cleanRoast };
//     } catch (groqError) {
//       console.error("Error getting resume roast with GROQ:", groqError);
      
//       return { 
//         roast: "Your resume needs more specific accomplishments and metrics. The language is too generic and doesn't highlight your unique value. Try quantifying your achievements and using more powerful action verbs. Also, make sure your resume is tailored for each specific role you apply for rather than using a one-size-fits-all approach."
//       };
//     }
//   } catch (error) {
//     console.error('Error in getResumeRoast:', error);
//     return { 
//       error: error.message,
//       roast: "I couldn't analyze your resume properly. Please ensure your resume has proper formatting and try again."
//     };
//   }
// }

// async function analyzeResume(resumeText: string, userId?: string) {
//   try {
//     let resumeId = null;
//     if (userId) {
//       try {
//         const { data: existingResume, error: fetchError } = await supabase
//           .from('resumes')
//           .select('id, text')
//           .eq('user_id', userId)
//           .maybeSingle();
        
//         if (fetchError) {
//           console.error("Error fetching existing resume:", fetchError);
//         }
        
//         if (existingResume?.id) {
//           resumeId = existingResume.id;
          
//           if (!resumeText && existingResume.text) {
//             console.log("Using stored resume text from database");
//             resumeText = existingResume.text;
//           }
//         }
//       } catch (fetchError) {
//         console.error("Error fetching resume data:", fetchError);
//       }
//     }
    
//     if (!resumeText) {
//       console.error("No resume text provided and none found in database");
//       return {
//         bullets: [],
//         resume_average: 25,
//         resume_percent: 50,
//         letter_grade: "C",
//         themes: ["Please upload a resume with text content"],
//         elevator_pitch: "We couldn't find any text to analyze. Please upload a valid resume document.",
//         explanation: "We couldn't find any text to analyze. Make sure your document contains readable text content."
//       };
//     }
    
//     if (userId) {
//       try {
//         const assessment = await getResumeRoast(resumeText, userId);
//         console.log('Generated and stored assessment');
//       } catch (assessmentError) {
//         console.error('Error generating assessment:', assessmentError);
//       }
//     }
    
//     let bulletPoints = [];
    
//     if (userId && bulletCache.has(`user:${userId}:bullets`)) {
//       console.log("Using cached bullets for user:", userId);
//       bulletPoints = bulletCache.get(`user:${userId}:bullets`);
//     } else {
//       try {
//         bulletPoints = await extractBulletPoints(resumeText);
//         console.log("Bullet Points: ", bulletPoints)
        
//         if (!bulletPoints || bulletPoints.length === 0) {
//           console.log("Primary bullet extraction failed, using fallback");
//           bulletPoints = fallbackExtractBullets(resumeText);
//         }
        
//         if (userId && bulletPoints.length > 0) {
//           bulletCache.set(`user:${userId}:bullets`, bulletPoints);
//           console.log(`Cached ${bulletPoints.length} bullets for user:${userId}`);
//         }
//       } catch (extractError) {
//         console.error("Error extracting bullets:", extractError);
//         return {
//           bullets: [],
//           resume_average: 0,
//           resume_percent: 50,
//           letter_grade: "C",
//           themes: ["Try reorganizing your resume into clear bullet points for better analysis"],
//           elevator_pitch: "Unable to extract bullet points from your resume. Please format your resume with clear bullet points for analysis.",
//           explanation: "Your resume needs to be formatted with clear bullet points for our analysis tool to work effectively. Each bullet should start with an action verb and describe a specific achievement."
//         };
//       }
//     }
    
//     if (bulletPoints.length === 0) {
//       console.warn("No bullet points found in resume after all extraction attempts");
//       return {
//         bullets: [],
//         resume_average: 0,
//         resume_percent: 50,
//         letter_grade: "C",
//         themes: ["Format your resume with clear bullet points", "Start each bullet with an action verb", "Include measurable achievements"],
//         elevator_pitch: "We couldn't detect formatted bullet points in your resume. For a complete analysis, consider organizing your experience in clear bullet points.",
//         explanation: "Your resume needs to be formatted with clear bullet points for our analysis tool to work effectively. Each bullet should start with an action verb and describe a specific achievement."
//       };
//     }
    
//     try {
//       const analyzedBullets = await Promise.all(bulletPoints.map(async bullet => {
//         try {
//           const wordBalance = analyzeWordBalance(bullet);
          
//           const xyzScores = xyzCheck(bullet);
          
//           const bulletTotal = wordBalance.word_balance_score + xyzScores.xyz_total;
          
//           const rewritten = await rewriteBullet(bullet, { xyz_scores: xyzScores });
          
//           const tips = await generateTips(bullet, { xyz_scores: xyzScores, word_balance_score: wordBalance.word_balance_score });
          
//           return {
//             original: bullet,
//             word_balance: {
//               industry_pct: wordBalance.industry_pct,
//               common_pct: wordBalance.common_pct,
//               action_pct: wordBalance.action_pct,
//               metric_pct: wordBalance.metric_pct
//             },
//             word_balance_score: wordBalance.word_balance_score,
//             xyz_scores: {
//               hard_soft: xyzScores.hard_soft,
//               action_words: xyzScores.action_words,
//               measurable_results: xyzScores.measurable_results,
//               clarity_focus: xyzScores.clarity_focus
//             },
//             bullet_total: bulletTotal,
//             rewritten,
//             tips
//           };
//         } catch (bulletError) {
//           console.error("Error analyzing individual bullet:", bulletError);
//           return {
//             original: bullet,
//             word_balance: { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
//             word_balance_score: 5,
//             xyz_scores: { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
//             bullet_total: 10,
//             rewritten: bullet,
//             tips: "We had trouble analyzing this bullet. Consider rephrasing it with more action verbs and specific metrics."
//           };
//         }
//       }));
      
//       const totalScore = analyzedBullets.reduce((sum, bullet) => sum + bullet.bullet_total, 0);
//       const resumeAverage = analyzedBullets.length > 0 ? totalScore / analyzedBullets.length : 25;
      
//       const resumePercent = Math.max(Math.min(parseFloat((resumeAverage / 45 * 100).toFixed(1)), 100), 30);
      
//       let letterGrade = getLetterGrade(resumePercent);
//       if (letterGrade === "F") letterGrade = "D";
      
//       const themes = generateThemes(analyzedBullets);
      
//       const basicAnalysis = {
//         bullets: analyzedBullets,
//         resume_average: resumeAverage,
//         resume_percent: resumePercent,
//         letter_grade: letterGrade,
//         themes,
//         elevator_pitch: "Experienced professional with a track record of delivering results and driving business outcomes through effective problem-solving and collaborative teamwork.",
//         explanation: `Your resume received a ${letterGrade} grade (${resumePercent}%), indicating ${letterGrade >= 'C' ? 'reasonable' : 'significant room for'} improvement. Focus on the suggested themes to enhance your resume's effectiveness.`
//       };
      
//       let enhancedAnalysis;
//       try {
//         enhancedAnalysis = await enhanceWithGroq(resumeText, basicAnalysis);
//       } catch (groqError) {
//         console.error("Error enhancing with GROQ, using basic analysis:", groqError);
//         enhancedAnalysis = basicAnalysis;
//       }
      
//       if (userId) {
//         try {
//           const { data: resumeRecord, error: findError } = await supabase
//             .from('resumes')
//             .select('id')
//             .eq('user_id', userId)
//             .maybeSingle();
          
//           if (findError) {
//             console.error("Error finding resume record:", findError);
//           } else if (resumeRecord) {
//             const { error: updateError } = await supabase
//               .from('resumes')
//               .update({ 
//                 analysis: enhancedAnalysis,
//                 updated_at: new Date().toISOString()
//               })
//               .eq('id', resumeRecord.id);
            
//             if (updateError) {
//               console.error("Error updating resume analysis:", updateError);
//             } else {
//               console.log("Successfully updated resume analysis in database");
//             }
//           } else {
//             console.warn("Resume record not found for user:", userId);
//           }
//         } catch (updateError) {
//           console.error("Error updating resume analysis:", updateError);
//         }
//       }
      
//       if (userId) {
//         try {
//           const assessment = await getResumeRoast(resumeText, userId);
//           console.log("Generated and stored initial assessment");
//         } catch (assessmentError) {
//           console.error("Error generating initial assessment:", assessmentError);
//         }
//       }
      
//       return enhancedAnalysis;
//     } catch (analysisError) {
//       console.error("Error during analysis:", analysisError);
//       return {
//         bullets: [],
//         resume_average: 25,
//         resume_percent: 50,
//         letter_grade: "C",
//         themes: ["Error during analysis, please try again"],
//         elevator_pitch: "We encountered an issue analyzing your resume. For best results, ensure your resume uses clear bullet points with action verbs and metrics.",
//         explanation: "Our analysis tool had difficulty processing your resume. For better results, format your experiences as bullet points starting with action verbs and include specific achievements with metrics."
//       };
//     }
//   } catch (error) {
//     console.error('Error processing resume:', error);
//     return {
//       bullets: [],
//       resume_average: 25,
//       resume_percent: 50,
//       letter_grade: "C",
//       themes: ["Error during analysis, please try again"],
//       elevator_pitch: "We encountered an error analyzing your resume. Please try uploading again or contact support if the issue persists.",
//       explanation: `Error analyzing resume: ${error.message || "Unknown error"}`
//     };
//   }
// }

// serve(async (req) => {
//   // Proper handling of CORS preflight requests
//   if (req.method === 'OPTIONS') {
//     return new Response(null, {
//       status: 200,
//       headers: corsHeaders
//     });
//   }
// // if (req.method === 'OPTIONS') {
// //   return new Response(null, {
// //     status: 200,
// //     headers: preflightCorsHeaders
// //   });
// // }
//   const url = new URL(req.url);
//   const path = url.pathname.split('/').pop();
  
//   if (path === 'detect-sentences') {
//     return await serveSentenceDetector()(req);
//   } else if (path === 'improve-bullet') {
//     return await serveBulletImprover()(req);
//   } else {
//     try {
//       const requestData = await req.json();
      
//       if (requestData.action === 'get-roast') {
//         const { resumeText, userId } = requestData;
//         const roastData = await getResumeRoast(resumeText, userId);
        
//         return new Response(
//           JSON.stringify(roastData),
//           { 
//             headers: { 
//               'Content-Type': 'application/json',
//               ...corsHeaders
//             }
//           }
//         );
//       }
      
//       const { resumeText, userId } = requestData;
      
//       console.log(`Analyzing resume for ${userId ? 'user ' + userId : 'anonymous user'}, text length: ${resumeText?.length || 0}`);
      
//       const analysis = await analyzeResume(resumeText, userId);
      
//       console.log("Analysis complete, returning results");
      
//       return new Response(
//         JSON.stringify(analysis),
//         { 
//           headers: { 
//             'Content-Type': 'application/json',
//             ...corsHeaders
//           }
//         }
//       );
      
//     } catch (error) {
//       console.error('Error processing request:', error.message);
      
//       return new Response(
//         JSON.stringify({ 
//           error: error.message,
//           resume_percent: 50,
//           letter_grade: "C",
//           themes: ["Error during analysis, please try again"],
//           elevator_pitch: "We encountered an error. Please try again with a different resume format.",
//           explanation: `Error: ${error.message}`,
//           bullets: []
//         }),
//         { 
//           status: 500, 
//           headers: { 
//             'Content-Type': 'application/json',
//             ...corsHeaders
//           }
//         }
//       );
//     }
//   }
// })
// // // Add this at the top of the file
// // console.log('Resume analyzer function hit');
// // import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// // import { extractBulletPoints, fallbackExtractBullets } from "./bulletExtractor.ts";
// // import { analyzeWordBalance, xyzCheck } from "./bulletAnalysis.ts";
// // import { rewriteBullet, generateTips, generateThemes } from "./bulletSuggestions.ts";
// // import { getLetterGrade } from "./gradeHelper.ts";
// // import { enhanceWithGroq } from "./aiEnhancer.ts";
// // import { serveBulletImprover } from "./bulletImprover.ts";
// // import { detectSentences } from "./sentenceDetector.ts";
// // import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";
// // import { corsHeaders } from "./utils.ts";

// // const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
// // const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// // const supabase = createClient(supabaseUrl, supabaseKey);

// // const bulletCache = new Map();
// // const roastCache = new Map();

// // export { detectSentences };
// // export { serveBulletImprover };

// // export function serveSentenceDetector() {
// //   return async (req: Request) => {
// //     // Handle CORS preflight requests
// //     if (req.method === 'OPTIONS') {
// //       return new Response(null, { 
// //         status: 200, 
// //         headers: corsHeaders 
// //         // headers: preflightCorsHeaders
// //       });
// //     }

// //     try {
// //       const { text, userId } = await req.json();
      
// //       if (!text || typeof text !== 'string') {
// //         return new Response(
// //           JSON.stringify({ error: "Missing or invalid text parameter" }),
// //           { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
// //         );
// //       }

// //       const sentences = await detectSentences(text, userId);
      
// //       return new Response(
// //         JSON.stringify({ sentences }),
// //         { headers: { "Content-Type": "application/json", ...corsHeaders } }
// //       );
// //     } catch (error) {
// //       console.error("Error in sentence detector service:", error);
// //       return new Response(
// //         JSON.stringify({ error: error.message || "Failed to detect sentences" }),
// //         { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
// //       );
// //     }
// //   };
// // }

// // async function saveSentencesToDatabase(userId: string, sentences: string[]) {
// //   if (!userId || !sentences || sentences.length === 0) {
// //     console.log("Not saving sentences: Missing userId or no sentences to save");
// //     return;
// //   }
  
// //   try {
// //     console.log(`Saving ${sentences.length} sentences for user ${userId}`);
    
// //     // Find the user's most recent resume
// //     const { data: resumeRecord, error: findError } = await supabase
// //       .from('resumes')
// //       .select('id')
// //       .eq('user_id', userId)
// //       .order('updated_at', { ascending: false })
// //       .limit(1)
// //       .single();
      
// //     if (findError) {
// //       console.error("Error finding resume record:", findError);
// //       return;
// //     }
    
// //     // Update the resume with the sentences
// //     const { error: updateError } = await supabase
// //       .from('resumes')
// //       .update({
// //         sentences: sentences,
// //         sentences_updated_at: new Date().toISOString()
// //       })
// //       .eq('id', resumeRecord.id);
      
// //     if (updateError) {
// //       console.error("Error updating sentences:", updateError);
// //       return;
// //     }
    
// //     // Verify the update
// //     const { data: verifyData, error: verifyError } = await supabase
// //       .from('resumes')
// //       .select('sentences, sentences_updated_at')
// //       .eq('id', resumeRecord.id)
// //       .single();
      
// //     console.log("Sentences saved to database:", {
// //       success: !!verifyData && Array.isArray(verifyData.sentences),
// //       count: verifyData?.sentences?.length || 0,
// //       updated_at: verifyData?.sentences_updated_at
// //     });
    
// //   } catch (error) {
// //     console.error("Error saving sentences to database:", error);
// //   }
// // }

// // // Then in your main analyzeResume function, add this after extracting bullets:
// // if (userId && bulletPoints.length > 0) {
// //   // Save to cache
// //   bulletCache.set(`user:${userId}:bullets`, bulletPoints);
// //   console.log(`Cached ${bulletPoints.length} bullets for user:${userId}`);
  
// //   // Also save to database
// //   await saveSentencesToDatabase(userId, bulletPoints);
// // }

// // async function getResumeRoast(resumeText: string, userId?: string) {
// //   try {
// //     const cacheKey = userId ? `user:${userId}:roast` : `temp:${resumeText.substring(0, 100)}:roast`;
    
// //     if (roastCache.has(cacheKey)) {
// //       console.log("Using cached roast");
// //       return { roast: roastCache.get(cacheKey) };
// //     }
    
// //     if (!resumeText) {
// //       return { 
// //         roast: "I need to see your resume first to provide specific feedback. Please upload your resume so I can analyze it and give you targeted advice on how to improve it."
// //       };
// //     }
    
// //     try {
// //       const groqApiKey = Deno.env.get('GROQ');
// //       if (!groqApiKey) {
// //         throw new Error("GROQ API key not found");
// //       }
      
// //       const prompt = `
// //         I'm looking at this resume text:
        
// //         ${resumeText.substring(0, 4000)}
        
// //         Now, I need a full-on resume roast. Don't sugarcoat it — tell me what's holding this back. Why am I not getting callbacks, referrals, or interviews? Tear it apart like a hiring manager who's had one too many resumes land on their desk. Be blunt. What's outdated, what's weak, what's missing, what makes you roll your eyes, and what makes you scroll past me? Give me the real — and then tell me how to fix it so I actually start landing opportunities.
        
// //         Be specific and provide actionable advice. Format your response with no markdown, just clean text. Keep it to 3-4 paragraphs maximum.
// //       `;
      
// //       const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
// //         method: "POST",
// //         headers: {
// //           "Authorization": `Bearer ${groqApiKey}`,
// //           "Content-Type": "application/json"
// //         },
// //         body: JSON.stringify({
// //           model: "llama3-70b-8192",
// //           messages: [
// //             { role: "system", content: "You are a brutally honest resume critic. Your job is to point out the real issues in a resume without sugarcoating, then provide actionable advice." },
// //             { role: "user", content: prompt }
// //           ],
// //           temperature: 0.7,
// //           max_tokens: 750
// //         })
// //       });
      
// //       if (!response.ok) {
// //         const result = await response.json();
// //         throw new Error(`GROQ API error: ${result.error?.message || 'Unknown error'}`);
// //       }
      
// //       const result = await response.json();
      
// //       const roastText = result.choices[0].message.content.trim();
      
// //       const cleanRoast = roastText
// //         .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
// //         .replace(/^[–\-\*\s]*|:/g, '')
// //         .trim();
      
// //       if (cacheKey) {
// //         roastCache.set(cacheKey, cleanRoast);
// //         console.log(`Cached roast for ${cacheKey}`);
// //       }
      
// //       if (userId) {
// //         try {
// //           const { error } = await supabase
// //             .from('resumes')
// //             .update({ initial_assessment: cleanRoast })
// //             .eq('user_id', userId);
            
// //           if (error) {
// //             console.error('Error storing assessment in database:', error);
// //           } else {
// //             console.log('Assessment stored in database for user:', userId);
// //           }
// //         } catch (dbError) {
// //           console.error('Error updating database with assessment:', dbError);
// //         }
// //       }
      
// //       return { roast: cleanRoast };
// //     } catch (groqError) {
// //       console.error("Error getting resume roast with GROQ:", groqError);
      
// //       return { 
// //         roast: "Your resume needs more specific accomplishments and metrics. The language is too generic and doesn't highlight your unique value. Try quantifying your achievements and using more powerful action verbs. Also, make sure your resume is tailored for each specific role you apply for rather than using a one-size-fits-all approach."
// //       };
// //     }
// //   } catch (error) {
// //     console.error('Error in getResumeRoast:', error);
// //     return { 
// //       error: error.message,
// //       roast: "I couldn't analyze your resume properly. Please ensure your resume has proper formatting and try again."
// //     };
// //   }
// // }

// // async function analyzeResume(resumeText: string, userId?: string) {
// //   try {
// //     let resumeId = null;
// //     if (userId) {
// //       try {
// //         const { data: existingResume, error: fetchError } = await supabase
// //           .from('resumes')
// //           .select('id, text')
// //           .eq('user_id', userId)
// //           .maybeSingle();
        
// //         if (fetchError) {
// //           console.error("Error fetching existing resume:", fetchError);
// //         }
        
// //         if (existingResume?.id) {
// //           resumeId = existingResume.id;
          
// //           if (!resumeText && existingResume.text) {
// //             console.log("Using stored resume text from database");
// //             resumeText = existingResume.text;
// //           }
// //         }
// //       } catch (fetchError) {
// //         console.error("Error fetching resume data:", fetchError);
// //       }
// //     }
    
// //     if (!resumeText) {
// //       console.error("No resume text provided and none found in database");
// //       return {
// //         bullets: [],
// //         resume_average: 25,
// //         resume_percent: 50,
// //         letter_grade: "C",
// //         themes: ["Please upload a resume with text content"],
// //         elevator_pitch: "We couldn't find any text to analyze. Please upload a valid resume document.",
// //         explanation: "We couldn't find any text to analyze. Make sure your document contains readable text content."
// //       };
// //     }
    
// //     if (userId) {
// //       try {
// //         const assessment = await getResumeRoast(resumeText, userId);
// //         console.log('Generated and stored assessment');
// //       } catch (assessmentError) {
// //         console.error('Error generating assessment:', assessmentError);
// //       }
// //     }
    
// //     let bulletPoints = [];
    
// //     if (userId && bulletCache.has(`user:${userId}:bullets`)) {
// //       console.log("Using cached bullets for user:", userId);
// //       bulletPoints = bulletCache.get(`user:${userId}:bullets`);
// //     } else {
// //       try {
// //         bulletPoints = await extractBulletPoints(resumeText);
// //         console.log("Bullet Points: ", bulletPoints)
        
// //         if (!bulletPoints || bulletPoints.length === 0) {
// //           console.log("Primary bullet extraction failed, using fallback");
// //           bulletPoints = fallbackExtractBullets(resumeText);
// //         }
        
// //         if (userId && bulletPoints.length > 0) {
// //           bulletCache.set(`user:${userId}:bullets`, bulletPoints);
// //           console.log(`Cached ${bulletPoints.length} bullets for user:${userId}`);
// //         }
// //       } catch (extractError) {
// //         console.error("Error extracting bullets:", extractError);
// //         return {
// //           bullets: [],
// //           resume_average: 0,
// //           resume_percent: 50,
// //           letter_grade: "C",
// //           themes: ["Try reorganizing your resume into clear bullet points for better analysis"],
// //           elevator_pitch: "Unable to extract bullet points from your resume. Please format your resume with clear bullet points for analysis.",
// //           explanation: "Your resume needs to be formatted with clear bullet points for our analysis tool to work effectively. Each bullet should start with an action verb and describe a specific achievement."
// //         };
// //       }
// //     }
    
// //     if (bulletPoints.length === 0) {
// //       console.warn("No bullet points found in resume after all extraction attempts");
// //       return {
// //         bullets: [],
// //         resume_average: 0,
// //         resume_percent: 50,
// //         letter_grade: "C",
// //         themes: ["Format your resume with clear bullet points", "Start each bullet with an action verb", "Include measurable achievements"],
// //         elevator_pitch: "We couldn't detect formatted bullet points in your resume. For a complete analysis, consider organizing your experience in clear bullet points.",
// //         explanation: "Your resume needs to be formatted with clear bullet points for our analysis tool to work effectively. Each bullet should start with an action verb and describe a specific achievement."
// //       };
// //     }
    
// //     try {
// //       const analyzedBullets = await Promise.all(bulletPoints.map(async bullet => {
// //         try {
// //           const wordBalance = analyzeWordBalance(bullet);
          
// //           const xyzScores = xyzCheck(bullet);
          
// //           const bulletTotal = wordBalance.word_balance_score + xyzScores.xyz_total;
          
// //           const rewritten = await rewriteBullet(bullet, { xyz_scores: xyzScores });
          
// //           const tips = await generateTips(bullet, { xyz_scores: xyzScores, word_balance_score: wordBalance.word_balance_score });
          
// //           return {
// //             original: bullet,
// //             word_balance: {
// //               industry_pct: wordBalance.industry_pct,
// //               common_pct: wordBalance.common_pct,
// //               action_pct: wordBalance.action_pct,
// //               metric_pct: wordBalance.metric_pct
// //             },
// //             word_balance_score: wordBalance.word_balance_score,
// //             xyz_scores: {
// //               hard_soft: xyzScores.hard_soft,
// //               action_words: xyzScores.action_words,
// //               measurable_results: xyzScores.measurable_results,
// //               clarity_focus: xyzScores.clarity_focus
// //             },
// //             bullet_total: bulletTotal,
// //             rewritten,
// //             tips
// //           };
// //         } catch (bulletError) {
// //           console.error("Error analyzing individual bullet:", bulletError);
// //           return {
// //             original: bullet,
// //             word_balance: { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
// //             word_balance_score: 5,
// //             xyz_scores: { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
// //             bullet_total: 10,
// //             rewritten: bullet,
// //             tips: "We had trouble analyzing this bullet. Consider rephrasing it with more action verbs and specific metrics."
// //           };
// //         }
// //       }));
      
// //       const totalScore = analyzedBullets.reduce((sum, bullet) => sum + bullet.bullet_total, 0);
// //       const resumeAverage = analyzedBullets.length > 0 ? totalScore / analyzedBullets.length : 25;
      
// //       const resumePercent = Math.max(Math.min(parseFloat((resumeAverage / 45 * 100).toFixed(1)), 100), 30);
      
// //       let letterGrade = getLetterGrade(resumePercent);
// //       if (letterGrade === "F") letterGrade = "D";
      
// //       const themes = generateThemes(analyzedBullets);
      
// //       const basicAnalysis = {
// //         bullets: analyzedBullets,
// //         resume_average: resumeAverage,
// //         resume_percent: resumePercent,
// //         letter_grade: letterGrade,
// //         themes,
// //         elevator_pitch: "Experienced professional with a track record of delivering results and driving business outcomes through effective problem-solving and collaborative teamwork.",
// //         explanation: `Your resume received a ${letterGrade} grade (${resumePercent}%), indicating ${letterGrade >= 'C' ? 'reasonable' : 'significant room for'} improvement. Focus on the suggested themes to enhance your resume's effectiveness.`
// //       };
      
// //       let enhancedAnalysis;
// //       try {
// //         enhancedAnalysis = await enhanceWithGroq(resumeText, basicAnalysis);
// //       } catch (groqError) {
// //         console.error("Error enhancing with GROQ, using basic analysis:", groqError);
// //         enhancedAnalysis = basicAnalysis;
// //       }
      
// //       if (userId) {
// //         try {
// //           const { data: resumeRecord, error: findError } = await supabase
// //             .from('resumes')
// //             .select('id')
// //             .eq('user_id', userId)
// //             .maybeSingle();
          
// //           if (findError) {
// //             console.error("Error finding resume record:", findError);
// //           } else if (resumeRecord) {
// //             const { error: updateError } = await supabase
// //               .from('resumes')
// //               .update({ 
// //                 analysis: enhancedAnalysis,
// //                 updated_at: new Date().toISOString()
// //               })
// //               .eq('id', resumeRecord.id);
            
// //             if (updateError) {
// //               console.error("Error updating resume analysis:", updateError);
// //             } else {
// //               console.log("Successfully updated resume analysis in database");
// //             }
// //           } else {
// //             console.warn("Resume record not found for user:", userId);
// //           }
// //         } catch (updateError) {
// //           console.error("Error updating resume analysis:", updateError);
// //         }
// //       }
      
// //       if (userId) {
// //         try {
// //           const assessment = await getResumeRoast(resumeText, userId);
// //           console.log("Generated and stored initial assessment");
// //         } catch (assessmentError) {
// //           console.error("Error generating initial assessment:", assessmentError);
// //         }
// //       }
      
// //       return enhancedAnalysis;
// //     } catch (analysisError) {
// //       console.error("Error during analysis:", analysisError);
// //       return {
// //         bullets: [],
// //         resume_average: 25,
// //         resume_percent: 50,
// //         letter_grade: "C",
// //         themes: ["Error during analysis, please try again"],
// //         elevator_pitch: "We encountered an issue analyzing your resume. For best results, ensure your resume uses clear bullet points with action verbs and metrics.",
// //         explanation: "Our analysis tool had difficulty processing your resume. For better results, format your experiences as bullet points starting with action verbs and include specific achievements with metrics."
// //       };
// //     }
// //   } catch (error) {
// //     console.error('Error processing resume:', error);
// //     return {
// //       bullets: [],
// //       resume_average: 25,
// //       resume_percent: 50,
// //       letter_grade: "C",
// //       themes: ["Error during analysis, please try again"],
// //       elevator_pitch: "We encountered an error analyzing your resume. Please try uploading again or contact support if the issue persists.",
// //       explanation: `Error analyzing resume: ${error.message || "Unknown error"}`
// //     };
// //   }
// // }

// // serve(async (req) => {
// //   // Proper handling of CORS preflight requests
// //   if (req.method === 'OPTIONS') {
// //     return new Response(null, {
// //       status: 200,
// //       headers: corsHeaders
// //     });
// //   }
// // // if (req.method === 'OPTIONS') {
// // //   return new Response(null, {
// // //     status: 200,
// // //     headers: preflightCorsHeaders
// // //   });
// // // }
// //   const url = new URL(req.url);
// //   const path = url.pathname.split('/').pop();
  
// //   if (path === 'detect-sentences') {
// //     return await serveSentenceDetector()(req);
// //   } else if (path === 'improve-bullet') {
// //     return await serveBulletImprover()(req);
// //   } else {
// //     try {
// //       const requestData = await req.json();
      
// //       if (requestData.action === 'get-roast') {
// //         const { resumeText, userId } = requestData;
// //         const roastData = await getResumeRoast(resumeText, userId);
        
// //         return new Response(
// //           JSON.stringify(roastData),
// //           { 
// //             headers: { 
// //               'Content-Type': 'application/json',
// //               ...corsHeaders
// //             }
// //           }
// //         );
// //       }
      
// //       const { resumeText, userId } = requestData;
      
// //       console.log(`Analyzing resume for ${userId ? 'user ' + userId : 'anonymous user'}, text length: ${resumeText?.length || 0}`);
      
// //       const analysis = await analyzeResume(resumeText, userId);
      
// //       console.log("Analysis complete, returning results");
      
// //       return new Response(
// //         JSON.stringify(analysis),
// //         { 
// //           headers: { 
// //             'Content-Type': 'application/json',
// //             ...corsHeaders
// //           }
// //         }
// //       );
      
// //     } catch (error) {
// //       console.error('Error processing request:', error.message);
      
// //       return new Response(
// //         JSON.stringify({ 
// //           error: error.message,
// //           resume_percent: 50,
// //           letter_grade: "C",
// //           themes: ["Error during analysis, please try again"],
// //           elevator_pitch: "We encountered an error. Please try again with a different resume format.",
// //           explanation: `Error: ${error.message}`,
// //           bullets: []
// //         }),
// //         { 
// //           status: 500, 
// //           headers: { 
// //             'Content-Type': 'application/json',
// //             ...corsHeaders
// //           }
// //         }
// //       );
// //     }
// //   }
// // })