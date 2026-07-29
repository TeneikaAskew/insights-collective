// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// `corsHeaders` was referenced on all eight response paths but never defined or
// imported, so every return threw ReferenceError before it could send.
import { corsHeaders } from "../_shared/utils.ts";

/**
 * The curated roles this report is allowed to recommend.
 *
 * The model used to emit a free-text `salaryRange` per role, which was
 * unsourced and — because the roles carried no identifier — impossible to join
 * to the BLS figures in `career_role_wages`. It now picks from this catalog by
 * slug, and salary is looked up at render time from the occupation each slug
 * maps to.
 */
async function loadRoleCatalog(): Promise<{ slug: string; title: string }[]> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !key) throw new Error("Supabase environment is not configured");

  const { data, error } = await createClient(url, key)
    .from("career_roles")
    .select("slug, title")
    .eq("source", "curated")
    .order("title");

  if (error) throw error;
  if (!data?.length) {
    throw new Error("career_roles is empty — the BLS reference migration has not been applied");
  }
  return data as { slug: string; title: string }[];
}

// Simple token estimation without external dependency
function countTokens(text: string): number {
  // Approximate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Career advice function called");
    
    const body = await req.json();
    const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = body;

    console.log("Prompt:", prompt);
    console.log("Pathway questions:", pathwayQuestions);
    console.log("Pathway answers:", pathwayAnswers);
    console.log("Resume text:", resumeText);

    // Validate required fields
    if (!prompt || !pathwayQuestions || !pathwayAnswers) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: prompt, pathwayQuestions, or pathwayAnswers" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Build context from user answers
    let userContext = "User's Career Pathway Responses:\n\n";
    pathwayQuestions.forEach((question: any) => {
      const answer = pathwayAnswers[question.id];
      if (answer) {
        userContext += `${question.label}: ${answer}\n`;
      }
    });

    if (resumeText) {
      userContext += `\nUser's Resume:\n${resumeText}\n`;
    }

    console.log("User context:", userContext);

    const roleCatalog = await loadRoleCatalog();
    const validSlugs = new Set(roleCatalog.map((r) => r.slug));

    // New system prompt for structured JSON output
    const systemPrompt = `You are a professional career advisor and industry expert in technology. Based on the user's responses and resume, generate a comprehensive career pathway report as a valid JSON object with the following structure:\n\n{
  \"summary\": \"string\",
  \"recommendedRoles\": [
    {
      \"roleSlug\": \"string\",
      \"description\": \"string\"
    }
  ],
  \"skillsAndCourses\": [
    {
      \"skill\": \"string\",
      \"course\": \"string\",
      \"provider\": \"string\",
      \"level\": \"string\"
    }
  ],
  \"nextStepRecommendations\": \"string\",
  \"potentialRoles\": [
    {
      \"title\": \"string\",
      \"description\": \"string\"
    }
  ],
  \"careerPathSteps\": [
    {
      \"step\": \"string\",
      \"action\": \"string\",
      \"timeline\": \"string\"
    }
  ],
  
  \"futureCareerPath\": [
    {
      \"step\": \"string\",
      \"action\": \"string\",
      \"timeline\": \"string\",
      \"focusAreas\": \"string\"
    }
  ],
  \"keyTakeaways\": [
    \"string\"
  ]
}\n\nDo not include any markdown or commentary, only return valid JSON. Fill in each section with personalized, actionable, and specific content based on the user's answers and resume.
\n\nProvide a minimum of 3 future career steps. Provide a minimum of 4 skills and courses. Provide a minimum of 3 recommended roles. Provide a minimumn of 3 recommended roles. 
\n\nProvide a minimum of 3 key takeaways. Provide a minimum of 3 career path steps.

Every entry in recommendedRoles MUST use a "roleSlug" taken verbatim from this list. Do not invent a slug, do not modify one, and do not output a role that is not on the list:
${roleCatalog.map((r) => `- ${r.slug} (${r.title})`).join("\n")}

Do not output salary figures anywhere in the report. Pay is sourced separately from the U.S. Bureau of Labor Statistics and attached to each role by its slug.`;

    // Prepare chat messages for Together.ai
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContext }
    ];
    console.log("Messages:", messages);
    console.log("Making request to Together.ai API");

    const n = countTokens(systemPrompt + userContext);
    console.log(`Prompt uses ${n} tokens`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        temperature: 0.7,
        max_tokens: 5000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Together.ai API error:', errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate career advice" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();
    console.log("Response from Together.ai API:", data);

    let report;
    try {
      report = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      // A report that is not valid JSON cannot be rendered or stored. Fail
      // loudly rather than persisting a `{ error, raw }` object into
      // career_pathway_results, where every consumer then has to guard for it.
      console.error("LLM returned unparseable JSON:", data.choices?.[0]?.message?.content);
      return new Response(
        JSON.stringify({ error: "Career report was not valid JSON" }),
        { status: 502, headers: corsHeaders }
      );
    }

    // Any role we cannot join to career_role_wages would render without pay
    // while its neighbours show it. Reject the whole report instead.
    const badSlugs = (report.recommendedRoles ?? [])
      .map((r: { roleSlug?: string }) => r?.roleSlug)
      .filter((slug: string | undefined) => !slug || !validSlugs.has(slug));

    if (badSlugs.length) {
      console.error("LLM returned unknown role slugs:", badSlugs);
      return new Response(
        JSON.stringify({
          error: "Career report referenced roles outside the catalog",
          unknownSlugs: badSlugs,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    console.log("Generated structured career advice successfully: ", report);
    return new Response(
      JSON.stringify(report),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error in evaluateCareerAdvice function: ${message}`);
    return new Response(
      JSON.stringify({ error: "Server error processing request" }),
      { status: 500, headers: corsHeaders }
    );
  }
});