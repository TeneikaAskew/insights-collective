#!/usr/bin/env node
// ABOUTME: Fails when the committed Supabase types no longer describe the database.
// ABOUTME: Compares against the live catalogue, not against a re-run of the generator.
//
// Why this exists
// ---------------
// src/integrations/supabase/types.ts is generated and committed, and nothing
// regenerated it for months. During the audit it produced a ~40% false-positive
// rate: of four column mismatches it implied, two were real, one had already
// been fixed by a migration, and one column simply did not exist. A generated
// file that nothing checks is worse than no file at all, because it gets
// trusted — the drift is invisible precisely because the file looks
// authoritative.
//
// Why not "regenerate and diff"
// -----------------------------
// The obvious check is to re-run `supabase gen types` in CI and diff the bytes.
// That makes the gate sensitive to the generator's formatting and version, not
// just to the schema: a CLI upgrade reorders a key and CI goes red for a
// non-problem. A gate that cries wolf is a gate people disable, which is the
// same silent-failure shape this whole effort is about.
//
// So compare meaning instead. The database is the authority; this asks whether
// every table and column the types file claims still exists, and reports what
// the file is missing.
//
// Usage: node scripts/audit/types-drift.mjs   (needs .env with E2E_ADMIN_*)

import fs from 'node:fs';

const TYPES_FILE = 'src/integrations/supabase/types.ts';

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

/**
 * Pull `relation → Set(column)` out of the generated file.
 *
 * The generated shape is stable and indentation-significant:
 *
 *   Tables: {
 *     certificates: {
 *       Row: {
 *         id: string
 *
 * so the Row block of each entry is what we want — Insert and Update repeat the
 * same columns with different optionality.
 *
 * Views are read the same way and merged in. They are queried through PostgREST
 * exactly like tables, so a column that disappears from a view breaks a page
 * just as thoroughly; and skipping them would make every view look like an
 * undeclared relation in the report below.
 */
function parseTypes(source) {
  const relations = new Map();
  const lines = source.split('\n');

  let inSection = false;
  let relation = null;
  let inRow = false;

  for (const line of lines) {
    if (/^ {4}(Tables|Views): \{$/.test(line)) { inSection = true; relation = null; continue; }
    if (/^ {4}(Functions|Enums|CompositeTypes): \{$/.test(line)) { inSection = false; relation = null; continue; }
    if (!inSection) continue;

    const start = line.match(/^ {6}(\w+): \{$/);
    if (start) {
      relation = start[1];
      if (!relations.has(relation)) relations.set(relation, new Set());
      inRow = false;
      continue;
    }

    if (!relation) continue;
    if (/^ {8}Row: \{$/.test(line)) { inRow = true; continue; }
    if (inRow && /^ {8}\}$/.test(line)) { inRow = false; continue; }

    if (inRow) {
      const col = line.match(/^ {10}(\w+)\??:/);
      if (col) relations.get(relation).add(col[1]);
    }
  }
  return relations;
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

// PostgREST caps a page at 1000 rows by default and this catalogue is larger,
// so page explicitly rather than silently truncating — a truncated catalogue
// would report every table past the cut-off as deleted.
const live = new Map();
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/audit_db_columns?select=table_name,column_name&order=table_name,column_name`,
    {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        Range: `${offset}-${offset + 999}`,
      },
    },
  );
  if (!res.ok) {
    console.error(`audit_db_columns unreadable: ${res.status} ${(await res.text()).slice(0, 200)}`);
    console.error('Is migration 20260801000000_audit_surfaces.sql applied, and is this account an admin?');
    process.exit(2);
  }
  const rows = await res.json();
  for (const r of rows) {
    if (!live.has(r.table_name)) live.set(r.table_name, new Set());
    live.get(r.table_name).add(r.column_name);
  }
  if (rows.length < 1000) break;
}

if (live.size === 0) {
  console.error('audit_db_columns returned nothing — the signed-in account is probably not an admin.');
  process.exit(2);
}

const declared = parseTypes(fs.readFileSync(TYPES_FILE, 'utf8'));
if (declared.size === 0) {
  console.error(`could not parse any tables out of ${TYPES_FILE} — has the generated shape changed?`);
  process.exit(2);
}

// Types claiming something the database does not have is the dangerous
// direction: the compiler blesses a query PostgREST will reject at runtime,
// which is exactly how `profiles.full_name` reached production.
const staleTables = [];
const staleColumns = [];
for (const [table, cols] of declared) {
  const liveCols = live.get(table);
  if (!liveCols) { staleTables.push(table); continue; }
  const gone = [...cols].filter((c) => !liveCols.has(c));
  if (gone.length) staleColumns.push({ table, gone });
}

// The other direction is not a build breaker — you simply cannot reference what
// the types do not declare — but it is how the file rots, so report it.
const missingTables = [...live.keys()].filter((t) => !declared.has(t) && !t.startsWith('audit_'));
const missingColumns = [];
for (const [table, cols] of declared) {
  const liveCols = live.get(table);
  if (!liveCols) continue;
  const added = [...liveCols].filter((c) => !cols.has(c));
  if (added.length) missingColumns.push({ table, added });
}

for (const t of staleTables) console.error(`  STALE  types declare table "${t}" — it does not exist in the database`);
for (const { table, gone } of staleColumns) {
  console.error(`  STALE  ${table}: types declare column(s) the database does not have — ${gone.join(', ')}`);
}

const behind = missingTables.length + missingColumns.length;
if (behind) {
  console.log(`\n${TYPES_FILE} is behind the database (not a failure, but regenerate it):`);
  for (const t of missingTables) console.log(`  +  table ${t}`);
  for (const { table, added } of missingColumns) console.log(`  +  ${table}.${added.join(', ')}`);
  console.log('\n  npx supabase gen types typescript --project-id "$VITE_SUPABASE_PROJECT_ID" \\');
  console.log(`    > ${TYPES_FILE}`);
}

if (staleTables.length || staleColumns.length) {
  console.error(
    `\nFAIL — ${TYPES_FILE} describes ${staleTables.length + staleColumns.length} thing(s) the database does not have.`,
  );
  console.error('TypeScript will accept queries against them; PostgREST will reject them at runtime.');
  process.exit(1);
}

console.log(`\nOK — every table and column ${TYPES_FILE} declares exists in the database.`);
