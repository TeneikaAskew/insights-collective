// admin-storage-config re-applies the exact bucket settings already live
// (verified identical beforehand), so this call is a no-op.
const BASE = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const r0 = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }),
});
const j0 = await r0.json();
if (!j0.access_token) { console.log("admin sign-in failed", r0.status); process.exit(0); }
console.log("signed in as admin: OK\n");
const t0 = Date.now();
const r = await fetch(`${BASE}/functions/v1/admin-storage-config`, {
  method: "POST",
  headers: { Authorization: `Bearer ${j0.access_token}`, apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const text = await r.text();
console.log(`— admin-storage-config`);
console.log(`  HTTP ${r.status}  ${Date.now() - t0}ms`);
console.log(`  body: ${text.slice(0, 400)}`);
