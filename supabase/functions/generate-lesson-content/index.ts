// ABOUTME: Generates HTML lesson content from lesson/course/section context via
// ABOUTME: the Lovable AI Gateway (Gemini 2.5 Flash). Returns { html: string }.

import { corsHeaders } from "../_shared/utils.ts";
import { requireStaff } from "../_shared/auth.ts";

const BASE_RULES = `You are an expert curriculum writer. Given a lesson title and its surrounding course context, write a complete, ready-to-publish lesson body as clean semantic HTML.

Rules:
- Return ONLY an HTML fragment (no <html>, <head>, <body>, no markdown fences, no commentary).
- Use <h2> for the intro heading, <h3> for sub-sections, <p> for prose, <ul>/<ol> for lists, <strong>/<em> for emphasis, <blockquote> for callouts, and <pre><code> for code samples where useful.
- Do NOT invent citations, URLs, statistics, or people. Do NOT use inline styles, scripts, or images.
- Stay tightly on-topic for the lesson title and its section — every paragraph must be recognisably about THIS lesson, not generic filler.
- If author notes or feedback are provided, follow them precisely; they override defaults.`;

const VARIANTS: Record<string, string> = {
  default:
    "Structure: brief intro, 3-5 substantive sections with sub-headings, a 'Key takeaways' bulleted list at the end. Target 400-700 words.",
  verbose:
    "Structure: rich intro, 5-7 substantive sections with sub-headings, worked examples where useful, and a 'Key takeaways' bulleted list. Target 900-1400 words. Go deeper with examples and nuance — do not pad with filler.",
  compact:
    "Structure: 1-sentence intro, 2-3 tight sub-headings, and a 'Key takeaways' bulleted list (3-5 bullets). Target 180-320 words. Prefer bullets over long paragraphs.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const {
      lessonTitle,
      courseTitle,
      courseDescription,
      sectionTitle,
      sectionSummary,
      siblingLessonTitles,
      lessonType,
      notes,
      feedback,
      previousHtml,
      variant,
    } = body ?? {};

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!lessonTitle || typeof lessonTitle !== "string") {
      return new Response(JSON.stringify({ error: "lessonTitle is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const chosenVariant = typeof variant === "string" && VARIANTS[variant] ? variant : "default";
    const systemPrompt = `${BASE_RULES}\n\n${VARIANTS[chosenVariant]}`;

    const siblings = Array.isArray(siblingLessonTitles)
      ? siblingLessonTitles.filter((t: unknown) => typeof t === "string" && t.trim()).slice(0, 20)
      : [];

    const contextLines = [
      courseTitle ? `Course: ${courseTitle}` : null,
      courseDescription ? `Course description: ${courseDescription}` : null,
      sectionTitle ? `Section: ${sectionTitle}` : null,
      sectionSummary ? `Section summary: ${sectionSummary}` : null,
      siblings.length ? `Other lessons in this section:\n- ${siblings.join("\n- ")}` : null,
      lessonType ? `Lesson type: ${lessonType}` : null,
      `Lesson title: ${lessonTitle}`,
      notes ? `Author notes:\n${notes}` : null,
      feedback ? `User revision feedback (apply to the new draft):\n${feedback}` : null,
      previousHtml
        ? `Previous draft (revise it — do not just repeat it):\n${String(previousHtml).slice(0, 6000)}`
        : null,
    ].filter(Boolean).join("\n\n");

    console.log("generate-lesson-content start", {
      lessonTitle,
      variant: chosenVariant,
      hasFeedback: Boolean(feedback),
      hasPrev: Boolean(previousHtml),
      siblings: siblings.length,
    });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextLines },
        ],
        temperature: chosenVariant === "compact" ? 0.5 : 0.7,
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
    html = html.trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!html) {
      return new Response(JSON.stringify({ error: "Model returned empty content" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("generate-lesson-content ok", { chars: html.length, variant: chosenVariant });

    return new Response(JSON.stringify({ html, variant: chosenVariant }), {
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
