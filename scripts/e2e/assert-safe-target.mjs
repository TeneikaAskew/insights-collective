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
// 4. There is NO opt-in. Nothing in the environment, in a workflow input or on the command line can
//    make this script accept the production project for a mutating run. Mutating tests against
//    production are not a supported operation of this repository (handoff: DOT_START_HERE line 29,
//    master plan lines 36, 108, 149, 490, 513).
// 5. `--read-only` only reports the resolved targets; it never blocks.
// Secrets are never printed: hosts are shown, passwords and keys are masked.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluateLibpqDsn } from '../local-db/assert-local-dsn.mjs';

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
  // HTTP(S) API targets only here; libpq DSNs are evaluated by evaluateLibpqDsn, which understands
  // multihost, hostaddr, query overrides and service files that URL() cannot see.
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'unparseable', shown: '(non-http scheme for an API target)' };
  if (u.username || u.password) return { kind: 'unparseable', shown: '(userinfo in an API target is refused)' };
  if (u.search || u.hash) return { kind: 'unparseable', shown: '(query or fragment in an API target is refused)' };
  if (/%|\s/.test(u.hostname)) return { kind: 'unparseable', shown: '(encoded host, not shown)' };
  const host = u.hostname.toLowerCase();
  const shown = `${u.protocol}//${host}${u.port ? ':' + u.port : ''}${u.pathname}`;
  if (LOOPBACK_HOSTS.has(host)) return { kind: 'loopback', host, shown };
  const m = host.match(/^([a-z0-9]{15,})\.supabase\.(?:co|in|red)$/);
  if (m) return { kind: 'supabase', ref: m[1], host, shown };
  return { kind: 'other', host, shown };
}

/**
 * @param {{ mutating: boolean, env?: NodeJS.ProcessEnv, prod?: string }} opts
 * @returns {{ ok: boolean, prod: string, isolatedRef?: string, targets: Array<{name:string, kind:string, ref?:string, shown:string, verdict:'ok'|'refused', why?:string}>, reason?: string }}
 */
export function assessTarget({ mutating, env = process.env, prod = productionRef() }) {
  const isolatedRef = (env.E2E_ISOLATED_TARGET_REF || '').trim() || undefined;
  const targets = TARGET_VARS.map((name) => {
    const raw = env[name];
    if (name === 'SUPABASE_DB_URL') {
      // libpq DSN: evaluated by the strict parser (effective endpoint, not the URL host).
      if (raw === undefined || String(raw).trim() === '') {
        return { name, kind: 'unset', shown: '(unset → code default = production)', verdict: 'refused', why: 'unset, so the code default (production) would be used' };
      }
      const r = evaluateLibpqDsn(String(raw), { env, isolatedRef, productionRef: prod });
      if (!r.ok) return { name, kind: 'libpq', shown: '(libpq DSN, not shown)', verdict: 'refused', why: r.reason };
      return { name, kind: 'libpq', ref: r.target.startsWith('isolated:') ? isolatedRef : undefined, shown: r.redacted, verdict: 'ok' };
    }
    const c = classifyTarget(raw);
    const t = { name, kind: c.kind, ref: c.ref, shown: c.shown, verdict: 'refused', why: undefined };
    const containsProd = raw ? String(raw).toLowerCase().includes(prod.toLowerCase()) : false;
    if (containsProd) { t.why = 'contains the production project ref'; return t; }
    switch (c.kind) {
      case 'unset': t.why = 'unset, so the code default (production) would be used'; break;
      case 'unparseable': t.why = 'not a parseable, plain http(s) URL (no userinfo, query or fragment)'; break;
      case 'loopback': t.verdict = 'ok'; break;
      case 'supabase':
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
