#!/usr/bin/env node
// ABOUTME: Asserts database invariants that no test would otherwise notice.
// ABOUTME: Exits non-zero on violation so CI can gate on it.
//
// These are conditions that are true today, that nothing enforces, and whose
// violation would be invisible until a user hit it.
//
// The checks themselves live in the database as public.audit_invariants()
// (migration 20260801000000), not here. Two reasons: the two profile-coverage
// checks read auth.users, which no client role can; and a check defined in a
// script only runs when someone remembers to run the script, whereas one
// defined in the schema is versioned with the thing it constrains.
//
// This used to require a Supabase management token — project-wide arbitrary SQL
// for a job that reads four integers. It now signs in as admin with the same
// credentials e2e.yml already holds.
//
// Usage: node scripts/audit/schema-invariants.mjs   (needs .env with E2E_ADMIN_*)

import fs from 'node:fs';

const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (fs.readFileSync('src/config/security.ts', 'utf8').match(/VITE_SUPABASE_ANON_KEY \|\| "([^"]+)"/) ?? [])[1];

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_TEST_PASSWORD;

if (!ANON || !EMAIL || !PASSWORD) {
  console.error('E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD and an anon key are required.');
  process.exit(2);
}

const signIn = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!signIn.ok) {
  console.error(`admin sign-in failed: ${signIn.status} ${(await signIn.text()).slice(0, 200)}`);
  process.exit(2);
}
const token = (await signIn.json()).access_token;

const res = await fetch(`${URL_BASE}/rest/v1/rpc/audit_invariants`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: '{}',
});

if (!res.ok) {
  const body = await res.text();
  console.error(`audit_invariants() failed: ${res.status} ${body.slice(0, 300)}`);
  // 404/PGRST202 means the migration is not applied on this project; 42501 means
  // the account signed in is not actually an admin. Both are setup problems
  // rather than invariant violations, so exit 2 to keep them distinguishable
  // from a real failure.
  process.exit(2);
}

const rows = await res.json();
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('audit_invariants() returned nothing — the function exists but produced no checks.');
  process.exit(2);
}

let failures = 0;
for (const row of rows) {
  const n = Number(row.violations ?? 0);
  if (n === 0) {
    console.log(`  ok    ${row.check_name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${row.check_name} — ${n} violation(s)`);
    if (row.why) console.error(`        ${row.why}`);
  }
}

if (failures) {
  console.error(`\n${failures} schema invariant(s) violated.`);
  process.exit(1);
}
console.log(`\nall ${rows.length} schema invariants hold.`);
