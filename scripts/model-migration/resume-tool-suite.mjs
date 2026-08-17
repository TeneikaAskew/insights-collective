// Does the Groq fallback in resume-analyzer support tool calling at all?
const ANALYZE_RESUME_TOOL = {
  type: "function",
  function: {
    name: "analyze_resume",
    description: "Return structured resume analysis with elevator pitch, improvement themes, and grade explanation.",
    parameters: {
      type: "object",
      properties: {
        elevator_pitch: { type: "string", description: "Detailed professional elevator pitch, 4-5 sentences." },
        themes: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3, description: "Three specific improvement themes, one sentence each" },
        explanation: { type: "string", description: "Brief explanation of the resume grade, max 2 sentences" }
      },
      required: ["elevator_pitch", "themes", "explanation"],
      additionalProperties: false
    }
  }
};
const TOOL_CHOICE = { type: "function", function: { name: "analyze_resume" } };

const system = `You are an expert resume analyst. Based on the provided resume text and basic analysis, analyze the resume and call the analyze_resume function with:
1. A detailed professional elevator pitch (4-5 sentences) covering their core expertise, standout achievements, hands-on experience, and what drives them professionally
2. Three specific improvement themes (one sentence each)
3. A brief explanation of the resume grade (max 2 sentences)
Be specific, professional, and concise. Focus on actionable advice.`;

const user = `Resume text (truncated): Marcus Webb — Data Analyst, 4 yrs. Built Looker dashboards for a 200-store retail chain. Migrated weekly Excel reporting to dbt + Snowflake, cutting refresh from 6h to 20m. Ran A/B tests on checkout flow; wrote SQL for finance close. Tools: SQL, Python (pandas), dbt, Snowflake, Looker, Airflow. BS Economics.

Basic Analysis: {"resume_percent":72,"letter_grade":"C+","bullet_count":9,"bullet_samples":[{"text":"Migrated weekly Excel reporting to dbt + Snowflake, cutting refresh from 6h to 20m","score":88,"issues":"strong metric, clear tooling"},{"text":"Ran A/B tests on checkout flow","score":41,"issues":"no result, no metric, vague scope"},{"text":"Wrote SQL for finance close","score":33,"issues":"no impact, no scale"}],"strong_bullets":"Migrated weekly Excel reporting to dbt + Snowflake, cutting refresh from 6h to 20m","weak_bullets":"Ran A/B tests on checkout flow\nWrote SQL for finance close"}`;

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/model-compare-prompt`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const extra = JSON.parse(process.argv[2] ?? "{}");
const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ system, user, temperature: 0.7, maxTokens: 500, tools: [ANALYZE_RESUME_TOOL], toolChoice: TOOL_CHOICE, ...extra }),
});
const t = await resp.text();
if (resp.status !== 200) { console.log(`HTTP ${resp.status}`, t.slice(0,400)); process.exit(0); }
for (const r of JSON.parse(t).results ?? []) {
  if (!r) continue;
  console.log('='.repeat(72));
  if (!r.ok) { console.log(`[${r.model}] API FAIL ${r.status}\n  ${(r.error||'').slice(0,420)}`); continue; }
  console.log(`[${r.model}] ${r.latency_ms}ms out=${r.usage?.completion_tokens} finish=${r.finish_reason}`);
  console.log(`  made_tool_call=${r.made_tool_call}  prod_parser_ok=${r.prod_parser_ok}`);
  const p = r.parsed;
  console.log(`  elevator_pitch: ${p?.elevator_pitch ? JSON.stringify(p.elevator_pitch.slice(0,150))+'…' : 'MISSING'}`);
  console.log(`  themes: ${Array.isArray(p?.themes) ? p.themes.length+' → '+JSON.stringify(p.themes[0]||'').slice(0,110) : 'MISSING'}`);
  console.log(`  explanation: ${p?.explanation ? 'present' : 'MISSING'}`);
  if (!r.made_tool_call) console.log(`  RAW: ${JSON.stringify((r.content||'').slice(0,220))}`);
}
