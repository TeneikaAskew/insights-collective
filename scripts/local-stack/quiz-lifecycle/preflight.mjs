#!/usr/bin/env node
// ABOUTME: Fail-closed preflight for the learner quiz lifecycle mode. Runs after the stack, functions and preview are up
// ABOUTME: and BEFORE any fixture write: config parses, API/DB/app are loopback-bound, no relay, score-quiz answers, app = dist.
//
// Usage: preflight.mjs [--dist <dir>] [--expect-ports <api>,<db>,<app>] [--deadline <seconds>]
//   Defaults: --dist dist, --expect-ports 54321,54322,8080, --deadline 120.
// Reads VITE_SUPABASE_URL, SUPABASE_DB_URL, E2E_BASE_URL, E2E_USE_RELAY, E2E_RELAY_PORT from the environment.
//
// Every check is fail-closed: a value that cannot be parsed, a probe that exits non-zero, a missing binary, a timeout
// or an unexpected exception is a FAIL, never "nothing found". Output names only the check, host:port and a reason:
// no environment value other than loopback host:port is printed, and child stderr is never echoed (byte count only).
// Exit 0 only when every check passes; 1 on any FAIL; 2 on a usage error.
//
// What this does NOT cover, by design (owned by the shared runner, see isolated-learner-fixture-plan-v2.md):
// the owned Docker network, container membership and published ports (stack-net.mjs / stack-checks.sh), and the
// edge-runtime container delta. Those run before this script in the integrated job.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const LOOPBACK_BIND = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\]|::1)$/;

let failed = 0;
const pass = (check, msg) => console.log(`PASS ${check}: ${msg}`);
const fail = (check, msg) => { failed += 1; console.log(`FAIL ${check}: ${msg}`); };
process.on('uncaughtException', (e) => {
  console.log(`FAIL preflight: unexpected ${e?.constructor?.name ?? 'error'} (detail withheld)`);
  process.exit(1);
});

function parseArgs(argv) {
  const out = { dist: 'dist', ports: [54321, 54322, 8080], deadline: 120 };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, v] = [argv[i], argv[i + 1]];
    if (k === '--dist' && v) { out.dist = v; i += 1; }
    else if (k === '--expect-ports' && v) {
      const p = v.split(',').map((x) => Number(x));
      if (p.length !== 3 || p.some((n) => !Number.isInteger(n) || n < 1 || n > 65535)) usage();
      out.ports = p; i += 1;
    } else if (k === '--deadline' && v && /^[0-9]{1,4}$/.test(v)) { out.deadline = Number(v); i += 1; }
    else usage();
  }
  return out;
}
function usage() { console.log('usage: preflight.mjs [--dist <dir>] [--expect-ports api,db,app] [--deadline seconds]'); process.exit(2); }

/** Runs a child with all output captured; a failed child is ALWAYS a failure. Returns stdout or null. */
function run(check, bin, args, label = `${path.basename(bin)} ${args[0] ?? ''}`) {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 << 20, timeout: 30000 });
  } catch (e) {
    const errBytes = Buffer.byteLength(String(e?.stderr ?? ''));
    fail(check, `${label} failed (status ${e?.status ?? 'none'}, signal ${e?.signal ?? 'none'}, stderr withheld: ${errBytes} bytes)`);
    return null;
  }
}

/** Parses a URL; returns {host, port} only when it is http(s) on a loopback host with an explicit or implied port. */
function loopbackHttp(check, name, value) {
  if (!value) { fail(check, `${name} is unset`); return null; }
  let u;
  try { u = new URL(value); } catch { fail(check, `${name} does not parse as a URL`); return null; }
  if (!['http:', 'https:'].includes(u.protocol)) { fail(check, `${name} is not http(s)`); return null; }
  if (u.username || u.password) { fail(check, `${name} carries userinfo`); return null; }
  if (!LOOPBACK_HOSTS.has(u.hostname)) { fail(check, `${name} host is not loopback`); return null; }
  const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
  return { host: u.hostname, port, origin: u.origin };
}

function dbPort(check, dsn) {
  if (!dsn) { fail(check, 'SUPABASE_DB_URL is unset'); return null; }
  if (run(check, process.execPath, [path.join(ROOT, 'scripts/local-db/assert-local-dsn.mjs'), dsn], 'assert-local-dsn') === null) return null;
  try { return Number(new URL(dsn).port || 5432); } catch { fail(check, 'SUPABASE_DB_URL does not parse'); return null; }
}

/** Host listeners from `ss -Htln`: [{addr, port}]. Unparseable lines are a failure, not skipped. */
function listeners(check) {
  const out = run(check, 'ss', ['-Htln']);
  if (out === null) return null;
  const rows = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.trim().split(/\s+/);
    const local = cols[3];
    const m = local && local.match(/^(.*):(\d{1,5})$/);
    if (!m) { fail(check, 'ss printed a listener line that does not parse'); return null; }
    rows.push({ addr: m[1].replace(/%.*$/, ''), port: Number(m[2]) });
  }
  return rows;
}

async function probeFunctions(check, origin, deadlineS) {
  const url = `${origin}/functions/v1/score-quiz`;
  const end = Date.now() + deadlineS * 1000;
  let last = 'no answer';
  while (Date.now() < end) {
    const left = Math.max(1000, Math.min(10000, end - Date.now()));
    try {
      const res = await fetch(url, { method: 'OPTIONS', signal: AbortSignal.timeout(left), redirect: 'manual' });
      const body = (await res.text()).trim();
      if (res.status === 200 && body === 'ok') return pass(check, `OPTIONS /functions/v1/score-quiz -> 200 "ok"`);
      last = `status ${res.status}`;
    } catch (e) {
      last = e?.name === 'TimeoutError' ? 'timeout' : 'connection failed';
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail(check, `score-quiz did not answer within ${deadlineS}s (${last})`);
}

async function probeApp(check, origin, distDir) {
  let expected;
  try { expected = readFileSync(path.join(distDir, 'index.html')); }
  catch { return fail(check, `${distDir}/index.html is not readable`); }
  try {
    const res = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10000), redirect: 'manual' });
    const got = Buffer.from(await res.arrayBuffer());
    if (res.status !== 200) return fail(check, `GET / -> ${res.status}`);
    if (!got.equals(expected)) return fail(check, 'served index.html differs from dist/index.html');
    return pass(check, 'GET / serves dist/index.html byte for byte');
  } catch (e) {
    return fail(check, e?.name === 'TimeoutError' ? 'GET / timed out' : 'GET / connection failed');
  }
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const [apiExpect, dbExpect, appExpect] = opt.ports;
  const env = process.env;

  // 1. Config parses, every target is loopback, exact ports.
  const api = loopbackHttp('config', 'VITE_SUPABASE_URL', env.VITE_SUPABASE_URL);
  const app = loopbackHttp('config', 'E2E_BASE_URL', env.E2E_BASE_URL);
  const db = dbPort('config', env.SUPABASE_DB_URL);
  if (api && api.port !== apiExpect) fail('config', `API port ${api.port} is not ${apiExpect}`);
  if (app && app.port !== appExpect) fail('config', `app port ${app.port} is not ${appExpect}`);
  if (db !== null && db !== dbExpect) fail('config', `DB port ${db} is not ${dbExpect}`);
  if (run('config', process.execPath, [path.join(ROOT, 'scripts/ci/check-local-target.mjs'), 'env'], 'check-local-target env') !== null) {
    pass('config', 'check-local-target env');
  }
  if (!failed) pass('config', `API ${api.host}:${api.port}, DB :${db}, app ${app.host}:${app.port}`);

  // 2. No relay: this mode reaches the stack directly over loopback.
  const relayFlag = env.E2E_USE_RELAY;
  if (relayFlag !== undefined && relayFlag !== '') fail('relay', 'E2E_USE_RELAY is set');
  const relayPortRaw = env.E2E_RELAY_PORT ?? '54399';
  const relayPort = /^[0-9]{1,5}$/.test(relayPortRaw) ? Number(relayPortRaw) : NaN;
  if (!Number.isInteger(relayPort)) fail('relay', 'E2E_RELAY_PORT does not parse');

  // 3. Effective listeners: required ports present and loopback-only; relay port absent.
  const ls = listeners('listeners');
  if (ls) {
    for (const [label, port] of [['API', apiExpect], ['DB', dbExpect], ['app', appExpect]]) {
      const on = ls.filter((l) => l.port === port);
      if (on.length === 0) fail('listeners', `${label} port ${port} has no listener`);
      else if (on.some((l) => !LOOPBACK_BIND.test(l.addr))) fail('listeners', `${label} port ${port} has a non-loopback listener`);
      else pass('listeners', `${label} port ${port} bound to loopback only (${on.length} listener${on.length === 1 ? '' : 's'})`);
    }
    if (Number.isInteger(relayPort)) {
      if (ls.some((l) => l.port === relayPort)) fail('relay', `relay port ${relayPort} is listening`);
      else if (relayFlag === undefined || relayFlag === '') pass('relay', `no relay (E2E_USE_RELAY unset, port ${relayPort} free)`);
    }
  }

  // 4. Functions through the API gateway; 5. app is this build.
  if (api) await probeFunctions('functions', api.origin, opt.deadline);
  if (app) await probeApp('app', app.origin, opt.dist);
  if (run('app', process.execPath, [path.join(ROOT, 'scripts/ci/check-local-target.mjs'), 'dist', opt.dist], 'check-local-target dist') !== null) {
    pass('app', 'check-local-target dist');
  }

  console.log(failed ? `== PREFLIGHT: ${failed} FAILED` : '== PREFLIGHT: ALL PASS');
  process.exit(failed ? 1 : 0);
}

await main();
