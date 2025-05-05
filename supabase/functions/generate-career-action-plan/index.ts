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

1. Skills to acquire (list 3 skills and for each skill, list specific online courses/trainings related to the skill from platforms like Coursera, Udemy, Udacity, AWS, Microsoft or LinkedIn Learning nested under the skill)
2. Projects to build (practical portfolio projects aligned with their career direction)
3. Content to post on LinkedIn/Twitter to build their professional brand - (be descriptive with examples)
4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities, be descriptive and explain the benefit)
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
});
