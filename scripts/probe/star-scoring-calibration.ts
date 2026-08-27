// ABOUTME: Proves the STAR scorer can tell answer quality levels apart, by
// ABOUTME: running a graded five-level answer ladder through the REAL evaluation
// ABOUTME: prompt, schema and model settings — not copies of them.
//
// Run:  GROQ_API_KEY=... deno run --allow-env --allow-net scripts/probe/star-scoring-calibration.ts
//  or:  npx tsx scripts/probe/star-scoring-calibration.ts
// Env:  TRIALS=n  scores each rung n times (default 1; use 3 when tuning the prompt)
//
// WHY THIS IS COMMITTED RATHER THAN REMEMBERED
//
// The scorer failed silently for months in a way no schema can catch: every
// value it returned was a legal integer 1-5, and almost every answer got a 2.
// A four-word non-answer ("At my job." / "They needed data stuff." / "I ran
// some code." / "It went well.") scored 2 across the board because the model
// read the old "1 - missing or unusable" anchor literally — words were present,
// so nothing was ever "missing" — while a merely-quantified answer and a
// genuinely excellent one both scored straight 5s. The visible symptom was a
// user reporting that no answer, however bad, ever earned a 1 (screenshots,
// 2026-08-26). groq-json-schema.ts proves the *shape* holds; this probe is the
// missing other half, proving the *judgment* holds. Rerun it whenever the
// prompt anchors, the model, or the temperature change.
//
// Deliberately not in CI: it spends live quota, and under the free tier's
// 8,000-tokens-per-minute budget a full ladder takes several minutes of 429
// backoff. Expect that; the retries are silent and normal.
//
// THE LADDER
//
// Six answers to one real behavioural question, written to trip one band each:
// a content-free non-answer (1), interchangeable filler (2), concrete but
// unquantified (3), quantified with clear ownership (4), and quantified plus
// judgment — validation, stakeholder handling, durable impact (5). MIXED pairs
// a non-answer Situation/Task with a strength-level Action/Result to prove
// components are scored on their own text rather than on the story's halo.
//
// The L1 fragments here deliberately do NOT reuse the examples quoted inside
// the prompt's own anchors ("At my job", "I ran some code", "It went well"), so
// a pass proves the content-free rule generalizes instead of string-matching.

import { createStandardEvaluationPrompt } from "../../supabase/functions/evaluate-star-response/prompts.ts";
import { responseFormat, starEvaluationSchema } from "../../supabase/functions/evaluate-star-response/schema.ts";
import { normalizeScores, type StarScores } from "../../supabase/functions/evaluate-star-response/scoring.ts";

const MODEL = "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Runs under Deno (like the edge function) and under Node via tsx (like this
// repo's other tooling), so the environment that has the key can run it.
const env = (name: string): string | undefined =>
  (globalThis as any).Deno?.env.get(name) ?? (globalThis as any).process?.env?.[name];
const exit = (code: number): never => {
  ((globalThis as any).Deno ?? (globalThis as any).process).exit(code);
};

const apiKey = env("GROQ_API_KEY") ?? env("GROQ");
if (!apiKey) {
  console.error("Set GROQ_API_KEY (or GROQ) to run this probe.");
  exit(1);
}

// The question the ladder answers — a real one from the STAR practice deck, so
// the prompt under test is exercised with production-shaped input.
const QUESTION = {
  question:
    "Tell me about a time you had to creatively solve a business problem using data science methodologies. What was the problem, what was your approach, and what was the outcome?",
  targetCompetency: "Problem-Solving (creativity), Solution Development, Drives Results",
};

interface Rung {
  answer: { situation: string; task: string; action: string; result: string };
  // Every trial's scores must satisfy this; `why` names the property being
  // proven so a failure reads as a calibration regression, not a flaky number.
  expect: (s: StarScores) => boolean;
  why: string;
}

const LADDER: Record<string, Rung> = {
  "L1 non-answer": {
    answer: {
      situation: "In my old team.",
      task: "Stuff needed fixing.",
      action: "I did some work on it.",
      result: "It was fine.",
    },
    expect: (s) => s.overall <= 1.25 && Math.max(s.situation, s.task, s.action, s.result) <= 2,
    why: "content-free fragments reach the floor: at most one component above 1, none above 2",
  },
  "L2 vague filler": {
    answer: {
      situation: "Our team was having problems with our reporting and leadership wasn't happy.",
      task: "I was asked to look into the data and figure out what was going on.",
      action: "I used Python and SQL to analyze the data and built some visualizations.",
      result: "Leadership liked the analysis and we made some changes based on it.",
    },
    expect: (s) => s.overall >= 1.75 && s.overall <= 2.5,
    why: "interchangeable filler sits around 2, above the non-answer",
  },
  "L3 concrete, unquantified": {
    answer: {
      situation:
        "Our regional sales team saw revenue climbing quarter over quarter but margins were flat, and nobody could explain the gap.",
      task: "My manager asked me to find the driver before the quarterly business review.",
      action:
        "I pulled two years of transaction data, joined it against the discount authorization table, and ran a cohort analysis by rep and product line. I found that discounting had crept up on a handful of SKUs.",
      result: "I presented the findings and the sales leadership team tightened the discount approval threshold.",
    },
    expect: (s) => s.overall >= 2.75 && s.overall <= 3.5,
    why: "concrete but unquantified lands mid-scale",
  },
  "L4 quantified ownership": {
    answer: {
      situation:
        "Revenue grew 12% year over year but gross margin dropped 4 points, and finance and sales were blaming each other in a standing weekly meeting with no data to settle it.",
      task: "I owned the analysis and had three weeks to deliver a defensible answer to the CFO, not just a chart.",
      action:
        "Instead of the top-down margin rollup finance had already tried, I rebuilt the picture from the transaction level. I joined 1.8M order lines to discount approvals and freight cost, then ran a decomposition to separate price effect, mix effect, and cost effect. The mix effect turned out to be the story: reps were hitting quota by pushing a high-volume, low-margin accessory line.",
      result:
        "Margin erosion was 71% attributable to product mix, not discounting. Sales comp was restructured to weight margin instead of revenue, and margin recovered 2.6 points over the next two quarters.",
    },
    // Three of these components genuinely clear their bars, but the Action must
    // be held at 4: it shows a method and a reason, yet no validation and no
    // stakeholder handling, and Action is the component where that judgment
    // lives. This is the L4|L5 boundary the scorer used to collapse — and since
    // the overall is the exact mean rather than a rounded one, the held-back
    // Action keeps this rung's overall strictly below L5's 5.0.
    expect: (s) => s.overall >= 4 && s.overall < 5 && s.action <= 4,
    why: "quantified but judgment-light is detected where judgment lives: Action capped at 4, overall below 5",
  },
  "L5 judgment shown": {
    answer: {
      situation:
        "Revenue was up 12% year over year while gross margin fell 4 points. Finance and sales had been arguing about it for six weeks in a standing meeting, each side armed with a different rollup, and the CFO had lost patience with both.",
      task:
        "I was asked to settle it before the board deck locked in three weeks. The real constraint was not analytical, it was credibility: whatever I delivered had to be something both the VP of Sales and the Controller would sign off on, or it would die in the meeting like everything before it.",
      action:
        "I started by sitting with both teams to reconcile their definitions, and found they were computing margin at different points in the order lifecycle, which alone explained part of the disagreement. Then I rebuilt the analysis bottom-up from 1.8M order lines, joining discount approvals, freight, and returns. Rather than a single regression, I ran a price-volume-mix decomposition so each team could see their own piece isolated, and I stress-tested it by holding out the prior fiscal year and confirming the model reproduced the known margin path within 0.3 points. I walked the VP of Sales through the rep-level view privately before the readout so he was not surprised in front of the CFO.",
      result:
        "Product mix accounted for 71% of the erosion, discounting 18%, and freight the rest. Sales comp was restructured to weight contribution margin, and margin recovered 2.6 points over two quarters on flat revenue, roughly $4.1M. The decomposition became a standing monthly report that finance still runs, and the reconciled margin definition was written into the data dictionary so the argument could not restart.",
    },
    // Every component must clear its bar — together with the L4 rung this is
    // the separation claim: L5 scores straight 5s while L4's Action cannot.
    expect: (s) => s.situation === 5 && s.task === 5 && s.action === 5 && s.result === 5,
    why: "validation + stakeholder handling + durable impact earns the straight 5s that L4 does not",
  },
  "MIXED halo check": {
    answer: {
      situation: "At work.",
      task: "They needed something done.",
      action:
        "I rebuilt the analysis bottom-up from 1.8M order lines, joining discount approvals, freight, and returns, ran a price-volume-mix decomposition so each effect could be isolated, and stress-tested it against the prior fiscal year, reproducing the known margin path within 0.3 points.",
      result:
        "Product mix accounted for 71% of the erosion. Sales comp was restructured to weight contribution margin, and margin recovered 2.6 points over two quarters, roughly $4.1M.",
    },
    expect: (s) => s.situation <= 2 && s.task <= 2 && s.action >= 4 && s.result >= 4,
    why: "components are scored on their own text: a strength-level Action/Result cannot rescue a non-answer Situation/Task",
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mirrors the edge function's resilience: waits out 429s (free tier is 8k TPM)
// and resamples the occasional json_validate_failed decode accident, the same
// two retries _shared/groq.ts performs in production.
async function evaluate(prompt: string): Promise<StarScores> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. Provide detailed, objective feedback with specific examples from the actual response content and actionable suggestions.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: responseFormat(starEvaluationSchema({ assessment: false })),
      }),
    });

    if (response.status === 429 && attempt < 20) {
      const waitS = Math.ceil(Number(response.headers.get("retry-after") ?? 10));
      await sleep(waitS * 1000);
      continue;
    }
    if (response.status === 400 && attempt < 20) {
      const detail = await response.text();
      if (detail.includes("json_validate_failed")) continue;
      throw new Error(`Groq 400: ${detail}`);
    }
    if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);

    const json = await response.json();
    const scored = normalizeScores(JSON.parse(json.choices[0].message.content).scores);
    if (!scored.ok) throw new Error(`invalid scores: ${scored.reasons.join("; ")}`);
    return scored.scores;
  }
}

const TRIALS = Math.max(1, Number(env("TRIALS") ?? 1));
let failures = 0;

for (const [name, rung] of Object.entries(LADDER)) {
  const prompt = createStandardEvaluationPrompt(rung.answer, QUESTION);
  const rendered: string[] = [];
  let passed = true;

  for (let trial = 0; trial < TRIALS; trial++) {
    const s = await evaluate(prompt);
    rendered.push(`S=${s.situation} T=${s.task} A=${s.action} R=${s.result} overall=${s.overall}`);
    if (!rung.expect(s)) passed = false;
  }

  console.log(`${passed ? "  ok  " : " FAIL "} ${name}: ${rendered.join(" | ")}`);
  if (!passed) {
    failures++;
    console.log(`        expected: ${rung.why}`);
  }
}

console.log(
  failures === 0
    ? "\nThe scorer distinguishes every rung of the ladder."
    : `\n${failures} rung(s) FAILED — the anchors have drifted; recalibrate the prompt before shipping it.`,
);
exit(failures === 0 ? 0 : 1);
