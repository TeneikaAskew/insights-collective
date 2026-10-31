#!/usr/bin/env node
// ABOUTME: Fail-closed guard for anything that writes to a Supabase project during E2E
// ABOUTME: (seed, teardown, the mutating suite): refuses the production project unless an
// ABOUTME: explicit, exact opt-in names it. Importable from global-setup and runnable from CI.
//
// Why this exists
// ---------------
// Every E2E entry point in this repo defaults to the live project when its variable is unset
// (`VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co'` appears in global-setup,
// the relay, and most journey specs), and the CI seed step runs `psql "$SUPABASE_DB_URL" -f
// e2e/fixtures/seed.sql` with no check of where that URL points. So "I forgot to set the
// variable" and "I pointed it at production" are indistinguishable, and both mutate real data.
// The handoff forbids running seed/teardown against production. This makes that the default.
//
// Rules
// -----
// * Production is identified by its project ref (from supabase/config.toml). Any configured
//   URL whose host or credentials resolve to that ref counts, and so does an UNSET variable,
//   because unset means the code's hard-coded production default.
// * `--mutating` (seed, teardown, full suite) requires E2E_ALLOW_PRODUCTION_TARGET to equal
//   the production ref exactly. Nothing else — not draft status, not a branch name — unlocks it.
// * `--read-only` only reports the resolved target; it never blocks.
// * Secrets are never printed: hosts are shown, passwords and keys are masked.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_TOML = path.resolve(HERE, '../../supabase/config.toml');

export function productionRef() {
  const toml = readFileSync(CONFIG_TOML, 'utf8');
  const m = toml.match(/^\s*project_id\s*=\s*"([a-z0-9]+)"/m);
  if (!m) throw new Error(`could not read project_id from ${CONFIG_TOML}`);
  return m[1];
}

/** Project ref implied by a Supabase URL / PostgREST base / libpq URI, or null if unknown. */
export function refFromUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    let m = host.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.(?:co|in|red)$/);
    if (m) return m[1];
    // Supavisor pooler: host aws-0-<region>.pooler.supabase.com, user postgres.<ref>
    if (/\.pooler\.supabase\.com$/.test(host)) {
      m = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]{15,})$/);
      if (m) return m[1];
      return 'pooler:unknown-ref';
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return 'local';
    return `host:${host}`;
  } catch {
    return 'unparseable';
  }
}

function describe(value) {
  if (!value) return '(unset → code default = production)';
  try {
    const u = new URL(value);
    const user = u.username ? `${u.username}@` : '';
    return `${u.protocol}//${user}${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(unparseable value, not shown)';
  }
}

/**
 * @param {{ mutating: boolean, env?: NodeJS.ProcessEnv }} opts
 * @returns {{ ok: boolean, prod: string, targets: Array<{name:string, ref:string|null, shown:string}>, reason?: string }}
 */
export function assessTarget({ mutating, env = process.env }) {
  const prod = productionRef();
  const names = ['VITE_SUPABASE_URL', 'SUPABASE_DB_URL', 'E2E_RELAY_TARGET'];
  const targets = names.map((name) => ({ name, ref: refFromUrl(env[name]), shown: describe(env[name]) }));
  if (env.VITE_SUPABASE_PROJECT_ID) {
    targets.push({ name: 'VITE_SUPABASE_PROJECT_ID', ref: env.VITE_SUPABASE_PROJECT_ID, shown: env.VITE_SUPABASE_PROJECT_ID });
  }
  const pointsAtProd = targets.filter((t) => t.ref === null || t.ref === prod || t.ref === 'pooler:unknown-ref' || t.ref === 'unparseable');
  if (!mutating) return { ok: true, prod, targets };
  if (pointsAtProd.length === 0) return { ok: true, prod, targets };
  if (env.E2E_ALLOW_PRODUCTION_TARGET === prod) {
    return { ok: true, prod, targets, reason: `production explicitly allowed by E2E_ALLOW_PRODUCTION_TARGET=${prod}` };
  }
  return {
    ok: false,
    prod,
    targets,
    reason:
      `refusing to mutate: ${pointsAtProd.map((t) => `${t.name}=${t.shown}`).join('; ')} resolve to the production project ` +
      `(${prod}) or are unset/unknown. Point every target at an isolated database, or set ` +
      `E2E_ALLOW_PRODUCTION_TARGET=${prod} to state explicitly that production mutation is intended.`,
  };
}

/** Throws unless the configured targets are safe for the requested mode. */
export function assertSafeTarget(opts) {
  const r = assessTarget(opts);
  if (!r.ok) throw new Error(`[assert-safe-target] ${r.reason}`);
  return r;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mutating = process.argv.includes('--mutating');
  const r = assessTarget({ mutating });
  for (const t of r.targets) console.log(`  ${t.name.padEnd(26)} ${t.shown}  → ${t.ref ?? 'production (default)'}`);
  if (r.reason) console.log(`  ${r.reason}`);
  if (!r.ok) {
    console.error('::error title=E2E target is production::' + r.reason);
    process.exit(3);
  }
  console.log(mutating ? 'OK — mutating E2E target accepted.' : 'OK — read-only mode, no target restriction applied.');
}
