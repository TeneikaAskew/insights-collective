// ABOUTME: Strict local-only binding for the gradebook real-role run, checked when the config LOADS (before any setup,
// ABOUTME: sign-in or browser): API, DB, app and any relay must be explicit loopback http(s)-free origins; no hosted
// ABOUTME: isolated project, no production override, no relay mode. Throws a fixed message; never prints a value.
import { assertLocalDsn } from '../../scripts/local-db/assert-local-dsn.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** An exact loopback http origin with an explicit port and nothing else (no userinfo, path, query or fragment). */
/** @param {string|undefined} raw @param {string} what @returns {URL} */
export function strictLoopbackOrigin(raw, what) {
  let u;
  try { u = new URL(String(raw ?? '')); } catch { throw new Error(`gradebook-roles refused: ${what} is not a URL`); }
  const ok = u.protocol === 'http:' && LOOPBACK.has(u.hostname) && /^\d+$/.test(u.port) && !u.username && !u.password
    && (u.pathname === '/' || u.pathname === '') && !u.search && !u.hash
    && (String(raw) === u.origin || String(raw) === `${u.origin}/`);
  if (!ok) throw new Error(`gradebook-roles refused: ${what} must be exactly http://<loopback>:<port>`);
  return u;
}

/** @returns {{ api: URL, app: URL, anonKey: string }} */
export function assertStrictLocalBinding(env = process.env, root = process.cwd()) {
  const api = strictLoopbackOrigin(env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
  const app = strictLoopbackOrigin(env.E2E_BASE_URL, 'E2E_BASE_URL');
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!anonKey) throw new Error('gradebook-roles refused: no local anon key');
  if (env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_PUBLISHABLE_KEY && env.VITE_SUPABASE_ANON_KEY !== env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('gradebook-roles refused: two different anon keys are configured');
  }
  if ((env.E2E_ISOLATED_TARGET_REF ?? '') !== '') throw new Error('gradebook-roles refused: a hosted isolated project is configured (E2E_ISOLATED_TARGET_REF)');
  if ((env.E2E_ALLOW_PRODUCTION_TARGET ?? '') !== '') throw new Error('gradebook-roles refused: E2E_ALLOW_PRODUCTION_TARGET is set');
  if (env.E2E_USE_RELAY === '1') throw new Error('gradebook-roles refused: relay mode reaches a hosted project');
  if (env.E2E_RELAY_TARGET && strictLoopbackOrigin(env.E2E_RELAY_TARGET, 'E2E_RELAY_TARGET').origin !== api.origin) {
    throw new Error('gradebook-roles refused: E2E_RELAY_TARGET differs from the local API origin');
  }
  // The DB is checked IN-PROCESS by the repository's own loopback-DSN guard (no network, parse only). The DSN is never
  // put on a command line, and the guard's reason text is not shown.
  let dsnOk = false;
  try { dsnOk = assertLocalDsn(String(env.SUPABASE_DB_URL ?? ''), env).ok === true; } catch { dsnOk = false; }
  if (!dsnOk) throw new Error('gradebook-roles refused: SUPABASE_DB_URL is not a loopback DSN');
  return { api, app, anonKey };
}

// CLI: `node e2e/gradebook-roles/local-binding.mjs` (run.sh calls it before the seed). Prints only PASS or the refusal.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { assertStrictLocalBinding(); console.log('PASS gradebook-roles local binding: API, app, relay and DB are loopback only'); }
  catch (e) { console.log(String(e && e.message || 'gradebook-roles refused')); process.exit(3); }
}
