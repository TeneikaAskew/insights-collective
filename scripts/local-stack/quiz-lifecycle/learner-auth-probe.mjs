#!/usr/bin/env node
// ABOUTME: Pre-browser sign-in probe for the quiz-lifecycle synthetic learner: one GoTrue password grant against the strictly
// ABOUTME: loopback, guarded local API, BEFORE any browser case. Prints only fixed, allowlisted diagnostics; fails closed.
//
// Why: run 41353483766 failed all seven cases at session.fixture.ts:352 (still on /login after Sign In) and no step had
// ever proven that the local GoTrue accepts the SQL-seeded learner. This probe makes that a precondition with evidence.
//
// Inputs (environment only; nothing secret is ever in argv): VITE_SUPABASE_URL (API origin), VITE_SUPABASE_ANON_KEY,
// E2E_TEST_PASSWORD (the synthetic run password), E2E_BASE_URL (app origin, must differ from the API origin).
// Output: exactly one result line
//   auth-probe method=POST path=/auth/v1/token grant=password status=<3-digit|none> error_code=<allowlisted|other|none|transport|timeout|redirect|non-json> uid_present=<true|false> uid_match=<true|false>
// followed by PASS or FAIL. The response body, token, user id, headers and password are never printed or written.
// uid_match is a boolean comparison of the returned user id with the fixture's EXPECTED learner id; the id is not printed.
// Exit 0 only on HTTP 200 with a JSON access_token string and the EXPECTED user id (class=pass); 1 on an auth rejection
// (class=auth-rejected, see isAuthRejection); 3 on any other failure (class=diagnosis-only); 2 on refusal.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEARNER_EMAIL = 'qlc-learner@insightscollective.local';
// The fixture's fixed synthetic learner id (fixture.sql v_learner). Compared in memory only; never printed or written.
export const EXPECTED_LEARNER_UID = '9c000000-0000-4000-8000-0000000000a1';
export const PATH = '/auth/v1/token';
// GoTrue error_code values that are safe to print verbatim (fixed vocabulary; no user data).
export const ERROR_CODE_ALLOWLIST = Object.freeze([
  'invalid_credentials', 'email_not_confirmed', 'user_not_found', 'user_banned', 'validation_failed',
  'over_request_rate_limit', 'unexpected_failure', 'bad_json', 'email_address_invalid', 'request_timeout',
  'no_authorization', 'bad_jwt', 'not_admin', 'provider_disabled', 'email_provider_disabled',
]);
const LOOPBACK = new Set(['127.0.0.1', 'localhost']);

export class Refusal extends Error {}

/** Strict loopback origin with an explicit port and nothing else; throws Refusal with a fixed message. */
export function loopbackOrigin(value, name) {
  let u;
  try { u = new URL(value ?? ''); } catch { throw new Refusal(`${name} is not a URL`); }
  if (u.protocol !== 'http:') throw new Refusal(`${name} must be http on loopback`);
  if (!LOOPBACK.has(u.hostname)) throw new Refusal(`${name} must be 127.0.0.1 or localhost`);
  if (!/^[0-9]{1,5}$/.test(u.port)) throw new Refusal(`${name} must name an explicit port`);
  if (u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) throw new Refusal(`${name} must be a bare origin`);
  return u.origin;
}

/** Map a GoTrue JSON error to a printable code: allowlisted verbatim, anything else "other". */
export function classifyErrorCode(json) {
  const c = json && typeof json === 'object' ? (json.error_code ?? json.error) : undefined;
  if (typeof c !== 'string' || c === '') return 'none';
  return ERROR_CODE_ALLOWLIST.includes(c) ? c : 'other';
}

/**
 * The ONLY outcomes that may justify the automatic candidate: GoTrue answered and rejected the grant for this account,
 * either as a credential rejection (400 invalid_credentials) or as GoTrue's own failure reading the user row
 * (500 unexpected_failure). Transport, timeout, redirect, non-JSON, any other status or code, and a 200 for a
 * different user are diagnosis-only: they say nothing about the seed and must never trigger a password rewrite.
 */
export function isAuthRejection(status, code) {
  return (status === 400 && code === 'invalid_credentials') || (status === 500 && code === 'unexpected_failure');
}

/** Result line + verdict from a status and a parsed body; the body is inspected for shape only, never echoed. */
export function verdict(status, json, errorCodeOverride) {
  const uid = json && typeof json === 'object' && json.user && typeof json.user === 'object' && typeof json.user.id === 'string' && json.user.id.length > 0;
  const match = Boolean(uid && json.user.id === EXPECTED_LEARNER_UID);
  const token = json && typeof json === 'object' && typeof json.access_token === 'string' && json.access_token.length > 0;
  const code = errorCodeOverride ?? (status === 200 ? 'none' : classifyErrorCode(json));
  const ok = Boolean(status === 200 && token && match);
  const cls = ok ? 'pass' : isAuthRejection(status, code) ? 'auth-rejected' : 'diagnosis-only';
  const line = `auth-probe method=POST path=${PATH} grant=password status=${status ?? 'none'} error_code=${code} uid_present=${uid ? 'true' : 'false'} uid_match=${match ? 'true' : 'false'} class=${cls}`;
  return { line, ok, cls };
}

export async function probe({ api, anonKey, password, fetchImpl = fetch, timeoutMs = 15000 }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let res;
    try {
      res = await fetchImpl(`${api}${PATH}?grant_type=password`, {
        method: 'POST', redirect: 'manual', signal: ctl.signal,
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: LEARNER_EMAIL, password }),
      });
    } catch (e) {
      return verdict(null, null, ctl.signal.aborted ? 'timeout' : 'transport');
    }
    if (res.status >= 300 && res.status < 400) return verdict(res.status, null, 'redirect');
    let json = null;
    try { json = await res.json(); } catch { return verdict(res.status, null, 'non-json'); }
    return verdict(res.status, json);
  } finally {
    clearTimeout(t);
  }
}

/** GoTrue's own reported version from GET /auth/v1/health (read-only), reduced to a strict semver token or a fixed marker.
 *  Recorded because admin-API user construction with a caller-chosen id depends on the pinned GoTrue version. */
export function versionToken(json) {
  const v = json && typeof json === 'object' ? json.version : undefined;
  if (typeof v !== 'string' || v === '') return 'none';
  return /^v?[0-9]{1,3}\.[0-9]{1,4}\.[0-9]{1,4}$/.test(v) ? v : 'other';
}

export async function health({ api, anonKey, fetchImpl = fetch, timeoutMs = 10000 }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let res;
    try { res = await fetchImpl(`${api}/auth/v1/health`, { method: 'GET', redirect: 'manual', signal: ctl.signal, headers: { apikey: anonKey } }); }
    catch { return `gotrue-health method=GET path=/auth/v1/health status=none version=${ctl.signal.aborted ? 'timeout' : 'transport'}`; }
    let json = null;
    try { json = await res.json(); } catch { /* non-json */ }
    return `gotrue-health method=GET path=/auth/v1/health status=${res.status} version=${json ? versionToken(json) : 'non-json'}`;
  } finally { clearTimeout(t); }
}

async function main() {
  const mode = process.argv.slice(2);
  if (mode.length > 1 || (mode.length === 1 && mode[0] !== '--health')) throw new Refusal('unexpected argument');
  const api = loopbackOrigin(process.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
  const app = loopbackOrigin(process.env.E2E_BASE_URL, 'E2E_BASE_URL');
  if (api === app) throw new Refusal('API and app origins must differ');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (anonKey.length < 20) throw new Refusal('VITE_SUPABASE_ANON_KEY is missing');
  if (mode[0] === '--health') { console.log(await health({ api, anonKey })); process.exit(0); }
  const password = process.env.E2E_TEST_PASSWORD ?? '';
  if (!password) throw new Refusal('E2E_TEST_PASSWORD is empty');
  // The unchanged repository target guard, always (no bypass): a sign-in updates auth.users.last_sign_in_at.
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/e2e/assert-safe-target.mjs'), '--mutating'], { stdio: 'ignore' });
  } catch { throw new Refusal('target guard failed'); }
  const { line, ok, cls } = await probe({ api, anonKey, password });
  const phase = /^[a-z][a-z0-9-]{0,23}$/.test(process.env.LQ_AUTH_PROBE_PHASE ?? '') ? process.env.LQ_AUTH_PROBE_PHASE : 'unlabelled';
  console.log(`${line} phase=${phase}`);
  console.log(ok ? 'PASS auth-probe: the seeded learner signs in by password grant on the local API' : `FAIL auth-probe (${cls}): the seeded learner did not sign in (see the fixed diagnostics above)`);
  process.exit(ok ? 0 : cls === 'auth-rejected' ? 1 : 3);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.log(e instanceof Refusal ? `REFUSED auth-probe: ${e.message}` : 'FAIL auth-probe: unexpected error (detail withheld)');
    process.exit(e instanceof Refusal ? 2 : 1);
  });
}
