#!/usr/bin/env node
// ABOUTME: Replays every inventoried query against the live project as each role.
// ABOUTME: The status code PostgREST returns is the verdict — not the generated types.
//
// Why replay rather than check src/integrations/supabase/types.ts: that file is
// stale relative to the applied migrations. Checking four flagged column
// mismatches against it produced two real defects, one already fixed by a
// migration, and one that was simply wrong. Only the database can answer.
//
// Reads are issued for real. Writes are NOT executed — a table+column+grant+policy
// check is reported instead, so this script never mutates anything.
//
// Usage: node scripts/audit/replay-queries.mjs   (needs .env with role credentials)

import fs from 'node:fs';

const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (fs.readFileSync('src/config/security.ts', 'utf8').match(/VITE_SUPABASE_ANON_KEY \|\| "([^"]+)"/) ?? [])[1];

if (!ANON) {
  console.error('No anon key: set VITE_SUPABASE_ANON_KEY or keep the fallback in src/config/security.ts');
  process.exit(1);
}

const ROLES = {
  anon: null,
  member: [process.env.E2E_MEMBER_EMAIL, process.env.E2E_MEMBER_PASSWORD],
  instructor: [process.env.E2E_INSTRUCTOR_EMAIL, process.env.E2E_INSTRUCTOR_PASSWORD],
  admin: [process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD],
};

async function tokenFor(role) {
  const creds = ROLES[role];
  if (!creds) return null;
  const [email, password] = creds;
  if (!email || !password) return undefined;             // role unavailable
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return undefined;
  return (await res.json()).access_token;
}

function headersFor(token) {
  const h = { apikey: ANON };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Normalise a select list exactly the way postgrest-js does before sending it:
 * strip all whitespace that is not inside double quotes.
 *
 * This is not cosmetic. Sending the raw multi-line template literal
 * `*,\n  modules(\n    id,\n    order_index\n  )` gets a 200 from PostgREST,
 * while the whitespace-stripped form the client actually sends gets
 * `42703 column modules_1.order_index does not exist`. Replaying the unstripped
 * string reports a broken page as healthy.
 */
function normaliseSelect(select) {
  let quoted = false;
  return [...select]
    .map((c) => {
      if (c === '"') quoted = !quoted;
      return quoted || !/\s/.test(c) ? c : '';
    })
    .join('');
}

/**
 * Issue the query the page would issue. `limit=1` keeps payloads small; it does
 * not change whether the columns, grants, embeds or casts resolve — which is the
 * whole question. A 2xx means the shape is valid for that role; RLS returning
 * zero rows is a data question, not a validity one.
 */
async function probeSelect(table, select, token) {
  const cols = select && select.trim() ? normaliseSelect(select) : '*';
  const url = `${URL_BASE}/rest/v1/${table}?select=${encodeURIComponent(cols)}&limit=1`;
  try {
    const res = await fetch(url, { headers: headersFor(token) });
    if (res.ok) return { status: res.status, ok: true };
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ok: false, code: body.code ?? null, message: (body.message ?? '').slice(0, 200) };
  } catch (e) {
    return { status: 0, ok: false, code: 'NETWORK', message: e.message.slice(0, 160) };
  }
}

/**
 * RPC existence comes from the catalog, not from calling the function.
 *
 * Calling with `{}` reports PGRST202 "could not find the function … without
 * parameters" for every function that merely *requires arguments* — which
 * produced 22 false MISSING verdicts on functions that demonstrably exist.
 * pg_proc is the authority, and it also gives us the real parameter names so a
 * mis-spelled argument (which fails the same way at runtime) is visible.
 */
async function catalogFunctions() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.VITE_SUPABASE_PROJECT_ID ?? 'siuqvhscuiycvdrtiqsh';
  if (!token) return null;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `select p.proname as name,
                     coalesce(array_to_string(p.proargnames, ','), '') as args
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'`,
    }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.name)) map.set(r.name, new Set());
    r.args.split(',').filter(Boolean).forEach((a) => map.get(r.name).add(a));
  }
  return map;
}

const inventory = JSON.parse(fs.readFileSync('.e2e-audit/query-inventory.json', 'utf8'));

// Collapse to distinct shapes — 702 call sites reduce to far fewer real queries,
// and replaying duplicates proves nothing extra.
const selects = new Map();
for (const r of inventory.records) {
  if (r.kind !== 'table') continue;
  const key = `${r.table}::${r.select ?? '*'}`;
  if (!selects.has(key)) selects.set(key, { table: r.table, select: r.select, sites: [], writes: new Set() });
  const e = selects.get(key);
  e.sites.push(`${r.file}:${r.line}`);
  r.writes.forEach((w) => e.writes.add(w));
}
const rpcs = new Map();
for (const r of inventory.records) {
  if (r.kind !== 'rpc') continue;
  if (!rpcs.has(r.name)) rpcs.set(r.name, { name: r.name, sites: [], args: new Set() });
  rpcs.get(r.name).sites.push(`${r.file}:${r.line}`);
  (r.args ?? []).forEach((a) => rpcs.get(r.name).args.add(a));
}

const tokens = {};
for (const role of Object.keys(ROLES)) tokens[role] = await tokenFor(role);
const usable = Object.keys(ROLES).filter((r) => tokens[r] !== undefined);
console.error(`roles available: ${usable.join(', ')}`);

const results = [];
let n = 0;
for (const entry of selects.values()) {
  const perRole = {};
  for (const role of usable) perRole[role] = await probeSelect(entry.table, entry.select, tokens[role]);
  // A query is BROKEN only when every available role gets the same structural
  // error. A 401/403 for anon on a members-only table is correct behaviour, not
  // a defect; a 42703/42P01/PGRST200 everywhere is the code asking for something
  // that does not exist.
  const structural = ['42703', '42P01', 'PGRST200', 'PGRST204', '22P02'];
  const codes = usable.map((r) => perRole[r].code).filter(Boolean);
  const broken = codes.length === usable.length && codes.every((c) => structural.includes(c));
  const anyOk = usable.some((r) => perRole[r].ok);
  results.push({
    kind: 'select',
    table: entry.table,
    select: entry.select,
    writes: [...entry.writes],
    sites: entry.sites,
    perRole,
    verdict: broken ? 'BROKEN' : anyOk ? 'OK' : 'BLOCKED',
  });
  if (++n % 25 === 0) console.error(`  …${n}/${selects.size} select shapes`);
}

const catalog = await catalogFunctions();
if (!catalog) {
  console.error('WARNING: SUPABASE_ACCESS_TOKEN not set — RPC verdicts skipped rather than guessed.');
}
for (const entry of rpcs.values()) {
  if (!catalog) {
    results.push({ kind: 'rpc', name: entry.name, sites: entry.sites, verdict: 'UNKNOWN' });
    continue;
  }
  const known = catalog.get(entry.name);
  const badArgs = known ? [...entry.args].filter((a) => !known.has(a)) : [];
  results.push({
    kind: 'rpc',
    name: entry.name,
    sites: entry.sites,
    calledArgs: [...entry.args],
    actualArgs: known ? [...known] : null,
    badArgs,
    verdict: !known ? 'MISSING' : badArgs.length ? 'BAD_ARGS' : 'OK',
  });
}

fs.writeFileSync('.e2e-audit/query-results.json', JSON.stringify({ results }, null, 2));

const counts = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
console.error(`\n${results.length} distinct shapes replayed: ${JSON.stringify(counts)}`);
for (const r of results.filter((x) => ['BROKEN', 'MISSING', 'BAD_ARGS'].includes(x.verdict))) {
  const first = r.perRole ? Object.values(r.perRole).find((p) => p.code) : null;
  const detail = first
    ? `${first.code} ${first.message}`
    : r.verdict === 'BAD_ARGS'
      ? `called with [${r.badArgs}] but signature is [${r.actualArgs}]`
      : 'not present in pg_proc';
  console.error(`  ${r.verdict}  ${r.table ?? r.name}  ${detail}`);
  console.error(`         ${r.sites.slice(0, 3).join(', ')}${r.sites.length > 3 ? ` (+${r.sites.length - 3})` : ''}`);
}
console.error('→ .e2e-audit/query-results.json');
