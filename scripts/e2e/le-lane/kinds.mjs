// ABOUTME: Closed sibling lane kinds (DESIGN r2 section 2): `e1` is EXACTLY today's contract.mjs functions (referenced, never
// ABOUTME: copied), `video` is the sealed stubbed video lane (one bridged port, no API/DB/keys). Pure: no I/O, no process.
//
// SOURCE CANDIDATE (sealed-video r1, DESIGN r2 bd92a021 + ADDENDUM r2.1 30c88f08). UNRUN: nothing here has runtime evidence.
// Common to every kind and NOT redefined here: --network none, --ipc private, --cgroupns private, --cap-drop ALL,
// no-new-privileges, seccomp chromium147.json (e15422bb), --read-only, the /tmp tmpfs, --init, --restart no, --log-driver none,
// LANE_LIMITS, --workdir R, image WORKDIR '/', the pinned browser. videoCreateArgs is derived from laneCreateArgs itself, so a
// common flag cannot drift between kinds; only the binds, the -e list and the Cmd script differ (pure-tested field by field).
import path from 'node:path';
import { BROWSER_PATH_RE } from '../le-iso/expect.mjs';
import {
  APP_ORIGIN, IMAGE_PATH_ENV, LANE_NODE, PSQL_REAL, TOOL_PATHS, expectedLaneConfig, laneBinds, laneCreateArgs, laneEnv, lanePaths, lanePorts,
} from './contract.mjs';
import { APP_ONLY, SOCKETS, VIDEO_APP_PORT } from './bridge.mjs';

export const KIND_NAMES = Object.freeze(['e1', 'video']);
/** The video lane's synthetic compiled API origin (RFC 6761 `.invalid`; never resolvable). The spec stubs it by exact origin. */
export const VIDEO_API_ORIGIN = 'https://sealed-video.invalid';
/** The video lane's declared collection: exactly 24 browser tests in 1 file (C3 c); the egress coverage gate compares to it. */
export const VIDEO_DECLARED_TESTS = 24;
export const VIDEO_SPEC_REL = 'e2e/stubbed/wp09a-video-embed.spec.ts';
export const VIDEO_CONFIG_REL = 'playwright.sealed-video.config.ts';
export const VIDEO_ENTRY_REL = 'scripts/e2e/le-lane/video-entry.mjs';
/** Video image closure besides LANE_NODE and the browser dir: a strict subset of E1's TOOLS. No psql, no git (no run.sh). */
export const VIDEO_TOOLS = Object.freeze(['bash', 'env', 'mktemp', 'rm', 'mkdir', 'cat']);
export const VIDEO_TOOL_PATHS = Object.freeze(VIDEO_TOOLS.map((t) => `/usr/bin/${t}`));

/** Every video host path from P (private parent), C (control dir) and R (repo). Container paths are identical. */
export function videoPaths(P, C, R) {
  const E = lanePaths(P, C, R); // the same canonical-path refusal as E1, and the same control-dir names
  const j = path.join;
  return Object.freeze({
    P, C, R,
    sock: E.sock, lane: E.lane, evidence: E.evidence, output: E.output, report: E.report,
    out: E.out, laneTxt: E.laneTxt, pwExit: E.pwExit, egressDir: j(P, 'out', 'egress'),
    ctx: E.ctx, iid: E.iid, manifest: E.manifest, started: E.started, createInvoked: E.createInvoked, cidfile: E.cidfile,
    bridgeReady: E.bridgeReady, sealAck: E.sealAck, bridgeFinal: E.bridgeFinal, gates: E.gates, imageBuildRec: E.imageBuildRec,
    imageCleanupRec: E.imageCleanupRec,
    entry: j(R, VIDEO_ENTRY_REL), bridge: E.bridge, seccomp: E.seccomp,
  });
}

/** Exactly four binds, in create order: R ro, P/sock ro, P/lane rw, P/out rw. */
export function videoBinds(V) {
  return [[V.R, false], [V.sock, false], [V.lane, true], [V.out, true]];
}

/** Exact -e keys, in order. No API, DB, key, proof, GITHUB_* or VITE_* value exists in the video lane. */
export const VIDEO_ENV_KEYS = Object.freeze(['HOME', 'TMPDIR', 'CI', 'LE_KIND', 'LE_APP_ORIGIN', 'LE_SOCK_DIR', 'LE_LANE_DIR', 'LE_OUT_DIR',
  'LE_OUTPUT_DIR', 'LE_REPORT_JSON', 'LE_EGRESS_DIR', 'E2E_EVIDENCE_COMMIT', 'E2E_EVIDENCE_ENVIRONMENT', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']);

export function videoEnv(V, { commit, shell }) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('videoEnv: commit');
  if (typeof shell !== 'string' || !BROWSER_PATH_RE.test(shell) || shell !== path.normalize(shell) || /[\0\n]/.test(shell)) throw new Error('videoEnv: shell');
  const v = {
    HOME: '/tmp', TMPDIR: '/tmp', CI: 'true', LE_KIND: 'video', LE_APP_ORIGIN: APP_ORIGIN, LE_SOCK_DIR: V.sock, LE_LANE_DIR: V.lane,
    LE_OUT_DIR: V.out, LE_OUTPUT_DIR: V.output, LE_REPORT_JSON: V.report, LE_EGRESS_DIR: V.egressDir,
    E2E_EVIDENCE_COMMIT: commit, E2E_EVIDENCE_ENVIRONMENT: 'sealed-stubbed', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: shell,
  };
  return VIDEO_ENV_KEYS.map((k) => `${k}=${v[k]}`);
}

/** The video lane's one bridged port (the served copy). */
export const videoPorts = () => ({ app: VIDEO_APP_PORT });

/**
 * The ONE video `docker create` argv, derived from E1's laneCreateArgs: the E1 argv is built for the same P/C/R with a
 * placeholder env of the right shape, then its seven -v pairs are replaced by the four video binds, its -e list by the
 * video env, and its Cmd script by the video entry. Every other token is E1's, unchanged and in place.
 */
export function videoCreateArgs(V, { imageId, uid, gid, env }) {
  if (!Array.isArray(env) || env.length !== VIDEO_ENV_KEYS.length || env.some((e, i) => !e.startsWith(`${VIDEO_ENV_KEYS[i]}=`) || /[\0\n]/.test(e))) throw new Error('videoCreateArgs: env');
  const E = lanePaths(V.P, V.C, V.R);
  const placeholder = laneEnv(E, { apiOrigin: 'http://127.0.0.1:1', dbUrl: 'postgresql://x@127.0.0.1:2/x', commit: '0'.repeat(40), shell: '/x' });
  const e1 = laneCreateArgs(E, { imageId, uid, gid, env: placeholder });
  const firstV = e1.indexOf('-v');
  const tail = e1.slice(-4); // [image, LANE_NODE, entry, R]
  if (firstV < 0 || tail[1] !== LANE_NODE || tail[2] !== E.entry) throw new Error('videoCreateArgs: e1 shape');
  const a = e1.slice(0, firstV);
  for (const [p, rw] of videoBinds(V)) a.push('-v', `${p}:${p}:${rw ? 'rw' : 'ro'},rprivate`);
  for (const e of env) a.push('-e', e);
  a.push(imageId, LANE_NODE, V.entry, V.R);
  return a;
}

/** The exact inspect expectation: E1's for the same P/C/R, with ONLY Binds, EffectiveMounts, Config.Env and Config.Cmd replaced. */
export function expectedVideoConfig(V, { imageId, uid, gid, env, seccompText, cid }) {
  const E = lanePaths(V.P, V.C, V.R);
  const e1 = expectedLaneConfig(E, { imageId, uid, gid, env: [], seccompText, cid });
  const binds = videoBinds(V);
  return {
    ...e1,
    Binds: binds.map(([p, rw]) => `${p}:${p}:${rw ? 'rw' : 'ro'},rprivate`),
    EffectiveMounts: binds.map(([p, rw]) => ({ Type: 'bind', Source: p, Destination: p, RW: rw, Propagation: 'rprivate' }))
      .sort((a, b) => a.Destination.localeCompare(b.Destination)),
    Config: { ...e1.Config, Env: [IMAGE_PATH_ENV, ...env].sort(), Cmd: [LANE_NODE, V.entry, V.R] },
  };
}

/** Private-input shape for video (lstat only): P, sock, lane, out are 0700 own-uid dirs, sock/lane/out empty; C exists. */
export function videoInputsOk(fsx, V, uid) {
  const st = (p) => { try { return fsx.lstatSync(p); } catch { return null; } };
  const dir700 = (p) => { const s = st(p); return !!s && s.isDirectory() && !s.isSymbolicLink() && (s.mode & 0o777) === 0o700 && s.uid === uid; };
  const empty = (p) => { try { return fsx.readdirSync(p).length === 0; } catch { return false; } };
  return dir700(V.P) && dir700(V.sock) && empty(V.sock) && dir700(V.lane) && empty(V.lane) && dir700(V.out) && empty(V.out) && dir700(V.C);
}

/**
 * The closed kind table run-lane and image dispatch on. The e1 entry REFERENCES the contract.mjs functions (identity, so it is
 * the existing code path); its bridge argv and ready line are today's exact forms.
 */
export const KINDS = Object.freeze({
  e1: Object.freeze({
    name: 'e1',
    paths: lanePaths,
    ports: (o) => lanePorts({ apiOrigin: o.apiOrigin, dbUrl: o.dbUrl }),
    env: (L, o) => laneEnv(L, { apiOrigin: o.apiOrigin, dbUrl: o.dbUrl, commit: o.commit, shell: o.shell }),
    createArgs: laneCreateArgs,
    expected: expectedLaneConfig,
    sockets: SOCKETS,
    bridgeArgs: (L, ports) => [L.sock, L.C, String(ports.api), String(ports.db), String(ports.app)],
    readyRe: /^(\d+) (\d+) (\d+) (\d+) (\d+)\n$/,
    readyPortsOk: (m, ports) => Number(m[3]) === ports.api && Number(m[4]) === ports.db && Number(m[5]) === ports.app,
    closureBins: Object.freeze([PSQL_REAL, ...TOOL_PATHS]),
    binds: laneBinds,
  }),
  video: Object.freeze({
    name: 'video',
    paths: videoPaths,
    ports: () => videoPorts(),
    env: (V, o) => videoEnv(V, { commit: o.commit, shell: o.shell }),
    createArgs: videoCreateArgs,
    expected: expectedVideoConfig,
    sockets: APP_ONLY,
    bridgeArgs: (V, ports) => [V.sock, V.C, '--kind', 'video', String(ports.app)],
    readyRe: /^(\d+) (\d+) (\d+)\n$/,
    readyPortsOk: (m, ports) => Number(m[3]) === ports.app,
    closureBins: VIDEO_TOOL_PATHS,
    binds: videoBinds,
    inputsOk: videoInputsOk,
  }),
});

/** The kind for a name; undefined/absent is e1 (today's callers pass nothing). Anything else throws. */
export function laneKind(name) {
  const k = name === undefined ? 'e1' : name;
  if (!KIND_NAMES.includes(k)) throw new Error('laneKind: unknown kind');
  return KINDS[k];
}

// ---------------------------------------------------------------------------------------------------------------------
// Video lane output (P/out/lane.txt): written by the CONTAINER (video-entry.mjs), so it is untrusted data parsed against a
// closed grammar. Shapes (each line exactly once, in order):
//   LANE START, LANE APPARMOR <code>, LANE SETUP NOT RUN <precheck code>, LANE END
//   LANE START, LANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE, LANE VIDEO RAN,
//     LANE VIDEO APPARMOR PRE <w> <b> POST <w> <b> | LANE VIDEO APPARMOR MISSING|INVALID, LANE VIDEO RESULT PASS|FAIL,
//     LANE EGRESS <code>, LANE END
// A valid prefix without LANE END is { ok: true, interrupted: true }. Anything else is { ok: false }.
export const VIDEO_PRECHECKS = Object.freeze(['LANE_E_UMASK', 'LANE_E_ENV', 'LANE_E_APPARMOR', 'LANE_E_CLOSURE', 'LANE_E_EGRESS_DIR',
  'LANE_E_FORWARD', 'LANE_E_BRIDGE_REACH']);
export const VIDEO_EGRESS_CODES = Object.freeze(['LANE_EGRESS_OK', 'LANE_E_EGRESS_INPUT', 'LANE_E_EGRESS_TOO_MANY', 'LANE_E_EGRESS_UNKNOWN_FILE',
  'LANE_E_EGRESS_UNMATCHED', 'LANE_E_EGRESS_DUPLICATE', 'LANE_E_EGRESS_MALFORMED', 'LANE_E_EGRESS_OPEN', 'LANE_E_EGRESS_REFUSED',
  'LANE_E_EGRESS_COVERAGE', 'LANE_E_EGRESS_READ']);
const VIDEO_AA = ['APPARMOR_DOCKER_DEFAULT_ENFORCE', 'APPARMOR_E_UNKNOWN', 'APPARMOR_E_UNCONFINED', 'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE', 'APPARMOR_E_OTHER_PROFILE'];
const VAA = `(${VIDEO_AA.join('|')})`;
const VIDEO_AA_LINE = new RegExp(`^LANE VIDEO APPARMOR (?:PRE ${VAA} ${VAA} POST ${VAA} ${VAA}|MISSING|INVALID)$`);

export function parseVideoLaneOut(text) {
  if (typeof text !== 'string' || text.length > 4096 || (text !== '' && !text.endsWith('\n'))) return { ok: false };
  const ls = text === '' ? [] : text.slice(0, -1).split('\n');
  const r = { ok: true, interrupted: true, apparmor: null, precheck: null, ran: false, workerAppArmor: null, result: null, egress: null };
  let i = 0;
  const more = () => i < ls.length;
  if (!more()) return r;
  if (ls[i++] !== 'LANE START') return { ok: false };
  if (!more()) return r;
  const m = /^LANE APPARMOR ([A-Z_]+)$/.exec(ls[i++]);
  if (!m || !VIDEO_AA.includes(m[1])) return { ok: false };
  r.apparmor = m[1];
  if (!more()) return r;
  const s = ls[i++];
  const n = /^LANE SETUP NOT RUN ([A-Z_]+)$/.exec(s);
  if (n) {
    if (!VIDEO_PRECHECKS.includes(n[1]) || (r.apparmor !== VIDEO_AA[0]) !== (n[1] === 'LANE_E_APPARMOR')) return { ok: false };
    r.precheck = n[1];
  } else if (s === 'LANE VIDEO RAN') {
    if (r.apparmor !== VIDEO_AA[0]) return { ok: false };
    r.ran = true;
    if (!more()) return r;
    const a = ls[i++];
    if (!VIDEO_AA_LINE.test(a)) return { ok: false };
    r.workerAppArmor = a.slice('LANE VIDEO APPARMOR '.length);
    if (!more()) return r;
    const res = /^LANE VIDEO RESULT (PASS|FAIL)$/.exec(ls[i++]);
    if (!res) return { ok: false };
    r.result = res[1];
    if (!more()) return r;
    const e = /^LANE EGRESS ([A-Z_]+)$/.exec(ls[i++]);
    if (!e || !VIDEO_EGRESS_CODES.includes(e[1])) return { ok: false };
    r.egress = e[1];
  } else return { ok: false };
  if (!more()) return r;
  if (ls[i++] !== 'LANE END' || i !== ls.length) return { ok: false };
  r.interrupted = false;
  return r;
}

/** The lane verdict from a parsed video lane.txt: PASS only for a complete, enforced, passing, egress-clean run. */
export function videoLaneVerdict(p) {
  if (!p?.ok || p.interrupted) return 'UNRESOLVED';
  const enforced = /^PRE (APPARMOR_DOCKER_DEFAULT_ENFORCE ){2}POST APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_DOCKER_DEFAULT_ENFORCE$/.test(p.workerAppArmor ?? '');
  return p.ran && enforced && p.result === 'PASS' && p.egress === 'LANE_EGRESS_OK' ? 'PASS' : 'FAIL';
}
