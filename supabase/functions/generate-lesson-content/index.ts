// ABOUTME: Generates HTML lesson content for a given lesson title/context using
// ABOUTME: the Lovable AI Gateway (Gemini 2.5 Flash). Returns { html: string }.

import { corsHeaders } from "../_shared/utils.ts";

const SYSTEM_PROMPT = `You are an expert curriculum writer. Given a lesson title (and optional course/section context), write a complete, ready-to-publish lesson body as clean semantic HTML.

Rules:
- Return ONLY HTML fragment (no <html>, <head>, <body>, no markdown fences, no commentary).
- Use <h2> for the intro heading, <h3> for sub-sections, <p> for prose, <ul>/<ol> for lists, <strong>/<em> for emphasis, <blockquote> for callouts, and <pre><code> for code samples where useful.
- Structure: brief intro, 3-6 substantive sections with sub-headings, a "Key takeaways" bulleted list at the end.
- 400-900 words. Concrete, specific, non-generic. Do not invent citations or URLs.
- No inline styles, no scripts, no images.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lessonTitle, courseTitle, sectionTitle, notes } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!lessonTitle || typeof lessonTitle !== "string") {
      return new Response(
        JSON.stringify({ error: "lessonTitle is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = [
      `Lesson title: ${lessonTitle}`,
      courseTitle ? `Course: ${courseTitle}` : null,
      sectionTitle ? `Section: ${sectionTitle}` : null,
      notes ? `Author notes:\n${notes}` : null,
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
        temperature: 0.7,
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
      const errText = await res.text();
      console.error("Gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: `AI Gateway ${res.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    let html: string = data?.choices?.[0]?.message?.content ?? "";

    // Strip accidental markdown fences if the model wrapped output.
    html = html.trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!html) {
      return new Response(JSON.stringify({ error: "Model returned empty content" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-lesson-content error", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
