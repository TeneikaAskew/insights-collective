// ABOUTME: Pure contract for the sealed E1 lane container: exact paths, environment, docker create argv, inspect expectation,
// ABOUTME: the closed lane-output grammar, the host gate receipts and the summary plan. No I/O, no process, no network here.
//
// SOURCE CANDIDATE r3 (design r7, T's binding corrections of 2026-11-04 01:09Z, the f47b3553 review of 01:55Z and the e1a76692 review of 02:21Z). Unrun.
// Nothing here proves E1.
import path from 'node:path';
import { CID, IMAGE_ID, compareInspect, goCompact } from '../le-iso/expect.mjs';

export { CID, IMAGE_ID };

/** PostgreSQL client major shipped into the lane image (the REAL binary, never the pg_wrapper Perl script at /usr/bin/psql). */
export const PG_MAJOR = '16';
export const PSQL_REAL = `/usr/lib/postgresql/${PG_MAJOR}/bin/psql`;
/**
 * The ONE Node executable inside the lane: the host's toolcache Node (the job's `command -v node`) is copied, byte for byte
 * and hash-recorded, to this path in the image rootfs. It is on the enforced PATH (IMAGE_PATH_ENV contains /usr/bin), so the
 * unchanged run.sh's bare `node` calls, the Playwright runner's forked workers (process.execPath) and the supervisor's own
 * children all run this one file. The container Cmd uses it too. The host toolcache path never exists inside the lane.
 */
export const LANE_NODE = '/usr/bin/node';
/** The image's only Config.Env entry. No /bin: the image has /usr/bin only. */
export const IMAGE_PATH_ENV = `PATH=/usr/lib/postgresql/${PG_MAJOR}/bin:/usr/bin`;
/** Closed tool list (besides node at LANE_NODE, psql and the browser directory). run.sh, stack-checks.sh redact (sed) and pin_harness (git). */
export const TOOLS = Object.freeze(['bash', 'env', 'mktemp', 'rm', 'mkdir', 'wc', 'basename', 'dirname', 'cat', 'find', 'grep', 'sed', 'head', 'git']);
export const TOOL_PATHS = Object.freeze(TOOLS.map((t) => `/usr/bin/${t}`));
/** No fonts are shipped. Rendering without fonts is UNPROVED for E1 (decision recorded; nothing claims DOM rendering is unaffected). */
export const FONTS_SHIPPED = false;

/** Container resource bounds (proposed values; exact once reviewed). */
export const LANE_LIMITS = Object.freeze({ NanoCpus: 2_000_000_000, Memory: 4_294_967_296, MemorySwap: 4_294_967_296, PidsLimit: 1024, ShmSize: 1_073_741_824 });
export const LANE_WAIT_MS = 900_000;
export const APP_ORIGIN = 'http://127.0.0.1:8080';

export function laneTmpfsSpec(uid, gid) {
  if (!Number.isInteger(uid) || !Number.isInteger(gid) || uid < 0 || gid < 0) throw new Error('laneTmpfsSpec: integer uid/gid required');
  return `rw,nosuid,nodev,size=512m,mode=0700,uid=${uid},gid=${gid}`;
}

/** Every host path, from the private parent P, the control dir C and the repo R. Container paths are identical. */
export function lanePaths(P, C, R) {
  for (const p of [P, C, R]) if (typeof p !== 'string' || !path.isAbsolute(p) || p !== path.normalize(p) || p.endsWith('/') || /[\0\n:,=]/.test(p)) throw new Error('lanePaths: canonical absolute paths required');
  const j = path.join;
  return Object.freeze({
    P, C, R,
    keys: j(P, 'keys'), anon: j(P, 'keys', 'anon'), service: j(P, 'keys', 'service'), dbpass: j(P, 'dbpass'),
    proofDir: j(P, 'proof'), proof: j(P, 'proof', 'pairing-proof.json'), pairRaw: j(P, 'pair-raw'), sock: j(P, 'sock'),
    lane: j(P, 'lane'), work: j(P, 'lane', 'work'), evidence: j(P, 'lane', 'evidence'),
    output: j(P, 'lane', 'evidence', 'pw-output'), report: j(P, 'lane', 'evidence', 'report.json'),
    out: j(P, 'out'), laneTxt: j(P, 'out', 'lane.txt'), setupTxt: j(P, 'out', 'setup.txt'), pwExit: j(P, 'out', 'pw-exit'),
    ctx: j(C, 'ctx'), iid: j(C, 'image.id'), manifest: j(C, 'manifest.sha256'), started: j(C, 'run-lane.started'),
    createInvoked: j(C, 'create-invoked'), cidfile: j(C, 'lane.cid'), bridgeReady: j(C, 'bridge-ready'), sealAck: j(C, 'seal-ack'),
    bridgeFinal: j(C, 'bridge-final'), gates: j(C, 'gates.txt'), imageBuildRec: j(C, 'image-build.rec'), imageCleanupRec: j(C, 'image-cleanup.rec'),
    entry: j(R, 'scripts/e2e/le-lane/lane-entry.mjs'), bridge: j(R, 'scripts/e2e/le-lane/bridge.mjs'),
    seccomp: j(R, 'scripts/e2e/le-iso/seccomp/chromium147.json'),
  });
}

/** The seven binds, in create order: [host, container, rw]. Host and container paths are the same absolute path. */
export function laneBinds(L) {
  return [[L.R, false], [L.keys, false], [L.dbpass, false], [L.proofDir, false], [L.sock, false], [L.lane, true], [L.out, true]];
}

/** Exact environment keys, in -e order. Nothing else may be passed (no E2E_*_PASSWORD, SUPABASE_*, VITE_*, PG*, other PLAYWRIGHT_*). */
export const ENV_KEYS = Object.freeze(['HOME', 'TMPDIR', 'CI', 'LE_APP_ORIGIN', 'LE_API_ORIGIN', 'LE_DB_URL', 'LE_DB_PASSWORD_FILE',
  'LE_KEYS_DIR', 'LE_PROOF_FILE', 'LE_SOCK_DIR', 'LE_LANE_DIR', 'LE_OUT_DIR', 'LE_WORK_DIR', 'LE_EVIDENCE_DIR', 'LE_OUTPUT_DIR',
  'LE_REPORT_JSON', 'E2E_EVIDENCE_COMMIT', 'E2E_EVIDENCE_ENVIRONMENT', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']);

const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/;
/** Ports of the three bridged services, from the validated environment values. Throws on anything else. */
export function lanePorts({ apiOrigin, dbUrl, appOrigin = APP_ORIGIN }) {
  const a = LOOPBACK_ORIGIN.exec(apiOrigin ?? ''), p = LOOPBACK_ORIGIN.exec(appOrigin ?? '');
  if (!a || !p) throw new Error('lanePorts: loopback origins required');
  let u;
  try { u = new URL(dbUrl); } catch { throw new Error('lanePorts: db url'); }
  if (u.protocol !== 'postgresql:' || u.hostname !== '127.0.0.1' || u.password !== '' || !/^[1-9]\d{0,4}$/.test(u.port)) throw new Error('lanePorts: password-free loopback postgresql url required');
  const ports = { api: Number(a[1]), db: Number(u.port), app: Number(p[1]) };
  if (Object.values(ports).some((n) => n > 65535) || new Set(Object.values(ports)).size !== 3) throw new Error('lanePorts: three distinct ports required');
  return ports;
}

/** The exact -e values. Throws unless every input is in its closed form. */
export function laneEnv(L, { apiOrigin, dbUrl, commit, shell }) {
  lanePorts({ apiOrigin, dbUrl });
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('laneEnv: commit');
  if (typeof shell !== 'string' || !path.isAbsolute(shell) || /[\0\n]/.test(shell)) throw new Error('laneEnv: shell');
  const v = {
    HOME: '/tmp', TMPDIR: '/tmp', CI: 'true', LE_APP_ORIGIN: APP_ORIGIN, LE_API_ORIGIN: apiOrigin, LE_DB_URL: dbUrl,
    LE_DB_PASSWORD_FILE: L.dbpass, LE_KEYS_DIR: L.keys, LE_PROOF_FILE: L.proof, LE_SOCK_DIR: L.sock, LE_LANE_DIR: L.lane,
    LE_OUT_DIR: L.out, LE_WORK_DIR: L.work, LE_EVIDENCE_DIR: L.evidence, LE_OUTPUT_DIR: L.output, LE_REPORT_JSON: L.report,
    E2E_EVIDENCE_COMMIT: commit, E2E_EVIDENCE_ENVIRONMENT: 'isolated-local-stack', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: shell,
  };
  return ENV_KEYS.map((k) => `${k}=${v[k]}`);
}

/** The ONE docker create argv. */
export function laneCreateArgs(L, { imageId, uid, gid, env }) {
  if (!IMAGE_ID.test(imageId ?? '')) throw new Error('laneCreateArgs: image id');
  if (!Array.isArray(env) || env.length !== ENV_KEYS.length || env.some((e, i) => !e.startsWith(`${ENV_KEYS[i]}=`) || /[\0\n]/.test(e))) throw new Error('laneCreateArgs: env');
  const a = ['create', '--cidfile', L.cidfile,
    '--user', `${uid}:${gid}`, '--network', 'none', '--ipc', 'private', '--cgroupns', 'private',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${L.seccomp}`,
    '--read-only', '--tmpfs', `/tmp:${laneTmpfsSpec(uid, gid)}`, '--restart', 'no', '--log-driver', 'none', '--init',
    '--cpus', String(LANE_LIMITS.NanoCpus / 1e9), '--memory', String(LANE_LIMITS.Memory), '--memory-swap', String(LANE_LIMITS.MemorySwap),
    '--pids-limit', String(LANE_LIMITS.PidsLimit), '--shm-size', String(LANE_LIMITS.ShmSize),
    '--workdir', L.R];
  for (const [p, rw] of laneBinds(L)) a.push('-v', `${p}:${p}:${rw ? 'rw' : 'ro'},rprivate`);
  for (const e of env) a.push('-e', e);
  a.push(imageId, LANE_NODE, L.entry, L.R);
  return a;
}

/** Fields the lane inspect gate can report (names only; never values). Extends the probe's CONFIG_FIELDS. */
export const LANE_CONFIG_FIELDS = Object.freeze(['Env', 'Cmd', 'Entrypoint', 'WorkingDir', 'Tty', 'OpenStdin', 'StdinOnce', 'AttachStdin',
  'AttachStdout', 'AttachStderr', 'Labels', 'Hostname', 'Domainname', 'OnBuild', 'StopSignal', 'Healthcheck', 'ConfigImage']);

/** The exact expectation for `docker container inspect <cid>`. */
export function expectedLaneConfig(L, { imageId, uid, gid, env, seccompText, cid }) {
  const binds = laneBinds(L);
  return {
    Image: imageId, User: `${uid}:${gid}`,
    NetworkMode: 'none', PidMode: '', IpcMode: 'private', UTSMode: '', UsernsMode: '', CgroupnsMode: 'private',
    Privileged: false, ReadonlyRootfs: true, PublishAllPorts: false, CapAdd: [], CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges', `seccomp=${goCompact(seccompText)}`],
    Devices: [], DeviceCgroupRules: [], VolumesFrom: [], Links: [], ExtraHosts: [], Dns: [], DnsSearch: [], DnsOptions: [],
    RestartPolicy: { Name: 'no', MaximumRetryCount: 0 }, LogConfig: { Type: 'none' }, AutoRemove: false, Init: true,
    // tmpfs lives ONLY in HostConfig.Tmpfs; Docker 28 does not list it in inspect.Mounts.
    Tmpfs: { '/tmp': laneTmpfsSpec(uid, gid) },
    Binds: binds.map(([p, rw]) => `${p}:${p}:${rw ? 'rw' : 'ro'},rprivate`),
    PortBindings: {},
    ...LANE_LIMITS,
    // inspect.Mounts: EXACTLY the seven binds (no tmpfs entry, no volume), each with Source, Destination, RW and Propagation.
    EffectiveMounts: binds.map(([p, rw]) => ({ Type: 'bind', Source: p, Destination: p, RW: rw, Propagation: 'rprivate' }))
      .sort((a, b) => a.Destination.localeCompare(b.Destination)),
    Config: {
      Env: [IMAGE_PATH_ENV, ...env].sort(), Cmd: [LANE_NODE, L.entry, L.R], WorkingDir: L.R, Hostname: typeof cid === 'string' ? cid.slice(0, 12) : null,
    },
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Field names that differ from the exact lane expectation (empty = exact). Everything the probe's reviewed compareInspect
 * checks, plus the container Config: Env (exact multiset, no duplicate), Cmd, Entrypoint null, WorkingDir, the stdio/tty
 * flags, Labels {}, Hostname = full-CID prefix 12, Domainname '', OnBuild null, no StopSignal/Healthcheck, Config.Image.
 */
export function compareLaneInspect(inspect, exp) {
  const bad = compareInspect(inspect, exp);
  if (bad.includes('INSPECT')) return bad;
  const c = inspect.Config;
  if (!c || typeof c !== 'object') return [...bad, 'Env', 'Cmd', 'Entrypoint', 'WorkingDir'];
  const env = Array.isArray(c.Env) ? c.Env : null;
  if (!env || env.some((e) => typeof e !== 'string') || new Set(env.map((e) => e.split('=')[0])).size !== env.length || !same([...env].sort(), exp.Config.Env)) bad.push('Env');
  if (!same(c.Cmd, exp.Config.Cmd)) bad.push('Cmd');
  if (!has(c, 'Entrypoint') || c.Entrypoint !== null) bad.push('Entrypoint');
  if (c.WorkingDir !== exp.Config.WorkingDir) bad.push('WorkingDir');
  for (const k of ['Tty', 'OpenStdin', 'StdinOnce', 'AttachStdin']) if (c[k] !== false) bad.push(k);
  for (const k of ['AttachStdout', 'AttachStderr']) if (c[k] !== true) bad.push(k);
  if (!same(c.Labels, {})) bad.push('Labels');
  if (typeof exp.Config.Hostname !== 'string' || c.Hostname !== exp.Config.Hostname) bad.push('Hostname');
  if (c.Domainname !== '') bad.push('Domainname');
  if (!has(c, 'OnBuild') || c.OnBuild !== null) bad.push('OnBuild');
  if (has(c, 'StopSignal')) bad.push('StopSignal');
  if (has(c, 'Healthcheck')) bad.push('Healthcheck');
  if (c.Image !== exp.Image) bad.push('ConfigImage');
  return bad;
}

/** Image check after build (exact): one layer, linux/amd64, user, Env exactly the PATH entry, no Entrypoint/Cmd/WorkingDir etc. */
export function imageConfigProblems(img, { id, uid, gid }) {
  if (!img || typeof img !== 'object') return ['INSPECT'];
  const bad = [];
  const c = img.Config ?? {};
  if (img.Id !== id) bad.push('Id');
  if (img.Os !== 'linux') bad.push('Os');
  if (img.Architecture !== 'amd64') bad.push('Architecture');
  if ((img.RootFS?.Layers ?? []).length !== 1) bad.push('Layers');
  if (c.User !== `${uid}:${gid}`) bad.push('User');
  if (!same(c.Env, [IMAGE_PATH_ENV])) bad.push('Env');
  for (const k of ['Entrypoint', 'Cmd']) if (c[k] != null) bad.push(k);
  if ((c.WorkingDir ?? '') !== '') bad.push('WorkingDir');
  for (const k of ['Volumes', 'ExposedPorts', 'Labels']) if (c[k] != null && Object.keys(c[k]).length) bad.push(k);
  for (const k of ['OnBuild', 'Healthcheck', 'StopSignal']) if (c[k] != null && !(Array.isArray(c[k]) && c[k].length === 0)) bad.push(k);
  return bad;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lane output (P/out/lane.txt): written by the CONTAINER, so it is untrusted data parsed against a closed grammar.

export const PRECHECK_CODES = Object.freeze(['LANE_E_UMASK', 'LANE_E_ENV', 'LANE_E_APPARMOR', 'LANE_E_CLOSURE', 'LANE_E_FORWARD',
  'LANE_E_BRIDGE_REACH', 'LANE_E_SESSION_PARENT', 'LANE_E_PAIR_RECHECK']);
export const LANE_APPARMOR = Object.freeze(['APPARMOR_DOCKER_DEFAULT_ENFORCE', 'APPARMOR_E_UNKNOWN', 'APPARMOR_E_UNCONFINED',
  'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE', 'APPARMOR_E_OTHER_PROFILE']);

/**
 * Parse lane.txt. Shapes (each line exactly once, in order):
 *   LANE START, LANE APPARMOR <code>, LANE SETUP NOT RUN <precheck code>, LANE END
 *   LANE START, LANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE, LANE SETUP PASS|FAIL, LANE E1 RAN|NOT RUN,
 *     [only after E1 RAN] LANE E1 APPARMOR PRE <worker> <browser> POST <worker> <browser> | LANE E1 APPARMOR MISSING|INVALID,
 *     LANE CLEANUP PASS|FAIL, LANE END
 * The E1 APPARMOR line is the WORKER-side evidence (egress-test.ts laneAppArmorGate), copied from the report annotation.
 * A valid prefix without LANE END is { ok: true, interrupted: true }. Anything else is { ok: false }.
 */
export function parseLaneOut(text) {
  if (typeof text !== 'string' || text.length > 4096 || (text !== '' && !text.endsWith('\n'))) return { ok: false };
  const ls = text === '' ? [] : text.slice(0, -1).split('\n');
  const r = { ok: true, interrupted: true, apparmor: null, setup: null, precheck: null, e1: null, workerAppArmor: null, cleanup: null };
  const want = (i) => ls[i];
  let i = 0;
  if (ls.length === 0) return r;
  if (want(i++) !== 'LANE START') return { ok: false };
  if (i >= ls.length) return r;
  const m = /^LANE APPARMOR ([A-Z_]+)$/.exec(want(i++));
  if (!m || !LANE_APPARMOR.includes(m[1])) return { ok: false };
  r.apparmor = m[1];
  if (i >= ls.length) return r;
  const s = want(i++);
  const n = /^LANE SETUP NOT RUN ([A-Z_]+)$/.exec(s);
  if (n) {
    if (!PRECHECK_CODES.includes(n[1])) return { ok: false };
    if ((r.apparmor !== LANE_APPARMOR[0]) !== (n[1] === 'LANE_E_APPARMOR')) return { ok: false };
    r.setup = 'NOT_RUN'; r.precheck = n[1];
  } else if (s === 'LANE SETUP PASS' || s === 'LANE SETUP FAIL') {
    if (r.apparmor !== LANE_APPARMOR[0]) return { ok: false };
    r.setup = s.slice(11);
    if (i >= ls.length) return r;
    const e = want(i++);
    if (e === 'LANE E1 RAN') { if (r.setup !== 'PASS') return { ok: false }; r.e1 = 'RAN'; } else if (e === 'LANE E1 NOT RUN') r.e1 = 'NOT_RUN'; else return { ok: false };
    if (i >= ls.length) return r;
    if (r.e1 === 'RAN') {
      const w = workerAppArmorLine(want(i++));
      if (!w) return { ok: false };
      r.workerAppArmor = w;
      if (i >= ls.length) return r;
    }
    const c = want(i++);
    if (c === 'LANE CLEANUP PASS' || c === 'LANE CLEANUP FAIL') r.cleanup = c.slice(13); else return { ok: false };
  } else return { ok: false };
  if (i >= ls.length) return r;
  if (want(i++) !== 'LANE END' || i !== ls.length) return { ok: false };
  r.interrupted = false;
  return r;
}

const AA_CODE = `(${LANE_APPARMOR.join('|')})`;
const AA_EVIDENCE = new RegExp(`^PRE ${AA_CODE} ${AA_CODE} POST ${AA_CODE} ${AA_CODE}$`);
/** The worker-side evidence text (annotation description) to { state: 'EVIDENCE', codes, enforced } or null. */
export function workerAppArmorEvidence(text) {
  const m = typeof text === 'string' ? AA_EVIDENCE.exec(text) : null;
  if (!m) return null;
  const codes = m.slice(1, 5);
  return { state: 'EVIDENCE', codes, enforced: codes.every((c) => c === LANE_APPARMOR[0]) };
}
/** One `LANE E1 APPARMOR ...` line. */
export function workerAppArmorLine(line) {
  if (line === 'LANE E1 APPARMOR MISSING' || line === 'LANE E1 APPARMOR INVALID') return { state: line.slice(17), codes: null, enforced: false };
  return typeof line === 'string' && line.startsWith('LANE E1 APPARMOR ') ? workerAppArmorEvidence(line.slice(17)) : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Host gate receipts (C/gates.txt), written by run-lane.mjs in its own finally. Verified by gates.mjs in later steps.

export const GATE_VALUES = Object.freeze({
  CONTAINER: ['LANE_NO_CONTAINER', 'LANE_ABSENT', 'UNRESOLVED'],
  BRIDGE: ['BRIDGE_NOT_STARTED', 'BRIDGE_REAPED', 'UNRESOLVED'],
  CLIENTS: ['REAPED', 'UNRESOLVED'],
  STARTED: ['YES', 'NO'],
});
export const GATE_KEYS = Object.freeze(Object.keys(GATE_VALUES));

/** Parse the final gate block: exactly one `GATE <KEY> <VALUE>` per key in order, then LANE_GATES_END, as the last lines. */
export function parseGates(text) {
  if (typeof text !== 'string' || text.length > 65536 || !text.endsWith('LANE_GATES_END\n')) return null;
  const ls = text.slice(0, -1).split('\n');
  const tail = ls.slice(-(GATE_KEYS.length + 1));
  if (tail.length !== GATE_KEYS.length + 1) return null;
  const g = {};
  for (let i = 0; i < GATE_KEYS.length; i++) {
    const m = /^GATE ([A-Z]+) ([A-Z_]+)$/.exec(tail[i]);
    if (!m || m[1] !== GATE_KEYS[i] || !GATE_VALUES[m[1]].includes(m[2])) return null;
    g[m[1]] = m[2];
  }
  if (ls.slice(0, -(GATE_KEYS.length + 1)).some((l) => l.startsWith('GATE ') || l === 'LANE_GATES_END')) return null;
  // Internal consistency: "no container" only when the lane never started; a started lane needs a proven absence.
  if (g.CONTAINER === 'LANE_NO_CONTAINER' && g.STARTED !== 'NO') return null;
  return g;
}

/** Lane teardown verdict for later steps. `runLaneStarted` = the run-lane.started receipt exists. */
export function laneVerdict({ runLaneStarted, gatesText }) {
  if (!runLaneStarted) return { ok: true, container: 'LANE_NO_CONTAINER', bridge: 'BRIDGE_NOT_STARTED', clients: 'REAPED', started: 'NO', source: 'NOT_INVOKED' };
  const g = parseGates(gatesText);
  if (!g) return { ok: false, container: 'UNRESOLVED', bridge: 'UNRESOLVED', clients: 'UNRESOLVED', started: 'UNKNOWN', source: 'OWNER_LOST' };
  const ok = g.CONTAINER !== 'UNRESOLVED' && g.BRIDGE !== 'UNRESOLVED' && g.CLIENTS === 'REAPED';
  return { ok, container: g.CONTAINER, bridge: g.BRIDGE, clients: g.CLIENTS, started: g.STARTED, source: 'RECEIPT' };
}

// ---------------------------------------------------------------------------------------------------------------------
// Host image records (C/image-build.rec, C/image-cleanup.rec), written once (wx) by image.mjs and read by every later step.
// They carry docker/ldd CLIENT state across workflow steps: an unreaped client or an unknown result is never read as clean.

export const IMAGE_BUILD_RESULTS = Object.freeze(['LANE_IMAGE_OK', 'LANE_E_IMAGE_INPUT', 'LANE_E_IMAGE_CLOSURE', 'LANE_E_IMAGE_MANIFEST',
  'LANE_E_IMAGE_BUILD', 'LANE_E_IMAGE_CONFIG', 'LANE_E_IMAGE_UNCLASSIFIED']);
export function imageBuildRecord({ invoked, id, clientsReaped, result }) {
  return `BUILD_INVOKED ${invoked ? 'YES' : 'NO'}\nIMAGE_ID ${!invoked ? 'NONE' : id ?? 'UNKNOWN'}\nCLIENTS ${clientsReaped ? 'REAPED' : 'UNRESOLVED'}\nRESULT ${result}\nEND\n`;
}
/** { invoked, id (string|'NONE'|'UNKNOWN'), clients, result } or null. Consistency: NONE iff not invoked. */
export function parseImageBuildRecord(text) {
  const m = typeof text === 'string' ? /^BUILD_INVOKED (YES|NO)\nIMAGE_ID (NONE|UNKNOWN|sha256:[0-9a-f]{64})\nCLIENTS (REAPED|UNRESOLVED)\nRESULT ([A-Z_]+)\nEND\n$/.exec(text) : null;
  if (!m || !IMAGE_BUILD_RESULTS.includes(m[4]) || (m[1] === 'NO') !== (m[2] === 'NONE')) return null;
  if (m[4] === 'LANE_IMAGE_OK' && (m[1] !== 'YES' || !m[2].startsWith('sha256:'))) return null;
  return { invoked: m[1] === 'YES', id: m[2], clients: m[3], result: m[4] };
}
export const IMAGE_CLEANUP_CODES = Object.freeze(['LANE_IMAGE_NOT_BUILT', 'LANE_IMAGE_REMOVED', 'LANE_E_IMAGE_RECORD', 'LANE_E_IMAGE_BUILD_CLIENTS_UNRESOLVED',
  'LANE_E_IMAGE_ID', 'LANE_E_IMAGE_HELD_UNRESOLVED', 'LANE_E_IMAGE_CLIENT_UNREAPED', 'LANE_E_IMAGE_REMOVE', 'LANE_E_IMAGE_ABSENCE', 'LANE_E_IMAGE_STILL_PRESENT']);
export function imageCleanupRecord({ code, clientsReaped }) {
  const clean = clientsReaped && (code === 'LANE_IMAGE_NOT_BUILT' || code === 'LANE_IMAGE_REMOVED');
  return `IMAGE_CLEANUP ${code}\nCLIENTS ${clientsReaped ? 'REAPED' : 'UNRESOLVED'}\nRESULT ${clean ? 'CLEAN' : 'UNRESOLVED'}\nEND\n`;
}
export function parseImageCleanupRecord(text) {
  const m = typeof text === 'string' ? /^IMAGE_CLEANUP ([A-Z_]+)\nCLIENTS (REAPED|UNRESOLVED)\nRESULT (CLEAN|UNRESOLVED)\nEND\n$/.exec(text) : null;
  if (!m || !IMAGE_CLEANUP_CODES.includes(m[1])) return null;
  const clean = m[2] === 'REAPED' && ['LANE_IMAGE_NOT_BUILT', 'LANE_IMAGE_REMOVED'].includes(m[1]);
  if ((m[3] === 'CLEAN') !== clean) return null;
  return { code: m[1], clients: m[2], result: m[3] };
}

/**
 * The cleanup scope decision (le_private). Two separate answers:
 *  - secrets: LANE_SECRET_SCOPE (lane only: lane/bridge/docker-client gates verified and host private paths removed) and
 *    SECRET_CLEANUP_EFFECTIVE, which ALSO needs every other credential consumer proven stopped: the preview server, the
 *    stack, the psql producers. Each consumer counts only on step outcome 'success'; anything else is UNRESOLVED.
 *  - controls: the non-secret control dir C may be removed only when the lane verdict is clean AND both image records are
 *    present, parseable and clean (build clients reaped, image removed or never built, cleanup clients reaped).
 */
export function cleanupScope({ verdict, privateRemoved, outcomes, buildRec, cleanupRec, controlsPresent }) {
  const laneClean = !!verdict?.ok;
  const laneScope = laneClean && privateRemoved === true;
  const bad = [];
  for (const k of ['preview', 'stack', 'producers']) if (outcomes?.[k] !== 'success') bad.push(k);
  if (!laneClean) bad.push('lane');
  if (privateRemoved !== true) bad.push('private');
  const b = parseImageBuildRecord(buildRec), c = parseImageCleanupRecord(cleanupRec);
  const controls = !controlsPresent ? 'NONE' : laneClean && b && b.clients === 'REAPED' && c && c.result === 'CLEAN' ? 'REMOVE' : 'KEEP';
  return {
    effective: bad.length === 0,
    lines: [`LANE_SECRET_SCOPE ${laneScope ? 'CLEAN' : 'UNRESOLVED'}`,
      bad.length === 0 ? 'SECRET_CLEANUP_EFFECTIVE' : `SECRET_CLEANUP_UNRESOLVED ${bad.join(',')}`,
      `CONTROLS ${controls}`],
    controls,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Summary plan: which fixed-line producer runs, with which validated inputs. Never fabricates run.sh evidence.

/**
 * @param {{ verdict: ReturnType<typeof laneVerdict>, laneText: string|null, pwExit: { state: 'absent'|'ok'|'bad', digits?: string } }} x
 * @returns {{ kind: 'skip' } | { kind: 'notrun', at: string, code: string } | { kind: 'refused', code: string } | { kind: 'summary', pw: string, setup: string, cleanup: string }}
 */
export function planSummary({ verdict, laneText, pwExit }) {
  if (!verdict?.ok) return { kind: 'skip' };
  if (verdict.started === 'NO') return laneText === null ? { kind: 'notrun', at: 'not-started', code: 'LANE_NOT_STARTED' } : { kind: 'refused', code: 'LE_SUM_E_LANE_OUT' };
  if (laneText === null) return { kind: 'refused', code: 'LE_SUM_E_LANE_OUT' };
  const o = parseLaneOut(laneText);
  if (!o.ok) return { kind: 'refused', code: 'LE_SUM_E_LANE_OUT' };
  if (o.interrupted) return { kind: 'refused', code: 'LE_SUM_E_LANE_INTERRUPTED' };
  if (o.setup === 'NOT_RUN') return pwExit.state === 'absent' ? { kind: 'notrun', at: 'lane-precheck', code: o.precheck } : { kind: 'refused', code: 'LE_SUM_E_PW_UNEXPECTED' };
  let pw;
  if (o.e1 === 'RAN') {
    if (pwExit.state === 'absent') return { kind: 'refused', code: 'LE_SUM_E_PW_MISSING' };
    if (pwExit.state !== 'ok' || !/^\d{1,3}$/.test(pwExit.digits ?? '') || Number(pwExit.digits) > 255) return { kind: 'refused', code: 'LE_SUM_E_PW' };
    pw = String(Number(pwExit.digits));
    if (!o.workerAppArmor?.enforced) return { kind: 'refused', code: 'LE_SUM_E_WORKER_APPARMOR' };
  } else {
    if (pwExit.state !== 'absent') return { kind: 'refused', code: 'LE_SUM_E_PW_UNEXPECTED' };
    pw = '255';
  }
  return { kind: 'summary', pw, setup: o.setup, cleanup: o.cleanup };
}

/** pw-exit CONTENT (never its name): one to three digits and an optional newline. */
export function pwExitContent(text) {
  const m = typeof text === 'string' ? /^(\d{1,3})\n?$/.exec(text) : null;
  return m && Number(m[1]) <= 255 ? { state: 'ok', digits: m[1] } : { state: 'bad' };
}
