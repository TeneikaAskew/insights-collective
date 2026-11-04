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
/** The image's working directory, set by an explicit `WORKDIR /` and required exactly by imageConfigProblems. */
export const IMAGE_WORKDIR = '/';
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

// ---------------------------------------------------------------------------------------------------------------------
// Lifecycle-matrix SYNTHETIC target (DESIGN-r2 with r2.1 and r2.2; LOCAL candidate, unrun). Selection is closed: an unset target
// is E1 and every E1 value below is unchanged; 'SYNTHETIC' selects the synthetic container contract; anything else is refused
// before any other step. A synthetic run never produces an E1 line or an E1 acceptance (parseLaneOut refuses `LANE SYN`).

export const LE_TARGETS = Object.freeze(['E1', 'SYNTHETIC']);
/** Closed target selection: undefined -> 'E1'; 'E1' or 'SYNTHETIC' as given; anything else (including '') -> null (refused). */
export function laneTarget(value) {
  if (value === undefined) return 'E1';
  return typeof value === 'string' && LE_TARGETS.includes(value) ? value : null;
}
/** SYNTHETIC binds, closed set of three in create order: [R ro] [lane rw] [out rw]. No keys, dbpass, proof, sock or state. */
export function synBinds(L) {
  return [[L.R, false], [L.lane, true], [L.out, true]];
}
/** SYNTHETIC environment keys, in -e order. No app, API or DB origin, no key, password, proof or socket path. */
export const SYN_ENV_KEYS = Object.freeze(['HOME', 'TMPDIR', 'CI', 'LE_LANE_DIR', 'LE_OUT_DIR', 'LE_WORK_DIR', 'LE_EVIDENCE_DIR',
  'LE_OUTPUT_DIR', 'LE_REPORT_JSON', 'E2E_EVIDENCE_COMMIT', 'E2E_EVIDENCE_ENVIRONMENT', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', 'LE_TARGET']);
/** Names that must never reach a synthetic container (authentic inputs, and Playwright's baseURL default source). */
export const SYN_FORBIDDEN_ENV = Object.freeze(['LE_APP_ORIGIN', 'LE_API_ORIGIN', 'LE_DB_URL', 'LE_DB_PASSWORD_FILE', 'LE_KEYS_DIR',
  'LE_PROOF_FILE', 'LE_SOCK_DIR', 'PLAYWRIGHT_TEST_BASE_URL']);
export const SYN_EVIDENCE_ENVIRONMENT = 'synthetic-lifecycle-matrix';
/** The exact synthetic -e values. Throws unless every input is in its closed form. */
export function synEnv(L, { commit, shell }) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('synEnv: commit');
  if (typeof shell !== 'string' || !path.isAbsolute(shell) || /[\0\n]/.test(shell)) throw new Error('synEnv: shell');
  const v = {
    HOME: '/tmp', TMPDIR: '/tmp', CI: 'true', LE_LANE_DIR: L.lane, LE_OUT_DIR: L.out, LE_WORK_DIR: L.work, LE_EVIDENCE_DIR: L.evidence,
    LE_OUTPUT_DIR: L.output, LE_REPORT_JSON: L.report, E2E_EVIDENCE_COMMIT: commit, E2E_EVIDENCE_ENVIRONMENT: SYN_EVIDENCE_ENVIRONMENT,
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: shell, LE_TARGET: 'SYNTHETIC',
  };
  return SYN_ENV_KEYS.map((k) => `${k}=${v[k]}`);
}
/** Binds and env keys for a selected target. A target other than exactly 'SYNTHETIC' is the E1 contract, unchanged. */
const targetContract = (target) => (target === 'SYNTHETIC' ? { binds: synBinds, keys: SYN_ENV_KEYS } : { binds: laneBinds, keys: ENV_KEYS });

/** The synthetic private parent `<runner temp>/syn-<run id>-<attempt>`, from those three inputs ONLY (never an E1 path). */
export function synParent(runnerTemp, runId, attempt) {
  if (typeof runnerTemp !== 'string' || !path.isAbsolute(runnerTemp) || runnerTemp !== path.normalize(runnerTemp) || runnerTemp.endsWith('/')
    || /[\0\n:,=]/.test(runnerTemp)) throw new Error('synParent: canonical absolute runner temp required');
  if (!/^[1-9]\d{0,19}$/.test(String(runId ?? '')) || !/^[1-9]\d{0,4}$/.test(String(attempt ?? ''))) throw new Error('synParent: run id and attempt');
  return path.join(runnerTemp, `syn-${runId}-${attempt}`);
}
/** Lane paths for the synthetic parent: the same layout as E1 (lane/, out/, work/, evidence/, pw-output, report, lane.txt). */
export function synLanePaths(runnerTemp, runId, attempt, C, R) {
  return lanePaths(synParent(runnerTemp, runId, attempt), C, R);
}
/** The directories createSynDirs makes, in creation order (each exclusive). */
export const synDirs = (L) => [L.P, L.lane, L.out, L.work, L.evidence, L.output];


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
export function laneCreateArgs(L, { imageId, uid, gid, env, target }) {
  if (target !== undefined && laneTarget(target) === null) throw new Error('laneCreateArgs: target');
  const { binds, keys } = targetContract(target);
  if (!IMAGE_ID.test(imageId ?? '')) throw new Error('laneCreateArgs: image id');
  if (!Array.isArray(env) || env.length !== keys.length || env.some((e, i) => !e.startsWith(`${keys[i]}=`) || /[\0\n]/.test(e))) throw new Error('laneCreateArgs: env');
  const a = ['create', '--cidfile', L.cidfile,
    '--user', `${uid}:${gid}`, '--network', 'none', '--ipc', 'private', '--cgroupns', 'private',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${L.seccomp}`,
    '--read-only', '--tmpfs', `/tmp:${laneTmpfsSpec(uid, gid)}`, '--restart', 'no', '--log-driver', 'none', '--init',
    '--cpus', String(LANE_LIMITS.NanoCpus / 1e9), '--memory', String(LANE_LIMITS.Memory), '--memory-swap', String(LANE_LIMITS.MemorySwap),
    '--pids-limit', String(LANE_LIMITS.PidsLimit), '--shm-size', String(LANE_LIMITS.ShmSize),
    '--workdir', L.R];
  for (const [p, rw] of binds(L)) a.push('-v', `${p}:${p}:${rw ? 'rw' : 'ro'},rprivate`);
  for (const e of env) a.push('-e', e);
  a.push(imageId, LANE_NODE, L.entry, L.R);
  return a;
}

/** Fields the lane inspect gate can report (names only; never values). Extends the probe's CONFIG_FIELDS. */
export const LANE_CONFIG_FIELDS = Object.freeze(['Env', 'Cmd', 'Entrypoint', 'WorkingDir', 'Tty', 'OpenStdin', 'StdinOnce', 'AttachStdin',
  'AttachStdout', 'AttachStderr', 'Labels', 'Hostname', 'Domainname', 'OnBuild', 'StopSignal', 'Healthcheck', 'ConfigImage']);

/** The exact expectation for `docker container inspect <cid>`. */
export function expectedLaneConfig(L, { imageId, uid, gid, env, seccompText, cid, target }) {
  if (target !== undefined && laneTarget(target) === null) throw new Error('expectedLaneConfig: target');
  const binds = targetContract(target).binds(L);
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
    // inspect.Mounts: EXACTLY the target's binds (seven for E1, three for SYNTHETIC; no tmpfs entry, no volume), each with Source, Destination, RW and Propagation.
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

/** Image check after build (exact): one layer, linux/amd64, user, Env exactly the PATH entry, WorkingDir exactly '/', no Entrypoint/Cmd etc.
 * The Dockerfile sets `WORKDIR /` explicitly so the expectation does not depend on which builder supplies the scratch default. */
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
  if (c.WorkingDir !== IMAGE_WORKDIR) bad.push('WorkingDir');
  for (const k of ['Volumes', 'ExposedPorts', 'Labels']) if (c[k] != null && Object.keys(c[k]).length) bad.push(k);
  for (const k of ['OnBuild', 'Healthcheck', 'StopSignal']) if (c[k] != null && !(Array.isArray(c[k]) && c[k].length === 0)) bad.push(k);
  return bad;
}

/** The only field names an image-check line may carry; anything else prints as UNKNOWN. */
export const IMAGE_CHECK_FIELDS = Object.freeze(['INSPECT', 'Id', 'Os', 'Architecture', 'Layers', 'User', 'Env', 'Entrypoint', 'Cmd', 'WorkingDir',
  'Volumes', 'ExposedPorts', 'Labels', 'OnBuild', 'Healthcheck', 'StopSignal']);
/** Closed set of value shapes. A class never carries the value itself, so an unexpected field is diagnosable without printing it. */
export const IMAGE_VALUE_CLASSES = Object.freeze(['NOT_APPLICABLE', 'ABSENT', 'NULL', 'EMPTY_STRING', 'ROOT', 'ABS_PATH', 'OTHER_STRING', 'EMPTY_ARRAY',
  'ARRAY', 'EMPTY_OBJECT', 'OBJECT', 'NUMBER', 'BOOLEAN', 'OTHER']);
export function imageValueClass(holder, key) {
  if (!holder || typeof holder !== 'object' || !Object.prototype.hasOwnProperty.call(holder, key)) return 'ABSENT';
  const v = holder[key];
  if (v === null) return 'NULL';
  if (typeof v === 'string') return v === '' ? 'EMPTY_STRING' : v === '/' ? 'ROOT' : v.startsWith('/') ? 'ABS_PATH' : 'OTHER_STRING';
  if (Array.isArray(v)) return v.length ? 'ARRAY' : 'EMPTY_ARRAY';
  if (typeof v === 'number') return 'NUMBER';
  if (typeof v === 'boolean') return 'BOOLEAN';
  if (typeof v === 'object') return Object.keys(v).length ? 'OBJECT' : 'EMPTY_OBJECT';
  return 'OTHER';
}
/** Fixed diagnostic lines for imageConfigProblems output: `LANE_IMAGE_FIELD <known field|UNKNOWN> <value class>`. Never raw data. */
export function imageFieldLines(img, bad) {
  const ok = img && typeof img === 'object';
  return (Array.isArray(bad) ? bad : []).map((f) => {
    if (!IMAGE_CHECK_FIELDS.includes(f)) return 'LANE_IMAGE_FIELD UNKNOWN NOT_APPLICABLE';
    let cls;
    if (f === 'INSPECT' || !ok) cls = 'NOT_APPLICABLE';
    else if (f === 'Layers') cls = imageValueClass(img.RootFS, 'Layers');
    else if (['Id', 'Os', 'Architecture'].includes(f)) cls = imageValueClass(img, f);
    else cls = imageValueClass(img.Config, f);
    return `LANE_IMAGE_FIELD ${f} ${cls}`;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Lane output (P/out/lane.txt): written by the CONTAINER, so it is untrusted data parsed against a closed grammar.

export const PRECHECK_CODES = Object.freeze(['LANE_E_UMASK', 'LANE_E_ENV', 'LANE_E_APPARMOR', 'LANE_E_CLOSURE', 'LANE_E_FORWARD',
  'LANE_E_BRIDGE_REACH', 'LANE_E_SESSION_PARENT', 'LANE_E_PAIR_RECHECK']);
export const LANE_APPARMOR = Object.freeze(['APPARMOR_DOCKER_DEFAULT_ENFORCE', 'APPARMOR_E_UNKNOWN', 'APPARMOR_E_UNCONFINED',
  'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE', 'APPARMOR_E_OTHER_PROFILE']);

// E1 diagnostics r1 (closed values only; diagnostic, never acceptance).
/** runChild result shapes: CLOSE_WITH_CODE = close supplied an exit code 0..255 (it can still follow timeout signalling);
 *  REAP_UNCONFIRMED = runChild's final unreaped fallback; NO_CODE = spawn throw, child error, close without a code, or any
 *  other shape. It never says SPAWN_FAILED, TIMED_OUT or RETURNED_NORMALLY: the wrapper does not record those. */
export const E1_RESULT_CLASSES = Object.freeze(['CLOSE_WITH_CODE', 'REAP_UNCONFIRMED', 'NO_CODE']);
export const REPORT_STATES = Object.freeze(['MISSING', 'INVALID', 'PARSED']);
/** The fixed codes e2e/lesson-editor/sandbox-launch.mjs and egress-test.ts throw (checked against those sources by test). */
export const REPORTED_ERROR_CODES = Object.freeze(['LANE_E_APPARMOR_POST', 'LANE_E_APPARMOR_PRE', 'LANE_E_BROWSER_CLOSE', 'LANE_E_CONNECT',
  'LANE_E_LAUNCH_HUNG', 'LANE_E_LAUNCH_LATE', 'LANE_E_LAUNCH_LATE_REJECTED', 'LANE_E_LAUNCH_REJECTED', 'LANE_E_SANDBOX_ARTIFACTS',
  'LANE_E_SANDBOX_DEFAULTS', 'LANE_E_SANDBOX_EFFECTIVE', 'LANE_E_SANDBOX_EXE', 'LANE_E_SANDBOX_OFF', 'LANE_E_SANDBOX_OPTION',
  'LANE_E_SANDBOX_PID', 'LANE_E_SANDBOX_UNREAD', 'LANE_E_SERVER_CLOSE', 'LANE_E_SERVER_KILL']);
export const REPORTED_ERROR_VALUES = Object.freeze([...REPORTED_ERROR_CODES, 'MULTIPLE', 'UNKNOWN']);

// E1 diagnostics r2 (closed values only; DIAGNOSTIC, never acceptance). Copies of the sandbox-launch.mjs and step-codes.mjs
// lists (this module may not import e2e/ code); a test checks each copy equals its source.
export const POST_READ_OUTCOMES = Object.freeze(['OK', 'BLANK', 'ENOENT', 'EACCES', 'EPERM', 'ESRCH', 'OTHER', 'NOT_TRIED', 'UNKNOWN']);
export const POST_EXIT_OBSERVATIONS = Object.freeze(['EXIT_OBSERVED', 'NO_EXIT_OBSERVED', 'UNKNOWN']);
export const E1_STEP_CODES = Object.freeze(['E1_OPEN', 'E1_BASELINE', 'E1_EDIT_TITLE', 'E1_EDIT_BODY', 'E1_SAVED', 'E1_SETTLE',
  'E1_ROW', 'E1_BODY', 'E1_RELOAD', 'E1_RELOAD_BODY', 'E1_EVIDENCE']);
/** Playwright's attempt status words, as closed upper-case tokens (lane.txt lines are upper-case only). */
const ATTEMPT_STATUS_MAP = Object.freeze({ passed: 'PASSED', failed: 'FAILED', timedOut: 'TIMED_OUT', interrupted: 'INTERRUPTED', skipped: 'SKIPPED' });
export const ATTEMPT_STATUSES = Object.freeze([...Object.values(ATTEMPT_STATUS_MAP), 'UNKNOWN']);
export const FAILED_STEP_TOKENS = Object.freeze([...E1_STEP_CODES, 'NONE', 'UNKNOWN']);
/** A status word to its token; anything else (inherited keys included) is UNKNOWN. Never a success verdict for E1. */
export function attemptStatusToken(status) {
  return typeof status === 'string' && Object.prototype.hasOwnProperty.call(ATTEMPT_STATUS_MAP, status) ? ATTEMPT_STATUS_MAP[status] : 'UNKNOWN';
}
/** failedStep()'s result (a listed code, 'none' or 'unknown') to its token; anything else is UNKNOWN. */
export function failedStepToken(step) {
  if (step === 'none') return 'NONE';
  return typeof step === 'string' && E1_STEP_CODES.includes(step) ? step : 'UNKNOWN';
}
const RO = `(${POST_READ_OUTCOMES.join('|')})`, EO = `(${POST_EXIT_OBSERVATIONS.join('|')})`;
const POST_OBSERVED = new RegExp(`^WORKER_READ ${RO} ${RO} BROWSER_READ ${RO} ${RO} EXIT ${EO} ${EO}$`);
/** The test-scoped gate's observation (annotation description) to { reads: {worker, browser}, exit: [before, after] } or null.
 *  A first attempt that returned (OK or BLANK) must have a NOT_TRIED fallback; a failed primary must have a tried fallback;
 *  a NOT_TRIED primary is impossible; UNKNOWN (no outcome noted) comes in pairs. */
export function postObservedEvidence(text) {
  const m = typeof text === 'string' ? POST_OBSERVED.exec(text) : null;
  if (!m) return null;
  const pairOk = (p, f) => p === 'UNKNOWN' ? f === 'UNKNOWN' : p === 'NOT_TRIED' ? false : (p === 'OK' || p === 'BLANK') ? f === 'NOT_TRIED' : f !== 'UNKNOWN' && f !== 'NOT_TRIED';
  if (!pairOk(m[1], m[2]) || !pairOk(m[3], m[4])) return null;
  return { reads: { worker: [m[1], m[2]], browser: [m[3], m[4]] }, exit: [m[5], m[6]] };
}

// E1 diagnostics r3 (closed values only; DIAGNOSTIC, never acceptance). Copies of the sandbox-launch.mjs lists; a test checks
// each copy equals its source.
export const BROWSER_EXIT_SIGNALS = Object.freeze(['SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGHUP', 'SIGILL', 'SIGINT', 'SIGKILL', 'SIGPIPE', 'SIGSEGV', 'SIGSYS', 'SIGTERM', 'SIGTRAP']);
export const BODY_END_PAGE_STATES = Object.freeze(['OPEN', 'CLOSED', 'CRASHED', 'CRASHED_CLOSED', 'UNKNOWN']);
export const BROWSER_EXIT_CHECKPOINTS = Object.freeze(['PAGE_TEARDOWN_START', 'GATE_POST', 'NOT_SEEN', 'UNKNOWN']);
const BROWSER_EXIT = new RegExp(`^SHAPE (CODE_(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)|${BROWSER_EXIT_SIGNALS.join('|')}|SIG_OTHER|NONE|UNKNOWN) FIRST_SEEN (${BROWSER_EXIT_CHECKPOINTS.join('|')}) BODY_END_PAGE (${BODY_END_PAGE_STATES.join('|')})$`);
// E1 browser-log r1: the closed codes of sandbox-launch.mjs BROWSER_LOG_CODES (the copy equals its source; a static test pins it).
export const BROWSER_LOG_CODES = Object.freeze(['GPU_UNUSABLE_REPORTED', 'OTHER_FATAL_REPORTED', 'NO_MATCH', 'UNAVAILABLE', 'TRUNCATED', 'MULTIPLE']);
/** The test-scoped gate's `lane-browser-exit` annotation (sandbox-launch.mjs browserExitLine) to { shape, firstSeen, page } or
 *  null. Consistent pairs only: an exit shape needs a checkpoint or UNKNOWN; NONE needs NOT_SEEN; UNKNOWN needs UNKNOWN. */
export function browserExitEvidence(text) {
  const m = typeof text === 'string' ? BROWSER_EXIT.exec(text) : null;
  if (!m) return null;
  const exited = m[1].startsWith('CODE_') || m[1].startsWith('SIG');
  const ok = exited ? ['PAGE_TEARDOWN_START', 'GATE_POST', 'UNKNOWN'].includes(m[2]) : m[1] === 'NONE' ? m[2] === 'NOT_SEEN' : m[2] === 'UNKNOWN';
  return ok ? { shape: m[1], firstSeen: m[2], page: m[3] } : null;
}

/** Classify a runChild result object. Only the two exact known shapes get a specific class; everything else is NO_CODE. */
export function e1ResultClass(res) {
  try {
    // A plain object (the literal runChild builds) whose fields are OWN, ENUMERABLE DATA properties with the right types.
    // Inherited fields, accessors (getters are never invoked), non-enumerable or symbol keys, extra keys, a non-string `out`
    // or a conflicting pair are NO_CODE.
    if (!res || typeof res !== 'object' || Array.isArray(res) || Object.getPrototypeOf(res) !== Object.prototype) return 'NO_CODE';
    const keys = Reflect.ownKeys(res);
    if (keys.some((k) => typeof k !== 'string' || !['code', 'out', 'unreaped'].includes(k))) return 'NO_CODE';
    const own = {};
    for (const k of keys) {
      const d = Object.getOwnPropertyDescriptor(res, k);
      if (!d || !('value' in d) || d.enumerable !== true) return 'NO_CODE';
      own[k] = d.value;
    }
    if (!('code' in own)) return 'NO_CODE';
    if ('out' in own && typeof own.out !== 'string') return 'NO_CODE';
    if ('unreaped' in own) return own.unreaped === true && own.code === null ? 'REAP_UNCONFIRMED' : 'NO_CODE';
    return Number.isInteger(own.code) && own.code >= 0 && own.code <= 255 ? 'CLOSE_WITH_CODE' : 'NO_CODE';
  } catch { return 'NO_CODE'; } // a Proxy trap that throws
}

/** A message from a DEFINED report error field: exactly `<CODE>` or `Error: <CODE>` (Playwright's name prefix). */
export function reportedErrorCode(message) {
  if (typeof message !== 'string') return null;
  const m = /^(?:Error: )?([A-Z_]+)$/.exec(message);
  return m && REPORTED_ERROR_CODES.includes(m[1]) ? m[1] : null;
}

/**
 * Parse lane.txt. Shapes (each line exactly once, in order):
 *   LANE START, LANE APPARMOR <code>, LANE SETUP NOT RUN <precheck code>, LANE END
 *   LANE START, LANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE, LANE SETUP PASS|FAIL, LANE E1 RAN|NOT RUN,
 *     [only after E1 RAN, in this order]
 *       LANE E1 RESULT CLOSE_WITH_CODE|REAP_UNCONFIRMED|NO_CODE,
 *       LANE E1 APPARMOR PRE <worker> <browser> POST <worker> <browser> | LANE E1 APPARMOR MISSING|INVALID,
 *       LANE E1 REPORT MISSING|INVALID|PARSED,
 *       LANE E1 REPORTED_ERROR <one REPORTED_ERROR_CODES code>|MULTIPLE|UNKNOWN,
 *       LANE E1 POST_OBSERVED <postObservedEvidence grammar>|MISSING|INVALID,
 *       LANE E1 ATTEMPT_STATUS <ATTEMPT_STATUSES>,
 *       LANE E1 FAILED_STEP <FAILED_STEP_TOKENS>,
 *       LANE E1 BROWSER_EXIT <browserExitEvidence grammar>|MISSING|INVALID,
 *       LANE E1 BROWSER_LOG <one BROWSER_LOG_CODES code>|MISSING|INVALID,
 *     LANE CLEANUP PASS|FAIL, LANE END
 * The E1 APPARMOR line is the WORKER-side evidence (egress-test.ts laneAppArmorGate), copied from the report annotation.
 * RESULT, REPORT and REPORTED_ERROR are DIAGNOSTIC ONLY (E1 diagnostics r1): no acceptance, teardown or upload decision reads
 * them. RESULT classifies the runChild result shape (e1ResultClass); it never says why a child had no code. REPORTED_ERROR is
 * a lead from defined report error fields, never a proven subsystem or root cause. Consistency: REPORT MISSING needs APPARMOR
 * MISSING, REPORT INVALID needs APPARMOR INVALID, and either needs REPORTED_ERROR UNKNOWN.
 * POST_OBSERVED, ATTEMPT_STATUS and FAILED_STEP (E1 diagnostics r2) are DIAGNOSTIC ONLY as well. A report that is not PARSED
 * needs POST_OBSERVED equal to the report state and UNKNOWN status and step; UNKNOWN status needs UNKNOWN step; PASSED needs
 * NONE and only PASSED may have NONE. ATTEMPT_STATUS is Playwright's word for the one selected attempt, never an E1 verdict.
 * BROWSER_EXIT (E1 diagnostics r3) is DIAGNOSTIC ONLY too: the owned browser's closed exit shape and the spec page's state at the
 * page wrapper's teardown-start checkpoint. A report that is not PARSED needs it equal to the report state. It never says why a process exited.
 * BROWSER_LOG (E1 browser-log r1) is DIAGNOSTIC ONLY too: whether a Chromium FATAL record was seen on the owned browser's stderr,
 * as one closed code; never a path, line or message, and never the upstream reason. A report that is not PARSED needs it equal to
 * the report state.
 * A valid prefix without LANE END is { ok: true, interrupted: true }. Anything else is { ok: false }.
 */
export function parseLaneOut(text) {
  if (typeof text !== 'string' || text.length > 4096 || (text !== '' && !text.endsWith('\n'))) return { ok: false };
  // Acceptance isolation (lifecycle matrix): any synthetic line anywhere refuses the whole text. No accepted E1 text has one.
  if (/(^|\n)LANE SYN/.test(text)) return { ok: false };
  const ls = text === '' ? [] : text.slice(0, -1).split('\n');
  const r = { ok: true, interrupted: true, apparmor: null, setup: null, precheck: null, e1: null, e1Result: null, workerAppArmor: null, report: null, reportedError: null, postObserved: null, attemptStatus: null, failedStep: null, browserExit: null, browserLog: null, cleanup: null };
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
      const x = /^LANE E1 RESULT ([A-Z_]+)$/.exec(want(i++));
      if (!x || !E1_RESULT_CLASSES.includes(x[1])) return { ok: false };
      r.e1Result = x[1];
      if (i >= ls.length) return r;
      const w = workerAppArmorLine(want(i++));
      if (!w) return { ok: false };
      r.workerAppArmor = w;
      if (i >= ls.length) return r;
      const rs = /^LANE E1 REPORT ([A-Z_]+)$/.exec(want(i++));
      if (!rs || !REPORT_STATES.includes(rs[1])) return { ok: false };
      if (rs[1] !== 'PARSED' && w.state !== rs[1]) return { ok: false };
      r.report = rs[1];
      if (i >= ls.length) return r;
      const re = /^LANE E1 REPORTED_ERROR ([A-Z_]+)$/.exec(want(i++));
      if (!re || !REPORTED_ERROR_VALUES.includes(re[1])) return { ok: false };
      if (r.report !== 'PARSED' && re[1] !== 'UNKNOWN') return { ok: false };
      r.reportedError = re[1];
      if (i >= ls.length) return r;
      const po = /^LANE E1 POST_OBSERVED (.+)$/.exec(want(i++));
      if (!po) return { ok: false };
      if (po[1] === 'MISSING' || po[1] === 'INVALID') { if (r.report !== 'PARSED' && po[1] !== r.report) return { ok: false }; r.postObserved = { state: po[1] }; }
      else { const ev = postObservedEvidence(po[1]); if (!ev || r.report !== 'PARSED') return { ok: false }; r.postObserved = { state: 'EVIDENCE', ...ev }; }
      if (i >= ls.length) return r;
      const as = /^LANE E1 ATTEMPT_STATUS ([A-Z_]+)$/.exec(want(i++));
      if (!as || !ATTEMPT_STATUSES.includes(as[1]) || (r.report !== 'PARSED' && as[1] !== 'UNKNOWN')) return { ok: false };
      r.attemptStatus = as[1];
      if (i >= ls.length) return r;
      const fs1 = /^LANE E1 FAILED_STEP ([A-Z0-9_]+)$/.exec(want(i++));
      if (!fs1 || !FAILED_STEP_TOKENS.includes(fs1[1])) return { ok: false };
      // UNKNOWN status forces UNKNOWN step; PASSED is only ever NONE; a non-passed attempt is never NONE.
      if (as[1] === 'UNKNOWN' && fs1[1] !== 'UNKNOWN') return { ok: false };
      if (as[1] === 'PASSED' && fs1[1] !== 'NONE') return { ok: false };
      if (as[1] !== 'PASSED' && fs1[1] === 'NONE') return { ok: false };
      r.failedStep = fs1[1];
      if (i >= ls.length) return r;
      const bx = /^LANE E1 BROWSER_EXIT (.+)$/.exec(want(i++));
      if (!bx) return { ok: false };
      if (bx[1] === 'MISSING' || bx[1] === 'INVALID') { if (r.report !== 'PARSED' && bx[1] !== r.report) return { ok: false }; r.browserExit = { state: bx[1] }; }
      else { const ev = browserExitEvidence(bx[1]); if (!ev || r.report !== 'PARSED') return { ok: false }; r.browserExit = { state: 'EVIDENCE', ...ev }; }
      if (i >= ls.length) return r;
      const bl = /^LANE E1 BROWSER_LOG ([A-Z_]+)$/.exec(want(i++));
      if (!bl) return { ok: false };
      if (bl[1] === 'MISSING' || bl[1] === 'INVALID') { if (r.report !== 'PARSED' && bl[1] !== r.report) return { ok: false }; }
      else if (!BROWSER_LOG_CODES.includes(bl[1]) || r.report !== 'PARSED') return { ok: false };
      r.browserLog = bl[1];
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
 *    SECRET_CLEANUP_EFFECTIVE, which ALSO needs every other credential consumer resolved: the preview server, the
 *    stack, the psql producers. Each consumer counts as STOPPED on its step outcome 'success', or, for the stack and the
 *    psql producers only, as NEVER_STARTED in the exact bounded case of consumerState below; anything else is UNRESOLVED.
 *  - controls: the non-secret control dir C may be removed only when the lane verdict is clean AND both image records are
 *    present, parseable and clean (build clients reaped, image removed or never built, cleanup clients reaped).
 */
/**
 * One credential consumer's state from GitHub step outcomes (runner-reported, exact strings only).
 *  STOPPED       its stop/absence step reported 'success'.
 *  NEVER_STARTED only for the stack and the psql producers, and only when `supabase start` (steps.le_start) AND that consumer's
 *                own stop step were both 'skipped'. Nothing before le_start holds a credential: the stack keys and DSN first
 *                exist in le_start's output and reach GITHUB_ENV in the next step, and every psql producer runs after it under
 *                the default success() condition (pinned by checkLessonEditorJob). A skipped start therefore means no
 *                credential consumer of either kind ever ran.
 *  UNRESOLVED    anything else: failure, cancelled, a missing or malformed value, a started or interrupted start, or a skipped
 *                stop after a start that did not report 'skipped'. 'skipped' is never success on its own.
 */
export function consumerState(name, outcomes) {
  const own = (k) => (outcomes && typeof outcomes === 'object' && Object.prototype.hasOwnProperty.call(outcomes, k) ? outcomes[k] : undefined);
  const o = own(name);
  if (o === 'success') return 'STOPPED';
  if ((name === 'stack' || name === 'producers') && o === 'skipped' && own('start') === 'skipped') return 'NEVER_STARTED';
  return 'UNRESOLVED';
}

export function cleanupScope({ verdict, privateRemoved, outcomes, buildRec, cleanupRec, controlsPresent }) {
  const laneClean = !!verdict?.ok;
  const laneScope = laneClean && privateRemoved === true;
  const bad = [];
  const states = ['preview', 'stack', 'producers'].map((k) => [k, consumerState(k, outcomes)]);
  for (const [k, st] of states) if (st === 'UNRESOLVED') bad.push(k);
  if (!laneClean) bad.push('lane');
  if (privateRemoved !== true) bad.push('private');
  const b = parseImageBuildRecord(buildRec), c = parseImageCleanupRecord(cleanupRec);
  const controls = !controlsPresent ? 'NONE' : laneClean && b && b.clients === 'REAPED' && c && c.result === 'CLEAN' ? 'REMOVE' : 'KEEP';
  return {
    effective: bad.length === 0,
    lines: [`LANE_SECRET_SCOPE ${laneScope ? 'CLEAN' : 'UNRESOLVED'}`,
      ...states.map(([k, st]) => `SECRET_CONSUMER ${k} ${st}`),
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

/**
 * E1 diagnostics r1: one fixed detail line for the LE_SUM_E_WORKER_APPARMOR refusal ONLY, from the same validated inputs
 * planSummary used (it re-runs planSummary and changes nothing it decides). Any other plan is `LE-E1 DETAIL NONE`.
 * exit = the existing pw-exit content (255 stays ambiguous: a code of 255, or no code at all; read with result=).
 * aa = the closed worker class (MISSING, INVALID or the four LANE_APPARMOR codes), never proc text.
 * error = a lead only, never a proven subsystem or root cause.
 */
export function refusalDetail({ verdict, laneText, pwExit }) {
  const p = planSummary({ verdict, laneText, pwExit });
  if (p.kind !== 'refused' || p.code !== 'LE_SUM_E_WORKER_APPARMOR') return 'LE-E1 DETAIL NONE';
  const o = parseLaneOut(laneText);
  const w = o.workerAppArmor;
  const aa = w.state === 'EVIDENCE' ? `PRE:${w.codes[0]},${w.codes[1]};POST:${w.codes[2]},${w.codes[3]}` : w.state;
  const po = o.postObserved;
  const post = po.state === 'EVIDENCE' ? `WR:${po.reads.worker.join(',')};BR:${po.reads.browser.join(',')};EXIT:${po.exit.join(',')}` : po.state;
  const bx = o.browserExit;
  const browserExit = bx.state === 'EVIDENCE' ? `${bx.shape},${bx.firstSeen},${bx.page}` : bx.state;
  return `LE-E1 DETAIL exit=${Number(pwExit.digits)} result=${o.e1Result} aa=${aa} report=${o.report} error=${o.reportedError} post=${post} attempt_status=${o.attemptStatus} failed_step=${o.failedStep} browser_exit=${browserExit} browser_log=${o.browserLog} cleanup=${o.cleanup}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The closed `LANE SYN` grammar of the synthetic lane.txt (written by lane-entry.mjs synMain through its one say()).
//   LANE SYN START
//   LANE SYN NOT_ACCEPTANCE
//   LANE SYN APPARMOR <LANE_APPARMOR code>
//   then either  LANE SYN NOT RUN <SYN_PRECHECK_CODES code>
//   or           LANE SYN RAN / LANE SYN RESULT <E1_RESULT_CLASSES> / LANE SYN REPORT <MISSING|INVALID|PARSED>
//                four arm lines, A to D in order / LANE SYN MATRIX <PASS|FAIL|UNRESOLVED>
//   LANE SYN END
// Arm line (the spec's `syn-arm` annotation, re-validated here before it is written):
//   ARM <A-D> STATUS <DONE|FAILED|NOT_RUN|UNKNOWN> M <milestone> REAP <PROVEN|UNPROVEN|NOT_RUN|UNKNOWN>
//     BROWSER_EXIT <NOT_RUN|UNKNOWN|SHAPE .. FIRST_SEEN .. BODY_END_PAGE ..> BROWSER_LOG <BROWSER_LOG_CODES|NOT_RUN|UNKNOWN>
// BROWSER_EXIT and BROWSER_LOG are DIAGNOSTIC ONLY (the same closed shapes as E1's, sampled per arm); nothing decides on them.

export const SYN_ARMS = Object.freeze(['A', 'B', 'C', 'D']);
export const SYN_MILESTONES = Object.freeze(['NONE', 'CONTEXT', 'PRELIM', 'FINAL_GOTO', 'VISIBLE', 'TYPED', 'DONE', 'UNKNOWN']);
export const SYN_STATUSES = Object.freeze(['DONE', 'FAILED', 'NOT_RUN', 'UNKNOWN']);
export const SYN_REAPS = Object.freeze(['PROVEN', 'UNPROVEN', 'NOT_RUN', 'UNKNOWN']);
export const SYN_PRECHECK_CODES = Object.freeze(['LANE_E_APPARMOR', 'LANE_E_UMASK', 'LANE_E_ENV', 'LANE_E_CLOSURE', 'LANE_E_DIRS']);
export const SYN_MATRIX = Object.freeze(['PASS', 'FAIL', 'UNRESOLVED']);

const ARM_RE = /^ARM ([A-D]) STATUS ([A-Z_]+) M ([A-Z_]+) REAP ([A-Z_]+) BROWSER_EXIT (NOT_RUN|UNKNOWN|SHAPE [A-Z0-9_]+ FIRST_SEEN [A-Z_]+ BODY_END_PAGE [A-Z_]+) BROWSER_LOG ([A-Z_]+)$/;
/** One arm body (without `LANE SYN `) to its fields, or null. Consistency: DONE needs M DONE and REAP PROVEN; NOT_RUN is all NOT_RUN. */
export function parseSynArm(text) {
  const m = typeof text === 'string' ? ARM_RE.exec(text) : null;
  if (!m) return null;
  const [, arm, status, milestone, reap, exit, log] = m;
  if (!SYN_STATUSES.includes(status) || !SYN_MILESTONES.includes(milestone) || !SYN_REAPS.includes(reap)) return null;
  if (!['NOT_RUN', 'UNKNOWN'].includes(exit) && !browserExitEvidence(exit)) return null;
  if (![...BROWSER_LOG_CODES, 'NOT_RUN', 'UNKNOWN'].includes(log)) return null;
  const notRun = [reap, exit, log].map((v) => v === 'NOT_RUN');
  if (status === 'NOT_RUN' ? !(milestone === 'NONE' && notRun.every(Boolean)) : notRun.some(Boolean)) return null;
  if (status === 'DONE' && (milestone !== 'DONE' || reap !== 'PROVEN')) return null;
  if (status !== 'DONE' && milestone === 'DONE' && status !== 'FAILED') return null;
  return { arm, status, milestone, reap, exit, log };
}
/** The fixed arm body for an arm the report does not establish. */
export const unknownArm = (arm) => `ARM ${arm} STATUS UNKNOWN M UNKNOWN REAP UNKNOWN BROWSER_EXIT UNKNOWN BROWSER_LOG UNKNOWN`;
/** The fixed arm body for an arm that was never started. */
export const notRunArm = (arm) => `ARM ${arm} STATUS NOT_RUN M NONE REAP NOT_RUN BROWSER_EXIT NOT_RUN BROWSER_LOG NOT_RUN`;

/**
 * The matrix verdict from the four parsed arms and the run facts. PASS needs a parsed report, a Playwright exit code of 0 and
 * every arm DONE with a proven reap. Any UNPROVEN or UNKNOWN reap, an unknown arm or an unparsed report is UNRESOLVED (the reap
 * of some browser is not established). Otherwise FAIL. A failure status is never overwritten by a later arm.
 */
export function synMatrix({ report, pwCode, arms }) {
  if (report !== 'PARSED' || !Array.isArray(arms) || arms.length !== 4 || arms.some((a) => !a)) return 'UNRESOLVED';
  if (arms.some((a) => a.status === 'UNKNOWN' || a.reap === 'UNPROVEN' || a.reap === 'UNKNOWN')) return 'UNRESOLVED';
  if (pwCode === 0 && arms.every((a) => a.status === 'DONE')) return 'PASS';
  return 'FAIL';
}

/** Parse a synthetic lane.txt. { ok, interrupted, apparmor, precheck, result, report, arms, matrix } or { ok: false }. */
export function parseSynOut(text) {
  if (typeof text !== 'string' || text.length > 4096 || (text !== '' && !text.endsWith('\n'))) return { ok: false };
  const ls = text === '' ? [] : text.slice(0, -1).split('\n');
  const r = { ok: true, interrupted: true, apparmor: null, precheck: null, ran: false, result: null, report: null, arms: [], matrix: null };
  if (ls.some((l) => !l.startsWith('LANE SYN '))) return { ok: false };
  const seq = ls.map((l) => l.slice(9));
  let i = 0;
  const done = () => i >= seq.length;
  if (done()) return r;
  if (seq[i++] !== 'START') return { ok: false };
  if (done()) return r;
  if (seq[i++] !== 'NOT_ACCEPTANCE') return { ok: false };
  if (done()) return r;
  const a = /^APPARMOR ([A-Z_]+)$/.exec(seq[i++]);
  if (!a || !LANE_APPARMOR.includes(a[1])) return { ok: false };
  r.apparmor = a[1];
  if (done()) return r;
  const n = /^NOT RUN ([A-Z_]+)$/.exec(seq[i]);
  if (n) {
    i++;
    if (!SYN_PRECHECK_CODES.includes(n[1]) || ((r.apparmor !== LANE_APPARMOR[0]) !== (n[1] === 'LANE_E_APPARMOR'))) return { ok: false };
    r.precheck = n[1];
  } else {
    if (r.apparmor !== LANE_APPARMOR[0] || seq[i++] !== 'RAN') return { ok: false };
    r.ran = true;
    if (done()) return r;
    const x = /^RESULT ([A-Z_]+)$/.exec(seq[i++]);
    if (!x || !E1_RESULT_CLASSES.includes(x[1])) return { ok: false };
    r.result = x[1];
    if (done()) return r;
    const rp = /^REPORT ([A-Z_]+)$/.exec(seq[i++]);
    if (!rp || !REPORT_STATES.includes(rp[1])) return { ok: false };
    r.report = rp[1];
    for (const arm of SYN_ARMS) {
      if (done()) return r;
      const p = parseSynArm(seq[i++]);
      if (!p || p.arm !== arm || (r.report !== 'PARSED' && seq[i - 1] !== unknownArm(arm))) return { ok: false };
      r.arms.push(p);
    }
    if (done()) return r;
    const mx = /^MATRIX ([A-Z_]+)$/.exec(seq[i++]);
    if (!mx || !SYN_MATRIX.includes(mx[1])) return { ok: false };
    r.matrix = mx[1];
  }
  if (done()) return r;
  if (seq[i++] !== 'END' || !done()) return { ok: false };
  r.interrupted = false;
  return r;
}

/**
 * Host summary lines (never `LE-E1`). The lane verdict comes from gates.mjs readVerdict (host receipts only). Synthetic output
 * is UNRESOLVED unless the lane container is proven absent and docker clients reaped; MATRIX PASS is reported only from a
 * complete, valid lane.txt. Every line says NOT_ACCEPTANCE first.
 */
export function synSummaryLines({ verdict, laneText }) {
  const out = ['LE-SYN NOT_ACCEPTANCE synthetic lifecycle matrix; never E1 evidence'];
  if (!verdict?.ok) return { ok: false, lines: [...out, 'LE-SYN RESULT UNRESOLVED LANE_TEARDOWN'] };
  const p = typeof laneText === 'string' ? parseSynOut(laneText) : { ok: false };
  if (!p.ok) return { ok: false, lines: [...out, 'LE-SYN RESULT REFUSED LANE_OUT'] };
  if (p.interrupted) return { ok: false, lines: [...out, 'LE-SYN RESULT UNRESOLVED LANE_INTERRUPTED'] };
  if (p.precheck) return { ok: false, lines: [...out, `LE-SYN RESULT NOT_RUN ${p.precheck}`] };
  const lines = [...out, `LE-SYN RUN RESULT ${p.result} REPORT ${p.report}`];
  for (const a of p.arms) lines.push(`LE-SYN ARM ${a.arm} STATUS ${a.status} M ${a.milestone} REAP ${a.reap} BROWSER_EXIT ${a.exit} BROWSER_LOG ${a.log}`);
  lines.push(`LE-SYN RESULT ${p.matrix}`);
  return { ok: p.matrix === 'PASS', lines };
}

/** `select`: the target and the absence of every authentic input in THIS process environment. One fixed line. */
export function selectLine(env) {
  if (env.LE_TARGET !== 'SYNTHETIC') return { ok: false, line: 'LE-SYN SELECT REFUSED LE_TARGET' };
  for (const k of SYN_FORBIDDEN_ENV) if (Object.prototype.hasOwnProperty.call(env, k)) return { ok: false, line: `LE-SYN SELECT REFUSED ${k}` };
  for (const k of ['LE_ALLOW_SHIM', 'LE_ALLOWED_ORIGINS', 'LE_EGRESS_CONTROL', 'PGPASSWORD', 'E2E_ALLOW_PRODUCTION_TARGET', 'SUPABASE_DB_URL',
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'E2E_BASE_URL']) if (Object.prototype.hasOwnProperty.call(env, k)) return { ok: false, line: `LE-SYN SELECT REFUSED ${k}` };
  return { ok: true, line: 'LE-SYN SELECT SYNTHETIC (no authentic input, no baseURL source)' };
}
