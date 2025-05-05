import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, callGroqWithRetry } from '../_shared/utils.ts';
// CORS handling for preflight requests
function handleCors(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  return null;
}
// Fetch user's latest resume and career pathway report
async function getUserCareerData(supabase, userId) {
  const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
    ascending: false
  }).limit(1).maybeSingle();
  if (resumeError) console.error('Error fetching resume data:', resumeError);
  const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
    ascending: false
  }).limit(1).maybeSingle();
  if (pathwayError) console.error('Error fetching pathway data:', pathwayError);
  return {
    resume: resumeData || {
      sentences: [],
      analysis: ''
    },
    pathway: pathwayData || {
      report: ''
    }
  };
}
// // Robust JSON extractor from LLM response
// function extractJsonPayload(rawResponse) {
//   const raw = rawResponse.trim();
//   // 1) Try direct JSON.parse
//   try {
//     return JSON.parse(raw);
//   } catch (e) {
//     console.log('Direct JSON.parse failed, proceeding to extraction');
//   }
//   // 2) Extract from code fences
//   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenceMatch?.[1]) {
//     try {
//       return JSON.parse(fenceMatch[1].trim());
//     } catch (e) {
//       console.log('Code fence JSON.parse failed');
//     }
//   }
//   // 3) Naive substring from first to last brace
//   const first = raw.indexOf('{');
//   const last = raw.lastIndexOf('}');
//   if (first !== -1 && last !== -1 && last > first) {
//     const candidate = raw.substring(first, last + 1);
//     try {
//       return JSON.parse(candidate);
//     } catch (e) {
//       console.log('Naive substring JSON.parse failed');
//     }
//   }
//   // 4) Balanced braces fallback
//   if (first !== -1) {
//     let depth = 0;
//     for(let i = first; i < raw.length; i++){
//       if (raw[i] === '{') depth++;
//       if (raw[i] === '}') depth--;
//       if (depth === 0) {
//         const slice = raw.slice(first, i + 1);
//         try {
//           return JSON.parse(slice);
//         } catch (e) {}
//         break;
//       }
//     }
//   }
//   console.error('Unable to extract JSON from LLM response:', raw);
//   throw new Error('Invalid JSON payload');
// }
// // Generate the Career Action Plan with strict JSON output
// async function generateActionPlan(userData) {
//   const systemPrompt = `SYSTEM INSTRUCTIONS:
// - OUTPUT ONLY one JSON object with EXACT keys: "6_weeks","9_weeks","12_weeks","6_months","12_months".
// - Each key’s value must be an object with:
//     "skills_to_acquire": string[],
//     "projects_to_build": { title: string; description: string }[],
//     "content_to_post": { platform: string; topics: string[] }[],
//     "milestones_to_achieve": string[],
//     "motivational_narrative": string
// - NO additional keys, markdown, or text.
// - RESPONSE MUST START WITH '{' AND END WITH '}'.
// - If unable, output {}.`;
//   const resumeSnippet = Array.isArray(userData.resume.sentences) ? userData.resume.sentences.slice(0, 3).join(' ') : '';
//   const analysisSnippet = typeof userData.resume.analysis === 'string' ? userData.resume.analysis.slice(0, 200) : '';
//   const userPrompt = `Resume summary: ${resumeSnippet}
// Analysis snippet: ${analysisSnippet}
// Career Pathway Report:
// ${userData.pathway.report}
// 1. Skills to acquire (with specific online courses/trainings from platforms like Coursera, Udemy, LinkedIn Learning)
// 2. Projects to build (practical portfolio projects aligned with their career direction)
// 3. Content to post on LinkedIn/Twitter to build their professional brand
// 4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities)
// 5. A motivational narrative about their trajectory for this timeframe
// Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.
// Generate the action plan in the exact JSON format above.`;
//   const raw = await callGroqWithRetry(systemPrompt, userPrompt);
//   console.log('RAW LLM OUTPUT:', raw);
//   return extractJsonPayload(raw);
// }
// // Normalize raw LLM JSON into component shape
// function normalizeActionPlan(rawPlan) {
//   const keys = [
//     '6_weeks',
//     '9_weeks',
//     '12_weeks',
//     '6_months',
//     '12_months'
//   ];
//   const normalized = {};
//   keys.forEach((k)=>{
//     const data = rawPlan[k] || {};
//     normalized[k] = {
//       narrative: data.motivational_narrative || '',
//       skills: Array.isArray(data.skills_to_acquire) ? data.skills_to_acquire.map((s)=>({
//           name: s,
//           courses: []
//         })) : [],
//       projects: Array.isArray(data.projects_to_build) ? data.projects_to_build.map((p)=>({
//           title: p.title,
//           description: p.description
//         })) : [],
//       content: Array.isArray(data.content_to_post) ? data.content_to_post.map((c)=>({
//           platform: c.platform,
//           topics: c.topics
//         })) : [],
//       milestones: Array.isArray(data.milestones_to_achieve) ? data.milestones_to_achieve : []
//     };
//   });
//   return normalized;
// }
////////////////////////////////////////////////////////////////////////////////////////
// Generate the career action plan using GROQ API
// async function generateActionPlan(userData) {
//   try {
//     const systemPrompt = `SYSTEM INSTRUCTIONS (ENFORCE EXACT FORMAT):
// - OUTPUT ONLY a single JSON object with EXACT keys:
//   "6_weeks","9_weeks","12_weeks","6_months","12_months".
// - Each key's value must be an object with properties:
//     "skills_to_acquire": string[],
//     "projects_to_build": { title: string; description: string }[],
//     "content_to_post": { platform: string; topics: string[] }[],
//     "milestones_to_achieve": string[],
//     "motivational_narrative": string
// - DO NOT include ANY additional keys, markdown, or explanatory text.
// - RESPONSE MUST START WITH '{' AND END WITH '}'.
// - If you fail to comply, output {} only.`;
//     // Build a concise user prompt with just enough context
//     const resumeSnippet = Array.isArray(userData.resume.sentences) ? userData.resume.sentences.slice(0, 3).join(' ') : '';
//     const analysisSnippet = typeof userData.resume.analysis === 'string' ? userData.resume.analysis.slice(0, 200) : userData.resume.analysis ? JSON.stringify(userData.resume.analysis).slice(0, 200) : '';
//     const userPrompt = `Resume summary: ${resumeSnippet}
// Analysis snippet: ${analysisSnippet}
// Career Pathway Report:
// ${userData.pathway.report ? JSON.stringify(userData.pathway.report) : ''}
// 1. Skills to acquire (with specific online courses/trainings from platforms like Coursera, Udemy, LinkedIn Learning)
// 2. Projects to build (practical portfolio projects aligned with their career direction)
// 3. Content to post on LinkedIn/Twitter to build their professional brand
// 4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities)
// 5. A motivational narrative about their trajectory for this timeframe
// Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.
// Using only this information, generate the Career Action Plan in the exact JSON format described above.`;
//     // Call the GROQ API
//     const response = await callGroqWithRetry(systemPrompt, userPrompt);
//     console.log("Raw Response: ", response);
//     // Extract JSON from the response
//     return extractJsonPayload(response);
//   } catch (error) {
//     console.error('Error generating action plan:', error);
//     throw error;
//   }
// }
//////////////////////////////////////////////////////////////////////////////////////////////////
// // Robust JSON extractor from LLM response
// function extractJsonPayload(rawResponse) {
//   const raw = rawResponse.trim();
//   // First try to extract JSON from markdown code blocks
//   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenceMatch?.[1]) {
//     try {
//       return JSON.parse(fenceMatch[1].trim());
//     } catch (e) {
//       console.error("Failed to parse JSON from code block", e);
//     }
//   }
//   // If that fails, try to find the outer JSON object
//   const start = raw.indexOf('{');
//   if (start !== -1) {
//     let depth = 0;
//     for(let i = start; i < raw.length; i++){
//       if (raw[i] === '{') depth++;
//       else if (raw[i] === '}') depth--;
//       if (depth === 0) {
//         const jsonCandidate = raw.slice(start, i + 1);
//         try {
//           return JSON.parse(jsonCandidate);
//         } catch (e) {
//           console.error("Failed to parse JSON from content", e);
//         }
//       }
//     }
//   }
//   console.error('Unable to extract JSON from LLM response:', raw);
//   throw new Error('Invalid JSON payload');
// }
// Robust JSON extractor from LLM response with balancing fallback
// function extractJsonPayload(rawResponse) {
//   const raw = rawResponse.trim();
//   // 1) Try direct JSON.parse
//   try {
//     return JSON.parse(raw);
//   } catch  {
//     console.log('Direct JSON.parse failed, proceeding to extraction');
//   }
//   // 2) Extract from code fences
//   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenceMatch?.[1]) {
//     const candidate = fenceMatch[1].trim();
//     try {
//       return JSON.parse(candidate);
//     } catch  {
//       console.log('Code fence JSON.parse failed');
//     }
//   }
//   // 3) Naive substring from first to last brace
//   const first = raw.indexOf('{');
//   const last = raw.lastIndexOf('}');
//   if (first !== -1 && last !== -1 && last > first) {
//     const candidate = raw.substring(first, last + 1);
//     console.log("Candidate: ", candidate);
//     try {
//       return JSON.parse(candidate);
//     } catch  {
//       console.log('Naive substring JSON.parse failed');
//     }
//   }
//   // 4) Balanced braces fallback
//   if (first !== -1) {
//     let depth = 0;
//     for(let i = first; i < raw.length; i++){
//       if (raw[i] === '{') depth++;
//       if (raw[i] === '}') depth--;
//       if (depth === 0) {
//         const slice = raw.slice(first, i + 1);
//         console.log("Slice: ", slice);
//         try {
//           return JSON.parse(slice);
//         } catch  {
//           console.log('Balanced slice JSON.parse failed');
//         }
//         break;
//       }
//     }
//   }
//   // 5) Balancing fallback: append missing '}'
//   const opens = (raw.match(/\{/g) || []).length;
//   const closes = (raw.match(/\}/g) || []).length;
//   if (opens > closes && first !== -1) {
//     const candidate = raw.slice(first) + '}'.repeat(opens - closes);
//     try {
//       return JSON.parse(candidate);
//     } catch  {
//       console.log('Balancing fallback JSON.parse failed');
//     }
//   }
//   console.error('Unable to extract JSON from LLM response:', raw);
//   throw new Error('Invalid JSON payload');
// }
// Robust JSON extractor from LLM response with balancing fallback
// function extractJsonPayload(rawResponse) {
//   const raw = rawResponse.trim();
//   // 1) Try direct JSON.parse
//   try {
//     return JSON.parse(raw);
//   } catch  {
//     console.log('Direct JSON.parse failed, proceeding to extraction');
//   }
//   // 2) Extract from code fences
//   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenceMatch?.[1]) {
//     const candidate = fenceMatch[1].trim();
//     try {
//       return JSON.parse(candidate);
//     } catch  {
//       console.log('Code fence JSON.parse failed');
//     }
//   }
//   // 3) Naive substring from first to last brace
//   const first = raw.indexOf('{');
//   const last = raw.lastIndexOf('}');
//   if (first !== -1 && last !== -1 && last > first) {
//     const candidate = raw.substring(first, last + 1);
//     try {
//       return JSON.parse(candidate);
//     } catch  {
//       console.log('Naive substring JSON.parse failed');
//     }
//   }
//   // 4) Balanced braces fallback
//   if (first !== -1) {
//     let depth = 0;
//     for(let i = first; i < raw.length; i++){
//       if (raw[i] === '{') depth++;
//       if (raw[i] === '}') depth--;
//       if (depth === 0) {
//         const slice = raw.slice(first, i + 1);
//         try {
//           return JSON.parse(slice);
//         } catch  {
//           console.log('Balanced slice JSON.parse failed');
//         }
//         break;
//       }
//     }
//   }
//   // 5) Balancing fallback: append missing '}'
//   const opens = (raw.match(/\{/g) || []).length;
//   const closes = (raw.match(/\}/g) || []).length;
//   if (opens > closes && first !== -1) {
//     const candidate = raw.slice(first) + '}'.repeat(opens - closes);
//     try {
//       return JSON.parse(candidate);
//     } catch  {
//       console.log('Balancing fallback JSON.parse failed');
//     }
//   }
//   console.error('Unable to extract JSON from LLM response:', raw);
//   throw new Error('Invalid JSON payload');
// }
// // Normalize the action plan to match component expectations
// function normalizeActionPlan(rawPlan) {
//   // Keys mapping
//   const keys = [
//     '6_weeks',
//     '9_weeks',
//     '12_weeks',
//     '6_months',
//     '12_months'
//   ];
//   const normalized = {};
//   for (const k of keys){
//     const data = rawPlan[k] || {};
//     normalized[k] = {
//       // Map narrative
//       narrative: data.motivational_narrative || data.narrative || '',
//       // Map skills_to_acquire (strings) into objects with courses array
//       skills: Array.isArray(data.skills_to_acquire) ? data.skills_to_acquire.map((s)=>({
//           name: s,
//           courses: []
//         })) : [],
//       // Map projects_to_build -> projects
//       projects: Array.isArray(data.projects_to_build) ? data.projects_to_build.map((p)=>({
//           title: p.title,
//           description: p.description
//         })) : [],
//       // Map content_to_post -> content
//       content: Array.isArray(data.content_to_post) ? data.content_to_post.map((c)=>({
//           platform: c.platform,
//           topics: c.topics
//         })) : [],
//       // Map milestones_to_achieve -> milestones
//       milestones: Array.isArray(data.milestones_to_achieve) ? data.milestones_to_achieve : []
//     };
//   }
//   return normalized;
// }
// Generate the career action plan using GROQ API
async function generateActionPlan(userData) {
  try {
    const systemPrompt = `SYSTEM INSTRUCTIONS (ENFORCE EXACT FORMAT):
    - OUTPUT ONLY a single JSON object with EXACT keys:
      "6_weeks","9_weeks","12_weeks","6_months","12_months".
    - Each key's value must be an object with EXACTLY these properties:
        "skills_to_acquire": string[] (MAX 3 items with the courses),
        "projects_to_build": { title: string; description: string }[] (MAX 2 items),
        "content_to_post": { platform: string; topics: string[] }[] (MAX 2 items),
        "milestones_to_achieve": string[] (MAX 3 items),
        "motivational_narrative": string (MAX 150 chars)
    - Keep descriptions BRIEF - under 100 characters each.
    - DO NOT include ANY additional keys, markdown, or explanatory text.
    - RESPONSE MUST START WITH '{' AND END WITH '}'.
    - KEEP TOTAL RESPONSE UNDER 2000 CHARACTERS.
    - If you fail to comply, output {} only.`;
    //     const systemPrompt = `SYSTEM INSTRUCTIONS (ENFORCE EXACT FORMAT):
    // - OUTPUT ONLY a single JSON object with EXACT keys:
    //   "6_weeks","9_weeks","12_weeks","6_months","12_months".
    // - Each key's value must be an object with properties:
    //     "skills_to_acquire": string[],
    //     "projects_to_build": { title: string; description: string }[],
    //     "content_to_post": { platform: string; topics: string[] }[],
    //     "milestones_to_achieve": string[],
    //     "motivational_narrative": string
    // - DO NOT include ANY additional keys, markdown, or explanatory text.
    // - RESPONSE MUST START WITH '{' AND END WITH '}'.
    // - If you fail to comply, output {} only.`;
    // Build a concise user prompt with just enough context
    const resumeSnippet = Array.isArray(userData.resume.sentences) ? userData.resume.sentences.slice(0, 3).join(' ') : '';
    const analysisSnippet = typeof userData.resume.analysis === 'string' ? userData.resume.analysis.slice(0, 200) : userData.resume.analysis ? JSON.stringify(userData.resume.analysis).slice(0, 200) : '';
    const userPrompt = `Resume summary: ${resumeSnippet}
Analysis snippet: ${analysisSnippet}

Career Pathway Report:
${userData.pathway.report ? JSON.stringify(userData.pathway.report) : ''}

1. Skills to acquire (for each skill, list specific online courses/trainings from platforms like Coursera, Udemy, LinkedIn Learning nested under the skill)
2. Projects to build (practical portfolio projects aligned with their career direction)
3. Content to post on LinkedIn/Twitter to build their professional brand
4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities)
5. A motivational narrative about their trajectory for this timeframe
Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.

Using only this information, generate the Career Action Plan in the exact JSON format described above.`;
    // Call the GROQ API
    const response = await callGroqWithRetry(systemPrompt, userPrompt);
    console.log("Raw Response: ", response);
    console.log(response);
    // Extract JSON from the response
    return extractJsonPayload(response);
  } catch (error) {
    console.error('Error generating action plan:', error);
    throw error;
  }
}
// Robust JSON extractor from LLM response
// function extractJsonPayload(rawResponse) {
//   const raw = rawResponse.trim();
//   // First try to extract JSON from markdown code blocks
//   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenceMatch?.[1]) {
//     try {
//       return JSON.parse(fenceMatch[1].trim());
//     } catch (e) {
//       console.error("Failed to parse JSON from code block", e);
//     }
//   }
//   // If that fails, try to find the outer JSON object
//   const start = raw.indexOf('{');
//   console.log("Start Index: ", start);
//   if (start !== -1) {
//     let depth = 0;
//     for(let i = start; i < raw.length; i++){
//       if (raw[i] === '{') depth++;
//       else if (raw[i] === '}') depth--;
//       console.log("Depth: ", depth);
//       if (depth === 0) {
//         const jsonCandidate = raw.slice(start, i + 1);
//         console.log(jsonCandidate);
//         try {
//           return JSON.parse(jsonCandidate);
//         } catch (e) {
//           console.error("Failed to parse JSON from content", e);
//         }
//       }
//     }
//   }
//   console.error('Unable to extract JSON from LLM response:', raw);
//   throw new Error('Invalid JSON payload');
// }
// Robust JSON extractor from LLM response
function extractJsonPayload(rawResponse) {
  const raw = rawResponse.trim();
  // First try direct parsing of the entire response
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.log("Direct parsing failed, trying alternatives");
  }
  // Try to extract from code blocks
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {
      console.log("Code block parsing failed");
    }
  }
  // Try to find the JSON object with a more reliable approach
  const start = raw.indexOf('{');
  if (start !== -1) {
    // More sophisticated JSON extraction
    let openBraces = 0;
    let inString = false;
    let escaped = false;
    let endPos = -1;
    for(let i = 0; i < raw.length; i++){
      const char = raw[i];
      // Handle string escaping
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && !escaped) {
        escaped = true;
        continue;
      }
      // Toggle string context
      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      // Only count braces outside of strings
      if (!inString) {
        if (char === '{') {
          openBraces++;
        } else if (char === '}') {
          openBraces--;
          // If we've closed all open braces, we found the end
          if (openBraces === 0 && i >= start) {
            endPos = i;
            break;
          }
        }
      }
    }
    // If we found a complete JSON object
    if (endPos !== -1) {
      const jsonCandidate = raw.slice(start, endPos + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (e) {
        console.log("Extracted JSON parsing failed:", e);
      }
    }
    // If we failed to find a complete JSON object but have a partial one,
    // try to fix it by adding missing closing braces
    if (openBraces > 0) {
      let fixedJson = raw.slice(start);
      for(let i = 0; i < openBraces; i++){
        fixedJson += '}';
      }
      try {
        return JSON.parse(fixedJson);
      } catch (e) {
        console.log("Fixed JSON parsing failed:", e);
      }
    }
  }
  // If all methods fail, try to extract using regex pattern matching
  // This is a fallback approach for partial JSON responses
  try {
    const jsonPattern = /{[^]*}/g;
    const matches = raw.match(jsonPattern);
    if (matches && matches.length > 0) {
      // Try the longest match first (most likely to be complete)
      matches.sort((a, b)=>b.length - a.length);
      for (const match of matches){
        try {
          return JSON.parse(match);
        } catch (e) {
        // Continue to next match
        }
      }
    }
  } catch (e) {
    console.log("Regex extraction failed:", e);
  }
  console.error('All JSON extraction methods failed for raw response:', raw);
  throw new Error('Invalid JSON payload');
}
// Normalize the action plan to match component expectations
function normalizeActionPlan(rawPlan) {
  // Keys mapping
  const keys = [
    '6_weeks',
    '9_weeks',
    '12_weeks',
    '6_months',
    '12_months'
  ];
  const normalized = {};
  for (const k of keys){
    const data = rawPlan[k] || {};
    normalized[k] = {
      // Map narrative
      narrative: data.motivational_narrative || data.narrative || '',
      // Map skills_to_acquire (strings) into objects with courses array
      skills: Array.isArray(data.skills_to_acquire) ? data.skills_to_acquire.map((s)=>({
          name: s,
          courses: []
        })) : [],
      // Map projects_to_build -> projects
      projects: Array.isArray(data.projects_to_build) ? data.projects_to_build.map((p)=>({
          title: p.title,
          description: p.description
        })) : [],
      // Map content_to_post -> content
      content: Array.isArray(data.content_to_post) ? data.content_to_post.map((c)=>({
          platform: c.platform,
          topics: c.topics
        })) : [],
      // Map milestones_to_achieve -> milestones
      milestones: Array.isArray(data.milestones_to_achieve) ? data.milestones_to_achieve : []
    };
  }
  return normalized;
}
// Edge function handler
Deno.serve(async (req)=>{
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const { userId } = await req.json();
    if (!userId) throw new Error('Missing userId');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userData = await getUserCareerData(supabase, userId);
    const rawPlan = await generateActionPlan(userData);
    console.log('Raw action plan:', rawPlan);
    const actionPlan = normalizeActionPlan(rawPlan);
    console.log('Normalized action plan:', actionPlan);
    // Store the action plan in Supabase
    try {
      // Fetch existing record first
      // const { data: existingSession } = await supabase.from('career_pathway_results').select('session_id').eq('user_id', userId).maybeSingle();
      // const { data: savedData, error: saveError } = await supabase.from('career_pathway_results').upsert({
      //   user_id: userId,
      //   session_id: existingSession,
      //   action_plan: actionPlan
      // });
      // Find the latest record for this user to get its session_id
      const { data: existingRecord, error: fetchError } = await supabase.from('career_pathway_results').select('session_id').eq('user_id', userId).order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing session:', fetchError);
        throw fetchError;
      }
      // If we have an existing session_id, use it
      if (existingRecord?.session_id) {
        console.log('Using existing session_id:', existingRecord.session_id);
        const { data: savedData, error: saveError } = await supabase.from('career_pathway_results').update({
          action_plan: actionPlan
        }).eq('user_id', userId).eq('session_id', existingRecord.session_id);
        if (saveError) {
          console.error('Error saving action plan with existing session:', saveError);
          throw saveError;
        }
        console.log('Saved action plan with existing session_id:', savedData);
      }
    // if (saveError) {
    //   console.error('Error saving action plan:', saveError);
    // } else {
    //   console.log('Saved action plan to Supabase:', savedData);
    // }
    } catch (e) {
      console.error('Exception saving action plan:', e);
    }
    return new Response(JSON.stringify({
      success: true,
      data: actionPlan
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}); // import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
 // import { corsHeaders, callGroqWithRetry } from '../_shared/utils.ts';
 // // CORS handling for preflight requests
 // function handleCors(req) {
 //   if (req.method === 'OPTIONS') {
 //     return new Response(null, {
 //       headers: corsHeaders
 //     });
 //   }
 //   return null;
 // }
 // // Fetch user's latest resume and career pathway report
 // async function getUserCareerData(supabase, userId) {
 //   const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
 //     ascending: false
 //   }).limit(1).maybeSingle();
 //   if (resumeError) console.error('Error fetching resume data:', resumeError);
 //   const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
 //     ascending: false
 //   }).limit(1).maybeSingle();
 //   if (pathwayError) console.error('Error fetching pathway data:', pathwayError);
 //   return {
 //     resume: resumeData || {
 //       sentences: [],
 //       analysis: ''
 //     },
 //     pathway: pathwayData || {
 //       report: ''
 //     }
 //   };
 // }
 // // Robust JSON extractor from LLM response
 // function extractJsonPayload(rawResponse) {
 //   const raw = rawResponse.trim();
 //   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //   if (fenceMatch?.[1]) {
 //     try {
 //       return JSON.parse(fenceMatch[1].trim());
 //     } catch  {}
 //   }
 //   const start = raw.indexOf('{');
 //   if (start !== -1) {
 //     let depth = 0;
 //     for(let i = start; i < raw.length; i++){
 //       if (raw[i] === '{') depth++;
 //       else if (raw[i] === '}') depth--;
 //       if (depth === 0) {
 //         const jsonCandidate = raw.slice(start, i + 1);
 //         try {
 //           return JSON.parse(jsonCandidate);
 //         } catch  {}
 //       }
 //     }
 //   }
 //   console.error('Unable to extract JSON from LLM response:', raw);
 //   throw new Error('Invalid JSON payload');
 // }
 // // Generate the Career Action Plan with strict JSON output
 // async function generateActionPlan(userData) {
 //   const systemPrompt = `SYSTEM INSTRUCTIONS (ENFORCE EXACT FORMAT):
 // - OUTPUT ONLY a single JSON object with EXACT keys:
 //   "6_weeks","9_weeks","12_weeks","6_months","12_months".
 // - Each key’s value must be an object with properties:
 //     "skills_to_acquire": string[],
 //     "projects_to_build": { title: string; description: string }[],
 //     "content_to_post": { platform: string; topics: string[] }[],
 //     "milestones_to_achieve": string[],
 //     "motivational_narrative": string
 // - DO NOT include ANY additional keys, markdown, or explanatory text.
 // - RESPONSE MUST START WITH '{' AND END WITH '}'.
 // - If you fail to comply, output {} only.`;
 //   // Build a concise user prompt to avoid echoing raw JSON
 //   const resumeSnippet = Array.isArray(userData.resume.sentences) ? userData.resume.sentences.slice(0, 3).join(' ') : '';
 //   const analysisSnippet = typeof userData.resume.analysis === 'string' ? userData.resume.analysis.slice(0, 200) : '';
 //   const userPrompt = `Resume summary: ${resumeSnippet}
 // Analysis snippet: ${analysisSnippet}
 // Career Pathway Report:
 // ${userData.pathway.report}
 // 1. Skills to acquire (with specific online courses/trainings from platforms like Coursera, Udemy, LinkedIn Learning)
 // 2. Projects to build (practical portfolio projects aligned with their career direction)
 // 3. Content to post on LinkedIn/Twitter to build their professional brand
 // 4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities)
 // 5. A motivational narrative about their trajectory for this timeframe
 // Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.
 // Using only this information, generate the Career Action Plan in the exact JSON format described above.`;
 //   const raw = await callGroqWithRetry(systemPrompt, userPrompt);
 //   console.log('RAW LLM OUTPUT:', raw);
 //   return extractJsonPayload(raw);
 // }
 // // Function to normalize raw LLM JSON into the component’s expected shape
 // function normalizeActionPlan(rawPlan) {
 //   // Keys mapping
 //   const keys = [
 //     '6_weeks',
 //     '9_weeks',
 //     '12_weeks',
 //     '6_months',
 //     '12_months'
 //   ];
 //   const normalized = {};
 //   for (const k of keys){
 //     const data = rawPlan[k] || {};
 //     normalized[k] = {
 //       // Map narrative
 //       narrative: data.motivational_narrative || data.narrative || '',
 //       // Map skills_to_acquire (strings) into objects with courses array
 //       skills: Array.isArray(data.skills_to_acquire) ? data.skills_to_acquire.map((s)=>({
 //           name: s,
 //           courses: []
 //         })) : [],
 //       // Map projects_to_build -> projects
 //       projects: Array.isArray(data.projects_to_build) ? data.projects_to_build.map((p)=>({
 //           title: p.title,
 //           description: p.description
 //         })) : [],
 //       // Map content_to_post -> content
 //       content: Array.isArray(data.content_to_post) ? data.content_to_post.map((c)=>({
 //           platform: c.platform,
 //           topics: c.topics
 //         })) : [],
 //       // Map milestones_to_achieve -> milestones
 //       milestones: Array.isArray(data.milestones_to_achieve) ? data.milestones_to_achieve : []
 //     };
 //   }
 //   return normalized;
 // }
 // // Edge function handler
 // Deno.serve(async (req)=>{
 //   const preflight = handleCors(req);
 //   if (preflight) return preflight;
 //   try {
 //     const { userId } = await req.json();
 //     if (!userId) throw new Error('Missing userId');
 //     const supabaseUrl = Deno.env.get('SUPABASE_URL');
 //     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 //     const supabase = createClient(supabaseUrl, supabaseKey);
 //     const userData = await getUserCareerData(supabase, userId);
 //     const plan = await generateActionPlan(userData);
 //     console.log('Raw JSON action plan:', plan);
 //     const actionPlan = normalizeActionPlan(plan);
 //     console.log('Normalized action plan:', actionPlan);
 //     return new Response(JSON.stringify({
 //       success: true,
 //       data: plan
 //     }), {
 //       headers: {
 //         ...corsHeaders,
 //         'Content-Type': 'application/json'
 //       }
 //     });
 //   } catch (error) {
 //     console.error('Handler error:', error);
 //     return new Response(JSON.stringify({
 //       success: false,
 //       error: error.message
 //     }), {
 //       status: 500,
 //       headers: {
 //         ...corsHeaders,
 //         'Content-Type': 'application/json'
 //       }
 //     });
 //   }
 // }); 
 // import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
 // import { corsHeaders } from '../_shared/utils.ts';
 // import { callGroqWithRetry } from '../_shared/utils.ts';
 // // Handle CORS preflight requests
 // const handleCors = (req)=>{
 //   if (req.method === 'OPTIONS') {
 //     return new Response(null, {
 //       headers: corsHeaders
 //     });
 //   }
 // };
 // // Function to get user's resume data and career pathway results
 // async function getUserCareerData(supabase, userId) {
 //   // Get resume data
 //   const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
 //     ascending: false
 //   }).limit(1).maybeSingle();
 //   if (resumeError) {
 //     console.error('Error fetching resume data:', resumeError);
 //   }
 //   // Get career pathway results
 //   const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
 //     ascending: false
 //   }).limit(1).maybeSingle();
 //   if (pathwayError) {
 //     console.error('Error fetching career pathway data:', pathwayError);
 //   }
 //   return {
 //     resume: resumeData,
 //     pathway: pathwayData
 //   };
 // }
 // // Generate the career action plan using GROQ API
 // async function generateActionPlan(userData) {
 //   try {
 //     const systemPrompt = `SYSTEM INSTRUCTIONS:
 //  - Output ONLY one JSON object with EXACT keys: "6_weeks","9_weeks","12_weeks","6_months","12_months".
 //  - Each key’s value must be an object with properties:
 //    "skills_to_acquire" (array of strings),
 //    "projects_to_build" (array of {title,description}),
 //    "content_to_post" (array of {platform,topics}),
 //    "milestones_to_achieve" (array of strings),
 //    "motivational_narrative" (string).
 //  - DO NOT include any other keys, code fences, or markdown.
 //  - Start with "{" and end with "}".
 //  **CRUCIAL**: Your _only_ output must be valid JSON. Do not include any explanatory text or markdown. If you cannot comply, output an empty JSON object {}.`;
 //     //  `
 //     //         You are an expert career coach generating a personalized Career Action Plan.
 //     //         Create a structured plan based on the user's resume data and career assessment results.
 //     //         Break it down into these keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".
 //     //         Each key's value must be an object containing:
 //     //           1. skills_to_acquire
 //     //           2. projects_to_build
 //     //           3. content_to_post
 //     //           4. milestones_to_achieve
 //     //           5. motivational_narrative
 //     //         **CRUCIAL**: Your _only_ output must be valid JSON. Do not include any explanatory text or markdown.
 //     //         `;
 //     // Prepare user data for the prompt - safely extract and format data
 //     const resumeData = userData.resume || {};
 //     const pathwayData = userData.pathway?.report || {};
 //     let userPrompt = `Here is the user's data:\n\nRESUME DATA:\n`;
 //     // Safely handle resume data
 //     if (resumeData.sentences) {
 //       userPrompt += `Resume sentences: ${JSON.stringify(resumeData.sentences)}\n`;
 //     }
 //     if (resumeData.analysis) {
 //       // Check if analysis is a string, array, or object and handle accordingly
 //       if (typeof resumeData.analysis === 'string') {
 //         userPrompt += `Analysis: ${resumeData.analysis}\n`;
 //       } else {
 //         userPrompt += `Analysis: ${JSON.stringify(resumeData.analysis)}\n`;
 //       }
 //     } else {
 //       userPrompt += `No resume analysis available.\n`;
 //     }
 //     userPrompt += `\nCAREER PATHWAY RESULTS:\n${JSON.stringify(pathwayData)}\n\n`;
 //     userPrompt += `Based on this information, generate a detailed Career Action Plan broken into timeframes.`;
 //     const response = await callGroqWithRetry(systemPrompt, userPrompt);
 //     console.log("Raw Response: ", response);
 //     // Parse the response - it should be JSON already but might be wrapped in markdown code blocks
 //     let jsonResponse;
 //     try {
 //       // First try direct parsing
 //       jsonResponse = JSON.parse(response);
 //       console.log("Response: ", jsonResponse);
 //     } catch (e) {
 //       // If that fails, try to extract JSON from markdown code blocks
 //       const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
 //       if (jsonMatch && jsonMatch[1]) {
 //         jsonResponse = JSON.parse(jsonMatch[1].trim());
 //       } else {
 //         throw new Error("Failed to parse GROQ response as JSON");
 //       }
 //     }
 //     return jsonResponse;
 //   } catch (error) {
 //     console.error('Error generating action plan:', error);
 //     throw error;
 //   }
 // }
 // // Main handler for the edge function
 // Deno.serve(async (req)=>{
 //   // Handle CORS
 //   const corsResponse = handleCors(req);
 //   if (corsResponse) return corsResponse;
 //   try {
 //     const supabaseUrl = Deno.env.get('SUPABASE_URL');
 //     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 //     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 //     // Get user ID from request
 //     const { userId } = await req.json();
 //     if (!userId) {
 //       throw new Error('User ID is required');
 //     }
 //     // Get user's career data
 //     const userData = await getUserCareerData(supabase, userId);
 //     // Generate action plan
 //     const actionPlan = await generateActionPlan(userData);
 //     // Store the action plan in Supabase (optional - can be enabled if needed)
 //     // await supabase.from('career_action_plans').upsert({
 //     //   user_id: userId,
 //     //   plan: actionPlan,
 //     //   created_at: new Date().toISOString()
 //     // });
 //     return new Response(JSON.stringify({
 //       success: true,
 //       data: actionPlan
 //     }), {
 //       headers: {
 //         ...corsHeaders,
 //         'Content-Type': 'application/json'
 //       }
 //     });
 //   } catch (error) {
 //     console.error('Error in generate-career-action-plan function:', error);
 //     return new Response(JSON.stringify({
 //       success: false,
 //       error: error.message
 //     }), {
 //       status: 500,
 //       headers: {
 //         ...corsHeaders,
 //         'Content-Type': 'application/json'
 //       }
 //     });
 //   }
 // }); // import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
 //  // import { corsHeaders, callGroqWithRetry } from '../_shared/utils.ts';
 //  // // CORS handling for preflight and responses
 //  // function handleCors(req) {
 //  //   if (req.method === 'OPTIONS') {
 //  //     return new Response(null, {
 //  //       headers: corsHeaders
 //  //     });
 //  //   }
 //  //   return null;
 //  // }
 //  // // Fetches the latest resume sentences & analysis and career pathway report for a user
 //  // async function getUserCareerData(supabase, userId) {
 //  //   const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
 //  //     ascending: false
 //  //   }).limit(1).maybeSingle();
 //  //   if (resumeError) console.error('Error fetching resume data:', resumeError);
 //  //   const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
 //  //     ascending: false
 //  //   }).limit(1).maybeSingle();
 //  //   if (pathwayError) console.error('Error fetching pathway data:', pathwayError);
 //  //   return {
 //  //     resume: resumeData || {
 //  //       sentences: [],
 //  //       analysis: ''
 //  //     },
 //  //     pathway: pathwayData || {
 //  //       report: ''
 //  //     }
 //  //   };
 //  // }
 //  // // Extracts the first valid JSON object from an LLM response
 //  // function extractJsonPayload(rawResponse) {
 //  //   const raw = rawResponse.trim();
 //  //   // 1) JSON fence
 //  //   const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //  //   if (fence?.[1]) {
 //  //     try {
 //  //       return JSON.parse(fence[1].trim());
 //  //     } catch  {} // fall through
 //  //   }
 //  //   // 2) Balanced braces
 //  //   const start = raw.indexOf('{');
 //  //   if (start !== -1) {
 //  //     let depth = 0;
 //  //     for(let i = start; i < raw.length; i++){
 //  //       if (raw[i] === '{') depth++;
 //  //       else if (raw[i] === '}') depth--;
 //  //       if (depth === 0) {
 //  //         const slice = raw.slice(start, i + 1);
 //  //         try {
 //  //           return JSON.parse(slice);
 //  //         } catch  {}
 //  //       }
 //  //     }
 //  //   }
 //  //   console.error('Full LLM response with no JSON:', raw);
 //  //   throw new Error('Unable to extract valid JSON from LLM');
 //  // }
 //  // // Calls the LLM to generate a career action plan in strict JSON format
 //  // async function generateActionPlan(userData) {
 //  //   const systemPrompt = `SYSTEM INSTRUCTIONS:
 //  // - Output ONLY one JSON object with EXACT keys: "6_weeks","9_weeks","12_weeks","6_months","12_months".
 //  // - Each key’s value must be an object with properties:
 //  //   "skills_to_acquire" (array of strings),
 //  //   "projects_to_build" (array of {title,description}),
 //  //   "content_to_post" (array of {platform,topics}),
 //  //   "milestones_to_achieve" (array of strings),
 //  //   "motivational_narrative" (string).
 //  // - DO NOT include any other keys, code fences, or markdown.
 //  // - Start with "{" and end with "}".
 //  // If you cannot comply, output an empty JSON object {}.`;
 //  //   const resumeLines = Array.isArray(userData.resume.sentences) ? userData.resume.sentences.slice(0, 5).join(' ') : '';
 //  //   const userPrompt = `Resume summary: ${resumeLines}
 //  // Analysis excerpt: ${userData.resume.analysis.slice(0, 200)}
 //  // Career Pathway Report:
 //  // ${userData.pathway.report}
 //  // Generate the Career Action Plan as described.`;
 //  //   const raw = await callGroqWithRetry(systemPrompt, userPrompt);
 //  //   console.log('🔵 RAW LLM OUTPUT:', raw);
 //  //   return extractJsonPayload(raw);
 //  // }
 //  // // Edge function entrypoint
 //  // Deno.serve(async (req)=>{
 //  //   // Handle CORS preflight
 //  //   const corsResponse = handleCors(req);
 //  //   if (corsResponse) return corsResponse;
 //  //   try {
 //  //     const { userId } = await req.json();
 //  //     if (!userId) throw new Error('Missing userId');
 //  //     const supabaseUrl = Deno.env.get('SUPABASE_URL');
 //  //     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 //  //     const supabase = createClient(supabaseUrl, supabaseKey);
 //  //     const userData = await getUserCareerData(supabase, userId);
 //  //     const actionPlan = await generateActionPlan(userData);
 //  //     return new Response(JSON.stringify({
 //  //       success: true,
 //  //       data: actionPlan
 //  //     }), {
 //  //       headers: {
 //  //         ...corsHeaders,
 //  //         'Content-Type': 'application/json'
 //  //       }
 //  //     });
 //  //   } catch (err) {
 //  //     console.error('Handler error:', err);
 //  //     return new Response(JSON.stringify({
 //  //       success: false,
 //  //       error: err.message
 //  //     }), {
 //  //       status: 500,
 //  //       headers: {
 //  //         ...corsHeaders,
 //  //         'Content-Type': 'application/json'
 //  //       }
 //  //     });
 //  //   }
 //  // }); 
 //  // // {
 //  // //   summary: "Based on your responses, you show strong analytical skills and an interest in problem-solving. Your background suggests you would excel in roles that combine technical expertise with strategic thinking.",
 //  // //   recommended_roles: [
 //  // //     "Data Analyst",
 //  // //     "Business Intelligence Specialist",
 //  // //     "Project Manager with technical focus"
 //  // //   ],
 //  // //   skills_and_matching_courses: {
 //  // //     "Data Analysis": "Advanced SQL for Analysts",
 //  // //     "Project Management": "Agile Certification Prep",
 //  // //     Communication: "Executive Presentation Skills"
 //  // //   },
 //  // //   next_step_career_recommendations: [
 //  // //     "Gain certification in your primary technical area",
 //  // //     "Develop a portfolio showcasing your analytical projects",
 //  // //     "Connect with professionals in your target industry"
 //  // //   ],
 //  // //   roles_that_might_be_right_for_you: [ "Junior Data Scientist", "Business Analyst", "Research Associate" ],
 //  // //   path_to_your_aspirational_role: {
 //  // //     start: "Start in an entry-level analytical position",
 //  // //     gain_experience: "Gain 2-3 years of hands-on experience",
 //  // //     pursue_certification_education: "Pursue advanced certification or education",
 //  // //     move_into_specialized_senior_role: "Move into a specialized or senior role"
 //  // //   },
 //  // //   remote_work_considerations: "Remote opportunities are abundant in data-focused careers. Consider highlighting your self-motivation and digital collaboration skills."
 //  // // }
 //  // import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
 //  // import { corsHeaders } from '../_shared/utils.ts';
 //  // import { callGroqWithRetry } from '../_shared/utils.ts';
 //  // // Handle CORS preflight requests
 //  // const handleCors = (req)=>{
 //  //   if (req.method === 'OPTIONS') {
 //  //     return new Response(null, {
 //  //       headers: corsHeaders
 //  //     });
 //  //   }
 //  // };
 //  // // Function to get user's resume data and career pathway results
 //  // async function getUserCareerData(supabase, userId) {
 //  //   // Get resume data
 //  //   const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
 //  //     ascending: false
 //  //   }).limit(1).maybeSingle();
 //  //   if (resumeError) {
 //  //     console.error('Error fetching resume data:', resumeError);
 //  //   }
 //  //   // Get career pathway results
 //  //   const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
 //  //     ascending: false
 //  //   }).limit(1).maybeSingle();
 //  //   if (pathwayError) {
 //  //     console.error('Error fetching career pathway data:', pathwayError);
 //  //   }
 //  //   return {
 //  //     resume: resumeData,
 //  //     pathway: pathwayData
 //  //   };
 //  // }
 //  // /**
 //  //   * Extracts JSON from GROQ response with multiple fallback strategies
 //  //   */ function extractJsonFromResponse(response) {
 //  //   try {
 //  //     // First try: Direct parse (in case response is already valid JSON)
 //  //     return JSON.parse(response);
 //  //   } catch (e) {
 //  //     // Not valid JSON, continue to extraction methods
 //  //     console.log("Not direct JSON, trying extraction methods");
 //  //   }
 //  //   try {
 //  //     // Second try: Extract code blocks with ```json
 //  //     const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //  //     if (jsonBlockMatch && jsonBlockMatch[1]) {
 //  //       return JSON.parse(jsonBlockMatch[1].trim());
 //  //     }
 //  //   } catch (e) {
 //  //     console.log("Failed to extract from code block");
 //  //   }
 //  //   try {
 //  //     // Third try: Find any JSON-like structure
 //  //     const jsonMatch = response.match(/(\{[\s\S]*\})/);
 //  //     if (jsonMatch && jsonMatch[1]) {
 //  //       return JSON.parse(jsonMatch[1].trim());
 //  //     }
 //  //   } catch (e) {
 //  //     console.log("Failed to extract from brackets");
 //  //   }
 //  //   // If we got here, attempt a more aggressive extraction
 //  //   try {
 //  //     // Find the first opening brace and the last closing brace
 //  //     const firstBrace = response.indexOf('{');
 //  //     const lastBrace = response.lastIndexOf('}');
 //  //     if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
 //  //       const jsonCandidate = response.substring(firstBrace, lastBrace + 1);
 //  //       return JSON.parse(jsonCandidate);
 //  //     }
 //  //   } catch (e) {
 //  //     console.log("Aggressive extraction failed");
 //  //   }
 //  //   throw new Error("Could not extract valid JSON from response");
 //  // }
 //  // /**
 //  //   * Creates an empty action plan with the required structure
 //  //   */ function createEmptyActionPlan() {
 //  //   const timeframes = [
 //  //     "6_weeks",
 //  //     "9_weeks",
 //  //     "12_weeks",
 //  //     "6_months",
 //  //     "12_months"
 //  //   ];
 //  //   const categories = [
 //  //     "skills_to_acquire",
 //  //     "projects_to_build",
 //  //     "content_to_post",
 //  //     "milestones_to_achieve",
 //  //     "motivational_narrative"
 //  //   ];
 //  //   // Create empty structure
 //  //   const emptyPlan = {};
 //  //   timeframes.forEach((timeframe)=>{
 //  //     emptyPlan[timeframe] = {};
 //  //     categories.forEach((category)=>{
 //  //       if (category === "motivational_narrative") {
 //  //         emptyPlan[timeframe][category] = `Motivational text for ${timeframe}`;
 //  //       } else {
 //  //         emptyPlan[timeframe][category] = [];
 //  //       }
 //  //     });
 //  //   });
 //  //   return emptyPlan;
 //  // }
 //  // /**
 //  //   * Validates and repairs an action plan to ensure it has the required structure
 //  //   */ function validateAndRepairActionPlan(plan) {
 //  //   const timeframes = [
 //  //     "6_weeks",
 //  //     "9_weeks",
 //  //     "12_weeks",
 //  //     "6_months",
 //  //     "12_months"
 //  //   ];
 //  //   const categories = [
 //  //     "skills_to_acquire",
 //  //     "projects_to_build",
 //  //     "content_to_post",
 //  //     "milestones_to_achieve",
 //  //     "motivational_narrative"
 //  //   ];
 //  //   const validatedPlan = {
 //  //     ...plan
 //  //   };
 //  //   // Check if the plan has the required timeframes and categories
 //  //   timeframes.forEach((timeframe)=>{
 //  //     if (!validatedPlan[timeframe]) {
 //  //       validatedPlan[timeframe] = {};
 //  //     }
 //  //     categories.forEach((category)=>{
 //  //       if (!validatedPlan[timeframe][category]) {
 //  //         if (category === "motivational_narrative") {
 //  //           validatedPlan[timeframe][category] = `Motivational text for ${timeframe}`;
 //  //         } else {
 //  //           validatedPlan[timeframe][category] = [];
 //  //         }
 //  //       }
 //  //       // Ensure arrays for array fields
 //  //       if (category !== "motivational_narrative" && !Array.isArray(validatedPlan[timeframe][category])) {
 //  //         const value = validatedPlan[timeframe][category];
 //  //         validatedPlan[timeframe][category] = [
 //  //           value
 //  //         ];
 //  //       }
 //  //     });
 //  //   });
 //  //   return validatedPlan;
 //  // }
 //  // /**
 //  //   * Transform a non-standard response into our required format
 //  //   */ function transformResponseToRequiredFormat(response) {
 //  //   console.log("Attempting to transform non-standard response to required format");
 //  //   // Start with an empty plan
 //  //   const actionPlan = createEmptyActionPlan();
 //  //   try {
 //  //     // Extract any JSON we can find
 //  //     let extractedData = null;
 //  //     // Check for code blocks first
 //  //     const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //  //     if (jsonBlockMatch && jsonBlockMatch[1]) {
 //  //       try {
 //  //         extractedData = JSON.parse(jsonBlockMatch[1].trim());
 //  //         console.log("Found JSON in code block");
 //  //       } catch (e) {
 //  //         console.log("Found code block but couldn't parse as JSON");
 //  //       }
 //  //     }
 //  //     // If no JSON from code blocks, try to find JSON structure
 //  //     if (!extractedData) {
 //  //       const jsonMatch = response.match(/(\{[\s\S]*\})/);
 //  //       if (jsonMatch && jsonMatch[1]) {
 //  //         try {
 //  //           extractedData = JSON.parse(jsonMatch[1].trim());
 //  //           console.log("Found JSON-like structure");
 //  //         } catch (e) {
 //  //           console.log("Found JSON-like structure but couldn't parse");
 //  //         }
 //  //       }
 //  //     }
 //  //     // If we found some JSON, try to map it to our format
 //  //     if (extractedData) {
 //  //       console.log("Working with extracted data structure:", JSON.stringify(extractedData).substring(0, 200) + "...");
 //  //       // Map from Career_Action_Plan format to our required format
 //  //       if (extractedData.Career_Action_Plan) {
 //  //         const mappings = [
 //  //           {
 //  //             from: "Short-term (Next 3-6 months)",
 //  //             to: "6_weeks"
 //  //           },
 //  //           {
 //  //             from: "Mid-term (Next 6-12 months)",
 //  //             to: "12_weeks"
 //  //           },
 //  //           {
 //  //             from: "Long-term (Next 1-2 years)",
 //  //             to: "12_months"
 //  //           }
 //  //         ];
 //  //         mappings.forEach((mapping)=>{
 //  //           const items = extractedData.Career_Action_Plan[mapping.from];
 //  //           if (Array.isArray(items)) {
 //  //             items.forEach((item)=>{
 //  //               if (item.Action_Item && item.Description) {
 //  //                 const category = categorizeActionItem(item.Action_Item);
 //  //                 if (category && actionPlan[mapping.to][category]) {
 //  //                   if (category === "motivational_narrative") {
 //  //                     actionPlan[mapping.to][category] = item.Description;
 //  //                   } else {
 //  //                     actionPlan[mapping.to][category].push(item.Description);
 //  //                   }
 //  //                 }
 //  //               }
 //  //             });
 //  //           }
 //  //         });
 //  //       }
 //  //     }
 //  //     // If we couldn't map properly, mine textual information
 //  //     if (JSON.stringify(actionPlan) === JSON.stringify(createEmptyActionPlan())) {
 //  //       console.log("Extracting information from raw text");
 //  //       // Try to extract skills, projects, etc. from the text
 //  //       const skillsMatch = response.match(/skills?(?:\sto\s|\:\s|\s-\s)([^.]*)/gi);
 //  //       const projectsMatch = response.match(/projects?(?:\sto\s|\:\s|\s-\s)([^.]*)/gi);
 //  //       const contentMatch = response.match(/content(?:\sto\s|\:\s|\s-\s)([^.]*)/gi);
 //  //       const milestonesMatch = response.match(/milestones?(?:\sto\s|\:\s|\s-\s)([^.]*)/gi);
 //  //       // Populate skills across timeframes
 //  //       if (skillsMatch && skillsMatch.length > 0) {
 //  //         [
 //  //           "6_weeks",
 //  //           "9_weeks",
 //  //           "12_weeks"
 //  //         ].forEach((timeframe, index)=>{
 //  //           if (skillsMatch[index % skillsMatch.length]) {
 //  //             const skills = skillsMatch[index % skillsMatch.length].replace(/skills?(?:\sto\s|\:\s|\s-\s)/i, '').split(/,|;|\n/).map((s)=>s.trim()).filter((s)=>s.length > 0);
 //  //             if (skills.length > 0) {
 //  //               actionPlan[timeframe].skills_to_acquire = skills;
 //  //             }
 //  //           }
 //  //         });
 //  //       }
 //  //       // Populate projects across timeframes
 //  //       if (projectsMatch && projectsMatch.length > 0) {
 //  //         [
 //  //           "6_weeks",
 //  //           "9_weeks",
 //  //           "12_weeks"
 //  //         ].forEach((timeframe, index)=>{
 //  //           if (projectsMatch[index % projectsMatch.length]) {
 //  //             const projects = projectsMatch[index % projectsMatch.length].replace(/projects?(?:\sto\s|\:\s|\s-\s)/i, '').split(/,|;|\n/).map((s)=>s.trim()).filter((s)=>s.length > 0);
 //  //             if (projects.length > 0) {
 //  //               actionPlan[timeframe].projects_to_build = projects;
 //  //             }
 //  //           }
 //  //         });
 //  //       }
 //  //     // Similar approach for content and milestones...
 //  //     }
 //  //     console.log("Transformed plan (first 200 chars):", JSON.stringify(actionPlan).substring(0, 200) + "...");
 //  //     return actionPlan;
 //  //   } catch (e) {
 //  //     console.error("Error transforming response:", e);
 //  //     return createEmptyActionPlan();
 //  //   }
 //  // }
 //  // /**
 //  //   * Categorize an action item into one of our categories
 //  //   */ function categorizeActionItem(actionItem) {
 //  //   actionItem = actionItem.toLowerCase();
 //  //   if (actionItem.includes("skill") || actionItem.includes("certification") || actionItem.includes("learn") || actionItem.includes("education")) {
 //  //     return "skills_to_acquire";
 //  //   } else if (actionItem.includes("project") || actionItem.includes("portfolio") || actionItem.includes("build")) {
 //  //     return "projects_to_build";
 //  //   } else if (actionItem.includes("content") || actionItem.includes("post") || actionItem.includes("blog") || actionItem.includes("article")) {
 //  //     return "content_to_post";
 //  //   } else if (actionItem.includes("milestone") || actionItem.includes("achieve") || actionItem.includes("goal")) {
 //  //     return "milestones_to_achieve";
 //  //   } else if (actionItem.includes("motivation") || actionItem.includes("narrative") || actionItem.includes("story")) {
 //  //     return "motivational_narrative";
 //  //   }
 //  //   // Default to skills if we can't categorize
 //  //   return "skills_to_acquire";
 //  // }
 //  // // Generate the career action plan using GROQ API
 //  // async function generateActionPlan(userData) {
 //  //   try {
 //  //     // Improved system prompt with clearer formatting requirements
 //  //     const systemPrompt = `You are CareerPlanGPT, an AI specifically designed to output ONLY valid JSON in a specific format. Your only role is to create career action plans.
 //  //  RETURN ONLY THE FOLLOWING JSON STRUCTURE WITH NO EXPLANATION OR EXTRA TEXT:
 //  //  {
 //  //    "6_weeks": {
 //  //      "skills_to_acquire": ["Skill 1", "Skill 2", "Skill 3"],
 //  //      "projects_to_build": ["Project 1", "Project 2", "Project 3"],
 //  //      "content_to_post": ["Content 1", "Content 2", "Content 3"],
 //  //      "milestones_to_achieve": ["Milestone 1", "Milestone 2", "Milestone 3"],
 //  //      "motivational_narrative": "Short motivational message for 6 weeks"
 //  //    },
 //  //    "9_weeks": {
 //  //      "skills_to_acquire": ["Skill 1", "Skill 2", "Skill 3"],
 //  //      "projects_to_build": ["Project 1", "Project 2", "Project 3"],
 //  //      "content_to_post": ["Content 1", "Content 2", "Content 3"],
 //  //      "milestones_to_achieve": ["Milestone 1", "Milestone 2", "Milestone 3"],
 //  //      "motivational_narrative": "Short motivational message for 9 weeks"
 //  //    },
 //  //    "12_weeks": {
 //  //      "skills_to_acquire": ["Skill 1", "Skill 2", "Skill 3"],
 //  //      "projects_to_build": ["Project 1", "Project 2", "Project 3"],
 //  //      "content_to_post": ["Content 1", "Content 2", "Content 3"],
 //  //      "milestones_to_achieve": ["Milestone 1", "Milestone 2", "Milestone 3"],
 //  //      "motivational_narrative": "Short motivational message for 12 weeks"
 //  //    },
 //  //    "6_months": {
 //  //      "skills_to_acquire": ["Skill 1", "Skill 2", "Skill 3"],
 //  //      "projects_to_build": ["Project 1", "Project 2", "Project 3"],
 //  //      "content_to_post": ["Content 1", "Content 2", "Content 3"],
 //  //      "milestones_to_achieve": ["Milestone 1", "Milestone 2", "Milestone 3"],
 //  //      "motivational_narrative": "Short motivational message for 6 months"
 //  //    },
 //  //    "12_months": {
 //  //      "skills_to_acquire": ["Skill 1", "Skill 2", "Skill 3"],
 //  //      "projects_to_build": ["Project 1", "Project 2", "Project 3"],
 //  //      "content_to_post": ["Content 1", "Content 2", "Content 3"],
 //  //      "milestones_to_achieve": ["Milestone 1", "Milestone 2", "Milestone 3"],
 //  //      "motivational_narrative": "Short motivational message for 12 months"
 //  //    }
 //  //  }
 //  //  YOUR OUTPUT MUST BE PARSEABLE AS JSON. DO NOT INCLUDE MARKDOWN CODE BLOCKS OR ANY TEXT OUTSIDE THE JSON OBJECT.`;
 //  //     const userPrompt = `I need a career action plan in JSON format. The plan must be formatted EXACTLY as shown in the example, with the exact same keys.
 //  //  Here is the user's data:
 //  //  RESUME DATA:
 //  //  ${JSON.stringify(userData.resume || {})}
 //  //  CAREER PATHWAY RESULTS:
 //  //  ${JSON.stringify(userData.pathway?.report || {})}
 //  //  Return ONLY the JSON object with no explanation text. Your entire response must be valid, parseable JSON.`;
 //  //     // Call GROQ API
 //  //     const response = await callGroqWithRetry(systemPrompt, userPrompt);
 //  //     console.log("Raw GROQ response:", response);
 //  //     // Try to extract JSON directly from the raw response
 //  //     let actionPlan;
 //  //     try {
 //  //       // First try to parse response directly
 //  //       actionPlan = JSON.parse(response);
 //  //       console.log("Successfully parsed direct JSON response");
 //  //       console.log(actionPlan);
 //  //     } catch (e) {
 //  //       console.log("Failed to parse direct JSON, attempting extraction:", e.message);
 //  //       // If direct parse fails, try our extraction methods
 //  //       try {
 //  //         actionPlan = extractJsonFromResponse(response);
 //  //       } catch (extractError) {
 //  //         console.error("All JSON extraction methods failed:", extractError);
 //  //         // As a last resort, manually transform the response to our required format
 //  //         actionPlan = transformResponseToRequiredFormat(response);
 //  //       }
 //  //     }
 //  //     console.log("Final action plan (first 200 chars):", JSON.stringify(actionPlan).substring(0, 200) + "...");
 //  //     // Validate the action plan has the expected structure
 //  //     actionPlan = validateAndRepairActionPlan(actionPlan);
 //  //     return actionPlan;
 //  //   } catch (error) {
 //  //     console.error('Error generating action plan:', error);
 //  //     throw error;
 //  //   }
 //  // }
 //  // // Main handler for the edge function
 //  // Deno.serve(async (req)=>{
 //  //   // Handle CORS
 //  //   const corsResponse = handleCors(req);
 //  //   if (corsResponse) return corsResponse;
 //  //   try {
 //  //     const supabaseUrl = Deno.env.get('SUPABASE_URL');
 //  //     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 //  //     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 //  //     // Get user ID from request
 //  //     const { userId } = await req.json();
 //  //     if (!userId) {
 //  //       throw new Error('User ID is required');
 //  //     }
 //  //     // Get user's career data
 //  //     const userData = await getUserCareerData(supabase, userId);
 //  //     // Generate action plan
 //  //     const actionPlan = await generateActionPlan(userData);
 //  //     // Return the generated action plan
 //  //     return new Response(JSON.stringify({
 //  //       success: true,
 //  //       data: actionPlan
 //  //     }), {
 //  //       headers: {
 //  //         ...corsHeaders,
 //  //         'Content-Type': 'application/json'
 //  //       }
 //  //     });
 //  //   } catch (error) {
 //  //     console.error('Error in generate-career-action-plan function:', error);
 //  //     return new Response(JSON.stringify({
 //  //       success: false,
 //  //       error: error.message
 //  //     }), {
 //  //       status: 500,
 //  //       headers: {
 //  //         ...corsHeaders,
 //  //         'Content-Type': 'application/json'
 //  //       }
 //  //     });
 //  //   }
 //  // }); 
 //  // import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
 //  // import { corsHeaders } from '../_shared/utils.ts';
 //  // import { callGroqWithRetry } from '../_shared/utils.ts';
 //  // // Handle CORS preflight requests
 //  // const handleCors = (req)=>{
 //  //   if (req.method === 'OPTIONS') {
 //  //     return new Response(null, {
 //  //       headers: corsHeaders
 //  //     });
 //  //   }
 //  // };
 //  // // Function to get user's resume data and career pathway results
 //  // async function getUserCareerData(supabase, userId) {
 //  //   // Get resume data
 //  //   const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
 //  //     ascending: false
 //  //   }).limit(1).maybeSingle();
 //  //   if (resumeError) {
 //  //     console.error('Error fetching resume data:', resumeError);
 //  //   }
 //  //   // Get career pathway results
 //  //   const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
 //  //     ascending: false
 //  //   }).limit(1).maybeSingle();
 //  //   if (pathwayError) {
 //  //     console.error('Error fetching career pathway data:', pathwayError);
 //  //   }
 //  //   return {
 //  //     resume: resumeData,
 //  //     pathway: pathwayData
 //  //   };
 //  // }
 //  // /**
 //  //   * Extracts JSON from GROQ response with multiple fallback strategies
 //  //   */ function extractJsonFromResponse(response) {
 //  //   try {
 //  //     // First try: Direct parse (in case response is already valid JSON)
 //  //     return JSON.parse(response);
 //  //   } catch (e) {
 //  //     // Not valid JSON, continue to extraction methods
 //  //     console.log("Not direct JSON, trying extraction methods");
 //  //   }
 //  //   try {
 //  //     // Second try: Extract code blocks with ```json
 //  //     const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //  //     if (jsonBlockMatch && jsonBlockMatch[1]) {
 //  //       return JSON.parse(jsonBlockMatch[1].trim());
 //  //     }
 //  //   } catch (e) {
 //  //     console.log("Failed to extract from code block");
 //  //   }
 //  //   try {
 //  //     // Third try: Find any JSON-like structure
 //  //     const jsonMatch = response.match(/(\{[\s\S]*\})/);
 //  //     if (jsonMatch && jsonMatch[1]) {
 //  //       return JSON.parse(jsonMatch[1].trim());
 //  //     }
 //  //   } catch (e) {
 //  //     console.log("Failed to extract from brackets");
 //  //   }
 //  //   // If we got here, attempt a more aggressive extraction
 //  //   try {
 //  //     // Find the first opening brace and the last closing brace
 //  //     const firstBrace = response.indexOf('{');
 //  //     const lastBrace = response.lastIndexOf('}');
 //  //     if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
 //  //       const jsonCandidate = response.substring(firstBrace, lastBrace + 1);
 //  //       return JSON.parse(jsonCandidate);
 //  //     }
 //  //   } catch (e) {
 //  //     console.log("Aggressive extraction failed");
 //  //   }
 //  //   // Last resort: Generate our own JSON format based on the timeframes
 //  //   console.log("All extraction methods failed. Creating fallback JSON structure.");
 //  //   // Create an empty structure that matches our expected format
 //  //   return createFallbackActionPlan(response);
 //  // }
 //  // /**
 //  //   * Creates a fallback action plan when JSON parsing fails
 //  //   */ function createFallbackActionPlan(response) {
 //  //   const timeframes = [
 //  //     "6_weeks",
 //  //     "9_weeks",
 //  //     "12_weeks",
 //  //     "6_months",
 //  //     "12_months"
 //  //   ];
 //  //   const categories = [
 //  //     "skills_to_acquire",
 //  //     "projects_to_build",
 //  //     "content_to_post",
 //  //     "milestones_to_achieve",
 //  //     "motivational_narrative"
 //  //   ];
 //  //   // Create empty structure
 //  //   const fallbackPlan = {};
 //  //   timeframes.forEach((timeframe)=>{
 //  //     fallbackPlan[timeframe] = {};
 //  //     categories.forEach((category)=>{
 //  //       fallbackPlan[timeframe][category] = `Unable to extract ${category} for ${timeframe} timeframe. Please regenerate.`;
 //  //     });
 //  //   });
 //  //   return fallbackPlan;
 //  // }
 //  // // Generate the career action plan using GROQ API
 //  // async function generateActionPlan(userData) {
 //  //   try {
 //  //     // Improved system prompt with clearer formatting requirements
 //  //     const systemPrompt = `
 //  //  You are an expert career coach generating a personalized Career Action Plan.
 //  //  You MUST return your response as a valid JSON object with these EXACT keys:
 //  //    "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months"
 //  //  For each timeframe, you MUST include these EXACT properties:
 //  //    "skills_to_acquire": [Array of specific skills],
 //  //    "projects_to_build": [Array of project ideas],
 //  //    "content_to_post": [Array of content suggestions],
 //  //    "milestones_to_achieve": [Array of concrete milestones],
 //  //    "motivational_narrative": [String with motivation]
 //  //  CRITICAL FORMATTING REQUIREMENTS:
 //  //  1. Your entire response MUST be valid JSON
 //  //  2. Do NOT include ANY explanatory text outside the JSON
 //  //  3. Do NOT use markdown code blocks around the JSON
 //  //  4. JSON must start with "{" and end with "}"
 //  //  5. Ensure all quotes and brackets are properly balanced
 //  //  6. Each array must have 3-4 items
 //  //  Example of EXACTLY how your response should look:
 //  //  {
 //  //    "6_weeks": {
 //  //      "skills_to_acquire": ["Skill 1", "Skill 2", "Skill 3"],
 //  //      "projects_to_build": ["Project 1", "Project 2", "Project 3"],
 //  //      "content_to_post": ["Content 1", "Content 2", "Content 3"],
 //  //      "milestones_to_achieve": ["Milestone 1", "Milestone 2", "Milestone 3"],
 //  //      "motivational_narrative": "Short motivational message for 6 weeks"
 //  //    },
 //  //    ...remaining timeframes...
 //  //  }`;
 //  //     const userPrompt = `Here is the user's data:
 //  //  RESUME DATA:
 //  //  ${JSON.stringify(userData.resume || {})}
 //  //  CAREER PATHWAY RESULTS:
 //  //  ${JSON.stringify(userData.pathway?.report || {})}
 //  //  Based on this information, generate a detailed Career Action Plan broken into timeframes. ONLY respond with JSON.`;
 //  //     // Call GROQ API
 //  //     const response = await callGroqWithRetry(systemPrompt, userPrompt);
 //  //     console.log("Raw GROQ response:", response);
 //  //     // Extract JSON from the response
 //  //     const actionPlan = extractJsonFromResponse(response);
 //  //     console.log("Extracted action plan:", JSON.stringify(actionPlan).substring(0, 200) + "...");
 //  //     return actionPlan;
 //  //   } catch (error) {
 //  //     console.error('Error generating action plan:', error);
 //  //     throw error;
 //  //   }
 //  // }
 //  // // Main handler for the edge function
 //  // Deno.serve(async (req)=>{
 //  //   // Handle CORS
 //  //   const corsResponse = handleCors(req);
 //  //   if (corsResponse) return corsResponse;
 //  //   try {
 //  //     const supabaseUrl = Deno.env.get('SUPABASE_URL');
 //  //     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 //  //     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 //  //     // Get user ID from request
 //  //     const { userId } = await req.json();
 //  //     if (!userId) {
 //  //       throw new Error('User ID is required');
 //  //     }
 //  //     // Get user's career data
 //  //     const userData = await getUserCareerData(supabase, userId);
 //  //     // Generate action plan
 //  //     const actionPlan = await generateActionPlan(userData);
 //  //     // Return the generated action plan
 //  //     return new Response(JSON.stringify({
 //  //       success: true,
 //  //       data: actionPlan
 //  //     }), {
 //  //       headers: {
 //  //         ...corsHeaders,
 //  //         'Content-Type': 'application/json'
 //  //       }
 //  //     });
 //  //   } catch (error) {
 //  //     console.error('Error in generate-career-action-plan function:', error);
 //  //     return new Response(JSON.stringify({
 //  //       success: false,
 //  //       error: error.message
 //  //     }), {
 //  //       status: 500,
 //  //       headers: {
 //  //         ...corsHeaders,
 //  //         'Content-Type': 'application/json'
 //  //       }
 //  //     });
 //  //   }
 //  // }); 
 //  // import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
 //  //  // import { corsHeaders } from '../_shared/utils.ts';
 //  //  // import { callGroqWithRetry } from '../_shared/utils.ts';
 //  //  // // Handle CORS preflight requests
 //  //  // const handleCors = (req)=>{
 //  //  //   if (req.method === 'OPTIONS') {
 //  //  //     return new Response(null, {
 //  //  //       headers: corsHeaders
 //  //  //     });
 //  //  //   }
 //  //  // };
 //  //  // // Function to get user's resume data and career pathway results
 //  //  // async function getUserCareerData(supabase, userId) {
 //  //  //   // Get resume data
 //  //  //   const { data: resumeData, error: resumeError } = await supabase.from('resumes').select('sentences, analysis').eq('user_id', userId).order('updated_at', {
 //  //  //     ascending: false
 //  //  //   }).limit(1).maybeSingle();
 //  //  //   if (resumeError) {
 //  //  //     console.error('Error fetching resume data:', resumeError);
 //  //  //   }
 //  //  //   // Get career pathway results
 //  //  //   const { data: pathwayData, error: pathwayError } = await supabase.from('career_pathway_results').select('report').eq('user_id', userId).order('created_at', {
 //  //  //     ascending: false
 //  //  //   }).limit(1).maybeSingle();
 //  //  //   if (pathwayError) {
 //  //  //     console.error('Error fetching career pathway data:', pathwayError);
 //  //  //   }
 //  //  //   return {
 //  //  //     resume: resumeData,
 //  //  //     pathway: pathwayData
 //  //  //   };
 //  //  // }
 //  //  // // /**
 //  //  // //  * Robustly extracts and parses the first JSON object
 //  //  // //  * from a free-form LLM response string.
 //  //  // //  *
 //  //  // //  * @param rawResponse  The complete text returned by the model.
 //  //  // //  * @throws             If no JSON object can be found or parsed.
 //  //  // //  */ 
 //  //  // // function extractJsonPayload(rawResponse) {
 //  //  // //   const raw = rawResponse.trim();
 //  //  // //   // 1) Try to grab anything inside ```json ... ```
 //  //  // //   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //  //  // //   if (fenceMatch && fenceMatch[1]) {
 //  //  // //     const candidate = fenceMatch[1].trim();
 //  //  // //     try {
 //  //  // //       return JSON.parse(candidate);
 //  //  // //     } catch (e) {
 //  //  // //       console.warn("Found JSON fence but failed to parse:", candidate);
 //  //  // //     // fall through to next strategy
 //  //  // //     }
 //  //  // //   }
 //  //  // //   // 2) Fallback: find the first {...} block in the entire string
 //  //  // //   const blockMatch = raw.match(/\{[\s\S]*\}/);
 //  //  // //   if (blockMatch) {
 //  //  // //     const candidate = blockMatch[0];
 //  //  // //     try {
 //  //  // //       return JSON.parse(candidate);
 //  //  // //     } catch (e) {
 //  //  // //       console.warn("Extracted {...} block but failed to parse:", candidate);
 //  //  // //     }
 //  //  // //   }
 //  //  // //   // 3) Give up with full context for debugging
 //  //  // //   console.error("Full LLM response with no valid JSON found:\n", raw);
 //  //  // //   throw new Error("Unable to locate or parse a JSON object in LLM response.");
 //  //  // // }
 //  //  // /**
 //  //  //  * Extracts and parses the first valid JSON object from any LLM response.
 //  //  //  * 1) Checks for ```json fences```
 //  //  //  * 2) Falls back to finding the first balanced { … } block
 //  //  //  *
 //  //  //  * @param rawResponse  The raw text returned by the model.
 //  //  //  * @throws             If no JSON object can be found or parsed.
 //  //  //  */ function extractJsonPayload(rawResponse) {
 //  //  //   const raw = rawResponse.trim();
 //  //  //   // 1) Try to grab anything inside ```json ... ```
 //  //  //   const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 //  //  //   if (fenceMatch?.[1]) {
 //  //  //     const candidate = fenceMatch[1].trim();
 //  //  //     try {
 //  //  //       return JSON.parse(candidate);
 //  //  //     } catch (e) {
 //  //  //       console.warn("JSON fence found but parse failed:", candidate);
 //  //  //     // continue to balanced-brace extraction
 //  //  //     }
 //  //  //   }
 //  //  //   // 2) Fallback: locate the first balanced {...} block
 //  //  //   const start = raw.indexOf('{');
 //  //  //   if (start !== -1) {
 //  //  //     let depth = 0;
 //  //  //     for(let i = start; i < raw.length; i++){
 //  //  //       if (raw[i] === '{') depth++;
 //  //  //       else if (raw[i] === '}') depth--;
 //  //  //       // when depth returns to zero, we've closed our object
 //  //  //       if (depth === 0) {
 //  //  //         const candidate = raw.slice(start, i + 1);
 //  //  //         try {
 //  //  //           return JSON.parse(candidate);
 //  //  //         } catch (e) {
 //  //  //           console.warn("Balanced-brace candidate failed parse:", candidate);
 //  //  //           break;
 //  //  //         }
 //  //  //       }
 //  //  //     }
 //  //  //   }
 //  //  //   // 3) No valid JSON found
 //  //  //   console.error("Full LLM response (no JSON found):\n", raw);
 //  //  //   throw new Error("Unable to locate or parse a JSON object in LLM response.");
 //  //  // }
 //  //  // // Generate the career action plan using GROQ API
 //  //  // async function generateActionPlan(userData) {
 //  //  //   try {
 //  //  //     const systemPrompt = `
 //  //  // You are an expert career coach generating a personalized Career Action Plan.
 //  //  // Output **only** a single JSON object with these five top-level keys:
 //  //  //   "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months"
 //  //  // Each key’s value must be an object with exactly these properties:
 //  //  //   • skills_to_acquire  
 //  //  //   • projects_to_build  
 //  //  //   • content_to_post  
 //  //  //   • milestones_to_achieve  
 //  //  //   • motivational_narrative  
 //  //  // **IMPORTANT**: 
 //  //  // Do NOT include any headings, bullet points, or explanatory text. 
 //  //  // Do NOT wrap the JSON in code fences. 
 //  //  // Response must start with “{” and end with “}”.  THE RESPONSE MUST FULLY WRAPPED IN A JSON OBJECT.
 //  //  // `;
 //  //  //     //     const systemPrompt = `
 //  //  //     // You are an expert career coach generating a personalized Career Action Plan.
 //  //  //     // Use ONLY these five keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".
 //  //  //     // Each key’s value must be an object with **exactly** these properties:
 //  //  //     //   • skills_to_acquire  
 //  //  //     //   • projects_to_build  
 //  //  //     //   • content_to_post  
 //  //  //     //   • milestones_to_achieve  
 //  //  //     //   • motivational_narrative  
 //  //  //     // **IMPORTANT**
 //  //  //     // Output must start with “{” and end with “}”.
 //  //  //     // Do NOT include any headings, bullet points, explanatory text, or markdown.
 //  //  //     // Do NOT wrap your JSON in code fences. THE ACTION PLAN MUST BE IN JSON.
 //  //  //     // `;
 //  //  //     //     const systemPrompt = `
 //  //  //     // You are an expert career coach generating a personalized Career Action Plan.
 //  //  //     // Create a structured plan based on the user's resume data and career assessment results.
 //  //  //     // Break it down into these keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".
 //  //  //     // Each key’s value must be an object containing:
 //  //  //     //   1. skills_to_acquire
 //  //  //     //   2. projects_to_build
 //  //  //     //   3. content_to_post
 //  //  //     //   4. milestones_to_achieve
 //  //  //     //   5. motivational_narrative
 //  //  //     // **CRUCIAL**: Your _only_ output must be valid JSON. Do not include any explanatory text or markdown.
 //  //  //     // `;
 //  //  //     //     const systemPrompt = `You are an expert career coach generating a personalized Career Action Plan. 
 //  //  //     // Create a structured plan based on the user's resume data and career assessment results.
 //  //  //     // The plan should be broken down into timeframes: 6 weeks, 9 weeks, 12 weeks, 6 months, and 12 months.
 //  //  //     // Each timeframe should include:
 //  //  //     // 1. Skills to acquire (with specific online courses/trainings from platforms like Coursera, Udemy, LinkedIn Learning)
 //  //  //     // 2. Projects to build (practical portfolio projects aligned with their career direction)
 //  //  //     // 3. Content to post on LinkedIn/Twitter to build their professional brand
 //  //  //     // 4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities)
 //  //  //     // 5. A motivational narrative about their trajectory for this timeframe
 //  //  //     // Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.
 //  //  //     // Return a JSON object with these timeframes as keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".
 //  //  //     // Ensure your response is well-structured JSON that can be directly used in a frontend application.`;
 //  //  //     const userPrompt = `Here is the user's data:
 //  //  // RESUME DATA:
 //  //  // ${JSON.stringify(userData.resume || {})}
 //  //  // CAREER PATHWAY RESULTS:
 //  //  // ${JSON.stringify(userData.pathway?.report || {})}
 //  //  // Based on this information, generate a detailed Career Action Plan broken into timeframes.`;
 //  //  //     const response = await callGroqWithRetry(systemPrompt, userPrompt);
 //  //  //     console.log("Response: ", response);
 //  //  //     // Parse the response - it should be JSON already but might be wrapped in markdown code blocks
 //  //  //     //   let jsonResponse;
 //  //  //     //   try {
 //  //  //     //     // First try direct parsing
 //  //  //     //     jsonResponse = JSON.parse(response);
 //  //  //     //   } catch (e) {
 //  //  //     //     // If that fails, try to extract JSON from markdown code blocks
 //  //  //     //     const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
 //  //  //     //     if (jsonMatch && jsonMatch[1]) {
 //  //  //     //       jsonResponse = JSON.parse(jsonMatch[1].trim());
 //  //  //     //     } else {
 //  //  //     //       throw new Error("Failed to parse GROQ response as JSON");
 //  //  //     //     }
 //  //  //     //   }
 //  //  //     //   return jsonResponse;
 //  //  //     // } catch (error) {
 //  //  //     //   console.error('Error generating action plan:', error);
 //  //  //     //   throw error;
 //  //  //     // }
 //  //  //     // const response = await callGroqWithRetry(systemPrompt, userPrompt);
 //  //  //     let jsonResponse;
 //  //  //     try {
 //  //  //       jsonResponse = extractJsonPayload(response);
 //  //  //       console.log("Parsed action plan:", jsonResponse);
 //  //  //     } catch (err) {
 //  //  //       console.error("Error extracting JSON:", err);
 //  //  //       throw err;
 //  //  //     }
 //  //  //     return jsonResponse;
 //  //  //   } catch (error) {
 //  //  //     console.error('Error generating action plan:', error);
 //  //  //     throw error;
 //  //  //   }
 //  //  // }
 //  //  // // Main handler for the edge function
 //  //  // Deno.serve(async (req)=>{
 //  //  //   // Handle CORS
 //  //  //   const corsResponse = handleCors(req);
 //  //  //   if (corsResponse) return corsResponse;
 //  //  //   try {
 //  //  //     const supabaseUrl = Deno.env.get('SUPABASE_URL');
 //  //  //     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 //  //  //     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 //  //  //     // Get user ID from request
 //  //  //     const { userId } = await req.json();
 //  //  //     if (!userId) {
 //  //  //       throw new Error('User ID is required');
 //  //  //     }
 //  //  //     // Get user's career data
 //  //  //     const userData = await getUserCareerData(supabase, userId);
 //  //  //     // Generate action plan
 //  //  //     const actionPlan = await generateActionPlan(userData);
 //  //  //     // Store the action plan in Supabase (optional - can be enabled if needed)
 //  //  //     // await supabase.from('career_action_plans').upsert({
 //  //  //     //   user_id: userId,
 //  //  //     //   plan: actionPlan,
 //  //  //     //   created_at: new Date().toISOString()
 //  //  //     // });
 //  //  //     return new Response(JSON.stringify({
 //  //  //       success: true,
 //  //  //       data: actionPlan
 //  //  //     }), {
 //  //  //       headers: {
 //  //  //         ...corsHeaders,
 //  //  //         'Content-Type': 'application/json'
 //  //  //       }
 //  //  //     });
 //  //  //   } catch (error) {
 //  //  //     console.error('Error in generate-career-action-plan function:', error);
 //  //  //     return new Response(JSON.stringify({
 //  //  //       success: false,
 //  //  //       error: error.message
 //  //  //     }), {
 //  //  //       status: 500,
 //  //  //       headers: {
 //  //  //         ...corsHeaders,
 //  //  //         'Content-Type': 'application/json'
 //  //  //       }
 //  //  //     });
 //  //  //   }
 //  //  // });
