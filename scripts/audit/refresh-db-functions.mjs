#!/usr/bin/env node
// ABOUTME: Writes the live list of public database functions to a checked-in fixture.
// ABOUTME: The unit-test Supabase mock validates .rpc() names against it.
//
// Why the list is checked in rather than fetched
// ----------------------------------------------
// Unit tests must run offline and deterministically, so they cannot ask the
// database whether a function exists. But `rpc: vi.fn()` accepts any string,
// which is how 893 tests stayed green against `select_random_questions` — a
// function that does not exist and never did. A checked-in list is the
// compromise: offline at test time, and kept honest by CI, which fails if the
// committed file no longer matches the database.
//
// Usage: node scripts/audit/refresh-db-functions.mjs [--check]
//   --check  compare instead of writing; exit 1 on drift (this is what CI runs)

import fs from 'node:fs';
import path from 'node:path';

const OUT = 'src/test/fixtures/db-functions.json';

const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
  console.error(`admin sign-in failed: ${signIn.status}`);
  process.exit(2);
}
const token = (await signIn.json()).access_token;

const res = await fetch(`${URL_BASE}/rest/v1/audit_db_functions?select=name&order=name`, {
  headers: { apikey: ANON, Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`audit_db_functions unreadable: ${res.status}`);
  console.error('Is migration 20260801000000_audit_surfaces.sql applied, and is this account an admin?');
  process.exit(2);
}
const rows = await res.json();
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('audit_db_functions returned nothing — the signed-in account is probably not an admin.');
  process.exit(2);
}

const names = [...new Set(rows.map((r) => r.name))].sort();
const next = `${JSON.stringify(names, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current === next) {
    console.log(`OK — ${OUT} lists all ${names.length} database functions.`);
    process.exit(0);
  }
  const committed = current ? new Set(JSON.parse(current)) : new Set();
  const live = new Set(names);
  const gone = [...committed].filter((n) => !live.has(n));
  const added = [...live].filter((n) => !committed.has(n));
  console.error(`${OUT} does not match the database.`);
  // Removed is the direction that matters: a name in this file that no longer
  // exists lets a unit test keep passing against a function the app will fail
  // to call at runtime.
  for (const n of gone) console.error(`  -  ${n}  (no longer in the database)`);
  for (const n of added) console.error(`  +  ${n}`);
  console.error('\n  node scripts/audit/refresh-db-functions.mjs');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, next);
console.log(`wrote ${names.length} function names to ${OUT}`);
