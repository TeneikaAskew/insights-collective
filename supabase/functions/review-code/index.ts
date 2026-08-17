// ABOUTME: Edge function that evaluates Code Practice submissions with AI.
// ABOUTME: Judge mode traces the code against the challenge's stored test
// cases (Phase 1 of docs/architecture/code-evaluation.md); when the caller
// provides real execution results (Phase 2+), it reviews instead of judging.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError, safeParseJSON } from "../_shared/utils.ts";

const GROQ = Deno.env.get("GROQ");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Strong tracing matters for judge mode. Replaces llama-3.3-70b-versatile,
// decommissioned 2026-08-16. On six submissions with known-correct verdicts
// this model graded 6/6 where the 70b graded 4/6 - the 70b passed a log
// parser using `>=` where it needed `>`, and failed a correct solution for
// returning results in a different order on a challenge whose compare_mode
// is "set". Costs ~2.3s per grade against the 70b's ~0.9s; if that is ever
// too slow, reach for reasoning_effort: "low" before a smaller model.
const MODEL = "openai/gpt-oss-120b";

// Simple per-user rate limit: max submissions per minute, counted from code_attempts.
const MAX_SUBMISSIONS_PER_MINUTE = 10;

interface TestCase {
  input: string;
  expected: string;
  hidden?: boolean;
}

interface ExecutionResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

function createJudgePrompt(challenge: any, code: string, language: string, cases: TestCase[]): string {
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

function createReviewPrompt(challenge: any, code: string, language: string, results: ExecutionResult[]): string {
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

// Groq's per-minute token budget is the binding limit here, not the request
// count. This model spends ~4x the tokens the old 70b did, and the submission
// limit above allows 10 grades a minute, so a working student can outrun the
// budget. A 429 is "try again in a moment", not a failure worth surfacing.
const RATE_LIMIT_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGroq(prompt: string): Promise<any> {
  let response!: Response;

  for (let attempt = 0; ; attempt++) {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a precise code evaluation engine. You mentally execute code line by line and never guess. You respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        // Peak observed on the known-verdict suite was 1,419 completion tokens
        // against the 70b's 346: this model reasons before it answers. A
        // truncated response is an unparseable verdict, so keep real headroom.
        max_tokens: 4000,
      }),
    });

    if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) break;

    // Honour the server's own backoff when it gives one, but stay well inside
    // the request the browser is waiting on.
    const retryAfter = Number(response.headers.get("retry-after") ?? "2");
    const waitMs = Math.min(Number.isFinite(retryAfter) ? retryAfter : 2, 8) * 1000;
    console.warn(`[review-code] rate limited, retrying in ${waitMs}ms`);
    await sleep(waitMs);
  }

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[review-code] AI API error ${response.status}:`, errorData);
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  const parsed = safeParseJSON(content);
  if (!parsed.success || !parsed.data) {
    console.error(`[review-code] Failed to parse AI response:`, content);
    throw new Error("Failed to parse AI response");
  }
  return parsed.data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Authenticate: user id always comes from the JWT, never the body.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { challengeId, code, language, attemptId } = await req.json();
    if (!challengeId || !code || !language) {
      return new Response(JSON.stringify({ error: "challengeId, code, and language are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the challenge and its test cases server-side (hidden cases never
    // transit through the client).
    const { data: challenge, error: challengeError } = await supabase
      .from("code_challenges")
      .select("*")
      .eq("id", challengeId)
      .single();
    if (challengeError || !challenge) {
      return new Response(JSON.stringify({ error: "Challenge not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cases: TestCase[] = Array.isArray(challenge.test_cases) ? challenge.test_cases : [];
    const startedAt = Date.now();

    let payload: Record<string, unknown>;
    if (attemptId) {
      // Review mode: the verdict comes from the execution record execute-code
      // stored on the attempt — never from anything the client sends. The
      // attempt must belong to the caller and to this challenge.
      const { data: attempt, error: attemptLookupError } = await supabase
        .from("code_attempts")
        .select("id, challenge_id, code, language, passed_tests, ai_review")
        .eq("id", attemptId)
        .eq("user_id", userId)
        .single();
      const execution = attempt?.ai_review?.execution;
      if (attemptLookupError || !attempt || attempt.challenge_id !== challengeId || !execution) {
        return new Response(
          JSON.stringify({ error: "Attempt not found or has no execution record" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Idempotent: a review already attached to this attempt is returned as-is.
      if (attempt.ai_review?.review) {
        return new Response(JSON.stringify({ ...attempt.ai_review.review, attemptId: attempt.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Review the code that was actually executed (stored server-side).
      const ai = await callGroq(
        createReviewPrompt(challenge, attempt.code, attempt.language, execution.results as ExecutionResult[]),
      );
      payload = {
        evaluationMode: "executed",
        correct: attempt.passed_tests === true,
        testsPassed: execution.testsPassed,
        testsTotal: execution.testsTotal,
        review: ai.review,
        suggestions: ai.suggestions ?? [],
      };
    } else {
      // Judge mode is the submission itself, so it carries the rate limit.
      // (Review mode piggybacks on an execution that was already limited.)
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("code_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneMinuteAgo);
      if ((count ?? 0) >= MAX_SUBMISSIONS_PER_MINUTE) {
        return new Response(
          JSON.stringify({ error: "Too many submissions — wait a minute and try again" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Judge mode: the model traces the code against the stored cases.
      if (cases.length === 0) {
        return new Response(JSON.stringify({ error: "Challenge has no test cases" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ai = await callGroq(createJudgePrompt(challenge, code, language, cases));
      const results = Array.isArray(ai.test_results) ? ai.test_results : [];
      const passedCount = results.filter((r: any) => r.passed).length;
      const correct = ai.verdict === "correct" && passedCount === cases.length;
      payload = {
        evaluationMode: "ai-judged",
        correct,
        testsPassed: passedCount,
        testsTotal: cases.length,
        // Only surface details for non-hidden cases
        testResults: results
          .map((r: any, i: number) => ({ ...r, hidden: cases[i]?.hidden ?? false, input: cases[i]?.input }))
          .filter((r: any) => !r.hidden)
          .map(({ hidden: _hidden, ...rest }: any) => rest),
        review: ai.review,
        suggestions: ai.suggestions ?? [],
      };
    }

    // Persist: in review mode execute-code already created the attempt row —
    // attach the review to it (next to its execution record) instead of
    // inserting a duplicate.
    if (attemptId) {
      const { data: current } = await supabase
        .from("code_attempts")
        .select("ai_review")
        .eq("id", attemptId)
        .eq("user_id", userId)
        .single();
      const { error: updateError } = await supabase
        .from("code_attempts")
        .update({ ai_review: { ...(current?.ai_review ?? {}), review: payload } })
        .eq("id", attemptId)
        .eq("user_id", userId);
      if (updateError) {
        console.error(`[review-code] Failed to attach review to attempt:`, updateError);
      } else {
        payload.attemptId = attemptId;
      }
    } else {
      const { data: attempt, error: attemptError } = await supabase
        .from("code_attempts")
        .insert({
          user_id: userId,
          challenge_id: challengeId,
          code,
          language,
          passed_tests: payload.correct as boolean,
          ai_review: payload,
          duration: Date.now() - startedAt,
        })
        .select("id")
        .single();
      if (attemptError) {
        // The evaluation still succeeded — log, don't fail the request.
        console.error(`[review-code] Failed to persist attempt:`, attemptError);
      } else {
        payload.attemptId = attempt.id;
      }
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    handleError(error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to evaluate code" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
