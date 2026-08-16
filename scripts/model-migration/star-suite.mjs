// STAR-evaluation comparison. The old model (llama3-8b-8192) is decommissioned,
// so this compares candidate replacements on the exact production prompt.
// Hard check: the prompt REQUIRES overall === round((s+t+a+r)/4).

const SYSTEM = `You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. You MUST calculate the overall score as the exact mathematical average of the 4 component scores. Provide detailed, objective feedback with specific examples from the actual response content and actionable suggestions.`;

const questionData = {
  question: "Tell me about a time you had to influence a team without direct authority.",
  targetCompetency: "Influencing & Collaboration",
};

// Deliberately uneven quality: strong Action, weak Result (no metrics).
const response = {
  situation: "Our analytics team was duplicating dashboard work across three business units because nobody owned a shared definition of 'active customer'.",
  task: "I was the analyst on the retention squad. I had no management authority over the other two teams, but I needed all three to agree on one definition before quarterly reporting.",
  action: "I audited the three existing definitions and documented where they diverged. I set up a 45-minute working session with the leads from each unit, brought a one-page comparison, and walked through the revenue impact of each variant. When the marketing lead pushed back, I offered to run both definitions in parallel for two weeks so we could compare rather than argue. I then wrote the agreed definition into our dbt model and added a test so it could not silently drift.",
  result: "Everyone ended up using the same definition and reporting got easier. The leads were happy with the outcome.",
};

const USER = `You are an expert interview coach evaluating this STAR response.

Question: ${questionData.question}
Target Competency: ${questionData.targetCompetency}

STAR Response:
Situation: ${response.situation}
Task: ${response.task}
Action: ${response.action}
Result: ${response.result}

CRITICAL SCORING INSTRUCTIONS:
1. Score each component (situation, task, action, result) individually on a 1-10 scale based on:
   - Situation: How well the context is established and relevant
   - Task: How clearly the challenge/responsibility is explained
   - Action: How effectively specific actions are described
   - Result: How well outcomes are quantified and demonstrate impact
2. The overall score MUST be calculated as: (situation + task + action + result) / 4
3. Round the overall score to the nearest integer (1-10)

FEEDBACK REQUIREMENTS - BE VERY SPECIFIC:
- Strengths: Provide exactly 3-5 SPECIFIC examples with concrete details from the response
- Improvements: Provide exactly 3-5 SPECIFIC areas that need enhancement with clear explanations
- Suggestions: Provide exactly 3 ACTIONABLE suggestions with detailed reasoning

Evaluate this STAR response and provide feedback in the following JSON format:
{
  "scores": {
    "situation": number (1-10),
    "task": number (1-10),
    "action": number (1-10),
    "result": number (1-10),
    "overall": number (1-10)
  },
  "analysis": {
    "completeness": "Comment on whether all STAR elements are present and complete",
    "specificity": "Comment on level of detail and concrete examples provided",
    "relevance": "Comment on relevance to the target competency",
    "impact": "Comment on how well the response demonstrates measurable impact",
    "communication": "Comment on clarity and logical flow of the response"
  },
  "feedback": {
    "strengths": ["..."],
    "improvements": ["..."],
    "suggestions": ["..."]
  }
}`;

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/model-compare-prompt`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("no service key"); process.exit(1); }

const extra = JSON.parse(process.argv[2] ?? "{}");
const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ system: SYSTEM, user: USER, temperature: 0.3, maxTokens: 3000, ...extra }),
});
const text = await resp.text();
if (resp.status !== 200) { console.log(`HTTP ${resp.status}`, text.slice(0, 300)); process.exit(0); }

const d = JSON.parse(text);
for (const r of d.results ?? []) {
  if (!r) { console.log("  (null record)"); continue; }
  if (!r.ok) { console.log(`\n[${r.model}] API FAIL ${r.status} ${(r.error||'').slice(0,200)}`); continue; }
  const s = r.parsed?.scores ?? {};
  const parts = [s.situation, s.task, s.action, s.result];
  const expected = parts.every(n => typeof n === "number") ? Math.round(parts.reduce((a,b)=>a+b,0)/4) : null;
  const arithmeticOK = expected !== null && s.overall === expected;
  console.log(`\n[${r.model}]  ${r.latency_ms}ms  out=${r.usage?.completion_tokens}  parseOK=${r.prod_parser_ok}  finish=${r.finish_reason}`);
  console.log(`  scores: S=${s.situation} T=${s.task} A=${s.action} R=${s.result} overall=${s.overall}  (required ${expected}) ${arithmeticOK ? "ARITHMETIC OK" : "ARITHMETIC WRONG"}`);
  const fb = r.parsed?.feedback ?? {};
  console.log(`  counts: strengths=${fb.strengths?.length} improvements=${fb.improvements?.length} suggestions=${fb.suggestions?.length} (spec: 3-5 / 3-5 / exactly 3)`);
  console.log(`  impact analysis: ${JSON.stringify(r.parsed?.analysis?.impact ?? null)}`);
  console.log(`  first suggestion: ${JSON.stringify(fb.suggestions?.[0] ?? null)}`);
  if (!r.prod_parser_ok) console.log("  RAW:", JSON.stringify(r.content.slice(0,300)));
}
