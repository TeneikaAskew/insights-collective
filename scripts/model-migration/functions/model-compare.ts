// ABOUTME: Temporary migration harness — replays real production Code Practice
// ABOUTME: submissions through the decommissioned model and its candidates.
// Not part of the app. Delete after the model migration is approved.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const GROQ = Deno.env.get("GROQ_API_KEY") ?? Deno.env.get("GROQ");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Verbatim copies of review-code's prompt builders (must not drift) ----

function createJudgePrompt(challenge: any, code: string, language: string, cases: any[]): string {
  const caseList = cases
    .map((c, i) => `Test ${i + 1}: ${challenge.function_name}(${c.input})\nExpected (JSON): ${c.expected}`)
    .join("\n\n");

  return `You are a rigorous code judge. Trace the candidate's ${language} code against each test case by mentally executing it step by step. Do not assume the code works because it looks plausible — verify each case.

CHALLENGE: ${challenge.title}
${challenge.description ?? challenge.prompt}
${challenge.detail ?? ""}

CANDIDATE CODE:
\`\`\`${language}
${code}
\`\`\`

TEST CASES (the function under test is \`${challenge.function_name}\`):
${caseList}

RULES:
1. For each test case, predict the exact output of the code (as JSON) and compare with the expected value${challenge.compare_mode === "set" ? " (order does not matter for this challenge — compare as sets)" : ""}.
2. A case passes only if the predicted output matches the expected value.
3. If the code would raise an error, not compile, or is an empty/placeholder stub, every case fails.
4. verdict is "correct" only if ALL cases pass.
5. review: 2-4 sentences of specific, constructive code review referring to the actual code.
6. suggestions: exactly 3 actionable improvement suggestions.

Return ONLY this JSON object, no other text:
{
  "verdict": "correct" | "incorrect",
  "test_results": [
    { "case": 1, "predicted_output": "<JSON>", "passed": true | false, "note": "<one short sentence>" }
  ],
  "review": "<string>",
  "suggestions": ["<string>", "<string>", "<string>"]
}`;
}

function createReviewPrompt(challenge: any, code: string, language: string, results: any[]): string {
  const resultList = results
    .map((r, i) => `Test ${i + 1}: input (${r.input}) → expected ${r.expected}, got ${r.actual} — ${r.passed ? "PASSED" : "FAILED"}`)
    .join("\n");

  return `You are an expert code reviewer. The candidate's ${language} solution was already executed in a sandbox; do not re-judge correctness — the results below are ground truth.

CHALLENGE: ${challenge.title}
${challenge.description ?? challenge.prompt}

CANDIDATE CODE:
\`\`\`${language}
${code}
\`\`\`

EXECUTION RESULTS:
${resultList}

Return ONLY this JSON object, no other text:
{
  "review": "<2-4 sentences of specific code review: approach, complexity, style, referring to the actual code>",
  "suggestions": ["<string>", "<string>", "<string>"]
}`;
}

const SYSTEM = "You are a precise code evaluation engine. You mentally execute code line by line and never guess. You respond with valid JSON only.";

// review-code's exact parser, so "would this have worked in prod" is measured.
function safeParseJSON(content: string) {
  try {
    return { success: true, data: JSON.parse(content) };
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { return { success: true, data: JSON.parse(m[0]) }; } catch { /* fall through */ }
    }
    return { success: false, data: null };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(model: string, prompt: string, opts: any = {}) {
  const isReasoner = model.startsWith("openai/") || model.startsWith("qwen/");
  const body: any = {
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
  };
  // Reasoning models spend output budget on reasoning before emitting JSON.
  if (isReasoner) body.max_completion_tokens = opts.maxTokens ?? 6000;
  else body.max_tokens = opts.maxTokens ?? 2500;
  if (opts.reasoningEffort && model.startsWith("openai/")) body.reasoning_effort = opts.reasoningEffort;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ}` },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - t0;
    const text = await resp.text();

    if (resp.status === 429) {
      const wait = Number(resp.headers.get("retry-after") ?? "5");
      if (attempt < 2) { await sleep(Math.min(wait, 20) * 1000 + 500); continue; }
      return { model, ok: false, status: 429, latency_ms: latency, error: text.slice(0, 400) };
    }
    if (!resp.ok) {
      return { model, ok: false, status: resp.status, latency_ms: latency, error: text.slice(0, 600) };
    }

    const json = JSON.parse(text);
    const content = json.choices?.[0]?.message?.content ?? "";
    const reasoning = json.choices?.[0]?.message?.reasoning ?? null;
    const parsed = safeParseJSON(content);
    return {
      model,
      ok: true,
      status: 200,
      latency_ms: latency,
      usage: json.usage ?? null,
      finish_reason: json.choices?.[0]?.finish_reason ?? null,
      emitted_reasoning_field: reasoning !== null,
      // Did prod's parser survive the raw output? This is the migration risk.
      prod_parser_ok: parsed.success,
      raw_content: content,
      parsed: parsed.data,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Service-role only: this is an internal migration tool.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (token !== SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!GROQ) {
    return new Response(JSON.stringify({ error: "No GROQ key in function env" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const {
    mode = "review",
    limit = 2,
    models = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"],
    reasoningEffort = null,
    jsonMode = false,
    probeOnly = false,
    offset = 0,
  } = await req.json().catch(() => ({}));

  // Probe: is a model id still served at all?
  if (probeOnly) {
    const out = [];
    for (const m of models) {
      const r = await callModel(m, "Reply with {\"ok\":true} and nothing else.", { maxTokens: 200 });
      out.push({ model: m, alive: r.ok, status: r.status, error: r.ok ? null : r.error });
      await sleep(1200);
    }
    return new Response(JSON.stringify({ probe: out }, null, 2), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Real production submissions as the corpus.
  const { data: attempts, error } = await supabase
    .from("code_attempts")
    .select("id, challenge_id, code, language, passed_tests, ai_review, created_at")
    .not("ai_review->review", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const results = [];
  for (const a of attempts ?? []) {
    const { data: challenge } = await supabase
      .from("code_challenges").select("*").eq("id", a.challenge_id).single();
    if (!challenge) continue;

    const execution = (a.ai_review as any)?.execution;
    const cases = Array.isArray(challenge.test_cases) ? challenge.test_cases : [];

    const prompt = mode === "judge"
      ? createJudgePrompt(challenge, a.code, a.language, cases)
      : createReviewPrompt(challenge, a.code, a.language, execution?.results ?? []);

    const perModel = [];
    for (const m of models) {
      perModel.push(await callModel(m, prompt, { reasoningEffort, jsonMode }));
      await sleep(2500); // stay under free-tier TPM
    }

    results.push({
      attempt_id: a.id,
      created_at: a.created_at,
      challenge: challenge.title,
      language: a.language,
      mode,
      code_excerpt: (a.code ?? "").slice(0, 400),
      ground_truth_passed: a.passed_tests,
      // What llama-3.3-70b-versatile actually returned in production:
      production_baseline: (a.ai_review as any)?.review ?? null,
      candidates: perModel,
    });
  }

  return new Response(JSON.stringify({ mode, count: results.length, results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
