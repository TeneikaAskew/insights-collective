// ABOUTME: Supervisor INSIDE the sealed E1 lane container (its Cmd). umask 077 first, then the enforcing AppArmor gate, the closure
// ABOUTME: check, three in-container forwarders, bridge reach, the session-parent and read-only pairing rechecks, run.sh setup, E1, cleanup.
//
// Every step appends one fixed `LANE ...` line to <LE_OUT_DIR>/lane.txt (the closed grammar in contract.mjs parseLaneOut). Child
// output is withheld, except run.sh setup's, which is piped through stack-checks.sh redact into <LE_OUT_DIR>/setup.txt. The
// Playwright exit status (CONTENT, digits only) goes to <LE_OUT_DIR>/pw-exit, written only when E1 ran. No retry anywhere.
// After E1 the WORKER-side AppArmor evidence (pre-launch and post-run labels of the browser worker and the owned browser,
// egress-test.ts laneAppArmorGate) is read from the JSON report's `lane-apparmor` annotation (readReportBounded: O_NOFOLLOW,
// owner/mode/links/size checked on the fd before a bounded read; budgeted walk where exhaustion is INVALID) and written as one
// closed `LANE E1 APPARMOR ...` line; MISSING, INVALID or any non-ENFORCE code fails the lane. E1 diagnostics r1 adds three
// DIAGNOSTIC lines from the same result and the same single read (LANE E1 RESULT, REPORT, REPORTED_ERROR; contract.mjs);
// nothing decides on them, and they add no writer and no capture (runChild is unchanged). E1 diagnostics r2 adds three more
// DIAGNOSTIC lines from that same read (POST_OBSERVED, ATTEMPT_STATUS, FAILED_STEP); nothing decides on them either. Every Node child (run.sh's bare `node`,
// the Playwright runner and its workers, pgconn) is LANE_NODE, the job's Node copied into the image (closure-checked).
// Listeners (disclosed, inside the container's own network namespace, which has only loopback): the three forwarders on
// 127.0.0.1:<api|db|app port>, and Playwright's launchServer endpoint on 127.0.0.1 (egress-test.ts). No other listener.
// Writers (disclosed): lane.txt, setup.txt, pw-exit (one wx 0600 descriptor each, umask 077), one private passfile dir under
// /tmp (container tmpfs) for the read-only pairing DB read, removed after use. run.sh writes its own session/evidence dirs.
process.umask(0o077);

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { apparmorGate } from '../le-iso/expect.mjs';
import { ENV_KEYS, LANE_APPARMOR, LANE_NODE, PSQL_REAL, PG_MAJOR, TOOLS, laneEnv, lanePaths, lanePorts, workerAppArmorEvidence, e1ResultClass, reportedErrorCode, postObservedEvidence, attemptStatusToken, failedStepToken } from './contract.mjs';
import { E1_IDENTITY, testsOf } from '../le-e1-summary.mjs';
import { failedStep } from '../../../e2e/lesson-editor/step-codes.mjs';
import { PAIRING_COURSE_ID, PAIRING_PREFIX, assertLivePairing, assertPairingProof } from '../../../e2e/gradebook-roles/journey/pairing-proof.mjs';

/** A bounded child: SIGTERM at timeout, SIGKILL after grace, resolves within timeout + 2*grace even if never reaped. */
export function runChild(spawnFn, bin, args, { env, cwd, stdout = 'ignore', timeout = 60000, grace = 2000, capture = false }) {
  return new Promise((resolve) => {
    let child, done = false;
    const chunks = [];
    const timers = [];
    const finish = (r) => { if (!done) { done = true; for (const t of timers) clearTimeout(t); resolve(r); } };
    try { child = spawnFn(bin, args, { env, cwd, stdio: ['ignore', capture ? 'pipe' : stdout, 'ignore'] }); } catch { finish({ code: null, out: '' }); return; }
    child.on('error', () => finish({ code: null, out: '' }));
    if (capture) child.stdout?.on('data', (b) => { if (chunks.reduce((n, c) => n + c.length, 0) < 65536) chunks.push(b); });
    child.on('close', (code) => finish({ code, out: Buffer.concat(chunks).toString('utf8') }));
    timers.push(setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* gone */ }
      timers.push(setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } timers.push(setTimeout(() => finish({ code: null, out: '', unreaped: true }), grace)); }, grace));
    }, timeout));
  });
}

export const REPORT_MAX = 8 * 1024 * 1024;
export const REPORT_MAX_DEPTH = 64;
export const REPORT_MAX_NODES = 200_000;

/**
 * Genuinely bounded, secure read of the lane's own report. One open with O_NOFOLLOW|O_NONBLOCK (a symlink fails, a FIFO
 * cannot block), then on that SAME fd: a regular file, owned by `uid`, no group/other permission bits (written under umask
 * 077), one link, size <= max, and /proc/self/fd/<fd> naming exactly `p` (no symlinked directory component). Only then are
 * at most size+1 bytes read; more than `size` bytes (grown since fstat) is refused. The fd is always closed.
 * Result: { status: 'ok', text } | { status: 'missing' } (ENOENT only) | { status: 'refused', why }.
 */
export function readReportBounded(fsx, p, uid, max = REPORT_MAX) {
  let fd;
  try { fd = fsx.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK); } catch (e) {
    return e?.code === 'ENOENT' ? { status: 'missing' } : { status: 'refused', why: 'open' };
  }
  try {
    const st = fsx.fstatSync(fd);
    if (!st.isFile()) return { status: 'refused', why: 'type' };
    if (st.uid !== uid) return { status: 'refused', why: 'owner' };
    if ((st.mode & 0o077) !== 0) return { status: 'refused', why: 'mode' };
    if (st.nlink !== 1) return { status: 'refused', why: 'links' };
    if (!Number.isSafeInteger(st.size) || st.size < 0 || st.size > max) return { status: 'refused', why: 'size' };
    if (fsx.readlinkSync(`/proc/self/fd/${fd}`) !== p) return { status: 'refused', why: 'path' };
    const buf = Buffer.alloc(st.size + 1);
    let got = 0;
    for (;;) {
      const n = fsx.readSync(fd, buf, got, buf.length - got, null);
      if (n === 0) break;
      got += n;
      if (got > st.size) return { status: 'refused', why: 'grew' };
    }
    if (got !== st.size) return { status: 'refused', why: 'short' };
    return { status: 'ok', text: buf.subarray(0, got).toString('utf8') };
  } catch { return { status: 'refused', why: 'read' }; } finally { try { fsx.closeSync(fd); } catch { /* reported by nothing; the read result stands */ } }
}

/**
 * The worker-side AppArmor evidence from the Playwright JSON report (a readReportBounded result): every `annotations` array
 * anywhere in it must hold EXACTLY one distinct `lane-apparmor` description, in the closed PRE/POST form. The walk is
 * budgeted (REPORT_MAX_DEPTH, REPORT_MAX_NODES) and exhausting either budget is a REFUSAL (INVALID), never a truncated
 * success: an early PASS cannot hide a later conflicting record. A refused read or more than REPORT_MAX bytes is INVALID;
 * only an absent report (or one with no record) is MISSING. Both fail the lane.
 */
export function workerAppArmorFromReport(r) {
  return reportSnapshot(r).aaLine;
}

/**
 * E1 diagnostics r1: ONE parse and ONE budgeted walk of ONE bounded read (the readReportBounded result `r`), giving the
 * AppArmor line (unchanged rules above) plus two diagnostic values for lane.txt:
 *   report: MISSING (status missing) | INVALID (refused, over-size, unparsable, either budget exhausted) | PARSED.
 *   reportedError: matched ONLY in defined error fields, by structure: the root `errors[i].message`, and
 *     `suites[..](.suites)*.specs[].tests[].results[].error.message`. A message counts only when it is exactly `<CODE>` or
 *     `Error: <CODE>` for a REPORTED_ERROR_CODES code (contract.mjs reportedErrorCode). Annotations, stdout, stderr,
 *     attachments, steps, stacks, snippets, formatted `errors[]` of a result and any other text are never read for codes.
 *     One distinct code is that code, two or more are MULTIPLE, none (or a report that is not PARSED) is UNKNOWN.
 * Exhausting the walk budget is INVALID for all three (fail closed), never a truncated answer.
 * E1 diagnostics r2 adds three more DIAGNOSTIC values from the same parsed tree, only after the budgeted walk completed:
 *   postObserved: the `lane-post-observed` annotation (written by the test-scoped gate next to `lane-apparmor`), exactly one
 *     distinct description in the closed grammar (contract.mjs postObservedEvidence), else MISSING (none) or INVALID.
 *     Like `lane-apparmor`, it is collected from every annotations array, not tied to one result.
 *   attemptStatus / failedStep: ONLY when the report holds exactly one test, that test is E1 by the full E1_IDENTITY (file,
 *     describe path, title, project) and it has exactly one attempt with retry 0 and a known status: that attempt's status
 *     word, and step-codes.mjs failedStep (titles only; for timedOut, the last listed phase RECORDED, not necessarily the
 *     failing operation). Missing, extra, ambiguous or malformed selection is UNKNOWN for both. No message is read.
 */
export function reportSnapshot(r) {
  const none = (aa, report) => ({ aaLine: `LANE E1 APPARMOR ${aa}`, report, reportedError: 'UNKNOWN', postObserved: aa, attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN' });
  if (!r || r.status === 'missing') return none('MISSING', 'MISSING');
  if (r.status !== 'ok' || typeof r.text !== 'string' || Buffer.byteLength(r.text, 'utf8') > REPORT_MAX) return none('INVALID', 'INVALID');
  let root;
  try { root = JSON.parse(r.text); } catch { return none('INVALID', 'INVALID'); }
  const found = new Set();
  const observed = new Set();
  const codes = new Set();
  let nodes = 0, exhausted = false;
  // role: the structural position of `v` (null = not on a defined error path). Node and depth counting are unchanged.
  const CHILD = { root: { suites: 'suites', errors: 'rootErrors' }, suite: { suites: 'suites', specs: 'specs' }, spec: { tests: 'tests' },
    test: { results: 'results' }, result: { error: 'error' } };
  const ITEM = { suites: 'suite', specs: 'spec', tests: 'test', results: 'result', rootErrors: 'error' };
  const walk = (v, depth, role) => {
    if (exhausted || !v || typeof v !== 'object') return;
    if (++nodes > REPORT_MAX_NODES || depth > REPORT_MAX_DEPTH) { exhausted = true; return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1, ITEM[role] ?? null); return; }
    if (role === 'error') { const c = reportedErrorCode(v.message); if (c) codes.add(c); }
    if (Array.isArray(v.annotations)) for (const a of v.annotations) {
      if (a && a.type === 'lane-apparmor') found.add(typeof a.description === 'string' ? a.description : '');
      if (a && a.type === 'lane-post-observed') observed.add(typeof a.description === 'string' ? a.description : '');
    }
    for (const k of Object.keys(v)) if (k !== 'annotations') walk(v[k], depth + 1, CHILD[role]?.[k] ?? null);
  };
  walk(root, 0, Array.isArray(root) ? null : 'root');
  if (exhausted) return none('INVALID', 'INVALID');
  const reportedError = codes.size === 0 ? 'UNKNOWN' : codes.size === 1 ? [...codes][0] : 'MULTIPLE';
  const [obs] = observed;
  const postObserved = observed.size === 0 ? 'MISSING' : observed.size === 1 && postObservedEvidence(obs) ? obs : 'INVALID';
  const { attemptStatus, failedStep: step } = e1Attempt(root);
  const diag = { postObserved, attemptStatus, failedStep: step };
  if (found.size === 0) return { aaLine: 'LANE E1 APPARMOR MISSING', report: 'PARSED', reportedError, ...diag };
  const [only] = found;
  return { aaLine: found.size === 1 && workerAppArmorEvidence(only) ? `LANE E1 APPARMOR ${only}` : 'LANE E1 APPARMOR INVALID', report: 'PARSED', reportedError, ...diag };
}

/** E1 diagnostics r2: the single E1 attempt's closed status and failed step, or UNKNOWN for both (see reportSnapshot). */
export function e1Attempt(root) {
  const unknown = { attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN' };
  try {
    if (!root || typeof root !== 'object' || Array.isArray(root)) return unknown;
    const all = testsOf(root);
    if (all.length !== 1) return unknown;
    const t = all[0];
    if (t.title !== E1_IDENTITY.title || t.file !== E1_IDENTITY.file || t.describe !== E1_IDENTITY.describe || t.projectName !== E1_IDENTITY.project) return unknown;
    if (t.results.length !== 1) return unknown;
    const only = t.results[0];
    if (!only || typeof only !== 'object' || Array.isArray(only) || only.retry !== 0) return unknown;
    const attemptStatus = attemptStatusToken(only.status);
    if (attemptStatus === 'UNKNOWN') return unknown;
    return { attemptStatus, failedStep: failedStepToken(failedStep(only)) };
  } catch { return unknown; }
}

/** Expected process environment: exactly ENV_KEYS (values recomputed from the validated inputs), PATH, and Docker's HOSTNAME. */
export function envProblems(env, R) {
  try {
    const P = path.dirname(env.LE_LANE_DIR ?? '');
    const L = lanePaths(P, '/nonexistent-ctl', R);
    const want = laneEnv(L, { apiOrigin: env.LE_API_ORIGIN, dbUrl: env.LE_DB_URL, commit: env.E2E_EVIDENCE_COMMIT, shell: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    for (const kv of want) { const i = kv.indexOf('='); if (env[kv.slice(0, i)] !== kv.slice(i + 1)) return true; }
    const extra = Object.keys(env).filter((k) => !ENV_KEYS.includes(k) && k !== 'PATH' && k !== 'HOSTNAME');
    return extra.length > 0 || env.PATH !== `/usr/lib/postgresql/${PG_MAJOR}/bin:/usr/bin`;
  } catch { return true; }
}

/**
 * PATH resolution, without spawning, of every closure tool to its manifest location (realpath), of `psql` to the real PG16
 * binary, and of bare `node` (run.sh calls it unqualified) to LANE_NODE; and this supervisor itself must be LANE_NODE.
 */
export function closureProblems(fsx, env, execPath) {
  if (execPath !== LANE_NODE) return true;
  const dirs = String(env.PATH ?? '').split(':');
  const resolve = (t) => { for (const d of dirs) { const p = path.join(d, t); try { fsx.accessSync(p, fs.constants.X_OK); return fsx.realpathSync(p); } catch { /* next */ } } return null; };
  for (const t of TOOLS) if (resolve(t) !== `/usr/bin/${t}`) return true;
  return resolve('psql') !== PSQL_REAL || resolve('node') !== LANE_NODE;
}

/** One in-container TCP forwarder 127.0.0.1:<port> -> unix socket <sock>. Resolves the server once listening. */
export function forwarder(netx, port, sock) {
  return new Promise((resolve, reject) => {
    const srv = netx.createServer((c) => {
      const up = netx.connect({ path: sock });
      const end = () => { c.destroy(); up.destroy(); };
      c.on('error', end); up.on('error', end); c.on('close', end); up.on('close', end);
      c.pipe(up); up.pipe(c);
    });
    srv.once('error', reject);
    srv.listen({ host: '127.0.0.1', port }, () => { srv.off('error', reject); resolve(srv); });
  });
}

/** The session parent: an existing, empty, 0700, own-uid, non-symlink directory (run.sh then creates work/ and evidence/). */
export function sessionParentOk(fsx, dir, uid) {
  try {
    const s = fsx.lstatSync(dir);
    return s.isDirectory() && !s.isSymbolicLink() && (s.mode & 0o777) === 0o700 && s.uid === uid && fsx.readdirSync(dir).length === 0;
  } catch { return false; }
}

export async function laneMain(d) {
  const env = d.env, R = d.repo;
  const lines = [];
  let fd = null;
  const say = (l) => { lines.push(l); if (fd !== null) d.write(fd, `${l}\n`); };
  if (d.umask() !== 0o077) return { code: 1, lines: ['LANE_E_UMASK_NOT_SET'] };
  const P = path.dirname(env.LE_LANE_DIR ?? '/nonexistent/lane');
  let L;
  try { L = lanePaths(P, '/nonexistent-ctl', R); fd = d.openExcl(L.laneTxt); } catch { return { code: 1, lines: ['LANE_E_OUT'] }; }
  const end = (code) => { say('LANE END'); return { code, lines }; };
  const notRun = (c) => { say(`LANE SETUP NOT RUN ${c}`); return end(1); };
  say('LANE START');
  // AppArmor gate: before ANY other step; only exact "docker-default (enforce)" proceeds.
  const label = d.readText('/proc/self/attr/apparmor/current') ?? d.readText('/proc/self/attr/current');
  const aa = apparmorGate(label);
  say(`LANE APPARMOR ${LANE_APPARMOR.includes(aa) ? aa : 'APPARMOR_E_UNKNOWN'}`);
  if (aa !== 'APPARMOR_DOCKER_DEFAULT_ENFORCE') return notRun('LANE_E_APPARMOR');
  if (d.umask() !== 0o077) return notRun('LANE_E_UMASK');
  if (envProblems(env, R)) return notRun('LANE_E_ENV');
  if (closureProblems(d.fs, env, d.execPath)) return notRun('LANE_E_CLOSURE');
  const v = await d.run(PSQL_REAL, ['--version'], { capture: true, timeout: 10000 });
  if (v.code !== 0 || !new RegExp(`^psql \\(PostgreSQL\\) ${PG_MAJOR}\\.\\d+`).test(v.out)) return notRun('LANE_E_CLOSURE');
  let ports;
  try { ports = lanePorts({ apiOrigin: env.LE_API_ORIGIN, dbUrl: env.LE_DB_URL }); } catch { return notRun('LANE_E_ENV'); }
  const fwd = [];
  try { for (const [k, sock] of [['api', 'api.sock'], ['db', 'db.sock'], ['app', 'app.sock']]) fwd.push(await d.forward(ports[k], path.join(L.sock, sock))); }
  catch { return notRun('LANE_E_FORWARD'); }
  try {
    let anon;
    try { anon = d.fs.readFileSync(L.anon, 'utf8').trim(); } catch { return notRun('LANE_E_BRIDGE_REACH'); }
    // Bridge reach: API (anon), preview index, DB select 1, each through the forwarders only.
    const api = await d.fetch(`${env.LE_API_ORIGIN}/rest/v1/`, { headers: { apikey: anon, Accept: 'application/openapi+json' }, redirect: 'error' }).catch(() => null);
    const app = await d.fetch(`${env.LE_APP_ORIGIN}/`, { redirect: 'error' }).catch(() => null);
    const appText = app && app.status === 200 ? await app.text().catch(() => '') : '';
    const db = await d.psql(L, ['-c', 'select 1']);
    if (!api || api.status !== 200 || !appText.includes('id="root"') || db.code !== 0 || db.out.trim() !== '1') return notRun('LANE_E_BRIDGE_REACH');
    // Session parent before and after the read-only pairing recheck.
    if (!sessionParentOk(d.fs, L.lane, d.uid())) return notRun('LANE_E_SESSION_PARENT');
    try {
      const proof = (d.assertPairingProof ?? assertPairingProof)(L.proof, { sessionDir: L.lane });
      await (d.assertLivePairing ?? assertLivePairing)(proof, { apiOrigin: env.LE_API_ORIGIN, anonKey: anon, fetchImpl: d.fetch, randomId: d.randomUUID() });
      const r = await d.psql(L, ['-c', 'begin read only', '-c', `select description from public.courses where id = '${PAIRING_COURSE_ID}'`, '-c', 'commit']);
      const got = r.out.split('\n').filter((l) => l !== '' && l !== 'BEGIN' && l !== 'COMMIT');
      if (r.code !== 0 || got.length !== 1 || got[0] !== PAIRING_PREFIX + proof.stack_id) throw new Error('db');
    } catch { return notRun('LANE_E_PAIR_RECHECK'); }
    if (!sessionParentOk(d.fs, L.lane, d.uid())) return notRun('LANE_E_SESSION_PARENT');

    const runsh = path.join(R, 'scripts/local-stack/lesson-editor/run.sh');
    const redact = path.join(R, 'scripts/local-stack/t09/stack-checks.sh');
    const sfd = d.openExcl(L.setupTxt);
    const s = await d.run('/usr/bin/bash', ['-c', 'set -o pipefail; "$0" "$@" 2>&1 | /usr/bin/bash "$LE_REDACT" redact', runsh, 'setup',
      env.LE_API_ORIGIN, env.LE_APP_ORIGIN, env.LE_DB_URL, L.anon, L.service, L.work, L.evidence], { stdout: sfd, timeout: 300000, extraEnv: { LE_REDACT: redact } });
    d.close(sfd);
    const setupPass = s.code === 0;
    say(setupPass ? 'LANE SETUP PASS' : 'LANE SETUP FAIL');
    let e1 = null, aaLine = null;
    if (setupPass) {
      e1 = await d.run(LANE_NODE, [path.join(R, 'node_modules/@playwright/test/cli.js'), 'test', '-c', path.join(R, 'e2e/lesson-editor/playwright.lesson-editor.config.ts'), '--grep', 'E1 save'], { timeout: 600000 });
      const pfd = d.openExcl(L.pwExit);
      d.write(pfd, `${Number.isInteger(e1.code) && e1.code >= 0 && e1.code <= 255 ? e1.code : 255}\n`);
      d.close(pfd);
      say('LANE E1 RAN');
      say(`LANE E1 RESULT ${e1ResultClass(e1)}`);
      const snap = reportSnapshot(d.readReport(L.report)); // the ONE bounded read, used for AppArmor and diagnostics
      aaLine = snap.aaLine;
      say(aaLine);
      say(`LANE E1 REPORT ${snap.report}`);
      say(`LANE E1 REPORTED_ERROR ${snap.reportedError}`);
      say(`LANE E1 POST_OBSERVED ${snap.postObserved}`);
      say(`LANE E1 ATTEMPT_STATUS ${snap.attemptStatus}`);
      say(`LANE E1 FAILED_STEP ${snap.failedStep}`);
    } else say('LANE E1 NOT RUN');
    const c = await d.run(runsh, ['cleanup', L.work], { timeout: 60000 });
    say(c.code === 0 ? 'LANE CLEANUP PASS' : 'LANE CLEANUP FAIL');
    const aaOk = !!aaLine && workerAppArmorEvidence(aaLine.slice(17))?.enforced === true;
    return end(setupPass && e1?.code === 0 && aaOk && c.code === 0 ? 0 : 1);
  } finally {
    for (const f of fwd) { try { f.close(); } catch { /* the namespace ends with the container */ } }
  }
}

/** psql through a private passfile on the container tmpfs (pgconn.mjs, unchanged), PG* cleared; removed after use. */
export function makePsql(d0) {
  return async (L, args) => {
    let dir = null;
    try {
      dir = d0.fs.mkdtempSync('/tmp/le-pf-');
      const pf = path.join(dir, 'pgpass');
      const env = { ...d0.cleanEnv(), LE_DB_PASSWORD_FILE: L.dbpass };
      const w = await d0.run(LANE_NODE, [path.join(d0.repo, 'scripts/local-stack/lesson-editor/pgconn.mjs'), 'passfile', d0.env.LE_DB_URL, pf], { env, timeout: 10000 });
      if (w.code !== 0) return { code: null, out: '' };
      return await d0.run(PSQL_REAL, [d0.env.LE_DB_URL, '-w', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', ...args], { env: { ...d0.cleanEnv(), PGPASSFILE: pf }, capture: true, timeout: 15000 });
    } catch { return { code: null, out: '' }; } finally { if (dir) { try { d0.fs.rmSync(dir, { recursive: true, force: true }); } catch { /* tmpfs ends with the container */ } } }
  };
}

if (process.argv[1] && /le-lane\/lane-entry\.mjs$/.test(process.argv[1])) {
  const repo = process.argv[2];
  const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('PG')));
  const d = {
    env: process.env, repo, fs, execPath: process.execPath, uid: () => process.getuid(), umask: () => { const u = process.umask(0o077); return u; },
    openExcl: (p) => fs.openSync(p, 'wx', 0o600), write: (f, t) => fs.writeSync(f, t), close: (f) => fs.closeSync(f),
    readText: (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
    readReport: (p) => readReportBounded(fs, p, process.getuid(), REPORT_MAX),
    fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(15000) }), randomUUID: () => crypto.randomUUID(),
    forward: (port, sock) => forwarder(net, port, sock), cleanEnv,
  };
  d.run = (bin, args, o = {}) => runChild(spawn, bin, args, { ...o, env: o.env ?? { ...cleanEnv(), ...(o.extraEnv ?? {}) }, cwd: repo });
  d.psql = makePsql(d);
  laneMain(d).then((r) => process.exit(r.code), () => process.exit(1));
}
