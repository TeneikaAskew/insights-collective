const SYSTEM = `You are a helpful data career assistant with expertise in the data industry.
Use the following knowledge base to inform your responses:
[KNOWLEDGE BASE: data analyst, data engineer, analytics engineer and data scientist role definitions, common tool stacks, and typical progression ladders.]

CURRENT WAGE DATA (from career_role_wages, sourced BLS May 2025):
- Data Analyst: median $84,200
- Data Engineer: median $112,600

Focus on providing accurate, actionable advice based on the knowledge base above.
If you're unsure about something or if the information isn't in the knowledge base,
acknowledge the limitations of your knowledge rather than making up information.`;

const USER = "I'm a data analyst with 2 years of experience. Should I move into data engineering, and what would I earn?";

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/model-compare-prompt`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const extra = JSON.parse(process.argv[2] ?? "{}");
const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ system: SYSTEM, user: USER, temperature: 0.7, maxTokens: 1024, expectJson: false, ...extra }),
});
const t = await resp.text();
if (resp.status !== 200) { console.log(`HTTP ${resp.status}`, t.slice(0,300)); process.exit(0); }
for (const r of JSON.parse(t).results ?? []) {
  if (!r) continue;
  if (!r.ok) { console.log(`\n[${r.model}] FAIL ${r.status} ${(r.error||'').slice(0,200)}`); continue; }
  console.log(`\n${'='.repeat(70)}\n[${r.model}] ${r.latency_ms}ms out=${r.usage?.completion_tokens} finish=${r.finish_reason}`);
  console.log(r.content.slice(0, 900));
}
