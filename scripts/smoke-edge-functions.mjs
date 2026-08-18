#!/usr/bin/env node
// ABOUTME: Checks that every Edge Function in the repo actually boots in the deployed project.
// ABOUTME: Side-effect free — sends a CORS preflight, never invokes handler logic.
//
// WHY THIS EXISTS
//
// A function can be deployed, listed as ACTIVE, and still be broken in a way
// nothing reports. `_shared/utils.ts` carries a note about exactly this:
// auth-callback imported `parseQueryParams` from it, the helper was never
// exported, and the function failed to boot with a module-resolution error on
// every cold start. Deployment succeeds because deployment does not run the
// code. The failure only appears when a user hits it.
//
// A boot failure is distinguishable from ordinary rejection: the worker never
// starts, so the platform answers with BOOT_ERROR or a 503 rather than the
// function's own response. Any structured answer at all — 200, 400, 401 — means
// the module graph resolved and the handler ran.
//
// WHY PREFLIGHT AND NOT POST
//
// A preflight exercises booting and nothing else, so this stays safe to run
// against production without needing to know what each handler does.
//
// The original version of this comment claimed a POST would have sent real
// email. That was wrong, and worth correcting rather than quietly deleting:
// the functions that spend Resend quota or trigger a refresh are gated on a
// shared secret held in the database vault — send-notification-digest and
// send-notification-email on `x-notify-secret`, coursera-refresh on
// `x-refresh-secret` — and answer 401 without it. notify-course-announcement
// sends nothing at all; DB triggers raise those emails, it only reports counts.
// A blind POST would have been rejected, not destructive.
//
// The preflight is still the right probe, for the weaker but real reason: it
// does not depend on having read the auth posture of all 34 functions first.
//
//   node scripts/smoke-edge-functions.mjs
//
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the environment.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!BASE || !ANON) {
  console.error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set.');
  process.exit(1);
}

const FUNCTIONS_DIR = 'supabase/functions';

// `_shared` is a module directory, not a function.
const slugs = readdirSync(FUNCTIONS_DIR)
  .filter((name) => !name.startsWith('_'))
  .filter((name) => statSync(join(FUNCTIONS_DIR, name)).isDirectory())
  .sort();

// The platform answers for a worker that never started; the function itself
// cannot produce these, so they are unambiguous.
function classify(status, body) {
  if (status === 404) return { ok: false, label: 'NOT DEPLOYED' };
  if (status === 503 || status === 546) return { ok: false, label: `BOOT FAILURE (${status})` };
  if (/BOOT_ERROR|WORKER_LIMIT|worker.*boot|module.*not found/i.test(body)) {
    return { ok: false, label: 'BOOT FAILURE' };
  }
  return { ok: true, label: `boots (${status})` };
}

const results = [];

for (const slug of slugs) {
  let status = 0;
  let body = '';
  try {
    const resp = await fetch(`${BASE}/functions/v1/${slug}`, {
      method: 'OPTIONS',
      headers: {
        apikey: ANON,
        Origin: 'https://example.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
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

const broken = results.filter((r) => !r.ok);
console.log(`\n${results.length - broken.length}/${results.length} functions boot`);

if (broken.length > 0) {
  console.error('\nNot booting:');
  for (const r of broken) console.error(`  ${r.slug} — ${r.label}`);
  process.exit(1);
}
