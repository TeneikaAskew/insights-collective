// ABOUTME: Supervisor INSIDE the sealed video lane container (its Cmd). umask 077, the enforcing AppArmor gate, the exact env and
// ABOUTME: closure, the empty egress dir, ONE forwarder (app), bridge reach, the 24-test sealed Playwright run, then the gates.
//
// SOURCE CANDIDATE (sealed-video r1). UNRUN. Reuses lane-entry.mjs's reviewed helpers (runChild, readReportBounded, forwarder,
// workerAppArmorFromReport) unchanged; E1's laneMain is not touched.
// Every step appends one fixed `LANE ...` line to <LE_OUT_DIR>/lane.txt (closed grammar: kinds.mjs parseVideoLaneOut). Child
// output is withheld. The Playwright exit status (digits only) goes to <LE_OUT_DIR>/pw-exit, written only when the run started.
// After Playwright exits: the WORKER-side AppArmor evidence from the JSON report, the report's own result counts (exactly 24
// expected, 0 unexpected, 0 flaky, 0 skipped), and the per-worker egress records (egress-records.mjs aggregateEgress, coverage =
// the declared 24). Any failure fails the lane. No retry anywhere.
// Listeners (disclosed, inside the container's own network namespace, loopback only): the ONE forwarder 127.0.0.1:8080 ->
// <LE_SOCK_DIR>/app.sock, and Playwright's launchServer endpoint on 127.0.0.1 (sandbox-launch.mjs). No other listener.
// Writers (disclosed): lane.txt and pw-exit (one wx 0600 descriptor each, umask 077), mkdir of <LE_EGRESS_DIR> (0700). The
// worker fixture writes the egress records; Playwright writes its report and output dir.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { apparmorGate } from '../le-iso/expect.mjs';
import { APP_ORIGIN, IMAGE_PATH_ENV, LANE_APPARMOR, LANE_NODE, workerAppArmorEvidence } from './contract.mjs';
import { REPORT_MAX, REPORT_MAX_DEPTH, REPORT_MAX_NODES, forwarder, readReportBounded, runChild, workerAppArmorFromReport } from './lane-entry.mjs';
import { VIDEO_CONFIG_REL, VIDEO_DECLARED_TESTS, VIDEO_ENV_KEYS, VIDEO_TOOLS, videoEnv, videoPaths } from './kinds.mjs';
import { RECORD_MAX_BYTES, aggregateEgress } from './egress-records.mjs';
import { VIDEO_APP_PORT } from './bridge.mjs';

/** Exact process environment: VIDEO_ENV_KEYS (values recomputed from the validated inputs), PATH = the image PATH, Docker's HOSTNAME. */
export function videoEnvProblems(env, R) {
  try {
    const V = videoPaths(path.dirname(env.LE_LANE_DIR ?? ''), '/nonexistent-ctl', R);
    const want = videoEnv(V, { commit: env.E2E_EVIDENCE_COMMIT, shell: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    for (const kv of want) { const i = kv.indexOf('='); if (env[kv.slice(0, i)] !== kv.slice(i + 1)) return true; }
    const extra = Object.keys(env).filter((k) => !VIDEO_ENV_KEYS.includes(k) && k !== 'PATH' && k !== 'HOSTNAME');
    return extra.length > 0 || `PATH=${env.PATH}` !== IMAGE_PATH_ENV;
  } catch { return true; }
}

/** PATH resolution, without spawning: every VIDEO_TOOLS entry at /usr/bin, bare `node` at LANE_NODE (this process too), and NO psql or git. */
export function videoClosureProblems(fsx, env, execPath) {
  if (execPath !== LANE_NODE) return true;
  const dirs = String(env.PATH ?? '').split(':');
  const resolve = (t) => { for (const d of dirs) { const p = path.join(d, t); try { fsx.accessSync(p, fs.constants.X_OK); return fsx.realpathSync(p); } catch { /* next */ } } return null; };
  for (const t of VIDEO_TOOLS) if (resolve(t) !== `/usr/bin/${t}`) return true;
  return resolve('node') !== LANE_NODE || resolve('psql') !== null || resolve('git') !== null;
}

/** The report's own result counts: exactly `declared` expected and nothing unexpected, flaky or skipped. Bounded input only. */
export function reportResult(r, declared = VIDEO_DECLARED_TESTS) {
  if (!r || r.status !== 'ok' || typeof r.text !== 'string' || Buffer.byteLength(r.text, 'utf8') > REPORT_MAX) return 'FAIL';
  let s;
  try { s = JSON.parse(r.text)?.stats; } catch { return 'FAIL'; }
  return s && s.expected === declared && s.unexpected === 0 && s.flaky === 0 && s.skipped === 0 ? 'PASS' : 'FAIL';
}

/**
 * The text-render precheck's fixed code from the bounded JSON report. Never returns or prints report content.
 *   LANE_E_TEXT_RENDER    the exact token appears in any error `message` or `value` string (the worker fixture threw it);
 *                         this wins over everything else.
 *   LANE_TEXT_RENDER_OK   otherwise, every `lane-text-render` annotation is exactly LANE_TEXT_RENDER_OK, and there is one
 *                         per test result.
 *   TEXT_RENDER_E_MISSING no annotation, a different description, or fewer annotations than test results.
 *   TEXT_RENDER_E_REPORT  missing, unreadable, oversized, unparsable or over-deep/over-large report.
 */
export function textRenderFromReport(r) {
  if (!r || r.status !== 'ok' || typeof r.text !== 'string' || Buffer.byteLength(r.text, 'utf8') > REPORT_MAX) return 'TEXT_RENDER_E_REPORT';
  let root;
  try { root = JSON.parse(r.text); } catch { return 'TEXT_RENDER_E_REPORT'; }
  const TOKEN = /(^|[^A-Z_])LANE_E_TEXT_RENDER([^A-Z_]|$)/;
  let nodes = 0, exhausted = false, failed = false, okCount = 0, other = 0, results = 0;
  const walk = (v, depth, key) => {
    if (exhausted) return;
    if (typeof v === 'string') { if ((key === 'message' || key === 'value') && TOKEN.test(v)) failed = true; return; }
    if (!v || typeof v !== 'object') return;
    if (++nodes > REPORT_MAX_NODES || depth > REPORT_MAX_DEPTH) { exhausted = true; return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1, key); return; }
    if (key === 'results') results++;
    if (Array.isArray(v.annotations)) for (const a of v.annotations) if (a && a.type === 'lane-text-render') { if (a.description === 'LANE_TEXT_RENDER_OK') okCount++; else other++; }
    for (const k of Object.keys(v)) walk(v[k], depth + 1, k);
  };
  walk(root, 0, '');
  if (exhausted) return 'TEXT_RENDER_E_REPORT';
  if (failed) return 'LANE_E_TEXT_RENDER';
  return okCount > 0 && other === 0 && okCount >= results ? 'LANE_TEXT_RENDER_OK' : 'TEXT_RENDER_E_MISSING';
}

export async function videoMain(d) {
  const env = d.env, R = d.repo;
  const lines = [];
  let fd = null;
  const say = (l) => { lines.push(l); if (fd !== null) d.write(fd, `${l}\n`); };
  if (d.umask() !== 0o077) return { code: 1, lines: ['LANE_E_UMASK_NOT_SET'] };
  let V;
  try { V = videoPaths(path.dirname(env.LE_LANE_DIR ?? '/nonexistent/lane'), '/nonexistent-ctl', R); fd = d.openExcl(V.laneTxt); } catch { return { code: 1, lines: ['LANE_E_OUT'] }; }
  const end = (code) => { say('LANE END'); return { code, lines }; };
  const notRun = (c) => { say(`LANE SETUP NOT RUN ${c}`); return end(1); };
  say('LANE START');
  const label = d.readText('/proc/self/attr/apparmor/current') ?? d.readText('/proc/self/attr/current');
  const aa = apparmorGate(label);
  say(`LANE APPARMOR ${LANE_APPARMOR.includes(aa) ? aa : 'APPARMOR_E_UNKNOWN'}`);
  if (aa !== 'APPARMOR_DOCKER_DEFAULT_ENFORCE') return notRun('LANE_E_APPARMOR');
  if (d.umask() !== 0o077) return notRun('LANE_E_UMASK');
  if (videoEnvProblems(env, R)) return notRun('LANE_E_ENV');
  if (videoClosureProblems(d.fs, env, d.execPath)) return notRun('LANE_E_CLOSURE');
  // The egress dir is created here, empty and private, before Playwright; a pre-existing entry refuses (no stale record counts).
  try {
    d.fs.mkdirSync(V.egressDir, { mode: 0o700 });
    const s = d.fs.lstatSync(V.egressDir);
    if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o777) !== 0o700 || s.uid !== d.uid() || d.fs.readdirSync(V.egressDir).length !== 0) throw new Error('egress');
  } catch { return notRun('LANE_E_EGRESS_DIR'); }
  let fwd = null;
  try { fwd = await d.forward(VIDEO_APP_PORT, path.join(V.sock, 'app.sock')); } catch { return notRun('LANE_E_FORWARD'); }
  try {
    const app = await d.fetch(`${APP_ORIGIN}/`, { redirect: 'error' }).catch(() => null);
    const appText = app && app.status === 200 ? await app.text().catch(() => '') : '';
    if (!appText.includes('id="root"')) return notRun('LANE_E_BRIDGE_REACH');
    const pw = await d.run(LANE_NODE, [path.join(R, 'node_modules/@playwright/test/cli.js'), 'test', '-c', path.join(R, VIDEO_CONFIG_REL)], { timeout: 900000 });
    const pfd = d.openExcl(V.pwExit);
    d.write(pfd, `${Number.isInteger(pw.code) && pw.code >= 0 && pw.code <= 255 ? pw.code : 255}\n`);
    d.close(pfd);
    say('LANE VIDEO RAN');
    const report = d.readReport(V.report);
    const aaLine = `LANE VIDEO APPARMOR ${workerAppArmorFromReport(report).slice('LANE E1 APPARMOR '.length)}`;
    say(aaLine);
    const textRender = textRenderFromReport(report);
    say(`LANE VIDEO TEXT_RENDER ${textRender}`);
    const result = pw.code === 0 ? reportResult(report) : 'FAIL';
    say(`LANE VIDEO RESULT ${result}`);
    let eg;
    try {
      const names = d.fs.readdirSync(V.egressDir);
      const read = (n) => { const r = d.readRecord(path.join(V.egressDir, n)); return r.status === 'ok' ? r.text : null; };
      eg = aggregateEgress(names, read, VIDEO_DECLARED_TESTS);
    } catch { eg = { ok: false, code: 'LANE_E_EGRESS_READ' }; }
    say(`LANE EGRESS ${eg.code}`);
    const aaOk = workerAppArmorEvidence(aaLine.slice('LANE VIDEO APPARMOR '.length))?.enforced === true;
    return end(pw.code === 0 && result === 'PASS' && aaOk && textRender === 'LANE_TEXT_RENDER_OK' && eg.ok ? 0 : 1);
  } finally {
    try { fwd?.close(); } catch { /* the namespace ends with the container */ }
  }
}

if (process.argv[1] && /le-lane\/video-entry\.mjs$/.test(process.argv[1])) {
  process.umask(0o077);
  const repo = process.argv[2];
  const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('PG')));
  const d = {
    env: process.env, repo, fs, execPath: process.execPath, uid: () => process.getuid(), umask: () => process.umask(0o077),
    openExcl: (p) => fs.openSync(p, 'wx', 0o600), write: (f, t) => fs.writeSync(f, t), close: (f) => fs.closeSync(f),
    readText: (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
    readReport: (p) => readReportBounded(fs, p, process.getuid(), REPORT_MAX),
    readRecord: (p) => readReportBounded(fs, p, process.getuid(), RECORD_MAX_BYTES),
    fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(15000) }),
    forward: (port, sock) => forwarder(net, port, sock),
  };
  d.run = (bin, args, o = {}) => runChild(spawn, bin, args, { ...o, env: o.env ?? cleanEnv(), cwd: repo });
  videoMain(d).then((r) => process.exit(r.code), () => process.exit(1));
}
