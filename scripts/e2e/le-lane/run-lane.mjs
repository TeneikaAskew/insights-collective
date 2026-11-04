#!/usr/bin/env node
// ABOUTME: The ONE host orchestrator for the sealed E1 lane. In a single try/finally lifetime it creates, inspects and starts the
// ABOUTME: container, launches, seals, terminates and REAPS the bridge through its own ChildProcess handle, and tears down.
//
//   run-lane.mjs <ctl dir> <private parent> <repo> <node abs path> <headless shell abs path> <api origin> <password-free db url> <commit>
//
// Run inside le_run immediately after the single pairing `pair` (same step). Later always() steps only VERIFY the receipts
// written here (gates.mjs) and never reconstruct a child handle or claim a reap from a PID: if this process is lost abruptly,
// gates.txt is missing or incomplete and every later verdict is UNRESOLVED.
// Create states: the run-lane.started receipt is written before any docker call; create-invoked before `docker create`.
//   never invoked             -> GATE CONTAINER LANE_NO_CONTAINER (the only state that proves no lane container exists)
//   invoked, CID unknown      -> UNRESOLVED (cidfile missing/unreadable/invalid, stdout disagrees, client unreaped)
//   created, never started    -> inspect createdNeverStarted by full CID, plain rm, successful-empty listing
//   started                   -> bounded stop and wait, exitStateOk, rm, successful-empty listing
// Docker clients and the bridge get a sanitized environment (image.mjs sanitizedEnv): this process holds the job's secrets in
// its own environment (it is trusted orchestration), but nothing it spawns inherits them.
// Writers (disclosed, host-only control dir): run-lane.started, create-invoked, gates.txt (wx, 0600). docker writes lane.cid.
// Lifecycle matrix (LOCAL candidate, unrun): `--synthetic` selects the SYNTHETIC target. It creates the fresh synthetic-only
// directories (createSynDirs below: directories only, exclusive, 0700) as its last validation step, never starts a
// bridge (GATE BRIDGE BRIDGE_NOT_STARTED), and otherwise runs the same create, inspect, start, wait and teardown.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { makeExec } from '../le-iso/run-probe.mjs';
import { CONFIG_FIELDS, absenceVerdict, createdNeverStarted, exitStateOk, BROWSER_PIN, BROWSER_PATH_RE, SECCOMP_RAW_SHA256 } from '../le-iso/expect.mjs';
import { CID, IMAGE_ID, LANE_CONFIG_FIELDS, LANE_NODE, LANE_WAIT_MS, compareLaneInspect, expectedLaneConfig, laneCreateArgs, laneEnv, lanePaths, lanePorts } from './contract.mjs';
import { synEnv, synDirs, synLanePaths } from './contract.mjs';
import { parseBridgeFinal } from './bridge.mjs';
import { sanitizedEnv, spawnClean } from './image.mjs';

export const realDeps = {
  exec: makeExec(spawnClean),
  fs,
  files: { put: (p, t) => fs.writeFileSync(p, t, { flag: 'wx', mode: 0o600 }) },
  spawnBridge: (script, args) => spawn(process.execPath, [script, ...args], { stdio: 'ignore', env: sanitizedEnv(process.env) }),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  uid: () => process.getuid(), gid: () => process.getgid(),
};

const sha = (fsx, p) => crypto.createHash('sha256').update(fsx.readFileSync(p)).digest('hex');
const starttimeOf = (fsx, pid) => { const s = fsx.readFileSync(`/proc/${pid}/stat`, 'utf8'); return s.slice(s.lastIndexOf(')') + 2).split(' ')[19]; };
const FIELD_NAMES = new Set([...CONFIG_FIELDS, ...LANE_CONFIG_FIELDS]);

/** Private-input shape before anything starts (lstat only; nothing is read or printed). */
export function inputsOk(fsx, L, uid) {
  const st = (p) => { try { return fsx.lstatSync(p); } catch { return null; } };
  const dir700 = (p) => { const s = st(p); return !!s && s.isDirectory() && !s.isSymbolicLink() && (s.mode & 0o777) === 0o700 && s.uid === uid; };
  const file600 = (p) => { const s = st(p); return !!s && s.isFile() && !s.isSymbolicLink() && (s.mode & 0o777) === 0o600 && s.uid === uid && s.nlink === 1; };
  const empty = (p) => { try { return fsx.readdirSync(p).length === 0; } catch { return false; } };
  return dir700(L.P) && dir700(L.keys) && file600(L.anon) && file600(L.service) && file600(L.dbpass) && dir700(L.proofDir) && file600(L.proof)
    && dir700(L.sock) && empty(L.sock) && dir700(L.lane) && empty(L.lane) && dir700(L.out) && empty(L.out) && dir700(L.C);
}

/**
 * DESIGN-r2.2 A, in order: (2) the parent must NOT exist (lstat ENOENT is the only accepted result); (3) every EXISTING ancestor
 * from the runner temp root down to the parent's directory is a real directory, not a symlink, and its own realpath; (4) the
 * parent is created with an exclusive mkdir (no recursion: EEXIST is a refusal); (5) its owner and mode are then verified by
 * lstat (job uid, 0700); then lane/, out/, work/, evidence/ and evidence/pw-output are created and verified the same way.
 * Returns null on success or one fixed code. A refusal before step 4 creates nothing.
 */
export function createSynDirs(fsx, runnerTemp, L, uid) {
  if (L.P !== path.join(runnerTemp, path.basename(L.P)) || !/^syn-\d+-\d+$/.test(path.basename(L.P))) return 'SYN_E_DIR_PARENT';
  try { fsx.lstatSync(L.P); return 'SYN_E_DIR_EXISTS'; } catch (e) { if (e?.code !== 'ENOENT') return 'SYN_E_DIR_EXISTS'; }
  // Every existing ancestor: '/', then each component down to runnerTemp (the parent's own directory).
  const parts = runnerTemp.split('/').filter(Boolean);
  for (let i = 0; i <= parts.length; i++) {
    const a = '/' + parts.slice(0, i).join('/');
    let s;
    try { s = fsx.lstatSync(a); } catch { return 'SYN_E_DIR_ANCESTOR'; }
    let real;
    try { real = fsx.realpathSync(a); } catch { return 'SYN_E_DIR_ANCESTOR'; }
    if (!s.isDirectory() || s.isSymbolicLink() || real !== a) return 'SYN_E_DIR_ANCESTOR';
  }
  for (const d of synDirs(L)) {
    try { fsx.mkdirSync(d, { mode: 0o700 }); } catch { return 'SYN_E_DIR_CREATE'; }
    let s;
    try { s = fsx.lstatSync(d); } catch { return 'SYN_E_DIR_VERIFY'; }
    if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== uid || (s.mode & 0o777) !== 0o700) return 'SYN_E_DIR_VERIFY';
  }
  return null;
}

/** SYNTHETIC container wait: the in-lane Playwright child bound (lane-entry.mjs SYN_PW_TIMEOUT_MS, 1 060 000 ms) plus margin. */
export const SYN_WAIT_MS = 1_200_000;

export async function runLane(d, o) {
  const fsx = d.fs;
  const say = [];
  const out = (c) => say.push(c);
  let ok = true;
  const fail = (c) => { ok = false; out(c); };
  // Lifecycle matrix: o.target is undefined for E1 (every E1 call is unchanged) or exactly 'SYNTHETIC'; anything else is refused
  // before any read, directory or docker call. SYNTHETIC: paths from the runner temp, run id and attempt only (never an E1 path),
  // fresh synthetic-only dirs, three binds, the closed synthetic env, and NO bridge.
  const syn = o.target === 'SYNTHETIC';
  if (o.target !== undefined && !syn) return { ok: false, say: ['LANE_E_TARGET'] };
  let L;
  try { L = syn ? synLanePaths(o.T, o.runId, o.attempt, o.C, o.R) : lanePaths(o.P, o.C, o.R); } catch { return { ok: false, say: ['LANE_E_INPUT'] }; }
  // Validation needs no docker; nothing below this block may run without the started receipt.
  let imageId = null, env = null, seccompText = null, ports = null;
  try {
    imageId = fsx.readFileSync(L.iid, 'utf8').trim();
    if (!IMAGE_ID.test(imageId)) throw new Error('iid');
    if (!syn) {
      ports = lanePorts({ apiOrigin: o.apiOrigin, dbUrl: o.dbUrl });
      env = laneEnv(L, { apiOrigin: o.apiOrigin, dbUrl: o.dbUrl, commit: o.commit, shell: o.shell });
    } else env = synEnv(L, { commit: o.commit, shell: o.shell });
    const raw = fsx.readFileSync(L.seccomp);
    if (crypto.createHash('sha256').update(raw).digest('hex') !== SECCOMP_RAW_SHA256) throw new Error('profile');
    seccompText = raw.toString('utf8');
    if (!BROWSER_PATH_RE.test(o.shell) || sha(fsx, o.shell) !== (d.browserSha256 ?? BROWSER_PIN.SHA256)) throw new Error('browser');
    // The lane's Node (LANE_NODE in the image) must be byte-identical to this job's Node, as recorded by the image build.
    if (!path.isAbsolute(o.node ?? '') || !fsx.readFileSync(L.manifest, 'utf8').split('\n').includes(`${sha(fsx, o.node)}  ${LANE_NODE}`)) throw new Error('node');
    if (!syn && !inputsOk(fsx, L, d.uid())) throw new Error('inputs');
    if (syn) {
      const c = fsx.lstatSync(L.C);
      if (!c.isDirectory() || c.isSymbolicLink() || (c.mode & 0o777) !== 0o700 || c.uid !== d.uid()) throw new Error('ctl');
      // Last validation step, so a refused input creates nothing (createSynDirs, DESIGN-r2.2 A order).
      if (createSynDirs(fsx, o.T, L, d.uid()) !== null) throw new Error('dirs');
    }
  } catch { return { ok: false, say: ['LANE_E_INPUT'] }; }
  try { d.files.put(L.started, 'run-lane.started\n'); } catch { return { ok: false, say: ['LANE_E_RECEIPT'] }; }

  let cid = null, createTried = false, startInvoked = false, clientUnreaped = false, child = null, bridgeRec = null, laneExit = null;
  const x = async (...a) => { const r = await d.exec(...a); if (r?.unreaped) clientUnreaped = true; return r; };
  const uid = d.uid(), gid = d.gid();
  try {
    // create (receipt first)
    d.files.put(L.createInvoked, 'create-invoked\n');
    createTried = true;
    const c = await x('docker', laneCreateArgs(L, { imageId, uid, gid, env, target: o.target }));
    let read = null;
    try { read = fsx.readFileSync(L.cidfile, 'utf8').trim(); } catch { read = null; }
    const said = String(c.stdout ?? '').trim();
    const fromFile = read && CID.test(read) ? read : null, fromOut = CID.test(said) ? said : null;
    cid = fromFile && fromOut && fromFile === fromOut ? fromFile : null; // both, valid and equal; anything else is unknown
    if (!c.ok) fail('LANE_E_CREATE');
    if (!cid) fail('LANE_E_CID');
    else if (ok) out('LANE_CREATE_OK');

    if (ok) {
      const i = await x('docker', ['container', 'inspect', cid]);
      let obj = null;
      try { obj = JSON.parse(i.stdout)[0]; } catch { obj = null; }
      const bad = !i.ok ? ['INSPECT_EXEC'] : !obj ? ['INSPECT_PARSE'] : obj.Id !== cid ? ['INSPECT_ID']
        : compareLaneInspect(obj, expectedLaneConfig(L, { imageId, uid, gid, env, seccompText, cid, target: o.target }));
      if (bad.length) { fail('LANE_E_CONFIG'); for (const n of [...new Set(bad)]) out(`LANE_CONFIG_FIELD ${FIELD_NAMES.has(n) ? n : 'UNKNOWN'}`); } else out('LANE_CONFIG_OK');
    }

    if (ok && !syn) {
      let spawnError = false;
      try {
        child = d.spawnBridge(L.bridge, [L.sock, L.C, String(ports.api), String(ports.db), String(ports.app)]);
        child.on('error', () => { spawnError = true; });
      } catch { child = null; spawnError = true; }
      let rec = null;
      for (let n = 0; n < 50 && !rec && !spawnError; n++) { try { rec = fsx.readFileSync(L.bridgeReady, 'utf8'); } catch { await d.sleep(200); } }
      const m = rec?.match(/^(\d+) (\d+) (\d+) (\d+) (\d+)\n$/);
      if (spawnError || !m || !child || !Number.isInteger(child.pid)) fail('LANE_E_BRIDGE_START');
      else {
        bridgeRec = { pid: Number(m[1]), start: m[2] };
        let st = null;
        try { st = starttimeOf(fsx, bridgeRec.pid); } catch { st = null; }
        if (bridgeRec.pid !== child.pid || st !== bridgeRec.start || Number(m[3]) !== ports.api || Number(m[4]) !== ports.db || Number(m[5]) !== ports.app) fail('LANE_E_BRIDGE_IDENTITY');
        else out('LANE_BRIDGE_OK');
      }
    }

    if (ok) {
      startInvoked = true;
      const s = await x('docker', ['start', cid], { timeout: 60000 });
      if (!s.ok || String(s.stdout).trim() !== cid) fail('LANE_E_START');
      else {
        out('LANE_STARTED');
        const w = await x('docker', ['wait', cid], { timeout: syn ? SYN_WAIT_MS : LANE_WAIT_MS });
        const code = String(w.stdout ?? '').trim();
        if (w.timedOut) fail('LANE_E_WAIT_TIMEOUT');
        else if (!w.ok || !/^-?\d+$/.test(code)) fail('LANE_E_WAIT');
        else { laneExit = Number(code); out(laneExit === 0 ? 'LANE_EXIT_ZERO' : 'LANE_EXIT_NONZERO'); }
      }
    }
  } catch { fail('LANE_E_UNCLASSIFIED'); } finally {
    // 1. Seal the bridge first, whenever it was started: it refuses every later connection before any upstream connect.
    let sealed = false;
    if (child && Number.isInteger(child.pid)) {
      try { child.kill('SIGUSR2'); } catch { /* checked through the ack */ }
      for (let n = 0; n < 50 && !sealed; n++) { try { sealed = fsx.readFileSync(L.sealAck, 'utf8') === 'sealed\n'; } catch { await d.sleep(200); } }
      if (sealed) out('BRIDGE_SEALED'); else fail('BRIDGE_E_SEAL');
    }
    // 2. Container teardown by create state.
    let container = !createTried ? 'LANE_NO_CONTAINER' : 'UNRESOLVED';
    if (createTried && !cid) fail('LANE_E_CID_UNKNOWN');
    if (cid) {
      let waited = true;
      if (startInvoked) {
        const st = await x('docker', ['stop', '-t', '10', cid], { timeout: 30000 });
        if (st.timedOut) fail('LANE_E_STOP_TIMEOUT'); else if (!st.ok || String(st.stdout).trim() !== cid) fail('LANE_E_STOP'); else out('LANE_STOP_OK');
        const w = await x('docker', ['wait', cid], { timeout: 30000 });
        waited = w.ok && /^-?\d+$/.test(String(w.stdout).trim());
        if (!waited) fail('LANE_E_STOP_WAIT');
      } else out('LANE_STOP_SKIPPED_NEVER_STARTED');
      const i = await x('docker', ['container', 'inspect', cid]);
      let obj = null;
      try { obj = JSON.parse(i.stdout)[0]; } catch { obj = null; }
      const seen = i.ok && !!obj && obj.Id === cid;
      const neverStarted = seen && !startInvoked && createdNeverStarted(obj);
      const exited = seen && waited && startInvoked && exitStateOk(obj);
      if (exited) out('LANE_EXIT_STATE_OK'); else if (neverStarted) out('LANE_CREATED_NEVER_STARTED'); else fail('LANE_E_EXIT_STATE');
      if (exited || neverStarted) {
        const rm = await x('docker', ['rm', cid], { timeout: 30000 });
        if (!rm.ok || String(rm.stdout).trim() !== cid) fail('LANE_E_RM'); else out('LANE_RM_OK');
        const ls = await x('docker', ['container', 'ls', '-a', '--no-trunc', '--filter', `id=${cid}`, '--format', '{{.ID}}'], { timeout: 30000 });
        const v = absenceVerdict(ls.ok, ls.stdout, cid);
        if (v === 'absent') { out('LANE_ABSENT'); container = 'LANE_ABSENT'; } else fail(v === 'present' ? 'LANE_E_STILL_PRESENT' : 'LANE_E_ABSENCE_UNDECIDED');
      }
    }
    // 3. Close and reap the bridge through OUR handle, always when started, regardless of the container result.
    let bridge = 'BRIDGE_NOT_STARTED';
    if (child && Number.isInteger(child.pid)) {
      bridge = 'UNRESOLVED';
      let reaped = child.exitCode !== null || child.signalCode !== null;
      const exitP = reaped ? Promise.resolve(child.exitCode) : new Promise((r) => child.once('exit', (code) => { reaped = true; r(code); }));
      let code = reaped ? child.exitCode : null;
      if (!reaped) {
        try { child.kill('SIGTERM'); } catch { /* reported by the reap check */ }
        code = await Promise.race([exitP, d.sleep(10000).then(() => 'timeout')]);
        if (code === 'timeout') { try { child.kill('SIGKILL'); } catch { /* reported below */ } await Promise.race([exitP, d.sleep(5000)]); fail('BRIDGE_E_TERMINATION'); }
      }
      let procGone = false;
      try { fsx.statSync(`/proc/${child.pid}`); procGone = false; } catch (e) { procGone = e?.code === 'ENOENT'; }
      if (reaped && procGone) { bridge = 'BRIDGE_REAPED'; out('BRIDGE_REAPED'); } else fail('BRIDGE_E_UNREAPED');
      let fin = null;
      try { fin = parseBridgeFinal(fsx.readFileSync(L.bridgeFinal, 'utf8')); } catch { fin = null; }
      if (bridge === 'BRIDGE_REAPED' && code === 0 && fin) {
        const open = fin.api.open + fin.db.open + fin.app.open;
        if (container === 'LANE_ABSENT' && open !== 0) fail('BRIDGE_E_DRAIN');
        else if (fin.listeners !== 'CLOSED') fail('BRIDGE_E_LISTENERS');
        else if (fin.closeBy !== 'OWNER') fail('BRIDGE_E_CEILING');
        else out('BRIDGE_FINAL_OK');
      } else fail('BRIDGE_E_FINAL');
    }
    if (clientUnreaped) fail('LANE_E_CLIENT_UNREAPED');
    const gates = [`GATE CONTAINER ${container}`, `GATE BRIDGE ${bridge}`, `GATE CLIENTS ${clientUnreaped ? 'UNRESOLVED' : 'REAPED'}`,
      `GATE STARTED ${startInvoked ? 'YES' : 'NO'}`];
    for (const g of gates) out(g);
    out('LANE_GATES_END');
    try { d.files.put(L.gates, `${say.join('\n')}\n`); } catch { ok = false; say.push('LANE_E_GATES_RECEIPT'); }
  }
  return { ok: ok && laneExit === 0, say };
}

if (process.argv[1] && /le-lane\/run-lane\.mjs$/.test(process.argv[1])) {
  process.umask(0o077);
  // E1 (unchanged):  run-lane.mjs <C> <P> <R> <node> <shell> <api origin> <db url> <commit>
  // SYNTHETIC:       run-lane.mjs --synthetic <C> <runner temp> <run id> <attempt> <R> <node> <shell> <commit>
  const a = process.argv.slice(2);
  let o;
  if (a[0] === '--synthetic') { const [, C, T, runId, attempt, R, node, shell, commit] = a; o = { target: 'SYNTHETIC', C, T, runId, attempt, R, node, shell, commit }; }
  else { const [C, P, R, node, shell, apiOrigin, dbUrl, commit] = a; o = { C, P, R, node, shell, apiOrigin, dbUrl, commit }; }
  runLane(realDeps, o)
    .then((r) => { for (const l of r.say) console.log(l); process.exit(r.ok ? 0 : 1); })
    .catch(() => { console.log('LANE_E_UNCLASSIFIED'); process.exit(1); });
}
