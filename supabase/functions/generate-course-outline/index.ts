// ABOUTME: Generates a structured course outline (sections + lessons) from a
// ABOUTME: freeform description using the Lovable AI Gateway (Gemini 2.5 Flash).

import { corsHeaders } from "../_shared/utils.ts";

interface OutlineLesson {
  title: string;
  type: "page" | "assignment" | "quiz" | "external_url";
}
interface OutlineSection {
  title: string;
  lessons: OutlineLesson[];
}
interface OutlineResponse {
  summary: string;
  sections: OutlineSection[];
}

const SYSTEM_PROMPT = `You are a curriculum designer. Given a short description of a course, produce a concrete outline as JSON with this exact shape:
{
  "summary": "one-sentence pitch of the course",
  "sections": [
    { "title": "Section title", "lessons": [ { "title": "Lesson title", "type": "page" } ] }
  ]
}
Rules:
- 3 to 6 sections, each with 3 to 5 lessons.
- Lesson "type" is one of: "page", "assignment", "quiz", "external_url". Default to "page". Include at least one "quiz" and one "assignment" spread across the course.
- Titles are concise, action-oriented, and specific to the topic.
- Return ONLY the JSON. No markdown, no commentary.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      // BEHAVIOR CHANGE (silent-failure audit): error paths in this function
      // returned HTTP 200, hiding failures from anything that only checks the
      // status. Errors now use honest non-2xx statuses (the client checks both
      // invoke `error` and `data.error`, so it handles either shape).
      return new Response(
        JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = `Course title: ${title || "(untitled)"}\n\nDescription:\n${description || ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gateway error", res.status, errText);
      return new Response(
        JSON.stringify({ error: `AI Gateway ${res.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed: OutlineResponse | null = null;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      // Try to extract JSON body if the model wrapped it
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed || !Array.isArray(parsed.sections)) {
      return new Response(
        JSON.stringify({ error: "Model returned no outline", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize / defensively coerce lesson types
    const ALLOWED = new Set(["page", "assignment", "quiz", "external_url"]);
    parsed.sections = parsed.sections.slice(0, 8).map((s) => ({
      title: String(s.title || "Untitled section").slice(0, 120),
      lessons: (Array.isArray(s.lessons) ? s.lessons : []).slice(0, 8).map((l) => ({
        title: String(l.title || "Untitled lesson").slice(0, 160),
        type: (ALLOWED.has(String(l.type)) ? l.type : "page") as OutlineLesson["type"],
      })),
    }));

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-course-outline error", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
