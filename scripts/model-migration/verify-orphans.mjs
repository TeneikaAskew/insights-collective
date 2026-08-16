// Invokes the four deployed-but-not-in-repo Edge Functions, signed in, to
// establish what each actually does today. Read-only calls only:
// analyze-job-description is given a nonexistent id so it returns before its
// database write, and admin-storage-config is NOT called here (it mutates).
const BASE = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function signIn(email, password) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`sign-in failed: ${r.status}`);
  return j.access_token;
}

async function call(token, path, body) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/functions/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const latency = Date.now() - t0;
  const text = await r.text();
  return { status: r.status, latency, text };
}

const token = await signIn(process.env.E2E_MEMBER_EMAIL, process.env.E2E_MEMBER_PASSWORD);
console.log("signed in as member: OK\n");

const cases = [
  {
    name: "resume-services /detect-sentences",
    path: "resume-services/detect-sentences",
    body: { text: "Migrated weekly Excel reporting to dbt and Snowflake, cutting refresh time from six hours to twenty minutes. Ran A/B tests on the checkout flow." },
    expects: "llama3-8b-8192 (decommissioned)",
  },
  {
    name: "resume-services /improve-bullet",
    path: "resume-services/improve-bullet",
    body: { bullet: "Ran A/B tests on checkout flow" },
    expects: "llama3-8b-8192 (decommissioned)",
  },
  {
    name: "generate-course-content",
    path: "generate-course-content",
    body: { prompt: "A short course on SQL window functions", field: "title" },
    expects: "llama3-8b-8192 (decommissioned) unless OPENAI_API_KEY is set",
  },
  {
    name: "analyze-job-description (nonexistent id — returns before any write)",
    path: "analyze-job-description",
    body: { jobDescriptionId: "00000000-0000-4000-8000-000000000000" },
    expects: "404 before reaching the model",
  },
];

for (const c of cases) {
  const r = await call(token, c.path, c.body);
  console.log(`— ${c.name}`);
  console.log(`  expected: ${c.expects}`);
  console.log(`  HTTP ${r.status}  ${r.latency}ms`);
  console.log(`  body: ${r.text.slice(0, 300).replace(/\n/g, " ")}\n`);
}
