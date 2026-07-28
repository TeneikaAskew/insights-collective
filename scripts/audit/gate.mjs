#!/usr/bin/env node
// ABOUTME: The CI gate. Fails the build when a query in routable code is invalid.
// ABOUTME: Turns "an agent audited this once" into "the repo checks itself".
//
// What this catches that nothing else did
// ---------------------------------------
// Five column mismatches and six broken embeds shipped to production and stayed
// green through 893 unit tests and 99 e2e specs. Every one of them was a query
// the database would reject — `profiles.full_name` where the column is
// `first_name`, an embed through a key pointing at `auth.users` — and every one
// rendered as an empty list rather than an error. Unit tests mock Supabase, so
// they cannot see it. The e2e suite could have, but its console fixture
// suppressed all of /rest/v1/.
//
// Only the live database can answer whether a query shape is valid, so this
// replays them against it.
//
// Why "reachable" matters
// -----------------------
// A broken query in code no route can load is a cleanup task, not a release
// blocker. Grading everything the same is how a gate ends up permanently
// yellow and permanently ignored. This fails ONLY on shapes reachable from a
// route, and reports the rest without failing. Reachable-BROKEN is 0 today, so
// it can fail hard from the first run rather than starting as a warning nobody
// reads.
//
// Usage: node scripts/audit/gate.mjs   (after query-inventory, route-reachability, replay-queries)

import fs from 'node:fs';

const OUT = '.e2e-audit';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(`${OUT}/${file}`, 'utf8'));
  } catch (e) {
    console.error(`cannot read ${OUT}/${file}: ${e.message}`);
    console.error('run query-inventory.mjs, route-reachability.mjs and replay-queries.mjs first.');
    process.exit(2);
  }
}

const { results } = readJson('query-results.json');
const { reachable } = readJson('route-reachability.json');

/** `src/pages/Foo.tsx:120` → the routes that can load that module. */
function routesFor(site) {
  const file = site.split(':')[0];
  return reachable[file] ?? [];
}

const FAILING = new Set(['BROKEN', 'MISSING', 'BAD_ARGS']);

const failures = [];
const unreachable = [];

for (const r of results) {
  if (!FAILING.has(r.verdict)) continue;
  const routes = [...new Set(r.sites.flatMap(routesFor))];
  (routes.length ? failures : unreachable).push({ ...r, routes });
}

function describe(r) {
  if (r.verdict === 'BAD_ARGS') return `called with [${r.badArgs}] but the signature is [${r.actualArgs}]`;
  if (r.verdict === 'MISSING') return 'no such function in the database';
  const first = r.perRole ? Object.values(r.perRole).find((p) => p.code) : null;
  return first ? `${first.code} ${first.message}` : 'invalid for every role';
}

function report(list, heading) {
  if (!list.length) return;
  console.error(`\n${heading}`);
  for (const r of list) {
    console.error(`  ${r.verdict}  ${r.table ?? r.name}`);
    console.error(`    ${describe(r)}`);
    if (r.select) console.error(`    select: ${r.select.replace(/\s+/g, ' ').slice(0, 160)}`);
    console.error(`    ${r.sites.slice(0, 3).join(', ')}${r.sites.length > 3 ? ` (+${r.sites.length - 3} more)` : ''}`);
    if (r.routes?.length) {
      console.error(`    reachable from: ${r.routes.slice(0, 5).join(', ')}${r.routes.length > 5 ? ` (+${r.routes.length - 5})` : ''}`);
    }
  }
}

// UNKNOWN means replay-queries could not sign in as admin, so RPC call sites
// were never judged. Passing the gate on the strength of checks that did not run
// is exactly the false confidence this exists to remove.
const unknown = results.filter((r) => r.verdict === 'UNKNOWN');
if (unknown.length) {
  console.error(`\n${unknown.length} RPC call site(s) could not be verified — no admin session.`);
  console.error('Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD so RPC names and arguments are checked.');
  process.exit(2);
}

report(unreachable, `${unreachable.length} invalid shape(s) in code no route can reach — not blocking:`);
report(failures, `${failures.length} invalid shape(s) REACHABLE FROM A ROUTE:`);

const checked = results.length;
if (failures.length) {
  console.error(
    `\nFAIL — ${failures.length} of ${checked} query shapes are invalid on a page a user can load.`,
  );
  console.error('Each one renders as an empty list rather than an error, so no test will catch it for you.');
  process.exit(1);
}

console.log(`\nOK — ${checked} query shapes checked against the live database, 0 broken on any reachable route.`);
if (unreachable.length) {
  console.log(`(${unreachable.length} invalid shape(s) sit in unroutable code — cleanup, not a blocker.)`);
}
