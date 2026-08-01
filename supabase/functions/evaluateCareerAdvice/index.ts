import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// The prompt is owned by the server. The client sends only the user's answers
// (keyed by question id) and optional resume text — never instructions.
const QUESTION_LABELS: Record<string, string> = {
  q1: 'Interest in Career Pathway',
  q2: 'Ideal Next Job',
  q3: 'Future Vision',
  q4: 'Desired Role',
  q5: 'Seniority Level',
  q6: 'Career Pivot',
  q7: 'Strengths',
  q8: 'Weaknesses',
  q9: 'Career Obstacles',
  q10: 'Past Role Insights',
  q11: 'Self-Reflection',
  q12: 'Top Career Priorities',
  q13: 'Work Engagement',
};

/**
 * The curated roles this report is allowed to recommend.
 *
 * The model used to emit a free-text `salaryRange` per role. That figure was
 * unsourced, varied between generations for the same role, and — because the
 * roles carried no identifier — could not be joined to the BLS figures in
 * `career_role_wages` even to check it. The model now picks from this catalog
 * by slug and emits no pay at all; salary is resolved at render time from the
 * occupation the slug maps to.
 *
 * Throws rather than falling back to an unconstrained prompt. An empty catalog
 * means the reference migration has not been applied, and the useful outcome is
 * a visible error, not a report full of invented salaries again.
 */
async function loadRoleCatalog(): Promise<{ slug: string; title: string }[]> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !key) throw new Error('Supabase environment is not configured');

  const { data, error } = await createClient(url, key)
    .from('career_roles')
    .select('slug, title')
    .eq('source', 'curated')
    .order('title');

  if (error) throw error;
  if (!data?.length) {
    throw new Error('career_roles is empty — the BLS reference migration has not been applied');
  }
  return data as { slug: string; title: string }[];
}

const buildSystemPrompt = (catalog: { slug: string; title: string }[]) =>
  `You are a professional career advisor and industry expert in technology. Based on the user's responses and resume, generate a comprehensive career pathway report as a single valid JSON object with exactly this structure:

{
  "summary": "string",
  "recommendedRoles": [
    { "roleSlug": "string", "description": "string" }
  ],
  "skillsAndCourses": [
    { "skill": "string", "course": "string", "provider": "string", "level": "beginner|intermediate|advanced" }
  ],
  "nextStepRecommendations": "string",
  "potentialRoles": [
    { "title": "string", "description": "string" }
  ],
  "careerPathSteps": [
    { "step": "string", "action": "string", "timeline": "string" }
  ],
  "futureCareerPath": [
    { "step": "string", "action": "string", "timeline": "string", "focusAreas": "string" }
  ],
  "keyTakeaways": ["string"]
}

Rules:
- Return ONLY the JSON object — no markdown, no commentary.
- Fill each section with personalized, actionable, specific content grounded in the user's answers and resume.
- Minimums: 3 recommendedRoles, 4 skillsAndCourses, 3 potentialRoles, 3 careerPathSteps, 3 futureCareerPath steps, 3 keyTakeaways.
- Do NOT output salary figures, pay ranges, or compensation anywhere in the report. Pay comes from the U.S. Bureau of Labor Statistics and is attached to each role by its slug after you respond.
- Every recommendedRoles entry MUST use a "roleSlug" copied verbatim from the list below. Do not invent a slug, do not reword one, and do not recommend a role that is not listed:
${catalog.map((r) => `  - ${r.slug} (${r.title})`).join('\n')}`;

function parseModelJson(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    // Single fallback: strip markdown code fences, then strict-parse.
    const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid user JWT before spending any LLM credits.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    // `pathwayAnswers` is the key the previous client sent — accepted during
    // rollover so the currently-deployed frontend keeps working. Its old
    // `prompt` field is intentionally ignored: the prompt is server-owned now.
    const answers = body?.answers ?? body?.pathwayAnswers;
    const resumeText = typeof body?.resumeText === 'string' ? body.resumeText : '';

    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required field: answers' }), { status: 400, headers: corsHeaders });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI provider not configured' }), { status: 500, headers: corsHeaders });
    }

    // Build the user context from known question ids only.
    let userContext = "User's Career Pathway Responses:\n\n";
    for (const [id, label] of Object.entries(QUESTION_LABELS)) {
      const answer = answers[id];
      if (typeof answer === 'string' && answer.trim()) {
        userContext += `${label}: ${answer.trim()}\n`;
      }
    }
    if (resumeText.trim()) {
      userContext += `\nUser's Resume:\n${resumeText.trim()}\n`;
    }

    // Log shape, never content — answers and resumes are PII.
    console.log(`evaluateCareerAdvice: user=${user.id} answers=${Object.keys(answers).length} resumeChars=${resumeText.length}`);

    // Loaded before the LLM call so a missing catalog costs nothing.
    const roleCatalog = await loadRoleCatalog();

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: buildSystemPrompt(roleCatalog) },
          { role: 'user', content: userContext },
        ],
        temperature: 0.7,
        max_tokens: 5000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText.slice(0, 300));
      return new Response(JSON.stringify({ error: 'Failed to generate career advice' }), { status: 502, headers: corsHeaders });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('AI gateway returned no content');
      return new Response(JSON.stringify({ error: 'AI returned no content' }), { status: 502, headers: corsHeaders });
    }

    const report = parseModelJson(content);
    if (!report) {
      console.error('Invalid JSON from LLM (first 300 chars):', content.slice(0, 300));
      return new Response(JSON.stringify({ error: 'Invalid JSON from LLM' }), { status: 502, headers: corsHeaders });
    }

    // Telling the model to use a slug from the catalog is not the same as it
    // doing so. A slug that is not in `career_roles` joins to nothing, so the
    // role would render with no title and no pay — drop those rather than ship
    // a blank row, and fail loudly if none survive.
    const validSlugs = new Set(roleCatalog.map((r) => r.slug));
    const recommended = Array.isArray((report as Record<string, unknown>).recommendedRoles)
      ? ((report as Record<string, unknown>).recommendedRoles as { roleSlug?: string }[])
      : [];
    const kept = recommended.filter((r) => r.roleSlug && validSlugs.has(r.roleSlug));

    if (recommended.length !== kept.length) {
      console.warn(
        'Dropped recommendedRoles with unknown slugs:',
        recommended.filter((r) => !r.roleSlug || !validSlugs.has(r.roleSlug)).map((r) => r.roleSlug),
      );
    }
    if (!kept.length) {
      console.error('No recommendedRoles matched the catalog; slugs seen:', recommended.map((r) => r.roleSlug));
      return new Response(
        JSON.stringify({ error: 'AI recommended no roles from the catalog' }),
        { status: 502, headers: corsHeaders },
      );
    }
    (report as Record<string, unknown>).recommendedRoles = kept;

    return new Response(JSON.stringify(report), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error(`Error in evaluateCareerAdvice: ${error instanceof Error ? error.message : error}`);
    return new Response(JSON.stringify({ error: 'Server error processing request' }), { status: 500, headers: corsHeaders });
  }
});
