#!/usr/bin/env node
// ABOUTME: Checks that every Edge Function's handler actually RUNS for a signed-in
// ABOUTME: caller — not merely that the worker boots.
//
// WHY THIS EXISTS ALONGSIDE smoke-edge-functions.mjs
//
// The preflight script proves the module graph resolves. That is a real check —
// auth-callback once failed to boot on a missing export — but it stops at the
// door. It cannot see a handler that boots and then throws on its first line, an
// auth helper that 500s instead of 401ing, or a function whose runtime config is
// missing. This one signs in and POSTs, so the handler executes.
//
// WHY AS A MEMBER, AND WHY AN EMPTY BODY
//
// Least privilege, deliberately. Every admin-only function here gates on role
// BEFORE doing any work — the scrapers and both Twitter functions call
// requireAdminOrService first — so a member token reaches the authorization
// check and stops. That is the behaviour worth exercising, and it cannot scrape,
// spend an API quota, or write a row.
//
// The empty body plays the same role: it is the input every handler should
// reject, so a well-built function answers 400 and a broken one shows itself.
//
// WHAT COUNTS AS PASSING
//
// Any structured HTTP answer means the handler ran and made a decision:
//
//   400 422  input validation rejected the empty body   <- the common case
//   401 403  auth or role check rejected a member       <- admin-gated functions
//   404 409  handler ran and resolved nothing
//   429      rate limited; the handler still ran
//   2xx      handler ran to completion
//
// A 500 is a FAILURE here, and that is the point: an unhandled empty body is a
// defect, not a pass. 503/546/BOOT_ERROR remain boot failures.
//
// SIDE EFFECTS — MEASURED, NOT ASSUMED
//
// Four member-reachable functions can write: portfolio-ideas, messages-helper,
// bls-wages and generate-career-action-plan. Row counts across all nine of their
// target tables were captured either side of a full run rather than reasoned
// about, and that mattered: three were clean, and portfolio-ideas was not. It
// creates a portfolio row from an empty body, so `portfolio` went 15 -> 16.
//
// It is skipped below for that reason. Skipping it is a real loss of coverage,
// so it is named in the output rather than quietly dropped — a run that says
// 33/33 while silently ignoring one function is worse than no check at all.
//
// If you change any writer, re-measure. Do not infer from a validation guard
// that nothing is written; portfolio-ideas has one and writes anyway.
//
//   node scripts/smoke-edge-functions-authed.mjs
//
// Needs VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_MEMBER_PASSWORD.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.E2E_MEMBER_EMAIL ?? 'e2e-member@insightscollective.org';
const PASSWORD = process.env.E2E_MEMBER_PASSWORD;

if (!BASE || !ANON || !PASSWORD) {
  console.error('VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and E2E_MEMBER_PASSWORD must be set.');
  process.exit(1);
}

const FUNCTIONS_DIR = 'supabase/functions';

// Measured to write a row from an empty body. See SIDE EFFECTS above.
const SKIP = new Map([
  ['portfolio-ideas', 'creates a portfolio row from an empty body'],
]);

const all = readdirSync(FUNCTIONS_DIR)
  .filter((name) => !name.startsWith('_'))
  .filter((name) => statSync(join(FUNCTIONS_DIR, name)).isDirectory())
  .sort();
const slugs = all.filter((s) => !SKIP.has(s));

const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = (await res.json()).access_token;
if (!token) {
  console.error(`Could not sign in as ${EMAIL}.`);
  process.exit(1);
}

// The platform answers for a worker that never started; a handler cannot
// produce these, so they are unambiguous.
function classify(status, body) {
  if (status === 404 && /NOT_FOUND|Function not found/i.test(body)) {
    return { ok: false, label: 'NOT DEPLOYED' };
  }
  if (status === 503 || status === 546) return { ok: false, label: `BOOT FAILURE (${status})` };
  if (/BOOT_ERROR|WORKER_LIMIT|worker.*boot|module.*not found/i.test(body)) {
    return { ok: false, label: 'BOOT FAILURE' };
  }
  if (status >= 500) {
    // An unhandled empty body: the handler ran, then crashed rather than
    // answering. That is the class of bug this script exists to surface.
    const detail = body.slice(0, 90).replace(/\s+/g, ' ');
    return { ok: false, label: `UNHANDLED (${status}) ${detail}` };
  }
  return { ok: true, label: `handler ran (${status})` };
}

const results = [];
for (const slug of slugs) {
  let status = 0;
  let body = '';
  try {
    const resp = await fetch(`${BASE}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    status = resp.status;
    body = await resp.text();
  } catch (e) {
    results.push({ slug, ok: false, label: `unreachable — ${e.message}` });
    continue;
  }
  const { ok, label } = classify(status, body);
  results.push({ slug, ok, label });
}

for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.slug.padEnd(30)} ${r.label}`);
}

for (const [slug, why] of SKIP) {
  console.log(`  - ${slug.padEnd(30)} SKIPPED — ${why}`);
}

const broken = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - broken.length}/${results.length} handlers ran` +
    (SKIP.size ? `, ${SKIP.size} skipped of ${all.length} total` : ''),
);

if (broken.length > 0) {
  console.error('\nNot answering:');
  for (const r of broken) console.error(`  ${r.slug} — ${r.label}`);
  process.exit(1);
}
