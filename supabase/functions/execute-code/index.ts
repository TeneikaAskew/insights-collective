// ABOUTME: Edge function that really executes Code Practice submissions in a
// ABOUTME: sandbox (Phase 2 of docs/architecture/code-evaluation.md).
// Routing: Judge0 CE (via RapidAPI) runs javascript / python-stdlib
// challenges and Judge0 Extra CE's "Python for ML" runtime runs the pandas
// ones — one RAPIDAPI_KEY covers both. The public Piston API is no longer
// freely available; set PISTON_URL to a self-hosted Piston instance to use
// it instead of Judge0 CE for the non-pandas challenges.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
const PISTON_URL = Deno.env.get("PISTON_URL"); // optional self-hosted Piston, e.g. https://piston.internal/api/v2/piston/execute

const JUDGE0_CE_URL = "https://judge0-ce.p.rapidapi.com";
const JUDGE0_EXTRA_URL = "https://judge0-extra-ce.p.rapidapi.com";
const JUDGE0_CE_PYTHON = 71; // Python (3.8.1)
const JUDGE0_CE_JAVASCRIPT = 63; // JavaScript (Node.js 12.14.0)
const JUDGE0_PYTHON_ML = 10; // Extra CE "Python for ML (3.7.7)" — includes pandas/numpy/scikit-learn

const MAX_SUBMISSIONS_PER_MINUTE = 10;

interface TestCase {
  input: string;
  expected: string;
  hidden?: boolean;
}

// One program runs ALL cases: cheaper, and a single sandbox round-trip.
// Each case prints exactly one JSON line (or __ERROR__: message).
function buildPythonHarness(challenge: any, code: string, cases: TestCase[]): string {
  const needsPandas = challenge.runtime === "python-ml";
  const prelude = needsPandas
    ? "import json, math\nimport pandas as pd\nimport numpy as np\n"
    : "import json, math\n";
  const caseLines = cases
    .map(
      (c) => `
try:
    __result = ${challenge.function_name}(${c.input})
    if 'DataFrame' in type(__result).__name__:
        __result = __result.to_dict(orient='records')
    ${challenge.compare_mode === "set" ? "__result = sorted(__result) if isinstance(__result, list) else __result" : ""}
    print(json.dumps(__result))
except Exception as __e:
    print("__ERROR__:" + str(__e))`,
    )
    .join("\n");
  return `${prelude}\n${code}\n${caseLines}\n`;
}

function buildJavascriptHarness(challenge: any, code: string, cases: TestCase[]): string {
  const caseLines = cases
    .map(
      (c) => `
try {
  let __result = ${challenge.function_name}(${c.input});
  ${challenge.compare_mode === "set" ? "if (Array.isArray(__result)) __result = [...__result].sort();" : ""}
  console.log(JSON.stringify(__result === undefined ? null : __result));
} catch (__e) {
  console.log("__ERROR__:" + __e.message);
}`,
    )
    .join("\n");
  return `${code}\n${caseLines}\n`;
}

async function runOnPiston(language: string, source: string): Promise<{ stdout: string; stderr: string; timeMs?: number; memoryKb?: number }> {
  const response = await fetch(PISTON_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: language === "javascript" ? "javascript" : "python",
      version: "*",
      files: [{ content: source }],
      run_timeout: 10_000,
    }),
  });
  if (!response.ok) {
    throw new Error(`Piston error: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return {
    stdout: data.run?.stdout ?? "",
    stderr: data.run?.stderr ?? "",
    timeMs: data.run?.wall_time ?? undefined,
    memoryKb: data.run?.memory ? Math.round(data.run.memory / 1024) : undefined,
  };
}

async function runOnJudge0(source: string, host: string, languageId: number): Promise<{ stdout: string; stderr: string; timeMs?: number; memoryKb?: number }> {
  if (!RAPIDAPI_KEY) {
    throw new Error("RAPIDAPI_KEY is not configured — real execution needs a Judge0 subscription (or set PISTON_URL to a self-hosted Piston)");
  }
  const response = await fetch(`${host}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": host.replace("https://", ""),
    },
    body: JSON.stringify({ source_code: source, language_id: languageId }),
  });
  if (!response.ok) {
    throw new Error(`Judge0 error: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return {
    stdout: data.stdout ?? "",
    stderr: data.stderr ?? data.compile_output ?? "",
    timeMs: data.time ? Math.round(parseFloat(data.time) * 1000) : undefined,
    memoryKb: data.memory ?? undefined,
  };
}

// python-ml → Judge0 Extra CE (pandas). Everything else → self-hosted Piston
// when configured, otherwise Judge0 CE.
function runInSandbox(challenge: any, source: string) {
  if (challenge.runtime === "python-ml") {
    return runOnJudge0(source, JUDGE0_EXTRA_URL, JUDGE0_PYTHON_ML);
  }
  if (PISTON_URL) {
    return runOnPiston(challenge.language, source);
  }
  return runOnJudge0(
    source,
    JUDGE0_CE_URL,
    challenge.language === "javascript" ? JUDGE0_CE_JAVASCRIPT : JUDGE0_CE_PYTHON,
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareOutputs(actualLine: string, expected: string, compareMode: string): { passed: boolean; actual: string } {
  if (actualLine.startsWith("__ERROR__:")) {
    return { passed: false, actual: actualLine.replace("__ERROR__:", "Error: ") };
  }
  try {
    let actualValue = JSON.parse(actualLine);
    let expectedValue = JSON.parse(expected);
    if (compareMode === "set") {
      if (Array.isArray(actualValue)) actualValue = [...actualValue].sort();
      if (Array.isArray(expectedValue)) expectedValue = [...expectedValue].sort();
    }
    return { passed: deepEqual(actualValue, expectedValue), actual: actualLine };
  } catch {
    return { passed: actualLine.trim() === expected.trim(), actual: actualLine };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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

    const { challengeId, code, language } = await req.json();
    if (!challengeId || !code || !language) {
      return new Response(JSON.stringify({ error: "challengeId, code, and language are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    if (cases.length === 0) {
      return new Response(JSON.stringify({ error: "Challenge has no test cases" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const source =
      challenge.language === "javascript"
        ? buildJavascriptHarness(challenge, code, cases)
        : buildPythonHarness(challenge, code, cases);

    const startedAt = Date.now();
    const run = await runInSandbox(challenge, source);

    const lines = run.stdout.split("\n").filter((l: string) => l.trim() !== "");
    const results = cases.map((c, i) => {
      const line = lines[i] ?? (run.stderr ? `__ERROR__:${run.stderr.split("\n")[0]}` : "__ERROR__:no output");
      const { passed, actual } = compareOutputs(line, c.expected, challenge.compare_mode ?? "exact");
      return {
        input: c.hidden ? "(hidden)" : c.input,
        expected: c.hidden ? "(hidden)" : c.expected,
        actual: c.hidden && passed ? "(hidden)" : actual,
        passed,
        hidden: c.hidden ?? false,
      };
    });
    const allTestsPassed = results.every((r) => r.passed);

    const { data: attempt, error: attemptError } = await supabase
      .from("code_attempts")
      .insert({
        user_id: userId,
        challenge_id: challengeId,
        code,
        language,
        passed_tests: allTestsPassed,
        duration: Date.now() - startedAt,
      })
      .select("id")
      .single();
    if (attemptError) {
      console.error(`[execute-code] Failed to persist attempt:`, attemptError);
    }

    return new Response(
      JSON.stringify({
        evaluationMode: "executed",
        allTestsPassed,
        testsPassed: results.filter((r) => r.passed).length,
        testsTotal: results.length,
        results,
        runtimeMs: run.timeMs ?? null,
        memoryKb: run.memoryKb ?? null,
        attemptId: attempt?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    handleError(error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to execute code" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
