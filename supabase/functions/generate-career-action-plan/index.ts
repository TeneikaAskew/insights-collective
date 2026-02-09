import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, callLLMWithRetry } from '../_shared/utils.ts';
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
// Improved robust JSON parser for LLM output
export function extractJsonPayload(rawResponse) {
  let raw = rawResponse;
  // 1. Remove markdown code fences if present
  raw = raw.replace(/```(?:json)?[\s\S]*?```/g, (m) => m.replace(/```(?:json)?|```/g, ''));
  // 2. Try to extract the largest JSON-like block
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in LLM response:', raw);
    throw new Error('Invalid JSON payload');
  }
  raw = jsonMatch[0];

  // 3. Try parsing directly
  try {
    return JSON.parse(raw);
  } catch (e) {
    // 4. Try to fix unbalanced brackets
    const open = (raw.match(/\{/g) || []).length;
    const close = (raw.match(/\}/g) || []).length;
    if (open > close) {
      try {
        return JSON.parse(raw + '}'.repeat(open - close));
      } catch {}
    }
    // 5. Remove trailing commas before } or ]
    let cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch {}
    // 6. Replace single quotes with double quotes (if any)
    cleaned = cleaned.replace(/'/g, '"');
    try {
      return JSON.parse(cleaned);
    } catch {}
    // 7. Try to trim after last closing brace
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace !== -1) {
      try {
        return JSON.parse(raw.slice(0, lastBrace + 1));
      } catch {}
    }
    // 8. Fallback: return error and raw
    console.error('All JSON recovery attempts failed:', e, raw);
    return { error: 'Invalid JSON from LLM', raw };
  }
}
// Generate the career action plan using GROQ API
async function generateActionPlan(userData) {
  try {
    const systemPrompt = `SYSTEM INSTRUCTIONS (ENFORCE EXACT FORMAT):
    - OUTPUT ONLY a single JSON object with EXACT keys:
      "6_weeks","9_weeks","12_weeks","6_months","12_months".
    - Each key's value must be an object with EXACTLY these properties:
        "skills_to_acquire": [{ "skill": string, "courses": string[] }] (MIN 3, MAX 3 items with the courses),
        "projects_to_build": { title: string; description: string }[] (MIN 2, MAX 3 items, be specific and aligned with their personal interests and career direction),
        "content_to_post": { platform: string; topics: string[] }[] (MIN 2, MAX 3 items),
        "milestones_to_achieve": string[] (MIN 3, MAX 3 items),
        "motivational_narrative": string (MAX 250 chars)
    - Keep descriptions BRIEF - under 150 characters each.
    - DO NOT include ANY additional keys, markdown, or explanatory text.
    - RESPONSE MUST START WITH '{' AND END WITH '}'.
    - KEEP TOTAL RESPONSE UNDER 9000 CHARACTERS.`; //    - If you fail to comply, output {} ERROR only.
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
5. A motivational narrative about their trajectory for this timeframe, be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights. Minimum of 100 words.
Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.

Using only this information, generate the Career Action Plan in the exact JSON format described above.`;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 5000,
      }),
    });
    const data = await response.json();
    let plan;
    try {
      plan = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      plan = { error: "Invalid JSON from LLM", raw: data.choices[0].message.content };
    }
    return plan;
  } catch (error) {
    console.error('Error generating action plan:', error);
    throw error;
  }
}
function normalizeActionPlan(rawPlan) {
  const keys = [
    '6_weeks',
    '9_weeks',
    '12_weeks',
    '6_months',
    '12_months'
  ];
  const normalized = {};
  keys.forEach((k)=>{
    const data = rawPlan[k] || {};
    normalized[k] = {
      narrative: data.motivational_narrative || data.narrative || '',
      skills: Array.isArray(data.skills_to_acquire) ? data.skills_to_acquire.map((skillObj)=>{
        // handle both .skill and .name
        const skillName = typeof skillObj.name === 'string' ? skillObj.name : typeof skillObj.skill === 'string' ? skillObj.skill : '';
        return {
          name: skillName,
          courses: Array.isArray(skillObj.courses) ? skillObj.courses : []
        };
      }) : [],
      projects: Array.isArray(data.projects_to_build) ? data.projects_to_build.map((p)=>({
          title: p.title,
          description: p.description
        })) : [],
      content: Array.isArray(data.content_to_post) ? data.content_to_post.map((c)=>({
          platform: c.platform,
          topics: c.topics
        })) : [],
      milestones: Array.isArray(data.milestones_to_achieve) ? data.milestones_to_achieve : []
    };
  });
  // Add careerPathRoles and recommendedSkills properties to make it compatible with our components
  const recommendedSkills = [];
  const careerPathRoles = [];
  // Extract skills from all timeframes and convert to the format expected by SkillsSection
  keys.forEach((timeframe)=>{
    if (normalized[timeframe] && normalized[timeframe].skills) {
      normalized[timeframe].skills.forEach((skill)=>{
        if (skill.name && !recommendedSkills.some((s)=>s.name === skill.name)) {
          recommendedSkills.push({
            name: skill.name,
            type: Math.random() > 0.5 ? 'hard' : 'soft',
            course: skill.courses && skill.courses.length > 0 ? skill.courses[0] : 'No specific course recommended'
          });
        }
      });
    }
    // Extract projects as potential career roles
    if (normalized[timeframe] && normalized[timeframe].projects) {
      normalized[timeframe].projects.forEach((project)=>{
        if (project.title && !careerPathRoles.some((r)=>r.title === project.title)) {
          careerPathRoles.push({
            title: project.title,
            description: project.description,
            salary: `$${60000 + Math.floor(Math.random() * 40000)} - $${100000 + Math.floor(Math.random() * 50000)} per year`
          });
        }
      });
    }
  });
  // Add these to the normalized plan
  normalized.recommendedSkills = recommendedSkills;
  normalized.careerPathRoles = careerPathRoles;
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
          action_plan: actionPlan,
          created_at: new Date().toISOString()
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
