const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/gateway-probe`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(JSON.parse(process.argv[2] ?? "{}")),
});
const t = await resp.text();
if (resp.status !== 200) { console.log(`HTTP ${resp.status}`, t.slice(0,400)); process.exit(0); }
for (const p of JSON.parse(t).probe ?? []) {
  console.log(`${p.accepted ? 'ACCEPTED' : 'REJECTED'}  ${String(p.status).padEnd(4)} ${p.model.padEnd(38)} ${p.latency_ms}ms`);
  if (p.reply) console.log(`          reply: ${JSON.stringify(p.reply)}`);
  if (p.error) console.log(`          error: ${p.error.slice(0,200)}`);
}
