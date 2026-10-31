#!/usr/bin/env node
// ABOUTME: Fail-closed, allow-list guard for anything that writes to a database during E2E
// ABOUTME: (seed, teardown, the mutating suite). Only loopback or an explicitly named isolated
// ABOUTME: Supabase project may be mutated; production and anything ambiguous are refused.
//
// Why this exists
// ---------------
// Every E2E entry point in this repo defaults to the live project when its variable is unset
// (`VITE_SUPABASE_URL || 'https://<prod-ref>.supabase.co'` appears in global-setup, the relay
// and most journey specs), and the CI seed step ran `psql "$SUPABASE_DB_URL" -f seed.sql` with
// no check of where that URL pointed. "I forgot to set the variable" and "I pointed it at
// production" were indistinguishable, and both mutated real data.
//
// Rules (mutating mode)
// ---------------------
// 1. Every target variable must be set. Unset means "the code's hard-coded production default".
// 2. A target is accepted only if it is (a) loopback — hostname exactly `localhost`, `127.0.0.1`
//    or `::1` — or (b) a Supabase host `<ref>.supabase.co` / `db.<ref>.supabase.co` whose ref
//    equals E2E_ISOLATED_TARGET_REF, which must itself differ from the production ref.
// 3. Everything else is refused: the production ref anywhere in any target (host, userinfo,
//    path, query), unknown hosts, look-alike hosts (`<prod>.supabase.co.attacker.tld`,
//    `localhost.attacker.tld`), pooler hosts whose user is not the isolated ref, IP literals
//    other than 127.0.0.1, percent-encoded or otherwise unparseable values, and any value that
//    merely *contains* the production ref as a substring.
// 4. There is NO environment variable that unlocks production. A deliberate production run is a
//    human decision made outside this script: a workflow_dispatch input the operator types, which
//    the workflow passes through as E2E_ALLOW_PRODUCTION_TARGET. The value must equal the
//    production ref exactly, and the CLI prints that it was used.
// 5. `--read-only` only reports the resolved targets; it never blocks.
// Secrets are never printed: hosts are shown, passwords and keys are masked.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_TOML = path.resolve(HERE, '../../supabase/config.toml');
const TARGET_VARS = ['VITE_SUPABASE_URL', 'SUPABASE_DB_URL', 'E2E_RELAY_TARGET'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function productionRef() {
  const toml = readFileSync(CONFIG_TOML, 'utf8');
  const m = toml.match(/^\s*project_id\s*=\s*"([a-z0-9]+)"/m);
  if (!m) throw new Error(`could not read project_id from ${CONFIG_TOML}`);
  return m[1];
}

/**
 * Classify one target value.
 * @returns {{ kind: 'unset'|'unparseable'|'loopback'|'supabase'|'pooler'|'other', ref?: string, host?: string, shown: string }}
 */
export function classifyTarget(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { kind: 'unset', shown: '(unset → code default = production)' };
  }
  let u;
  try {
    u = new URL(String(value));
  } catch {
    return { kind: 'unparseable', shown: '(unparseable value, not shown)' };
  }
  // Reject anything with percent-escapes or whitespace in host/userinfo: these are how a value
  // that reads as one host resolves as another.
  if (/%|\s/.test(u.hostname) || /%/.test(u.username)) {
    return { kind: 'unparseable', shown: '(encoded host or user, not shown)' };
  }
  const host = u.hostname.toLowerCase();
  const shown = `${u.protocol}//${u.username ? u.username + '@' : ''}${host}${u.port ? ':' + u.port : ''}${u.pathname}`;
  if (LOOPBACK_HOSTS.has(host)) return { kind: 'loopback', host, shown };
  let m = host.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.(?:co|in|red)$/);
  if (m) return { kind: 'supabase', ref: m[1], host, shown };
  if (/\.pooler\.supabase\.com$/.test(host)) {
    const pm = u.username.match(/^postgres\.([a-z0-9]{15,})$/);
    return { kind: 'pooler', ref: pm ? pm[1] : undefined, host, shown };
  }
  return { kind: 'other', host, shown };
}

/**
 * @param {{ mutating: boolean, env?: NodeJS.ProcessEnv, prod?: string }} opts
 * @returns {{ ok: boolean, prod: string, isolatedRef?: string, targets: Array<{name:string, kind:string, ref?:string, shown:string, verdict:'ok'|'refused', why?:string}>, reason?: string, productionAllowed?: boolean }}
 */
export function assessTarget({ mutating, env = process.env, prod = productionRef() }) {
  const isolatedRef = (env.E2E_ISOLATED_TARGET_REF || '').trim() || undefined;
  const targets = TARGET_VARS.map((name) => {
    const raw = env[name];
    const c = classifyTarget(raw);
    const t = { name, kind: c.kind, ref: c.ref, shown: c.shown, verdict: 'refused', why: undefined };
    const containsProd = raw ? String(raw).toLowerCase().includes(prod.toLowerCase()) : false;
    if (containsProd) { t.why = 'contains the production project ref'; return t; }
    switch (c.kind) {
      case 'unset': t.why = 'unset, so the code default (production) would be used'; break;
      case 'unparseable': t.why = 'not a parseable, unencoded URL'; break;
      case 'loopback': t.verdict = 'ok'; break;
      case 'supabase':
      case 'pooler':
        if (!isolatedRef) t.why = 'Supabase host but E2E_ISOLATED_TARGET_REF is not set';
        else if (isolatedRef === prod) t.why = 'E2E_ISOLATED_TARGET_REF equals the production ref';
        else if (c.ref !== isolatedRef) t.why = `host ref ${c.ref ?? '(none)'} does not equal E2E_ISOLATED_TARGET_REF`;
        else t.verdict = 'ok';
        break;
      default: t.why = 'host is neither loopback nor the isolated Supabase project'; break;
    }
    return t;
  });
  if (env.VITE_SUPABASE_PROJECT_ID) {
    const pid = String(env.VITE_SUPABASE_PROJECT_ID).trim();
    targets.push({
      name: 'VITE_SUPABASE_PROJECT_ID', kind: 'ref', ref: pid, shown: pid,
      verdict: pid === prod ? 'refused' : (isolatedRef && pid === isolatedRef) || !isolatedRef ? 'ok' : 'refused',
      why: pid === prod ? 'is the production project ref' : isolatedRef && pid !== isolatedRef ? 'does not equal E2E_ISOLATED_TARGET_REF' : undefined,
    });
  }
  if (!mutating) return { ok: true, prod, isolatedRef, targets };
  const refused = targets.filter((t) => t.verdict === 'refused');
  if (refused.length === 0) return { ok: true, prod, isolatedRef, targets };
  // The only path to production: an operator-typed value equal to the ref. Never set by a
  // workflow expression; see .github/workflows/e2e.yml.
  if (env.E2E_ALLOW_PRODUCTION_TARGET === prod) {
    return { ok: true, prod, isolatedRef, targets, productionAllowed: true,
      reason: `PRODUCTION MUTATION EXPLICITLY ALLOWED by E2E_ALLOW_PRODUCTION_TARGET=${prod} (operator decision)` };
  }
  return {
    ok: false, prod, isolatedRef, targets,
    reason: 'refusing to mutate: ' + refused.map((t) => `${t.name}=${t.shown} (${t.why})`).join('; ') +
      '. Point every target at loopback or at the isolated project named by E2E_ISOLATED_TARGET_REF.',
  };
}

export function assertSafeTarget(opts) {
  const r = assessTarget(opts);
  if (!r.ok) throw new Error(`[assert-safe-target] ${r.reason}`);
  return r;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mutating = process.argv.includes('--mutating');
  const r = assessTarget({ mutating });
  for (const t of r.targets) console.log(`  ${t.name.padEnd(26)} ${t.shown}  → ${t.kind}${t.ref ? ':' + t.ref : ''} ${mutating ? (t.verdict === 'ok' ? 'OK' : 'REFUSED: ' + t.why) : ''}`);
  if (r.reason) console.log(`  ${r.reason}`);
  if (!r.ok) {
    console.error('::error title=E2E target refused::' + r.reason);
    process.exit(3);
  }
  console.log(mutating ? 'OK — mutating E2E target accepted.' : 'OK — read-only mode, no target restriction applied.');
}
