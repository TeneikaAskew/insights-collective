import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Inlined (previously from ../_shared/utils.ts) so the function bundle is
// self-contained for dashboard/MCP deploys as well as the CLI.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CORS handling for preflight requests
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

// Fetch user's latest resume and career pathway report.
// A missing row (maybeSingle -> null) falls back to defaults; a real query
// error throws so a user WITH data never silently gets a generic plan.
async function getUserCareerData(supabase: SupabaseClient, userId: string) {
  const { data: resumeData, error: resumeError } = await supabase
    .from('resumes')
    .select('sentences, analysis')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (resumeError) {
    console.error('Error fetching resume data:', resumeError);
    throw new Error(`Failed to fetch resume data: ${resumeError.message}`);
  }
  const { data: pathwayData, error: pathwayError } = await supabase
    .from('career_pathway_results')
    .select('report')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pathwayError) {
    console.error('Error fetching pathway data:', pathwayError);
    throw new Error(`Failed to fetch career pathway data: ${pathwayError.message}`);
  }
  return {
    resume: resumeData || { sentences: [], analysis: '' },
    pathway: pathwayData || { report: '' },
  };
}

// Strict JSON parse with a single fence-strip fallback. The old regex repair
// chain (bracket balancing, quote swapping) could corrupt valid content; with
// response_format json_object it is no longer needed.
function parseModelJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

// Generate the career action plan via the AI gateway
async function generateActionPlan(userData: Awaited<ReturnType<typeof getUserCareerData>>) {
  const systemPrompt = `SYSTEM INSTRUCTIONS (ENFORCE EXACT FORMAT):
- OUTPUT ONLY a single JSON object with EXACT keys:
  "6_weeks","9_weeks","12_weeks","6_months","12_months".
- Each key's value must be an object with EXACTLY these properties:
    "skills_to_acquire": [{ "name": string, "courses": [{ "title": string, "provider": string }] }] (EXACTLY 3 skills, each with 1-2 courses; provider is the platform or organization, e.g. "Coursera", "dbt Labs", "LinkedIn Learning"),
    "projects_to_build": [{ "title": string, "description": string }] (MIN 2, MAX 3 items, specific and aligned with their personal interests and career direction),
    "content_to_post": [{ "platform": string, "topics": string[] }] (MIN 2, MAX 3 items, 1-3 topics each),
    "milestones_to_achieve": string[] (EXACTLY 3 concrete, checkable items),
    "motivational_narrative": string (80-120 words, supportive and specific to this timeframe)
- Keep project and topic descriptions under 150 characters each.
- DO NOT include ANY additional keys, markdown, or explanatory text.
- RESPONSE MUST START WITH '{' AND END WITH '}'.`;

  const resumeSnippet = Array.isArray(userData.resume.sentences) ? userData.resume.sentences.slice(0, 3).join(' ') : '';
  const analysisSnippet = typeof userData.resume.analysis === 'string'
    ? userData.resume.analysis.slice(0, 200)
    : userData.resume.analysis ? JSON.stringify(userData.resume.analysis).slice(0, 200) : '';
  const userPrompt = `Resume summary: ${resumeSnippet}
Analysis snippet: ${analysisSnippet}

Career Pathway Report:
${userData.pathway.report ? JSON.stringify(userData.pathway.report) : ''}

For each timeframe generate:
1. Skills to acquire, each with specific named courses and their providers
2. Projects to build (practical portfolio projects aligned with their career direction)
3. Content to post on LinkedIn/X/blogs to build their professional brand
4. Milestones to achieve (concrete, checkable steps like updating resume, applying to roles, joining communities)
5. A motivational narrative for the timeframe (80-120 words) that reads as a natural extension of their existing career insights

Using only this information, generate the Career Action Plan in the exact JSON format described above.`;

  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
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
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText.slice(0, 300));
    throw new Error(`AI gateway returned ${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI gateway returned no content');
  }
  const plan = parseModelJson(content);
  if (!plan) {
    console.error('Unparseable action plan from LLM (first 300 chars):', content.slice(0, 300));
    throw new Error('AI returned an unparseable action plan');
  }
  return plan;
}

// Normalize the raw plan into the shape the frontend renders.
// Courses become {title, provider} objects even if the model returned strings.
// NOTE: the old recommendedSkills/careerPathRoles synthesis was removed — it
// fabricated random salaries and random hard/soft types and presented them as
// personalized data. Nothing in the app consumes those keys anymore.
function normalizeActionPlan(rawPlan: Record<string, any>) {
  const keys = ['6_weeks', '9_weeks', '12_weeks', '6_months', '12_months'];
  const normalized: Record<string, any> = {};
  keys.forEach((k) => {
    const data = rawPlan[k] || {};
    normalized[k] = {
      narrative: data.motivational_narrative || data.narrative || '',
      skills: Array.isArray(data.skills_to_acquire) ? data.skills_to_acquire.map((skillObj: any) => {
        const skillName = typeof skillObj.name === 'string' ? skillObj.name
          : typeof skillObj.skill === 'string' ? skillObj.skill : '';
        const courses = Array.isArray(skillObj.courses) ? skillObj.courses.map((c: any) => {
          if (typeof c === 'string') return { title: c, provider: '' };
          return { title: c?.title ?? '', provider: c?.provider ?? '', ...(c?.url ? { url: c.url } : {}) };
        }) : [];
        return { name: skillName, courses };
      }) : [],
      projects: Array.isArray(data.projects_to_build) ? data.projects_to_build.map((p: any) => ({
        title: p.title,
        description: p.description,
      })) : [],
      content: Array.isArray(data.content_to_post) ? data.content_to_post.map((c: any) => ({
        platform: c.platform,
        topics: Array.isArray(c.topics) ? c.topics : [],
      })) : [],
      milestones: Array.isArray(data.milestones_to_achieve) ? data.milestones_to_achieve : [],
    };
  });
  return normalized;
}

// ── Coursera grounding ──────────────────────────────────────────────────────
// The LLM invents course names. Replace them with real catalog rows where a
// skill matches the catalog; skills nothing matches keep the LLM's suggestion
// verbatim. Mirrors the frontend pipeline: subject inference uses the
// coursera_subject_keywords table (the DB copy of src/data/subjectKeywords.json)
// and the read applies useCourseraCatalog's exact quality bar. Self-contained
// like the rest of this function — no imports from src/.

const COURSERA_MIN_RATING = 4.3;
const COURSERA_MIN_REVIEWS = 50;
const COURSERA_ROW_LIMIT = 120;
const COURSERA_COURSES_PER_SKILL = 2;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mutates `plan` in place; any failure leaves it exactly as generated.
async function enrichWithCourseraCourses(plan: Record<string, any>, supabase: SupabaseClient) {
  const { data: keywordRows, error: keywordError } = await supabase
    .from('coursera_subject_keywords')
    .select('subject, keyword');
  if (keywordError) throw keywordError;
  if (!keywordRows?.length) return;

  // Word-boundary containment, same as inferSubjects in learningSubjects.ts.
  const patternsBySubject = new Map<string, RegExp[]>();
  for (const row of keywordRows as { subject: string; keyword: string }[]) {
    if (!patternsBySubject.has(row.subject)) patternsBySubject.set(row.subject, []);
    patternsBySubject
      .get(row.subject)!
      .push(new RegExp(`(^|[^a-z0-9])${escapeRegExp(row.keyword)}([^a-z0-9]|$)`, 'i'));
  }
  const inferSubjects = (text: string) => {
    const out: string[] = [];
    for (const [subject, patterns] of patternsBySubject) {
      if (patterns.some((p) => p.test(text))) out.push(subject);
    }
    return out;
  };

  const subjectsBySkill = new Map();
  const allSubjects = new Set<string>();
  for (const timeframe of Object.values(plan)) {
    for (const skill of (timeframe as { skills?: { name?: string }[] }).skills ?? []) {
      if (!skill?.name || subjectsBySkill.has(skill.name)) continue;
      const subjects = inferSubjects(skill.name);
      subjectsBySkill.set(skill.name, subjects);
      for (const subject of subjects) allSubjects.add(subject);
    }
  }
  if (allSubjects.size === 0) return;

  const { data: courses, error: coursesError } = await supabase
    .from('coursera_courses')
    .select('url, title, partner, rating, reviews, subjects, primary_subjects')
    .eq('status', 'active')
    .overlaps('subjects', [...allSubjects])
    .gte('rating', COURSERA_MIN_RATING)
    .gte('reviews', COURSERA_MIN_REVIEWS)
    // English or unknown — empty means "not yet crawled", not "not English".
    .or('languages.cs.{en},languages.eq.{}')
    .order('rating', { ascending: false })
    .limit(COURSERA_ROW_LIMIT);
  if (coursesError) throw coursesError;
  if (!courses?.length) return;

  // Per-subject lists: primary-subject courses first; sort is stable, so the
  // rating order from the query is preserved within each group.
  const coursesBySubject = new Map<string, any[]>();
  for (const course of courses as any[]) {
    for (const subject of course.subjects ?? []) {
      if (!coursesBySubject.has(subject)) coursesBySubject.set(subject, []);
      coursesBySubject.get(subject)!.push(course);
    }
  }
  for (const [subject, list] of coursesBySubject) {
    list.sort(
      (a, b) =>
        Number((b.primary_subjects ?? []).includes(subject)) -
        Number((a.primary_subjects ?? []).includes(subject)),
    );
  }

  for (const timeframe of Object.values(plan)) {
    for (const skill of (timeframe as { skills?: { name?: string; courses?: unknown[] }[] }).skills ?? []) {
      const subjects = subjectsBySkill.get(skill?.name) ?? [];
      const seen = new Set();
      const picks: { title: string; provider: string; url: string }[] = [];
      for (const subject of subjects) {
        for (const course of coursesBySubject.get(subject) ?? []) {
          if (picks.length >= COURSERA_COURSES_PER_SKILL) break;
          if (seen.has(course.url)) continue;
          seen.add(course.url);
          picks.push({ title: course.title, provider: course.partner, url: course.url });
        }
        if (picks.length >= COURSERA_COURSES_PER_SKILL) break;
      }
      if (picks.length > 0) skill.courses = picks;
    }
  }
}

// Edge function handler
Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    // Identity comes from the JWT, never from the request body — previously any
    // caller could pass an arbitrary userId and generate/overwrite plans.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const authClient = createClient(supabaseUrl!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    const supabase = createClient(supabaseUrl!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userData = await getUserCareerData(supabase, userId);
    const rawPlan = await generateActionPlan(userData);
    const actionPlan = normalizeActionPlan(rawPlan);
    // Ground the invented course names in the real Coursera catalog. Never
    // fatal: a failed enrichment returns the plan exactly as generated.
    try {
      await enrichWithCourseraCourses(actionPlan, supabase);
    } catch (enrichError) {
      console.error('Coursera enrichment skipped:', enrichError);
    }
    console.log(`generate-career-action-plan: user=${userId} timeframes=${Object.keys(actionPlan).length}`);

    // Persist the plan onto the latest pathway session; a save failure is
    // reported honestly via the `saved` flag rather than claimed as success.
    let saved = false;
    let saveError: string | null = null;
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('career_pathway_results')
        .select('session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing session:', fetchError);
        throw fetchError;
      }
      if (existingRecord?.session_id) {
        const { error: updateError } = await supabase
          .from('career_pathway_results')
          .update({ action_plan: actionPlan, created_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('session_id', existingRecord.session_id);
        if (updateError) {
          console.error('Error saving action plan:', updateError);
          throw updateError;
        }
        saved = true;
      } else {
        saveError = 'No existing career_pathway_results session found to attach the plan to';
        console.warn(saveError);
      }
    } catch (e) {
      console.error('Exception saving action plan:', e);
      saveError = (e instanceof Error && e.message) || String(e);
    }

    return new Response(JSON.stringify({
      success: true,
      data: actionPlan,
      saved,
      ...(saveError ? { saveError } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
