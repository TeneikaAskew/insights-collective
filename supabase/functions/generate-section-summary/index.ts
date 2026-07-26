// ABOUTME: Generates a short student-facing section summary from a section
// ABOUTME: title and its lesson titles via the Lovable AI Gateway.

import { corsHeaders } from "../_shared/utils.ts";
import { requireStaff } from "../_shared/auth.ts";

const SYSTEM_PROMPT = `You write concise course section summaries for a learner-facing course page.

Return ONLY plain text (no markdown, no HTML, no bullets, no headings).
Write 1-2 sentences (max ~240 characters) that:
- Describe what the student will learn in this section.
- Reference the actual lessons (topics), not generic filler.
- Use a warm, direct, second-person voice ("You'll…").
No preamble, no quotes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req);
  if (auth.response) return auth.response;

  try {
    const { sectionTitle, lessonTitles, courseTitle } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!sectionTitle || typeof sectionTitle !== "string") {
      return new Response(JSON.stringify({ error: "sectionTitle is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lessons = Array.isArray(lessonTitles)
      ? lessonTitles.filter((t: unknown) => typeof t === "string" && t.trim()).slice(0, 30)
      : [];

    const userPrompt = [
      courseTitle ? `Course: ${courseTitle}` : null,
      `Section: ${sectionTitle}`,
      lessons.length ? `Lessons:\n- ${lessons.join("\n- ")}` : "Lessons: (none yet)",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!res.ok) {
      const detail = await res.text();
      console.error("Gateway error", res.status, detail);
      return new Response(JSON.stringify({ error: `AI Gateway ${res.status}`, detail }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    let summary: string = data?.choices?.[0]?.message?.content ?? "";
    summary = summary.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!summary) {
      return new Response(JSON.stringify({ error: "Model returned empty summary" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-section-summary error", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
