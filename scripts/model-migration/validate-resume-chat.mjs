// End-to-end validation of the ResumeChat fix, signed in as a real member.
// Calls the deployed `together-ai` function exactly as ResumeChat does.
// Credentials come from the environment and are never printed.
const BASE = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function signIn(email, password) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`sign-in failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

// Mirrors ResumeChat.handleSendMessage's payload shape.
async function callTogetherAI(token, model, stream) {
  const chatHistory = [
    { role: "system", content: "You are a resume coach. Answer in one short sentence." },
    { role: "user", content: "My resume says 'Ran A/B tests on checkout flow'. How do I make it stronger?" },
  ];
  const t0 = Date.now();
  const r = await fetch(`${BASE}/functions/v1/together-ai`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ chatHistory, model, max_tokens: 1024, stream }),
  });
  const latency = Date.now() - t0;
  const text = await r.text();
  return { status: r.status, ok: r.ok, latency, text };
}

const token = await signIn(process.env.E2E_MEMBER_EMAIL, process.env.E2E_MEMBER_PASSWORD);
console.log("signed in as member: OK\n");

const OLD = "meta-llama/Llama-3-8b-chat-hf";  // what ResumeChat sent before
const NEW = "google/gemini-2.5-flash";        // what it sends now

for (const [label, model, stream] of [
  ["BEFORE (old id, non-stream)", OLD, false],
  ["AFTER  (fixed id, non-stream)", NEW, false],
  ["AFTER  (fixed id, streaming — the path ResumeChat uses)", NEW, true],
]) {
  const r = await callTogetherAI(token, model, stream);
  console.log(`${label}`);
  console.log(`  HTTP ${r.status}  ${r.latency}ms`);
  if (!r.ok) {
    console.log(`  ERROR: ${r.text.slice(0, 260)}\n`);
    continue;
  }
  if (stream) {
    const chunks = r.text.split("\n").filter((l) => l.startsWith("data:"));
    let assembled = "";
    for (const c of chunks) {
      const payload = c.slice(5).trim();
      if (payload === "[DONE]") continue;
      try { assembled += JSON.parse(payload).choices?.[0]?.delta?.content ?? ""; } catch { /* noop */ }
    }
    console.log(`  SSE events: ${chunks.length}`);
    console.log(`  assembled reply: ${JSON.stringify(assembled.slice(0, 200))}\n`);
  } else {
    let reply = null;
    try { reply = JSON.parse(r.text).data?.choices?.[0]?.message?.content ?? null; } catch { /* noop */ }
    console.log(`  reply: ${JSON.stringify((reply ?? r.text).slice(0, 200))}\n`);
  }
}
