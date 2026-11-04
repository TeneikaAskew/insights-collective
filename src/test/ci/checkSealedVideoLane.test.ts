// ABOUTME: Pure, fake and static controls for the sealed stubbed video lane source candidate (DESIGN r2 + ADDENDUM r2.1): the
// ABOUTME: one-port bridge with E1 differential equivalence, kinds, run-lane/image dispatch, egress records, configs, fixture, supervisor, build, job.
//
// Read-only on purpose: nothing here writes a file, starts docker, a listener, a browser, a preview or a real child. The E1
// differential tests materialize the 0a075a77 modules from their pinned git blobs (git cat-file, read-only; test.yml checks out
// full history) and import them from data: URLs. Fakes live in memory.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fsDefault, { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import { APP_ONLY, SEALED_HOLD_MAX_MS, SOCKETS, SOCKET_SETS, VIDEO_APP_PORT, createBridge, parseBridgeFinal } from '../../../scripts/e2e/le-lane/bridge.mjs';
import {
  IMAGE_PATH_ENV, LANE_NODE, PSQL_REAL, TOOLS, TOOL_PATHS, compareLaneInspect, expectedLaneConfig, laneBinds, laneCreateArgs, laneEnv, lanePaths, lanePorts, parseGates,
} from '../../../scripts/e2e/le-lane/contract.mjs';
import {
  KINDS, KIND_NAMES, VIDEO_API_ORIGIN, VIDEO_DECLARED_TESTS, VIDEO_ENV_KEYS, VIDEO_TOOLS, VIDEO_TOOL_PATHS, expectedVideoConfig, laneKind, parseVideoLaneOut,
  VIDEO_TEXT_RENDER_CODES, videoBinds, videoCreateArgs, videoEnv, videoInputsOk, videoLaneVerdict, videoPaths,
} from '../../../scripts/e2e/le-lane/kinds.mjs';
import { runLane } from '../../../scripts/e2e/le-lane/run-lane.mjs';
import { buildLaneImage } from '../../../scripts/e2e/le-lane/image.mjs';
import { MAX_RECORDS, START_TEXT, aggregateEgress, egressEndText, egressStem, parseEndText, refusalOrigin, refusedLine } from '../../../scripts/e2e/le-lane/egress-records.mjs';
import { SEALED_VIDEO_TEST_MATCH, sealedVideoSettings, shellProblem, videoLaunchOptions } from '../../../scripts/e2e/le-lane/video-config.mjs';
import { reportResult, textRenderFromReport, videoClosureProblems, videoEnvProblems, videoMain } from '../../../scripts/e2e/le-lane/video-entry.mjs';
import { FORBIDDEN, SYNTHETIC_ANON_KEY, buildArgs, buildEnv, buildVideo, scanBundle } from '../../../scripts/e2e/le-lane/video-build.mjs';
import { videoSummaryLines } from '../../../scripts/e2e/le-lane/video-summary.mjs';
import { TEXT_RENDER_HTML, attachObserver, createLedger, finalLedger, observeTest, runWorkerBrowser, textRenderCode, textRenderPrecheck } from '../../../scripts/e2e/le-lane/video-observer.mjs';
import { RESOLVER_ARG, incomingProblem } from '../../../e2e/lesson-editor/sandbox-launch.mjs';
import { SECCOMP_PROFILE_REL } from '../../../scripts/e2e/le-iso/expect.mjs';

vi.mock('../../../e2e/support/chromium-executable', () => ({ chromiumExecutableOption: () => ({}), firefoxExecutableOption: () => ({}) }));

type Obj = Record<string, any>;
const ROOT = path.resolve(__dirname, '../../..');
const BASE = '0a075a77';
const P = '/rt/sv-private', C = '/rt/sv-ctl', R = '/w/repo';
const V = videoPaths(P, C, R);
const E = lanePaths(P, C, R);
const NODE = '/n/bin/node';
const SHELL = '/s/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const COMMIT = 'a'.repeat(40);
const IMG = `sha256:${'b'.repeat(64)}`, CIDV = 'c'.repeat(64);
const UID = 1001, GID = 118;
const PROFILE_RAW = readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL));
const git = (...a: string[]) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' });
const blobSha = (t: string) => createHash('sha1').update(`blob ${Buffer.byteLength(t)}\0`).update(t).digest('hex');
const dataUrl = (src: string) => `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`;
const fileUrl = (rel: string) => pathToFileURL(path.join(ROOT, rel)).href;
/** A module from the BASE commit, with its relative imports rewritten to the given absolute URLs (every import must be mapped). */
function baseModuleUrl(rel: string, map: Record<string, string>) {
  let src = git('show', `${BASE}:${rel}`);
  expect(blobSha(src)).toBe(git('rev-parse', `${BASE}:${rel}`).trim());
  src = src.replace(/from '(\.{1,2}\/[^']+)'/g, (_m, spec: string) => {
    const to = map[spec];
    if (!to) throw new Error(`unmapped import ${spec} in ${rel}`);
    return `from '${to}'`;
  });
  return dataUrl(src);
}
/** Unchanged dependencies are imported from the working tree only after proving each equals its BASE blob. */
function unchanged(rel: string) {
  expect(git('hash-object', path.join(ROOT, rel)).trim(), rel).toBe(git('rev-parse', `${BASE}:${rel}`).trim());
  return fileUrl(rel);
}
async function baseModules() {
  const bridge = baseModuleUrl('scripts/e2e/le-lane/bridge.mjs', {});
  const dep = { '../le-iso/run-probe.mjs': unchanged('scripts/e2e/le-iso/run-probe.mjs'), '../le-iso/expect.mjs': unchanged('scripts/e2e/le-iso/expect.mjs'), './contract.mjs': unchanged('scripts/e2e/le-lane/contract.mjs') };
  const image = baseModuleUrl('scripts/e2e/le-lane/image.mjs', dep);
  const runLaneUrl = baseModuleUrl('scripts/e2e/le-lane/run-lane.mjs', { ...dep, './bridge.mjs': bridge, './image.mjs': image });
  return {
    bridge: await import(/* @vite-ignore */ bridge),
    image: await import(/* @vite-ignore */ image),
    runLane: await import(/* @vite-ignore */ runLaneUrl),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// One-port bridge (DESIGN r2 section 7): closed socket sets, video controls, and E1 differential equivalence vs 0a075a77.
// ---------------------------------------------------------------------------------------------------------------------------
type BridgeMod = { createBridge: typeof createBridge; parseBridgeFinal: (t: string, n?: unknown) => unknown; SEALED_HOLD_MAX_MS: number };
/** The 0a075a77 bridge.mjs, materialized read-only from its pinned blob (see baseModules). */
const e1Bridge = async (): Promise<BridgeMod> => { expect(git('rev-parse', `${BASE}:scripts/e2e/le-lane/bridge.mjs`).trim()).toBe('fd790f4ef16552876fa7d7eb27cfb5cfeb091d38'); return (await baseModules()).bridge as BridgeMod; };
const BC = '/rt/sv-ctl', BS = '/rt/sv-private/sock';
/** Realistic listener fake (same model as checkLeLane.test.ts): close(cb) fires only after every accepted connection ended.
 *  failAt = index of the listener whose listen() emits 'error' instead of calling back (partial start). */
function bridgeHarness(mod: BridgeMod, opts: { ports: Record<string, number>; names?: readonly string[]; failAt?: number; ceiling?: boolean; noHold?: boolean }) {
  const servers: Obj[] = [];
  const ups: Obj[] = [];
  const log: string[] = [];
  const mkSock = (srv?: Obj) => {
    const so: Obj = Object.assign(new EventEmitter(), { destroyed: false, pipe() {} });
    so.destroy = () => { if (so.destroyed) return; so.destroyed = true; if (srv) { srv.conns.delete(so); srv.check(); } };
    return so;
  };
  const net = {
    createServer: (h: (c: Obj) => void) => {
      const idx = servers.length;
      const srv: Obj = Object.assign(new EventEmitter(), { h, closing: false, conns: new Set(), cbs: [] as (() => void)[], closedFired: false, listening: false,
        listen: (p: string, cb: () => void) => { log.push(`listen ${p.split('/').at(-1)}`); if (opts.failAt === idx) { setTimeout(() => srv.emit('error', new Error('EADDRINUSE')), 0); return; } srv.listening = true; cb(); },
        close: (cb: () => void) => { srv.closing = true; srv.cbs.push(cb); srv.check(); },
        check: () => { if (srv.closing && srv.conns.size === 0 && !srv.closedFired) { srv.closedFired = true; for (const f of srv.cbs) setTimeout(f, 0); } },
        accept: () => { const c = mkSock(srv); srv.conns.add(c); srv.h(c); return c; } });
      servers.push(srv);
      return srv;
    },
    connect: (to: Obj) => { const u = mkSock(); u.to = to; ups.push(u); log.push(`connect ${to.port}`); return u; },
  };
  const holds = new Set<number>();
  let nextHold = 0;
  const exits: number[] = [];
  const hold = () => { const id = nextHold++; if (!opts.noHold) holds.add(id); log.push('hold'); return { release: () => { holds.delete(id); log.push('release'); } }; };
  const sleep = (ms: number) => new Promise<void>((r) => { if (ms === mod.SEALED_HOLD_MAX_MS && !opts.ceiling) return; setTimeout(r, Math.min(ms, 20)); });
  const files = { put: (p: string, t: string) => log.push(`put ${p} ${JSON.stringify(t)}`), unlink: (p: string) => log.push(`unlink ${p}`) };
  const deps = { net, files, pid: 9, starttime: '77', sleep, hold, exit: (c: number) => { exits.push(c); log.push(`exit ${c}`); } };
  const b = mod.createBridge(deps as never, { sockDir: BS, ctl: BC, ports: opts.ports, ...(opts.names ? { names: opts.names } : {}) } as never);
  return { b, servers, ups, log, exits, holds };
}
const btick = () => new Promise<void>((r) => { setTimeout(r, 5); });
/** The scripted fake scenarios run through both modules (E1 mode) and through the video mode. */
const SCENARIOS: Record<string, (h: ReturnType<typeof bridgeHarness>) => Promise<void>> = {
  normal: async (h) => { await h.b.listen(); const c = h.servers.at(-1)!.accept(); c.destroy(); await h.b.seal(); await btick(); await h.b.close(); },
  'partial-start': async (h) => { await h.b.listen().catch((e: Error) => { h.log.push(`listen-rejected ${e.message}`); }); await btick(); },
  'seal-then-sigterm': async (h) => { await h.b.listen(); h.servers[0].accept(); await h.b.seal(); h.servers[0].accept(); await btick(); await h.b.close(); await h.b.close(); },
  ceiling: async (h) => { await h.b.listen(); h.servers.at(-1)!.accept(); await h.b.seal(); for (let n = 0; n < 20 && h.exits.length === 0; n++) await btick(); },
  'unreaped-client': async (h) => { await h.b.listen(); h.servers.at(-1)!.accept(); await btick(); await h.b.close(); },
  'no-hold': async (h) => { await h.b.listen(); const c = h.servers[0].accept(); await h.b.seal(); c.destroy(); h.ups[0].destroy(); await btick(); },
};
const scenarioOpts = (name: string) => ({ ceiling: name === 'ceiling', noHold: name === 'no-hold', failAt: name === 'partial-start' ? 1 : undefined });

describe('bridge one-port mode: closed socket sets, video controls and E1 differential equivalence (DESIGN r2 section 7)', () => {
  const E1_PORTS = { api: 54321, db: 54322, app: 8080 };
  it('the socket sets are closed: E1 three (default) or video app-only; anything else is refused before any listener', () => {
    expect(SOCKET_SETS).toEqual([['api', 'db', 'app'], ['app']]);
    expect(APP_ONLY).toEqual(['app']);
    expect(VIDEO_APP_PORT).toBe(8080);
    const mk = (names: unknown, ports: Record<string, number>) => () => bridgeHarness({ createBridge, parseBridgeFinal, SEALED_HOLD_MAX_MS } as never, { ports, names: names as string[] });
    for (const bad of [['app', 'api'], ['db'], ['api'], [], ['app', 'app'], 'app', ['APP']]) expect(mk(bad, { app: 8080 }), String(bad)).toThrow('bridge: names');
    // wrong kind for the port count: video with three ports, E1 with one
    expect(mk(APP_ONLY, E1_PORTS)).toThrow('bridge: ports');
    expect(mk(undefined, { app: 8080 })).toThrow('bridge: ports');
    expect(mk(SOCKETS, { app: 8080 })).toThrow('bridge: ports');
    // wrong port: not 8080, out of range, non-integer
    for (const p of [8081, 54321, 0, 65536, 8080.5, NaN]) expect(mk(APP_ONLY, { app: p }), String(p)).toThrow('bridge: ports');
    expect(mk(['app'], { app: 8080 })).not.toThrow(); // an equal fresh array resolves to the same closed set
  });
  it('video mode: one socket, one upstream (127.0.0.1:8080), a one-port ready line and a one-socket final record', async () => {
    const h = bridgeHarness({ createBridge, parseBridgeFinal, SEALED_HOLD_MAX_MS } as never, { ports: { app: 8080 }, names: APP_ONLY });
    await h.b.listen();
    expect(h.servers).toHaveLength(1);
    expect(h.log).toEqual(['hold', `listen app.sock`, `put ${BC}/bridge-ready "9 77 8080\\n"`]);
    h.servers[0].accept();
    expect(h.ups.map((u) => u.to)).toEqual([{ host: '127.0.0.1', port: 8080 }]);
    await h.b.seal();
    h.servers[0].accept(); // after seal: refused BEFORE any upstream connect
    expect(h.ups).toHaveLength(1);
    await h.b.close();
    const fin = h.log.find((l) => l.startsWith(`put ${BC}/bridge-final`))!;
    const text = JSON.parse(fin.slice(`put ${BC}/bridge-final `.length));
    expect(text).toBe('app accepted=1 refused=1 open=1\nLISTENERS CLOSED\nCLOSE OWNER\nEND\n');
    expect(parseBridgeFinal(text, APP_ONLY)).toEqual({ app: { accepted: 1, refused: 1, open: 1 }, listeners: 'CLOSED', closeBy: 'OWNER' });
    // a one-socket record is NOT a valid E1 record, and a three-socket record is not a valid video record
    expect(parseBridgeFinal(text)).toBeNull();
    expect(parseBridgeFinal('api accepted=0 refused=0 open=0\ndb accepted=0 refused=0 open=0\napp accepted=0 refused=0 open=0\nLISTENERS CLOSED\nCLOSE OWNER\nEND\n', APP_ONLY)).toBeNull();
    expect(parseBridgeFinal(text, ['db'])).toBeNull();
    expect(parseBridgeFinal(text.replace('app ', 'api '), APP_ONLY)).toBeNull();
    expect(parseBridgeFinal(text.replace('END\n', 'END\nx'), APP_ONLY)).toBeNull();
  });
  it('video partial start: the only listener fails, so no ready file is written and listen rejects (the CLI exits 2)', async () => {
    const h = bridgeHarness({ createBridge, parseBridgeFinal, SEALED_HOLD_MAX_MS } as never, { ports: { app: 8080 }, names: APP_ONLY, failAt: 0 });
    await expect(h.b.listen()).rejects.toThrow('EADDRINUSE');
    expect(h.log.some((l) => l.includes('bridge-ready'))).toBe(false);
    expect(h.servers.filter((s) => s.listening)).toHaveLength(0); // nothing opened, so nothing is left listening
  });
  it('video cleanup: close destroys every connection, waits boundedly, CLOSE OWNER; the ceiling path records CLOSE CEILING and exits 4', async () => {
    const h = bridgeHarness({ createBridge, parseBridgeFinal, SEALED_HOLD_MAX_MS } as never, { ports: { app: 8080 }, names: APP_ONLY, ceiling: true });
    await h.b.listen();
    h.servers[0].accept();
    await h.b.seal();
    for (let n = 0; n < 20 && h.exits.length === 0; n++) await btick();
    expect(h.exits).toEqual([4]);
    expect(h.ups.every((u) => u.destroyed)).toBe(true);
    const fin = h.log.find((l) => l.startsWith(`put ${BC}/bridge-final`))!;
    expect(parseBridgeFinal(JSON.parse(fin.slice(`put ${BC}/bridge-final `.length)), APP_ONLY)).toMatchObject({ closeBy: 'CEILING', app: { open: 1 } });
  });
  for (const name of Object.keys(SCENARIOS)) {
    it(`E1 differential (${name}): the new module in its default mode leaves the same record files, event order and exit codes as 0a075a77`, async () => {
      const old = await e1Bridge();
      const run = async (mod: BridgeMod) => { const h = bridgeHarness(mod, { ports: E1_PORTS, ...scenarioOpts(name) }); await SCENARIOS[name](h); return { log: h.log, exits: h.exits, ups: h.ups.map((u) => u.to), destroyed: h.ups.map((u) => u.destroyed), holds: h.holds.size }; };
      const a = await run(old);
      const b = await run({ createBridge, parseBridgeFinal, SEALED_HOLD_MAX_MS } as never);
      expect(b).toEqual(a);
      expect(a.log.length).toBeGreaterThan(1);
      // and the old parser and the new default parser agree on every final record the scenario produced
      for (const l of a.log.filter((x) => x.startsWith(`put ${BC}/bridge-final`))) {
        const t = JSON.parse(l.slice(`put ${BC}/bridge-final `.length));
        expect(parseBridgeFinal(t)).toEqual(old.parseBridgeFinal(t));
      }
    });
  }
  it('E1 differential (parser): old and new default parsers agree on valid, truncated, reordered and foreign records', async () => {
    const old = await e1Bridge();
    const good = 'api accepted=1 refused=0 open=0\ndb accepted=2 refused=1 open=1\napp accepted=0 refused=0 open=0\nLISTENERS UNRESOLVED\nCLOSE CEILING\nEND\n';
    const cases = [good, good.replace('db ', 'xx '), good.replace('END\n', 'END'), 'app accepted=1 refused=0 open=0\nLISTENERS CLOSED\nCLOSE OWNER\nEND\n', '', good.split('\n').reverse().join('\n'), good + 'x'];
    for (const c of cases) expect(parseBridgeFinal(c), JSON.stringify(c)).toEqual(old.parseBridgeFinal(c));
    expect(parseBridgeFinal(null as never)).toEqual(old.parseBridgeFinal(null as never));
  });
  it('E1 argv is unchanged and the video CLI form is closed: `<sock> <ctl> --kind video <port>` only', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/bridge.mjs'), 'utf8');
    expect(src).toContain("const appOnly = argv[2] === '--kind';");
    expect(src).toContain("if (appOnly && (argv.length !== 5 || argv[3] !== 'video')) process.exit(2);");
    expect(src).toContain('const [sockDir, ctl, a, d, p] = appOnly ? [argv[0], argv[1], null, null, argv[4]] : argv;');
    // run-lane's E1 spawn argv expression is the BASE one, verbatim
    const e1Spawn = '[L.sock, L.C, String(ports.api), String(ports.db), String(ports.app)]';
    expect(git('show', `${BASE}:scripts/e2e/le-lane/run-lane.mjs`)).toContain(`d.spawnBridge(L.bridge, ${e1Spawn})`);
    expect(readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/run-lane.mjs'), 'utf8')).toContain(`d.spawnBridge(L.bridge, e1 ? ${e1Spawn} : K.bridgeArgs(L, ports))`);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// run-lane and image: the kind table is injected; with no kind, E1 runs its unchanged expressions (differential vs BASE).
// ---------------------------------------------------------------------------------------------------------------------------
type RO = { kind?: 'video'; createOk?: boolean; cidFile?: string | null; createOut?: string; inspectBad?: (o: Obj) => void; lsOut?: [boolean, string];
  bridgeNoExit?: boolean; procStays?: boolean; finalOpen?: number; noBridgeReady?: boolean; readyLine?: string; waitOut?: string; failPut?: string[];
  inputsBad?: boolean; listeners?: string; closeBy?: string; earlyExit?: boolean; finalText?: string };
const CREATED = { Status: 'created', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '0001-01-01T00:00:00Z' };
const E1_API = 'http://127.0.0.1:54321', E1_DB = 'postgresql://postgres@127.0.0.1:54322/postgres';
function inspectFor(exp: Obj, state: Obj) {
  const { Image, User, EffectiveMounts, Config, ...hc } = exp;
  return {
    Id: CIDV, Image,
    Config: { Hostname: CIDV.slice(0, 12), Domainname: '', User, AttachStdin: false, AttachStdout: true, AttachStderr: true, Tty: false, OpenStdin: false,
      StdinOnce: false, Env: [...Config.Env].reverse(), Cmd: Config.Cmd, Image: IMG, Volumes: null, WorkingDir: R, Entrypoint: null, OnBuild: null, Labels: {} },
    HostConfig: { ...hc, Mounts: [] },
    Mounts: [...EffectiveMounts].reverse().map((m: Obj) => ({ ...m, Mode: m.RW ? 'rw' : 'ro', Name: '' })),
    State: state,
  };
}
function laneFake(o: RO = {}) {
  const video = o.kind === 'video';
  const L: Obj = video ? V : E;
  const nodeSha = createHash('sha256').update('node-bytes').digest('hex');
  const env = video ? videoEnv(V, { commit: COMMIT, shell: SHELL }) : laneEnv(E, { apiOrigin: E1_API, dbUrl: E1_DB, commit: COMMIT, shell: SHELL });
  const exp = (video ? expectedVideoConfig : expectedLaneConfig)(L as never, { imageId: IMG, uid: UID, gid: GID, env, seccompText: PROFILE_RAW.toString('utf8'), cid: CIDV } as never);
  const files = new Map<string, string | Buffer>([[L.iid, `${IMG}\n`], [L.seccomp, PROFILE_RAW], [SHELL, Buffer.from('shell')], [NODE, Buffer.from('node-bytes')],
    [L.manifest, `${'1'.repeat(64)}  /usr/bin/cat\n${nodeSha}  ${LANE_NODE}\n`]]);
  const procs = new Set<string>();
  const calls: string[][] = [];
  const put: string[] = [];
  let state: Obj = CREATED, exists = false;
  const dir = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, mode: 0o40700, uid: UID, nlink: 2 };
  const file = { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, mode: 0o100600, uid: UID, nlink: 1 };
  const stats = new Map<string, Obj>(video
    ? [[V.P, dir], [V.sock, dir], [V.lane, o.inputsBad ? { ...dir, mode: 0o40755 } : dir], [V.out, dir], [V.C, dir]]
    : [[E.P, dir], [E.keys, dir], [E.anon, file], [E.service, file], [E.dbpass, o.inputsBad ? { ...file, mode: 0o100644 } : file], [E.proofDir, dir], [E.proof, file], [E.sock, dir], [E.lane, dir], [E.out, dir], [E.C, dir]]);
  const enoent = () => Object.assign(new Error('x'), { code: 'ENOENT' });
  const fsx = {
    readFileSync: (p: string, enc?: string) => { if (p.startsWith('/proc/')) { if (!procs.has(p)) throw enoent(); return '9 (node) S 1 1 1 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 555 0 0'; } const v = files.get(p); if (v === undefined) throw enoent(); return enc ? v.toString() : v; },
    lstatSync: (p: string) => { const s = stats.get(p); if (!s) throw enoent(); return s; },
    readdirSync: () => [],
    statSync: (p: string) => { if (!procs.has(`${p}/stat`) && !(o.procStays && p === '/proc/4242')) throw enoent(); return {}; },
  };
  const finalText = o.finalText ?? (video
    ? `app accepted=1 refused=0 open=${o.finalOpen ?? 0}\nLISTENERS ${o.listeners ?? 'CLOSED'}\nCLOSE ${o.closeBy ?? 'OWNER'}\nEND\n`
    : `api accepted=1 refused=0 open=0\ndb accepted=1 refused=0 open=${o.finalOpen ?? 0}\napp accepted=1 refused=0 open=0\nLISTENERS ${o.listeners ?? 'CLOSED'}\nCLOSE ${o.closeBy ?? 'OWNER'}\nEND\n`);
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null as number | null, signalCode: null as string | null, kill: (sig: string) => {
    calls.push(['kill', sig]);
    if (sig === 'SIGUSR2') files.set(L.sealAck, 'sealed\n');
    if (sig === 'SIGUSR2' && o.earlyExit) { procs.delete('/proc/4242/stat'); child.exitCode = 0; process.nextTick(() => child.emit('exit', 0)); }
    if ((sig === 'SIGTERM' || sig === 'SIGKILL') && !o.bridgeNoExit) {
      files.set(L.bridgeFinal, finalText);
      procs.delete('/proc/4242/stat');
      child.exitCode = 0;
      process.nextTick(() => child.emit('exit', 0));
    }
    return true; } });
  const exec = async (bin: string, args: string[]) => {
    calls.push([bin, ...args]);
    const c = args[0];
    if (c === 'create') { if (o.cidFile !== null) files.set(L.cidfile, `${o.cidFile ?? CIDV}\n`); exists = true; return { ok: o.createOk ?? true, stdout: `${o.createOut ?? CIDV}\n` }; }
    if (c === 'container' && args[1] === 'inspect') { const g = inspectFor(exp, state) as Obj; if (o.inspectBad && state === CREATED) o.inspectBad(g); return exists ? { ok: true, stdout: JSON.stringify([g]) } : { ok: false, stdout: '' }; }
    if (c === 'start') { state = { Status: 'running', Running: true, Paused: false, Restarting: false, Pid: 77, Dead: false, StartedAt: '2026-11-04T01:00:00Z' }; return { ok: true, stdout: `${CIDV}\n` }; }
    if (c === 'wait') { state = { Status: 'exited', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '2026-11-04T01:00:00Z' }; return { ok: true, stdout: `${o.waitOut ?? '0'}\n` }; }
    if (c === 'stop') return { ok: true, stdout: `${CIDV}\n` };
    if (c === 'rm') { exists = false; return { ok: true, stdout: `${CIDV}\n` }; }
    if (c === 'container' && args[1] === 'ls') return o.lsOut ? { ok: o.lsOut[0], stdout: o.lsOut[1] } : { ok: true, stdout: exists ? `${CIDV}\n` : '' };
    return { ok: false, stdout: '' };
  };
  const d = {
    exec, fs: fsx, uid: () => UID, gid: () => GID, sleep: () => new Promise<void>((r) => { setTimeout(r, 2); }), browserSha256: createHash('sha256').update('shell').digest('hex'),
    files: { put: (p: string, t: string) => { if (o.failPut?.includes(p)) throw new Error('EEXIST'); put.push(p); files.set(p, t); } },
    spawnBridge: (script: string, args: string[]) => {
      calls.push(['spawnBridge', script, ...args]);
      if (!o.noBridgeReady) { files.set(L.bridgeReady, o.readyLine ?? (video ? '4242 555 8080\n' : '4242 555 54321 54322 8080\n')); procs.add('/proc/4242/stat'); }
      return child;
    },
  };
  return { d, calls, put, files };
}
const runWith = (rl: (d: never, o: never) => Promise<{ ok: boolean; say: string[] }>, o: RO = {}) => {
  const f = laneFake(o);
  const args = o.kind === 'video'
    ? { C, P, R, node: NODE, shell: SHELL, commit: COMMIT, kind: KINDS.video }
    : { C, P, R, node: NODE, shell: SHELL, apiOrigin: E1_API, dbUrl: E1_DB, commit: COMMIT };
  return rl(f.d as never, args as never).then((r) => ({ ...r, calls: f.calls, put: f.put, files: Object.fromEntries([...f.files].map(([k, v]) => [k, v.toString()])) }));
};
const gatesOf = (say: string[]) => Object.fromEntries(say.filter((l) => l.startsWith('GATE ')).map((l) => l.split(' ').slice(1)));
const E1_SCENARIOS: RO[] = [
  {}, { inputsBad: true }, { failPut: [E.started] }, { cidFile: null }, { createOut: 'd'.repeat(64) }, { createOk: false, cidFile: null },
  { inspectBad: (g) => { g.Config.Env.push('X=1'); } }, { lsOut: [false, ''] }, { lsOut: [true, `${CIDV}\n`] }, { procStays: true }, { bridgeNoExit: true },
  { finalOpen: 2 }, { listeners: 'UNRESOLVED' }, { closeBy: 'CEILING' }, { earlyExit: true }, { noBridgeReady: true }, { waitOut: '1' },
  { readyLine: '4242 555 54321 54322 8081\n' }, { readyLine: '4242 555 8080\n' }, { finalText: 'app accepted=1 refused=0 open=0\nLISTENERS CLOSED\nCLOSE OWNER\nEND\n' },
  { failPut: [E.gates] },
];

describe('run-lane kind dispatch: E1 differential equivalence vs 0a075a77, and the video kind', () => {
  it('E1 differential: every scenario gives the same result, lines, docker/bridge calls and receipts as the BASE module', async () => {
    const base = (await baseModules()).runLane;
    for (const o of E1_SCENARIOS) {
      const a = await runWith(base.runLane, o);
      const b = await runWith(runLane as never, o);
      expect(b, JSON.stringify(o, (_k, v) => (typeof v === 'function' ? String(v) : v))).toEqual(a);
    }
  }, 60_000);
  it('an unknown or unfrozen kind is an input refusal before any receipt or docker call', async () => {
    for (const kind of ['video', 'e1', { ...KINDS.video }, { name: 'catalog' }, null, 0]) {
      const f = laneFake({ kind: 'video' });
      const r = await runLane(f.d as never, { C, P, R, node: NODE, shell: SHELL, commit: COMMIT, kind } as never);
      expect(r, String(kind)).toEqual({ ok: false, say: ['LANE_E_INPUT'] });
      expect(f.calls).toEqual([]);
      expect(f.put).toEqual([]);
    }
  });
  it('video happy path: four binds, the video env and entry, ONE bridged port (`--kind video 8080`), gates last', async () => {
    const r = await runWith(runLane as never, { kind: 'video' });
    expect(r.ok).toBe(true);
    expect(gatesOf(r.say)).toEqual({ CONTAINER: 'LANE_ABSENT', BRIDGE: 'BRIDGE_REAPED', CLIENTS: 'REAPED', STARTED: 'YES' });
    expect(r.calls.find((c) => c[0] === 'spawnBridge')).toEqual(['spawnBridge', V.bridge, V.sock, C, '--kind', 'video', '8080']);
    const create = r.calls.find((c) => c[1] === 'create')!.slice(1);
    expect(create).toEqual(videoCreateArgs(V, { imageId: IMG, uid: UID, gid: GID, env: videoEnv(V, { commit: COMMIT, shell: SHELL }) }));
    expect(r.put[0]).toBe(V.started);
    expect(r.put.at(-1)).toBe(V.gates);
    expect(parseGates(r.files[V.gates])).not.toBeNull();
  });
  it('video failure shapes: a three-port ready line, a three-socket final, an open connection, a ceiling, a refused input', async () => {
    const id = await runWith(runLane as never, { kind: 'video', readyLine: '4242 555 54321 54322 8080\n' });
    expect(id.say).toContain('LANE_E_BRIDGE_START');
    const wrongPort = await runWith(runLane as never, { kind: 'video', readyLine: '4242 555 8081\n' });
    expect(wrongPort.say).toContain('LANE_E_BRIDGE_IDENTITY');
    const e1Final = await runWith(runLane as never, { kind: 'video', finalText: 'api accepted=1 refused=0 open=0\ndb accepted=1 refused=0 open=0\napp accepted=1 refused=0 open=0\nLISTENERS CLOSED\nCLOSE OWNER\nEND\n' });
    expect(e1Final.say).toContain('BRIDGE_E_FINAL');
    expect((await runWith(runLane as never, { kind: 'video', finalOpen: 1 })).say).toContain('BRIDGE_E_DRAIN');
    expect((await runWith(runLane as never, { kind: 'video', closeBy: 'CEILING' })).say).toContain('BRIDGE_E_CEILING');
    const bad = await runWith(runLane as never, { kind: 'video', inputsBad: true });
    expect(bad).toMatchObject({ ok: false, say: ['LANE_E_INPUT'], calls: [] });
    for (const r of [id, wrongPort, e1Final]) expect(r.ok).toBe(false);
  });
  it('E1 CLIs and host import closures are unchanged: run-lane.mjs and image.mjs import nothing new and keep their argv blocks', () => {
    for (const rel of ['scripts/e2e/le-lane/run-lane.mjs', 'scripts/e2e/le-lane/image.mjs', 'scripts/e2e/le-lane/bridge.mjs']) {
      const imports = (t: string) => [...t.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
      expect(imports(readFileSync(path.join(ROOT, rel), 'utf8')), rel).toEqual(imports(git('show', `${BASE}:${rel}`)));
    }
    const cli = (t: string) => t.slice(t.indexOf('if (process.argv[1] &&'));
    for (const rel of ['scripts/e2e/le-lane/run-lane.mjs', 'scripts/e2e/le-lane/image.mjs'])
      expect(cli(readFileSync(path.join(ROOT, rel), 'utf8')), rel).toBe(cli(git('show', `${BASE}:${rel}`)));
  });
});

describe('image closure dispatch: E1 differential vs 0a075a77; video closure is a strict subset (no psql, no git)', () => {
  const imageFake = () => {
    const calls: string[][] = [];
    const fsx = {
      existsSync: () => false,
      mkdirSync: (p: string) => { calls.push(['mkdir', p]); if (p.endsWith('/rootfs')) throw new Error('stop here'); },
      readdirSync: () => [{ name: 'chrome-headless-shell', isFile: () => true }, { name: 'libx.so', isFile: () => true }],
    };
    const d = { fs: fsx, exec: async (bin: string, args: string[]) => { calls.push([bin, ...args]); return { ok: true, stdout: '' }; },
      files: { put: (p: string) => { calls.push(['put', p]); } }, uid: () => UID, gid: () => GID };
    return { d, calls };
  };
  it('E1: the same ldd closure, control writes and result code as the BASE module', async () => {
    const base = (await baseModules()).image;
    const a = imageFake(), b = imageFake();
    const ra = await base.buildLaneImage(a.d, { ctl: C, repo: R, node: NODE, shell: SHELL });
    const rb = await buildLaneImage(b.d as never, { ctl: C, repo: R, node: NODE, shell: SHELL });
    expect(rb).toEqual(ra);
    expect(b.calls).toEqual(a.calls);
    expect(a.calls.filter((c) => c[0] === 'ldd').map((c) => c[1])).toEqual([NODE, SHELL, PSQL_REAL, ...TOOL_PATHS]);
  });
  it('video: ldd over node, the shell and exactly the six video tools; the table is frozen and a copy is refused', async () => {
    const f = imageFake();
    await buildLaneImage(f.d as never, { ctl: C, repo: R, node: NODE, shell: SHELL, kind: KINDS.video });
    expect(f.calls.filter((c) => c[0] === 'ldd').map((c) => c[1])).toEqual([NODE, SHELL, ...VIDEO_TOOL_PATHS]);
    expect(VIDEO_TOOLS.every((t) => TOOLS.includes(t))).toBe(true);
    expect(VIDEO_TOOLS).not.toContain('git');
    expect(VIDEO_TOOL_PATHS).not.toContain(PSQL_REAL);
    for (const kind of [{ ...KINDS.video }, 'video', { name: 'video', closureBins: ['/usr/bin/psql'] }]) {
      const g = imageFake();
      expect((await buildLaneImage(g.d as never, { ctl: C, repo: R, node: NODE, shell: SHELL, kind } as never)).code).toBe('LANE_E_IMAGE_INPUT');
      expect(g.calls).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// kinds: the e1 entry IS today's contract; the video table differs from E1 only where the design says.
// ---------------------------------------------------------------------------------------------------------------------------
describe('kinds: closed set; e1 references contract.mjs; video differs only in binds, env, entry and socket set', () => {
  it('the kind set is closed and the e1 entry references the contract functions themselves', () => {
    expect(KIND_NAMES).toEqual(['e1', 'video']);
    expect(Object.isFrozen(KINDS) && Object.isFrozen(KINDS.e1) && Object.isFrozen(KINDS.video)).toBe(true);
    expect(laneKind(undefined)).toBe(KINDS.e1);
    for (const bad of ['catalog', 'E1', '', null]) expect(() => laneKind(bad as never)).toThrow('unknown kind');
    expect(KINDS.e1.paths).toBe(lanePaths);
    expect(KINDS.e1.createArgs).toBe(laneCreateArgs);
    expect(KINDS.e1.expected).toBe(expectedLaneConfig);
    expect(KINDS.e1.binds).toBe(laneBinds);
    expect(KINDS.e1.sockets).toBe(SOCKETS);
    expect(KINDS.e1.ports({ apiOrigin: E1_API, dbUrl: E1_DB })).toEqual(lanePorts({ apiOrigin: E1_API, dbUrl: E1_DB }));
    expect(KINDS.e1.env(E, { apiOrigin: E1_API, dbUrl: E1_DB, commit: COMMIT, shell: SHELL })).toEqual(laneEnv(E, { apiOrigin: E1_API, dbUrl: E1_DB, commit: COMMIT, shell: SHELL }));
    expect(KINDS.e1.bridgeArgs(E, { api: 1, db: 2, app: 3 })).toEqual([E.sock, C, '1', '2', '3']);
    expect(KINDS.video.sockets).toBe(APP_ONLY);
  });
  it('video binds: exactly R ro, P/sock ro, P/lane rw, P/out rw; no keys, DB password or proof path anywhere in the video argv', () => {
    expect(videoBinds(V)).toEqual([[R, false], [`${P}/sock`, false], [`${P}/lane`, true], [`${P}/out`, true]]);
    const a = videoCreateArgs(V, { imageId: IMG, uid: UID, gid: GID, env: videoEnv(V, { commit: COMMIT, shell: SHELL }) });
    expect(a.flatMap((x, i) => (x === '-v' ? [a[i + 1]] : []))).toEqual([`${R}:${R}:ro,rprivate`, `${P}/sock:${P}/sock:ro,rprivate`, `${P}/lane:${P}/lane:rw,rprivate`, `${P}/out:${P}/out:rw,rprivate`]);
    expect(a.join(' ')).not.toMatch(/keys|dbpass|proof|LE_API|LE_DB|SUPABASE|VITE_|GITHUB_/);
    expect(a.slice(-4)).toEqual([IMG, LANE_NODE, `${R}/scripts/e2e/le-lane/video-entry.mjs`, R]);
  });
  it('video create argv equals the E1 argv token for token once binds, -e list and the entry script are removed', () => {
    const e1 = laneCreateArgs(E, { imageId: IMG, uid: UID, gid: GID, env: laneEnv(E, { apiOrigin: E1_API, dbUrl: E1_DB, commit: COMMIT, shell: SHELL }) });
    const vid = videoCreateArgs(V, { imageId: IMG, uid: UID, gid: GID, env: videoEnv(V, { commit: COMMIT, shell: SHELL }) });
    const strip = (a: string[]) => a.filter((x, i) => !['-v', '-e'].includes(x) && !['-v', '-e'].includes(a[i - 1])).filter((x) => !/(lane-entry|video-entry)\.mjs$/.test(x));
    expect(strip(vid)).toEqual(strip(e1));
    expect(vid).toContain(`seccomp=${R}/${SECCOMP_PROFILE_REL}`);
    for (const f of ['--network', 'none', '--cap-drop', 'ALL', 'no-new-privileges', '--read-only', '--init']) expect(vid).toContain(f);
  });
  it('video env: exact keys in order; no API, DB, key, proof or secret; refuses a bad commit or a shell outside the pinned layout', () => {
    const env = videoEnv(V, { commit: COMMIT, shell: SHELL });
    expect(env.map((e) => e.split('=')[0])).toEqual([...VIDEO_ENV_KEYS]);
    expect(Object.fromEntries(env.map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]))).toMatchObject({
      LE_KIND: 'video', LE_APP_ORIGIN: 'http://127.0.0.1:8080', LE_EGRESS_DIR: `${P}/out/egress`, LE_OUTPUT_DIR: `${P}/lane/evidence/pw-output`,
      LE_REPORT_JSON: `${P}/lane/evidence/report.json`, E2E_EVIDENCE_ENVIRONMENT: 'sealed-stubbed', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: SHELL });
    for (const k of VIDEO_ENV_KEYS) expect(k).not.toMatch(/PASSWORD|KEY|TOKEN|SECRET|^LE_API|^LE_DB|^SUPABASE|^VITE_|^PG|^GITHUB/);
    expect(() => videoEnv(V, { commit: 'HEAD', shell: SHELL })).toThrow();
    for (const sh of ['/x/chrome', 'relative/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell', `${SHELL}\n`, '/a/../chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell'])
      expect(() => videoEnv(V, { commit: COMMIT, shell: sh }), sh).toThrow();
  });
  it('video inspect expectation differs from E1 only in Binds, EffectiveMounts, Config.Env and Config.Cmd; compareLaneInspect accepts it exactly', () => {
    const env = videoEnv(V, { commit: COMMIT, shell: SHELL });
    const seccompText = PROFILE_RAW.toString('utf8');
    const v = expectedVideoConfig(V, { imageId: IMG, uid: UID, gid: GID, env, seccompText, cid: CIDV }) as Obj;
    const e = expectedLaneConfig(E, { imageId: IMG, uid: UID, gid: GID, env: laneEnv(E, { apiOrigin: E1_API, dbUrl: E1_DB, commit: COMMIT, shell: SHELL }), seccompText, cid: CIDV }) as Obj;
    const differ = Object.keys({ ...e, ...v }).filter((k) => JSON.stringify(e[k]) !== JSON.stringify(v[k]));
    expect(differ.sort()).toEqual(['Binds', 'Config', 'EffectiveMounts']);
    expect(Object.keys(v.Config).filter((k) => JSON.stringify(e.Config[k]) !== JSON.stringify(v.Config[k])).sort()).toEqual(['Cmd', 'Env']);
    expect(v.Config.Env).toEqual([IMAGE_PATH_ENV, ...env].sort());
    expect(compareLaneInspect(inspectFor(v, { Status: 'exited' }), v)).toEqual([]);
    const extraBind = inspectFor(v, {}) as Obj;
    extraBind.HostConfig.Binds = [...extraBind.HostConfig.Binds, `${P}/keys:${P}/keys:ro,rprivate`];
    expect(compareLaneInspect(extraBind, v)).toContain('Binds');
  });
  it('videoInputsOk: 0700 own-uid dirs, empty sock/lane/out; refuses a non-empty dir, a symlink, a foreign owner, a wider mode', () => {
    const dir = { isDirectory: () => true, isSymbolicLink: () => false, mode: 0o40700, uid: UID };
    const fsx = (over: Record<string, Obj> = {}, nonEmpty = '') => ({ lstatSync: (p: string) => over[p] ?? dir, readdirSync: (p: string) => (p === nonEmpty ? ['x'] : []) });
    expect(videoInputsOk(fsx(), V, UID)).toBe(true);
    expect(videoInputsOk(fsx({}, V.out), V, UID)).toBe(false);
    expect(videoInputsOk(fsx({ [V.sock]: { ...dir, isSymbolicLink: () => true } }), V, UID)).toBe(false);
    expect(videoInputsOk(fsx({ [V.lane]: { ...dir, uid: 0 } }), V, UID)).toBe(false);
    expect(videoInputsOk(fsx({ [V.P]: { ...dir, mode: 0o40750 } }), V, UID)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Per-worker egress records (ADDENDUM r2.1 C2).
// ---------------------------------------------------------------------------------------------------------------------------
describe('egress records: per-worker start/end grammar and the aggregation gate', () => {
  const stem = (wi: number, pid = 100 + wi) => egressStem({ workerIndex: wi, parallelIndex: 0, pid, nonce: `${wi}`.padStart(16, 'a') });
  const end = (o: Partial<{ refused: number; tests: number; closed: boolean; lines: string[] }> = {}) =>
    egressEndText({ refused: o.refused ?? 0, forwarded: 0, tests: o.tests ?? 24, closed: o.closed ?? true, lines: o.lines ?? [] });
  const dirOf = (recs: Record<string, string>) => ({ names: Object.keys(recs), read: (n: string) => recs[n] ?? null });
  const agg = (recs: Record<string, string>, declared = VIDEO_DECLARED_TESTS) => { const d = dirOf(recs); return aggregateEgress(d.names, d.read, declared); };
  it('one worker, 24 tests, nothing refused: OK', () => {
    const s = stem(0);
    expect(agg({ [`${s}.start`]: START_TEXT, [`${s}.end`]: end() })).toMatchObject({ ok: true, code: 'LANE_EGRESS_OK', workers: 1, tests: 24, refused: 0 });
  });
  it('two sequential workers (a replacement after a failure) are summed for coverage', () => {
    const a = stem(0), b = stem(1);
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: end({ tests: 10 }), [`${b}.start`]: START_TEXT, [`${b}.end`]: end({ tests: 14 }) })).toMatchObject({ ok: true, workers: 2, tests: 24 });
  });
  it('a missing end, an orphan end, a duplicate worker index, closed=0 and a malformed record each fail', () => {
    const a = stem(0), b = stem(0, 999);
    expect(agg({ [`${a}.start`]: START_TEXT }).code).toBe('LANE_E_EGRESS_UNMATCHED');
    expect(agg({ [`${a}.end`]: end() }).code).toBe('LANE_E_EGRESS_UNMATCHED');
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: end({ tests: 12 }), [`${b}.start`]: START_TEXT, [`${b}.end`]: end({ tests: 12 }) }).code).toBe('LANE_E_EGRESS_DUPLICATE');
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: end({ closed: false }) }).code).toBe('LANE_E_EGRESS_OPEN');
    for (const bad of ['', 'refused=0 forwarded=0 tests=24 closed=1', 'refused=0 forwarded=0 tests=24 closed=1\nextra\n', 'refused=1 forwarded=0 tests=24 closed=1\n', 'refused=0 forwarded=0 tests=24 closed=2\n'])
      expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: bad }).code, JSON.stringify(bad)).toBe('LANE_E_EGRESS_MALFORMED');
    expect(agg({ [`${a}.start`]: 'start\n', [`${a}.end`]: end() }).code).toBe('LANE_E_EGRESS_MALFORMED');
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: null as never }).code).toBe('LANE_E_EGRESS_MALFORMED');
  });
  it('refusals at startup, between tests, at teardown and at launch failure all reach the record and fail the gate', () => {
    const a = stem(0);
    const line = refusedLine('method', 'POST', 'https://sealed-video.invalid/rest/v1/x');
    // the record carries the whole-worker count, whatever phase produced it; a launch failure reports tests=0 plus its refusals
    for (const rec of [end({ refused: 1, lines: [line] }), end({ refused: 3, lines: [line, line, line] }), end({ refused: 1, tests: 0, lines: [refusedLine('websocket', '', 'ws://127.0.0.1:8080/x')] })])
      expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: rec }).code).toBe('LANE_E_EGRESS_REFUSED');
    // more than 16 refusals: the count stays exact, the lines are capped at 16
    const many = end({ refused: 40, lines: Array(40).fill(line) });
    expect(parseEndText(many)).toMatchObject({ refused: 40, lines: Array(16).fill(line) });
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: many }).code).toBe('LANE_E_EGRESS_REFUSED');
  });
  it('coverage: a shortfall, an excess and zero records each fail as LANE_E_EGRESS_COVERAGE', () => {
    const a = stem(0);
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: end({ tests: 23 }) }).code).toBe('LANE_E_EGRESS_COVERAGE');
    expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: end({ tests: 25 }) }).code).toBe('LANE_E_EGRESS_COVERAGE');
    expect(agg({}).code).toBe('LANE_E_EGRESS_COVERAGE');
  });
  it('an unknown file and 33 workers fail; names, origins and lines are closed grammars', () => {
    const a = stem(0);
    for (const n of ['notes.txt', `${a}.start.tmp`, `${a}.START`, 'w-0-0-0-aaaaaaaaaaaaaaaa.start', `../${a}.start`])
      expect(agg({ [`${a}.start`]: START_TEXT, [`${a}.end`]: end(), [n]: '' }).code, n).toBe('LANE_E_EGRESS_UNKNOWN_FILE');
    const recs: Record<string, string> = {};
    for (let i = 0; i <= MAX_RECORDS; i++) { const s = stem(i); recs[`${s}.start`] = START_TEXT; recs[`${s}.end`] = end({ tests: 0 }); }
    expect(agg(recs).code).toBe('LANE_E_EGRESS_TOO_MANY');
    expect(() => egressStem({ workerIndex: -1, parallelIndex: 0, pid: 1, nonce: 'a'.repeat(16) })).toThrow();
    expect(() => egressStem({ workerIndex: 0, parallelIndex: 0, pid: 1, nonce: 'A'.repeat(16) })).toThrow();
    expect(refusalOrigin('https://x.example/path?q=secret')).toBe('https://x.example');
    expect(refusalOrigin('data:text/html,hi')).toBe('<opaque>');
    expect(refusalOrigin('not a url')).toBe('<opaque>');
    expect(refusedLine('method', 'post', 'http://a.b')).toBe('REFUSED method - http://a.b');
    expect(() => refusedLine('other' as never, 'GET', 'http://a.b')).toThrow();
    expect(() => egressEndText({ refused: 0, forwarded: 0, tests: 1, closed: true, lines: ['REFUSED method GET http://a.b x'] })).toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Configs: the sealed config's load contract (C3/C4 of r1.4, C3/C4 of r2.1) and the main-config exclusion (C1/C2/C5/C6).
// ---------------------------------------------------------------------------------------------------------------------------
const PWUtil = createRequire(import.meta.url)(path.join(ROOT, 'node_modules/playwright/lib/util.js')) as { createFileMatcher: (p: unknown) => (f: string) => boolean };
const SPEC_ABS = path.join(ROOT, 'e2e/stubbed/wp09a-video-embed.spec.ts');
const EXTS = new Set(['.js', '.ts', '.mjs', '.mts', '.cjs', '.cts', '.jsx', '.tsx']);
/** Every file under a directory, as Playwright's collectFiles walks it (node_modules and dot-dirs skipped); read-only. */
const trackedUnder = (dirAbs: string): string[] => {
  const out: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (EXTS.has(path.extname(p))) out.push(p); } };
  walk(dirAbs);
  return out.sort();
};
const code = (t: string) => t.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
/** Playwright 1.59.1's own selection (projectUtils.collectFilesForProject + config.js takeFirst), over the tracked files. */
function collected(cfg: Obj, configDir: string) {
  const out: Record<string, string[]> = {};
  const projects: Obj[] = cfg.projects?.length ? cfg.projects : [{ name: '' }];
  for (const p of projects) {
    const testDir = path.resolve(configDir, p.testDir ?? cfg.testDir ?? '.');
    const match = PWUtil.createFileMatcher(p.testMatch ?? cfg.testMatch ?? '**/*.@(spec|test).?(c|m)[jt]s?(x)');
    const ignore = PWUtil.createFileMatcher(p.testIgnore ?? cfg.testIgnore ?? []);
    out[p.name] = trackedUnder(testDir).filter((f) => !ignore(f) && match(f));
  }
  return out;
}
const LANE_ENV = (): Record<string, string> => Object.fromEntries(videoEnv(videoPaths(P, '/nonexistent-ctl', ROOT), { commit: COMMIT, shell: SHELL }).map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]));
const isFileFake = (p: string) => p === SHELL;

describe('sealed video config: fail-closed load, validated shell in launchOptions, list-only, exact collection', () => {
  const settings = (env: Obj, argv: string[] = ['node', 'playwright', 'test']) => () => sealedVideoSettings({ env, argv, repo: ROOT, isFile: isFileFake });
  it('C3 refusals: env absent, wrong app origin, a missing or altered LE_* key, a preset guard, a non-absolute or wrong path, a wrong kind', () => {
    expect(settings({})).toThrow('SEALED_VIDEO_E_ENV');
    for (const o of ['http://localhost:8080', 'http://127.0.0.1:8081', 'https://abc.supabase.co']) expect(settings({ ...LANE_ENV(), LE_APP_ORIGIN: o }), o).toThrow('SEALED_VIDEO_E_ENV');
    for (const k of ['LE_KIND', 'LE_SOCK_DIR', 'LE_OUT_DIR', 'LE_OUTPUT_DIR', 'LE_REPORT_JSON', 'LE_EGRESS_DIR', 'E2E_EVIDENCE_COMMIT']) {
      const env = LANE_ENV(); delete env[k];
      expect(settings(env), k).toThrow('SEALED_VIDEO_E_ENV');
    }
    expect(settings({ ...LANE_ENV(), PUBLIC_VIDEO_SEALED: '1' })).toThrow('SEALED_VIDEO_E_PRESET');
    expect(settings({ ...LANE_ENV(), LE_LANE_DIR: 'rt/sv-private/lane' })).toThrow('SEALED_VIDEO_E_ENV');
    expect(settings({ ...LANE_ENV(), LE_EGRESS_DIR: `${P}/out` })).toThrow('SEALED_VIDEO_E_ENV');
    expect(settings({ ...LANE_ENV(), LE_KIND: 'e1' })).toThrow('SEALED_VIDEO_E_ENV');
    expect(settings({ ...LANE_ENV(), E2E_EVIDENCE_ENVIRONMENT: 'isolated-local-stack' })).toThrow('SEALED_VIDEO_E_ENV');
    // a worker must see the runner's guard exactly; the runner must not
    expect(settings({ ...LANE_ENV(), TEST_WORKER_INDEX: '0' })).toThrow('SEALED_VIDEO_E_PRESET');
    expect(settings({ ...LANE_ENV(), TEST_WORKER_INDEX: '0', PUBLIC_VIDEO_SEALED: '1' })).not.toThrow();
  });
  it('C4 shell: absolute, normalized, pinned layout, an existing regular file; launchOptions pass incomingProblem, mutations fail', () => {
    expect(shellProblem(SHELL, isFileFake)).toBeNull();
    for (const sh of ['', 'chrome', `${SHELL}/`, '/s/../s/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell', '/s/chromium_headless_shell-1216/chrome-headless-shell-linux64/chrome-headless-shell', `${SHELL}\n`])
      expect(shellProblem(sh, isFileFake), sh).toBe('SEALED_VIDEO_E_SHELL');
    expect(shellProblem(SHELL, () => false)).toBe('SEALED_VIDEO_E_SHELL');
    expect(shellProblem(SHELL, () => { throw new Error('EACCES'); })).toBe('SEALED_VIDEO_E_SHELL');
    expect(settings({ ...LANE_ENV(), PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/x/chrome' })).toThrow('SEALED_VIDEO_E');
    const s = sealedVideoSettings({ env: LANE_ENV(), argv: [], repo: ROOT, isFile: isFileFake });
    expect(s.launchOptions).toEqual({ executablePath: SHELL, args: [RESOLVER_ARG] });
    expect(incomingProblem(s.launchOptions, { shell: SHELL })).toBeNull();
    const lo = videoLaunchOptions(SHELL);
    for (const m of [{ ...lo, executablePath: undefined }, { args: lo.args }, { ...lo, executablePath: '/other/chrome' }, { ...lo, executablePath: 'rel/chrome' },
      { ...lo, args: [RESOLVER_ARG, '--no-sandbox'] }, { ...lo, chromiumSandbox: false }, { ...lo, ignoreDefaultArgs: true }])
      expect(incomingProblem(m, { shell: SHELL }), JSON.stringify(m)).not.toBeNull();
  });
  it('list-only: only with --list in the runner, never in a worker, never with any lane key or a preset guard', () => {
    const lo = { VIDEO_SEALED_LIST_ONLY: '1' };
    expect(sealedVideoSettings({ env: lo, argv: ['node', 'pw', 'test', '--list'], repo: ROOT, isFile: isFileFake })).toMatchObject({ mode: 'list-only', reportJson: null });
    expect(settings(lo)).toThrow('SEALED_VIDEO_E_LIST_ONLY');
    expect(settings({ ...lo, TEST_WORKER_INDEX: '0' }, ['--list'])).toThrow('SEALED_VIDEO_E_LIST_ONLY');
    expect(settings({ ...lo, LE_KIND: 'video' }, ['--list'])).toThrow('SEALED_VIDEO_E_LIST_ONLY');
    expect(settings({ ...lo, PUBLIC_VIDEO_SEALED: '1' }, ['--list'])).toThrow('SEALED_VIDEO_E_LIST_ONLY');
    expect(settings({ VIDEO_SEALED_LIST_ONLY: 'true' }, ['--list'])).toThrow('SEALED_VIDEO_E_LIST_ONLY');
  });
  it('C3 resolved discovery: the config at the repo root, testDir <R>/e2e/stubbed, the matcher selects exactly the spec; no setup hooks; no chromium-executable import', async () => {
    const src = readFileSync(path.join(ROOT, 'playwright.sealed-video.config.ts'), 'utf8');
    expect(code(src)).not.toMatch(/chromium-executable|globalSetup|globalTeardown|webServer|storageState/);
    const saved = { argv: process.argv, env: { ...process.env } };
    try {
      process.argv = ['node', 'playwright', 'test', '--list'];
      for (const k of Object.keys(process.env)) if (/^(LE_|PUBLIC_VIDEO_SEALED|TEST_WORKER_INDEX|E2E_EVIDENCE|PLAYWRIGHT_CHROMIUM)/.test(k)) delete process.env[k];
      process.env.VIDEO_SEALED_LIST_ONLY = '1';
      vi.resetModules();
      const cfg = (await import('../../../playwright.sealed-video.config.ts')).default as Obj;
      for (const k of ['globalSetup', 'globalTeardown', 'webServer']) expect(cfg[k], k).toBeUndefined();
      expect(path.resolve(ROOT, cfg.testDir)).toBe(path.join(ROOT, 'e2e/stubbed'));
      expect(String(cfg.testMatch)).toBe(String(SEALED_VIDEO_TEST_MATCH));
      expect(cfg.workers).toBe(1);
      expect(cfg.retries).toBe(0);
      expect(cfg.use).toMatchObject({ baseURL: 'http://127.0.0.1:8080', serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' });
      expect(collected(cfg, ROOT)).toEqual({ 'sealed-video-chromium': [SPEC_ABS] });
      expect(process.env.PUBLIC_VIDEO_SEALED).toBeUndefined(); // list-only never sets the guard
    } finally { process.argv = saved.argv; process.env = saved.env; vi.resetModules(); }
  });
  it('C4 lane mode load: with a complete fake lane env (one stubbed stat) the config carries the shell, the report and output paths, and sets the guard', async () => {
    const saved = { argv: process.argv, env: { ...process.env } };
    try {
      process.argv = ['node', 'playwright', 'test'];
      for (const k of Object.keys(process.env)) if (/^(LE_|PUBLIC_VIDEO_SEALED|VIDEO_SEALED_LIST_ONLY|TEST_WORKER_INDEX|E2E_EVIDENCE|PLAYWRIGHT_CHROMIUM)/.test(k)) delete process.env[k];
      Object.assign(process.env, LANE_ENV());
      vi.resetModules();
      const real = fsDefault.statSync;
      vi.spyOn(fsDefault, 'statSync').mockImplementation(((p: string, ...a: never[]) => (p === SHELL ? { isFile: () => true } : (real as (...x: unknown[]) => unknown)(p, ...a))) as never);
      const cfg = (await import('../../../playwright.sealed-video.config.ts')).default as Obj;
      expect(cfg.projects).toHaveLength(1);
      expect(cfg.projects[0].use.launchOptions).toEqual({ executablePath: SHELL, args: [RESOLVER_ARG] });
      expect(cfg.outputDir).toBe(LANE_ENV().LE_OUTPUT_DIR);
      expect(cfg.reporter).toEqual([['json', { outputFile: LANE_ENV().LE_REPORT_JSON }]]);
      expect(process.env.PUBLIC_VIDEO_SEALED).toBe('1');
    } finally { vi.restoreAllMocks(); process.argv = saved.argv; process.env = saved.env; vi.resetModules(); }
  });
});

describe('main config exclusion: the sealed spec is collected by NO main project (C1), causally (C2); other configs (C5); workflow (C6)', () => {
  const loadMain = async () => { vi.resetModules(); return (await import('../../../playwright.config.ts')) as Obj; };
  it('C1: evaluated with Playwright 1.59.1 createFileMatcher over every project, the spec is never collected; chromium-executable is mocked (no binary)', async () => {
    expect(JSON.parse(readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version).toBe('1.59.1');
    const m = await loadMain();
    const cfg = m.default as Obj;
    const sel = collected(cfg, ROOT);
    expect(Object.keys(sel).length).toBeGreaterThan(3);
    for (const [name, files] of Object.entries(sel)) {
      expect(files, name).not.toContain(SPEC_ABS);
      expect(files.filter((f) => f.includes('/e2e/stubbed/')), name).toEqual([]);
    }
    expect(sel['chromium-member'].length).toBeGreaterThan(10); // the evaluation is live: the member project still collects its specs
    expect(m.SEALED_LANE_IGNORE).toBe('**/stubbed/**');
    expect(cfg.testIgnore).toContain(m.SEALED_LANE_IGNORE);
  });
  it('C2 causal: without the chromium-member entry the member project collects the spec, and without the config-level entry nothing changes for member', async () => {
    const cfg = (await loadMain()).default as Obj;
    const noMember = { ...cfg, projects: cfg.projects.map((p: Obj) => (p.name === 'chromium-member' ? { ...p, testIgnore: p.testIgnore.filter((x: string) => x !== '**/stubbed/**') } : p)) };
    expect(collected(noMember, ROOT)['chromium-member']).toContain(SPEC_ABS);
    const noTop = { ...cfg, testIgnore: [] };
    expect(collected(noTop, ROOT)['chromium-member']).not.toContain(SPEC_ABS); // project testIgnore REPLACES the config-level one
  });
  it('C5: no other lane config can collect the sealed spec, and the sealed config collects nothing outside e2e/stubbed', () => {
    const dirs: Record<string, string> = {
      'playwright.gradebook-roles.config.ts': './e2e/gradebook-roles', 'playwright.quiz-lifecycle.config.ts': './e2e/quiz-lifecycle',
      'e2e/lesson-editor/playwright.lesson-editor.config.ts': '.', 'e2e/lesson-editor/playwright.egress-selftest.config.ts': '.',
    };
    for (const [cfgRel, dir] of Object.entries(dirs)) {
      const src = readFileSync(path.join(ROOT, cfgRel), 'utf8');
      expect(src, cfgRel).toContain(`testDir: '${dir}'`);
      const abs = path.resolve(path.dirname(path.join(ROOT, cfgRel)), dir);
      expect(SPEC_ABS.startsWith(`${abs}/`), cfgRel).toBe(false);
    }
    const all = trackedUnder(path.join(ROOT, 'e2e'));
    expect(all.filter((f) => SEALED_VIDEO_TEST_MATCH.test(f))).toEqual([SPEC_ABS]);
  });
  it('C6: no e2e.yml step runs Playwright on the sealed spec except through playwright.sealed-video.config.ts', () => {
    const wf = YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8')) as Obj;
    for (const [job, j] of Object.entries(wf.jobs as Obj)) {
      for (const s of (j as Obj).steps ?? []) {
        const run = String(s.run ?? '');
        if (/wp09a-video-embed|e2e\/stubbed/.test(run)) expect.fail(`${job}: a step names the sealed spec directly`);
        for (const m of run.matchAll(/playwright(?:\/test\/cli\.js)?\s+test\b[^\n]*/g))
          if (job === 'sealed-video') expect(m[0], job).toMatch(/-c playwright\.sealed-video\.config\.ts --list\b/);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// The fixture (static: it cannot run without a browser), the supervisor (fakes), the build scanner, the summary, the job.
// ---------------------------------------------------------------------------------------------------------------------------
describe('sandboxed-test.ts: only the worker browser is overridden; observer, AppArmor gate and the per-worker record', () => {
  const src = readFileSync(path.join(ROOT, 'e2e/stubbed/sandboxed-test.ts'), 'utf8');
  it('declares exactly egressLedger (worker), browser (worker), laneAppArmorGate (auto) and observer (auto); no stock fixture but browser', () => {
    const body = src.slice(src.indexOf('base.extend<'));
    const names = [...body.matchAll(/^ {2}([A-Za-z]+): \[$/gm)].map((m) => m[1]);
    expect(names).toEqual(['egressLedger', 'browser', 'laneAppArmorGate', 'observer']);
    for (const stock of ['page', 'context', 'baseURL', 'launchOptions', 'contextOptions', 'storageState', 'viewport']) expect(names).not.toContain(stock);
    expect(src).toMatch(/export \{ expect \};\s*$/);
  });
  it('the browser goes through withSandboxedBrowser with the bound shell and output dir, no proxy, AppArmor bound; no other launch path', () => {
    expect(src).toContain('await runWorkerBrowser((body: (b: unknown) => Promise<unknown>) => withSandboxedBrowser(playwright.chromium, {');
    expect(src).toContain('}, body), egressLedger, use);');
    expect(src).toContain('proxyUrl: null');
    expect(src).toContain('readLabel, onAppArmor');
    // The per-test text-render annotation carries one of two fixed values, never error text (correction c2).
    expect(src).toContain("test.info().annotations.push({ type: 'lane-text-render', description: egressLedger.textRender === 'LANE_TEXT_RENDER_OK' ? 'LANE_TEXT_RENDER_OK' : 'TEXT_RENDER_E_MISSING' });");
    expect(src.match(/type: 'lane-text-render'/g)).toHaveLength(1);
    expect(code(src)).not.toMatch(/\.launch\(|launchPersistentContext|launchServer|chromiumSandbox|no-sandbox|ignoreDefaultArgs/);
  });
  // The guard's own pattern (security.yml) matches the literal text of a write call, so a regex in THIS file that names the
  // call would be reported as a write site although this file writes nothing. `write[F]ileSync` is the same regular expression
  // (a one-character class) without that literal text. Only the test's pattern spelling changes: the guard, its allowlist and
  // the fixture's real writes are untouched, and the control below proves the guard still reports exactly those real writes.
  it('writes exactly two wx 0600 files per worker under LE_EGRESS_DIR: .start before the browser, .end in finally', () => {
    const writes = [...src.matchAll(/write[F]ileSync\(path\.join\(egressDir, `\$\{stem\}\.(start|end)`\)/g)].map((m) => m[1]);
    expect(writes).toEqual(['start', 'end']);
    expect(src.match(/write[F]ileSync\(/g)).toHaveLength(2);
    expect(src.match(/\{ flag: 'wx', mode: 0o600 \}/g)).toHaveLength(2);
    expect(src.indexOf('.start`')).toBeLessThan(src.indexOf('try { await use(ledger); } finally {'));
    expect(src).toContain('egressEndText(finalLedger(ledger))');
    expect(src).toMatch(/browser: \[\s*async \(\{ playwright, launchOptions, egressLedger \}/); // the ledger (and its .start) precedes the launch
    expect(src).toContain('const seen = await observeTest(context, egressLedger, use);');
    expect(code(src)).not.toMatch(/\.off\(|removeListener|removeAllListeners/); // the observer is never detached
  });
  it('fs-write guard control: the guard pattern still reports exactly the three real fixture lines and nothing in this file', () => {
    const wf = YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/security.yml'), 'utf8'));
    const run = JSON.stringify(wf);
    const allowed = new RegExp(/ALLOWED='([^']+)'/.exec(run)![1]);
    const pattern = new RegExp(/grep -nE '([^']+)'/.exec(run)![1]);
    const hits = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8').split('\n').map((l, i) => (pattern.test(l) ? i + 1 : 0)).filter(Boolean);
    const fixture = 'e2e/stubbed/sandboxed-test.ts';
    const self = 'src/test/ci/checkSealedVideoLane.test.ts';
    expect(allowed.test(fixture)).toBe(false); // not allowlisted: the guard keeps reporting it
    expect(allowed.test(self)).toBe(false);
    const fx = hits(fixture);
    expect(fx).toHaveLength(3); // the import line and the two write calls (.start, .end)
    const lines = readFileSync(path.join(ROOT, fixture), 'utf8').split('\n');
    expect(fx.map((n) => lines[n - 1]).filter((l) => /\{ flag: 'wx', mode: 0o600 \}/.test(l))).toHaveLength(2);
    expect(hits(self)).toEqual([]);
    // The pure observer module writes nothing and is not a hit either.
    expect(hits('scripts/e2e/le-lane/video-observer.mjs')).toEqual([]);
    // Discriminating negative: the guard pattern does match a real call and the pre-correction test spelling.
    expect(pattern.test(['write', 'FileSync(p, t)'].join(''))).toBe(true);
    expect(pattern.test(String.raw`src.match(/write` + String.raw`FileSync\(/g)`)).toBe(true);
  });
  it('the spec imports test and expect from the fixture, and decide() from the pure module (owner delta d81b1d49)', () => {
    const spec = readFileSync(SPEC_ABS, 'utf8');
    expect(spec).toContain("import { test, expect } from './sandboxed-test';");
    expect(spec).toContain("from './wp09a-decide';");
    expect(spec.match(/^\s*test\('/gm)?.length).toBe(8);
    expect(git('hash-object', SPEC_ABS).trim()).toBe('18dd6d719dca0329288ced648d8ae6a6f833bdac');
    expect(git('hash-object', path.join(ROOT, 'e2e/stubbed/wp09a-decide.ts')).trim()).toBe('1ddec193eac05ce6deceeba27fbf317dc4208232');
    expect(git('hash-object', path.join(ROOT, 'src/test/ci/wp09aDecide.test.ts')).trim()).toBe('0d6ca4c034daa3ac13f68e78029591a6b7278ae6');
  });
});

describe('video-entry supervisor (fakes): order, prechecks, one forwarder, the report and egress gates', () => {
  const R2 = '/w/repo';
  const VV = videoPaths(P, '/nonexistent-ctl', R2);
  const goodEnv = () => ({ ...Object.fromEntries(videoEnv(VV, { commit: COMMIT, shell: SHELL }).map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)])), PATH: IMAGE_PATH_ENV.slice(5), HOSTNAME: 'x' });
  const aa = 'PRE APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_DOCKER_DEFAULT_ENFORCE POST APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_DOCKER_DEFAULT_ENFORCE';
  const TR = { type: 'lane-text-render', description: 'LANE_TEXT_RENDER_OK' };
  const report = (stats: Obj = { expected: 24, unexpected: 0, flaky: 0, skipped: 0 }) => JSON.stringify({ stats, suites: [{ specs: [{ tests: [{ annotations: [{ type: 'lane-apparmor', description: aa }, TR], results: [{ status: 'passed' }] }] }] }] });
  const s0 = egressStem({ workerIndex: 0, parallelIndex: 0, pid: 7, nonce: 'b'.repeat(16) });
  type VO = Partial<{ label: string; env: Obj; tools: Record<string, string | null>; egressPre: string[]; fwdFail: boolean; app: string; pw: number; report: string; egress: Record<string, string>; umask: number }>;
  const mk = (o: VO = {}) => {
    const out: string[] = [];
    const calls: string[][] = [];
    const egress = o.egress ?? { [`${s0}.start`]: START_TEXT, [`${s0}.end`]: egressEndText({ refused: 0, forwarded: 0, tests: 24, closed: true }) };
    let egressMade = false;
    const tools: Record<string, string | null> = { node: LANE_NODE, ...Object.fromEntries(VIDEO_TOOLS.map((t) => [t, `/usr/bin/${t}`])), psql: null, git: null, ...(o.tools ?? {}) };
    const fsx = {
      accessSync: (p: string) => { const t = path.basename(p); if (!(t in tools) || tools[t] === null || !p.startsWith('/usr/bin/')) throw new Error('ENOENT'); },
      realpathSync: (p: string) => tools[path.basename(p)] ?? p,
      mkdirSync: (p: string, opt: Obj) => { calls.push(['mkdir', p, String(opt.mode)]); if (o.egressPre) throw new Error('EEXIST'); egressMade = true; },
      lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, mode: 0o40700, uid: UID }),
      readdirSync: (p: string) => (p === VV.egressDir ? (egressMade && calls.some((c) => c[0] === 'run') ? Object.keys(egress) : []) : []),
    };
    const d = {
      env: o.env ?? goodEnv(), repo: R2, fs: fsx, execPath: LANE_NODE, uid: () => UID, umask: () => o.umask ?? 0o077,
      openExcl: (p: string) => { calls.push(['open', p]); return p; }, write: (f: string, t: string) => { if (f === VV.laneTxt) out.push(t); else calls.push(['write', f, t]); }, close: () => {},
      readText: () => o.label ?? 'docker-default (enforce)\n',
      readReport: () => ({ status: 'ok', text: o.report ?? report() }),
      readRecord: (p: string) => { const t = egress[path.basename(p)]; return t === undefined ? { status: 'missing' } : { status: 'ok', text: t }; },
      fetch: async (u: string) => { calls.push(['fetch', u]); return { status: 200, text: async () => o.app ?? '<div id="root"></div>' }; },
      forward: async (port: number, sock: string) => { calls.push(['forward', String(port), sock]); if (o.fwdFail) throw new Error('EADDRINUSE'); return { close: () => calls.push(['fwd-close']) }; },
      run: async (bin: string, args: string[]) => { calls.push(['run', bin, ...args]); return { code: o.pw ?? 0, out: '' }; },
    };
    return { d, out, calls };
  };
  const lane = async (o: VO = {}) => { const f = mk(o); const r = await videoMain(f.d as never); return { ...r, text: f.out.join(''), calls: f.calls }; };
  it('happy path: START, AppArmor, then egress dir, ONE forwarder on 8080 -> app.sock, reach, the sealed config run, report and egress gates', async () => {
    const r = await lane();
    expect(r.code).toBe(0);
    expect(r.text).toBe(['LANE START', 'LANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'LANE VIDEO RAN', `LANE VIDEO APPARMOR ${aa}`, 'LANE VIDEO TEXT_RENDER LANE_TEXT_RENDER_OK', 'LANE VIDEO RESULT PASS', 'LANE EGRESS LANE_EGRESS_OK', 'LANE END', ''].join('\n'));
    expect(videoLaneVerdict(parseVideoLaneOut(r.text))).toBe('PASS');
    expect(r.calls.filter((c) => c[0] === 'forward')).toEqual([['forward', '8080', `${P}/sock/app.sock`]]);
    expect(r.calls.find((c) => c[0] === 'run')).toEqual(['run', LANE_NODE, `${R2}/node_modules/@playwright/test/cli.js`, 'test', '-c', `${R2}/playwright.sealed-video.config.ts`]);
    expect(r.calls.find((c) => c[0] === 'mkdir')).toEqual(['mkdir', `${P}/out/egress`, String(0o700)]);
    const ix = (k: string) => r.calls.findIndex((c) => c[0] === k);
    expect(ix('mkdir')).toBeLessThan(ix('forward'));
    expect(ix('forward')).toBeLessThan(ix('fetch'));
    expect(ix('fetch')).toBeLessThan(ix('run'));
    expect(r.calls.find((c) => c[0] === 'write')).toEqual(['write', `${P}/out/pw-exit`, '0\n']);
    expect(r.calls.at(-1)).toEqual(['fwd-close']);
  });
  it('prechecks stop before Playwright with one fixed code each', async () => {
    const cases: [VO, string][] = [
      [{ label: 'unconfined\n' }, 'LANE_E_APPARMOR'], [{ env: { ...goodEnv(), LE_API_ORIGIN: 'http://127.0.0.1:54321' } }, 'LANE_E_ENV'],
      [{ env: { ...goodEnv(), LE_KIND: 'e1' } }, 'LANE_E_ENV'], [{ env: { ...goodEnv(), PATH: '/usr/bin:/bin' } }, 'LANE_E_ENV'],
      [{ tools: { psql: '/usr/bin/psql' } }, 'LANE_E_CLOSURE'], [{ tools: { git: '/usr/bin/git' } }, 'LANE_E_CLOSURE'], [{ tools: { cat: null } }, 'LANE_E_CLOSURE'],
      [{ egressPre: ['x'] }, 'LANE_E_EGRESS_DIR'], [{ fwdFail: true }, 'LANE_E_FORWARD'], [{ app: 'nothing' }, 'LANE_E_BRIDGE_REACH'],
    ];
    for (const [o, code] of cases) {
      const r = await lane(o);
      expect(r.code, code).toBe(1);
      expect(r.text.split('\n').at(-3), code).toBe(`LANE SETUP NOT RUN ${code}`);
      expect(r.calls.some((c) => c[0] === 'run'), code).toBe(false);
      expect(parseVideoLaneOut(r.text).ok, code).toBe(true);
    }
    expect((await lane({ umask: 0o022 })).lines).toEqual(['LANE_E_UMASK_NOT_SET']);
  });
  it('after the run: a non-zero exit, a short or skipped report, missing AppArmor, refused egress or short coverage each fail the lane', async () => {
    expect((await lane({ pw: 1 })).text).toContain('LANE VIDEO RESULT FAIL');
    for (const stats of [{ expected: 23, unexpected: 0, flaky: 0, skipped: 0 }, { expected: 24, unexpected: 0, flaky: 0, skipped: 1 }, { expected: 23, unexpected: 0, flaky: 1, skipped: 0 }]) {
      const r = await lane({ report: report(stats) });
      expect(r.code).toBe(1);
      expect(r.text).toContain('LANE VIDEO RESULT FAIL');
    }
    const noAa = await lane({ report: JSON.stringify({ stats: { expected: 24, unexpected: 0, flaky: 0, skipped: 0 } }) });
    expect(noAa.text).toContain('LANE VIDEO APPARMOR MISSING');
    expect(noAa.code).toBe(1);
    const refused = await lane({ egress: { [`${s0}.start`]: START_TEXT, [`${s0}.end`]: egressEndText({ refused: 1, forwarded: 0, tests: 24, closed: true, lines: [refusedLine('method', 'POST', 'http://127.0.0.1:8080/x')] }) } });
    expect(refused.text).toContain('LANE EGRESS LANE_E_EGRESS_REFUSED');
    expect(refused.code).toBe(1);
    const short = await lane({ egress: { [`${s0}.start`]: START_TEXT, [`${s0}.end`]: egressEndText({ refused: 0, forwarded: 0, tests: 20, closed: true }) } });
    expect(short.text).toContain('LANE EGRESS LANE_E_EGRESS_COVERAGE');
    expect(videoLaneVerdict(parseVideoLaneOut(short.text))).toBe('FAIL');
  });
  it('text-render diagnostic (correction c2): a fixed lane line from the report, never its content; anything but OK fails the lane', async () => {
    const secret = 'https://private.example/token=abc';
    const failRep = JSON.stringify({ stats: { expected: 0, unexpected: 24, flaky: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ annotations: [{ type: 'lane-apparmor', description: aa }], results: [{ status: 'failed', error: { message: `Error: LANE_E_TEXT_RENDER\n at ${secret}` } }] }] }] }] });
    const r = await lane({ report: failRep, pw: 1 });
    expect(r.text).toContain('LANE VIDEO TEXT_RENDER LANE_E_TEXT_RENDER\n');
    expect(r.text).not.toContain('private.example');
    expect(r.code).toBe(1);
    expect(videoSummaryLines({ ok: true }, r.text).lines).toContain('VIDEO_LANE TEXT_RENDER LANE_E_TEXT_RENDER');
    // A report that passed every test but lacks the precheck annotation still fails the lane.
    const noTr = await lane({ report: JSON.stringify({ stats: { expected: 24, unexpected: 0, flaky: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ annotations: [{ type: 'lane-apparmor', description: aa }], results: [{}] }] }] }] }) });
    expect(noTr.text).toContain('LANE VIDEO TEXT_RENDER TEXT_RENDER_E_MISSING');
    expect(noTr.code).toBe(1);
    expect(videoLaneVerdict(parseVideoLaneOut(noTr.text))).toBe('FAIL');
  });
  it('textRenderFromReport: pure, bounded, fixed codes; failure wins; one OK per result; exact token only', () => {
    const rep = (o: unknown) => ({ status: 'ok', text: JSON.stringify(o) });
    const test = (annotations: unknown[], results: unknown[] = [{}]) => ({ annotations, results });
    const root = (tests: unknown[], extra: Obj = {}) => rep({ suites: [{ specs: [{ tests }] }], ...extra });
    expect(textRenderFromReport(root([test([TR]), test([TR])]))).toBe('LANE_TEXT_RENDER_OK');
    expect(textRenderFromReport(root([test([TR]), test([])]))).toBe('TEXT_RENDER_E_MISSING'); // fewer annotations than results
    expect(textRenderFromReport(root([test([{ type: 'lane-text-render', description: 'TEXT_RENDER_E_MISSING' }])]))).toBe('TEXT_RENDER_E_MISSING');
    expect(textRenderFromReport(root([test([TR, { type: 'lane-text-render', description: 'LANE_TEXT_RENDER_OK ' }])]))).toBe('TEXT_RENDER_E_MISSING');
    expect(textRenderFromReport(root([]))).toBe('TEXT_RENDER_E_MISSING');
    expect(textRenderFromReport(root([test([TR])], { errors: [{ message: 'Error: LANE_E_TEXT_RENDER' }] }))).toBe('LANE_E_TEXT_RENDER'); // failure wins
    expect(textRenderFromReport(root([test([TR], [{ error: { value: 'LANE_E_TEXT_RENDER' } }])]))).toBe('LANE_E_TEXT_RENDER');
    for (const near of ['LANE_E_TEXT_RENDERX', 'XLANE_E_TEXT_RENDER', 'lane_e_text_render']) expect(textRenderFromReport(root([test([TR])], { errors: [{ message: near }] })), near).toBe('LANE_TEXT_RENDER_OK');
    expect(textRenderFromReport(root([test([TR])], { title: 'LANE_E_TEXT_RENDER' }))).toBe('LANE_TEXT_RENDER_OK'); // only message/value strings count
    for (const bad of [null, { status: 'missing' }, { status: 'ok', text: '{' }, { status: 'ok', text: 'x'.repeat(8 * 1024 * 1024 + 1) }]) expect(textRenderFromReport(bad as never)).toBe('TEXT_RENDER_E_REPORT');
    let deep: unknown = {}; for (let i = 0; i < 80; i++) deep = { a: deep };
    expect(textRenderFromReport(rep(deep))).toBe('TEXT_RENDER_E_REPORT');
    for (const c of ['LANE_TEXT_RENDER_OK', 'LANE_E_TEXT_RENDER', 'TEXT_RENDER_E_MISSING', 'TEXT_RENDER_E_REPORT']) expect(VIDEO_TEXT_RENDER_CODES).toContain(c);
  });
  it('reportResult and the env/closure helpers are closed', () => {
    expect(reportResult({ status: 'missing' })).toBe('FAIL');
    expect(reportResult({ status: 'ok', text: '{' })).toBe('FAIL');
    expect(videoEnvProblems(goodEnv(), R2)).toBe(false);
    expect(videoEnvProblems({ ...goodEnv(), EXTRA: '1' }, R2)).toBe(true);
    expect(videoClosureProblems(mk().d.fs as never, goodEnv(), '/other/node')).toBe(true);
  });
});

describe('video lane.txt grammar and the host summary', () => {
  const ok = ['LANE START', 'LANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'LANE VIDEO RAN',
    'LANE VIDEO APPARMOR PRE APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_DOCKER_DEFAULT_ENFORCE POST APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_DOCKER_DEFAULT_ENFORCE',
    'LANE VIDEO TEXT_RENDER LANE_TEXT_RENDER_OK', 'LANE VIDEO RESULT PASS', 'LANE EGRESS LANE_EGRESS_OK', 'LANE END'];
  const t = (ls: string[]) => `${ls.join('\n')}\n`;
  it('accepts the two closed shapes and prefixes; refuses reordering, unknown codes, extra lines and E1 lines', () => {
    expect(videoLaneVerdict(parseVideoLaneOut(t(ok)))).toBe('PASS');
    expect(parseVideoLaneOut(t(ok.slice(0, 4)))).toMatchObject({ ok: true, interrupted: true });
    expect(videoLaneVerdict(parseVideoLaneOut(t(ok.slice(0, 4))))).toBe('UNRESOLVED');
    expect(parseVideoLaneOut(t(['LANE START', 'LANE APPARMOR APPARMOR_E_UNCONFINED', 'LANE SETUP NOT RUN LANE_E_APPARMOR', 'LANE END']))).toMatchObject({ ok: true, precheck: 'LANE_E_APPARMOR' });
    for (const bad of [[...ok.slice(0, 2), 'LANE SETUP PASS', ...ok.slice(3)], [ok[0], ok[2], ok[1], ...ok.slice(3)], [...ok.slice(0, 5), 'LANE EGRESS LANE_E_OTHER', 'LANE END'],
      [...ok, 'LANE END'], ['LANE START', 'LANE APPARMOR APPARMOR_E_UNCONFINED', 'LANE VIDEO RAN'], ['LANE START', 'LANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'LANE SETUP NOT RUN LANE_E_APPARMOR']])
      expect(parseVideoLaneOut(t(bad)).ok, bad.join('|')).toBe(false);
    expect(parseVideoLaneOut(ok.join('\n')).ok).toBe(false); // no trailing newline
    const weak = [...ok]; weak[3] = 'LANE VIDEO APPARMOR PRE APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_E_UNCONFINED POST APPARMOR_DOCKER_DEFAULT_ENFORCE APPARMOR_DOCKER_DEFAULT_ENFORCE';
    expect(videoLaneVerdict(parseVideoLaneOut(t(weak)))).toBe('FAIL');
    // Text render (correction c2): every fixed non-OK code parses and fails; unknown codes, a missing line or a moved line refuse.
    for (const c of ['LANE_E_TEXT_RENDER', 'TEXT_RENDER_E_MISSING', 'TEXT_RENDER_E_REPORT']) {
      const x = [...ok]; x[4] = `LANE VIDEO TEXT_RENDER ${c}`;
      expect(parseVideoLaneOut(t(x))).toMatchObject({ ok: true, textRender: c });
      expect(videoLaneVerdict(parseVideoLaneOut(t(x))), c).toBe('FAIL');
      expect(videoSummaryLines({ ok: true }, t(x)).lines, c).toContain(`VIDEO_LANE TEXT_RENDER ${c}`);
    }
    for (const bad of [[...ok.slice(0, 4), 'LANE VIDEO TEXT_RENDER LANE_E_OTHER', ...ok.slice(5)], [...ok.slice(0, 4), 'LANE VIDEO TEXT_RENDER Error: boom', ...ok.slice(5)],
      [...ok.slice(0, 4), ...ok.slice(5)], [...ok.slice(0, 4), ok[5], ok[4], ...ok.slice(6)]])
      expect(parseVideoLaneOut(t(bad)).ok, bad.join('|')).toBe(false);
  });
  it('the summary runs only when the host gates are OK and prints closed fields only', () => {
    expect(videoSummaryLines({ ok: false }, t(ok))).toEqual({ pass: false, lines: ['VIDEO_LANE SUMMARY NOT RUN: lane absence or bridge reaping unresolved'] });
    expect(videoSummaryLines({ ok: true }, t(ok))).toMatchObject({ pass: true });
    expect(videoSummaryLines({ ok: true }, t(ok)).lines.at(-1)).toBe('VIDEO_LANE PASS');
    expect(videoSummaryLines({ ok: true }, 'garbage\n')).toEqual({ pass: false, lines: ['VIDEO_LANE OUT INVALID', 'VIDEO_LANE UNRESOLVED'] });
    expect(videoSummaryLines({ ok: true }, null)).toMatchObject({ pass: false });
  });
});

describe('video observer lifecycle (correction c1): kept through owned context and browser closure, conservative on failure', () => {
  // Fakes only: a context and pages are EventEmitters with Playwright's method names. No browser, page or network.
  const fakePage = () => new EventEmitter();
  const fakeContext = (pages: EventEmitter[] = []) => Object.assign(new EventEmitter(), { pages: () => pages });
  const req = (method: string, url = 'https://sealed-video.invalid/rest/v1/x') => ({ method: () => method, url: () => url });
  const STEM = 'w-0-0-1234-0123456789abcdef';
  const aggOne = (fields: ReturnType<typeof finalLedger>, declared: number) => {
    const files: Record<string, string> = { [`${STEM}.start`]: START_TEXT, [`${STEM}.end`]: egressEndText(fields) };
    return aggregateEgress(Object.keys(files), (n: string) => files[n] ?? null, declared);
  };

  it('counts non-GET/HEAD requests, unreadable requests and every WebSocket on existing and later pages; GET/HEAD pass', () => {
    const p0 = fakePage();
    const ctx = fakeContext([p0]);
    const L = createLedger();
    const o = attachObserver(ctx, L);
    ctx.emit('request', req('GET')); ctx.emit('request', req('HEAD'));
    expect(L.refused).toBe(0);
    ctx.emit('request', req('POST'));
    ctx.emit('request', { method: () => { throw new Error('gone'); }, url: () => { throw new Error('gone'); } });
    p0.emit('websocket', { url: () => 'wss://sealed-video.invalid/realtime' });
    const popup = fakePage(); ctx.emit('page', popup); popup.emit('websocket', { url: () => 'ws://127.0.0.1:9/x' });
    expect(L.refused).toBe(4);
    expect(o.seen).toEqual(['REFUSED method POST https://sealed-video.invalid', 'REFUSED method - <opaque>', 'REFUSED websocket - wss://sealed-video.invalid', 'REFUSED websocket - ws://127.0.0.1:9']);
    expect(L.lines).toEqual(o.seen);
  });

  it('ordering: an event during Playwright context teardown (after the observer fixture) lands in the worker record and fails the lane', async () => {
    const page = fakePage();
    const ctx = fakeContext([page]);
    const L = createLedger();
    const order: string[] = [];
    const seen = await observeTest(ctx, L, async () => { order.push('test'); ctx.emit('request', req('GET')); });
    order.push('observer-teardown');
    expect(seen).toEqual([]); // the per-test assertion passes...
    expect(ctx.listenerCount('request')).toBe(1); // ...and the observer is still attached
    expect(page.listenerCount('websocket')).toBe(1);
    // Playwright's own context fixture tears down after the observer: a late beacon and a late popup WebSocket.
    ctx.emit('request', req('POST')); order.push('context-close');
    const late = fakePage(); ctx.emit('page', late); late.emit('websocket', { url: () => 'wss://x.example/s' });
    // Worker teardown: the owned browser closes cleanly, then the ledger is sealed and written.
    await runWorkerBrowser(async (body) => { await body({ newContext: async () => okPrecheckContext() }); }, L, async () => { order.push('worker-use'); });
    order.push('browser-closed');
    const fields = finalLedger(L);
    expect(order).toEqual(['test', 'observer-teardown', 'context-close', 'worker-use', 'browser-closed']);
    expect(fields).toMatchObject({ refused: 2, tests: 1, closed: true });
    expect(aggOne(fields, 1).code).toBe('LANE_E_EGRESS_REFUSED');
    // Mutant control: the pre-correction observer detached in its finally, so the same sequence reported a clean worker.
    const M = createLedger(); const mctx = fakeContext([]);
    const o = attachObserver(mctx, M); M.tests++;
    mctx.off('request', o.listeners.onRequest); mctx.off('page', o.listeners.watch); // what lines 103-107 did
    mctx.emit('request', req('POST'));
    M.closed = true;
    expect(aggOne(finalLedger(M), 1).code).toBe('LANE_EGRESS_OK'); // the gap this correction closes
  });

  it('closed only after a clean browser close: a launch failure, a cleanup mark or a precheck failure leaves the record OPEN', async () => {
    const L1 = createLedger(); L1.tests = 1;
    await expect(runWorkerBrowser(async () => { throw new Error('LANE_E_BROWSER_CLOSE'); }, L1, async () => {})).rejects.toThrow('LANE_E_BROWSER_CLOSE');
    expect(aggOne(finalLedger(L1), 1).code).toBe('LANE_E_EGRESS_OPEN');
    const L2 = createLedger(); L2.tests = 1;
    let used = false;
    await expect(runWorkerBrowser(async (body) => { await body({ newContext: async () => okPrecheckContext({ box: { width: 0, height: 18 } }) }); }, L2, async () => { used = true; })).rejects.toThrow('LANE_E_TEXT_RENDER');
    expect(used).toBe(false); // no test runs after a failed precheck
    expect(finalLedger(L2).closed).toBe(false);
    const L3 = createLedger(); L3.tests = 1;
    await runWorkerBrowser(async (body) => { await body({ newContext: async () => okPrecheckContext() }); }, L3, async () => {});
    expect(aggOne(finalLedger(L3), 1).code).toBe('LANE_EGRESS_OK');
    expect(L3.textRender).toBe('LANE_TEXT_RENDER_OK'); // set only after the precheck passed
    expect(L2.textRender).toBe(null);
  });

  it('a note after sealing cannot reach the record: it is counted as late only, never as a clean count', () => {
    const L = createLedger(); L.closed = true;
    const f = finalLedger(L);
    L.note('method', 'POST', 'https://x.example/');
    expect(f.refused).toBe(0);
    expect(L.refused).toBe(0);
    expect(L.late).toBe(1);
  });

  function okPrecheckContext({ box = { width: 120, height: 18 } as unknown, setContent = async () => {}, close = async () => {}, during = (_c: EventEmitter) => {} } = {}) {
    const ctx = fakeContext([]) as EventEmitter & Record<string, unknown>;
    const calls: unknown[] = [];
    Object.assign(ctx, {
      calls,
      route: async (pattern: string, h: (r: { abort: () => void }) => void) => { calls.push(['route', pattern]); let aborted = false; h({ abort: () => { aborted = true; } }); calls.push(['aborted', aborted]); },
      newPage: async () => ({
        setContent: async (html: string, o: unknown) => { calls.push(['setContent', html, o]); during(ctx); await setContent(); },
        locator: (sel: string) => ({ boundingBox: async () => { calls.push(['locator', sel]); return box; } }),
      }),
      close: async () => { calls.push(['close']); await close(); },
    });
    return ctx;
  }

  it('text-render precheck: layout only, one fixed inline page, every route aborted, observed, closed on every path', async () => {
    const opts: unknown[] = [];
    const mk = (o = {}) => { const c = okPrecheckContext(o); return { c, browser: { newContext: async (x: unknown) => { opts.push(x); return c; } } }; };
    const a = mk();
    expect(await textRenderPrecheck(a.browser, createLedger())).toBe('LANE_TEXT_RENDER_OK');
    expect(opts[0]).toEqual({ serviceWorkers: 'block' });
    expect((a.c as unknown as { calls: unknown[] }).calls).toEqual([['route', '**/*'], ['aborted', true], ['setContent', TEXT_RENDER_HTML, { waitUntil: 'load' }], ['locator', '#sealed-text'], ['close']]);
    expect(TEXT_RENDER_HTML).not.toMatch(/src=|href=|url\(|@font-face|@import|<link|<script/i); // nothing to fetch
    for (const box of [null, { width: 0, height: 18 }, { width: 120, height: 0 }, { width: Number.NaN, height: 1 }, { width: Infinity, height: 1 }, {}]) {
      const b = mk({ box });
      await expect(textRenderPrecheck(b.browser, createLedger())).rejects.toThrow('LANE_E_TEXT_RENDER');
      expect((b.c as unknown as { calls: unknown[][] }).calls.at(-1)).toEqual(['close']);
    }
    const t = mk({ setContent: async () => { throw new Error('timeout'); } });
    await expect(textRenderPrecheck(t.browser, createLedger())).rejects.toThrow('LANE_E_TEXT_RENDER');
    expect((t.c as unknown as { calls: unknown[][] }).calls.at(-1)).toEqual(['close']);
    const k = mk({ close: async () => { throw new Error('close'); } });
    await expect(textRenderPrecheck(k.browser, createLedger())).rejects.toThrow('LANE_E_TEXT_RENDER'); // a failed close is a failure
    await expect(textRenderPrecheck({ newContext: async () => { throw new Error('x'); } }, createLedger())).rejects.toThrow('LANE_E_TEXT_RENDER');
    // The precheck context is observed by the same worker ledger.
    const L = createLedger();
    const w = mk({ during: (c: EventEmitter) => c.emit('request', req('POST', 'https://x.example/p')) });
    expect(await textRenderPrecheck(w.browser, L)).toBe('LANE_TEXT_RENDER_OK');
    expect(L.refused).toBe(1);
    expect(textRenderCode({ width: 1, height: 1 })).toBe('LANE_TEXT_RENDER_OK');
  });

  it('the module is pure: no fs, no Playwright import, no listener removal', () => {
    const m = code(readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/video-observer.mjs'), 'utf8'));
    expect([...m.matchAll(/^import .* from '([^']+)';$/gm)].map((x) => x[1])).toEqual(['./egress-records.mjs']);
    expect(m).not.toMatch(/\.off\(|removeListener|removeAllListeners|node:fs|playwright/);
  });
});

describe('video build: exact env, refused env files, no source maps, and the bundle scanner as the effective control', () => {
  const js = `const u="${VIDEO_API_ORIGIN}";`;
  const good = () => [{ rel: 'index.html', text: '<div id="root"></div><script src="/assets/index-x.js"></script>' }, { rel: 'assets/index-x.js', text: js }];
  it('scanBundle: OK only with the exact origin in JS and none of the forbidden strings or a .map file', () => {
    expect(scanBundle(good())).toBe('VIDEO_BUNDLE_OK');
    for (const f of FORBIDDEN) expect(scanBundle([...good(), { rel: 'assets/a.js', text: `x${f}y` }]), f).toBe('VIDEO_BUNDLE_E_FORBIDDEN');
    expect(scanBundle([...good(), { rel: 'assets/index-x.js.map', text: '{}' }])).toBe('VIDEO_BUNDLE_E_SOURCEMAP');
    expect(scanBundle([good()[0], { rel: 'assets/index-x.js', text: 'const u="https://sealed-video.invalid.evil";'.replace('.invalid.evil', '-x.invalid') }])).toBe('VIDEO_BUNDLE_E_ORIGIN');
  });
  it('scanBundle: exact origin, not a substring (correction c1): suffix, port, userinfo and scheme variants fail even beside the exact one', () => {
    const one = (t: string) => scanBundle([good()[0], { rel: 'assets/index-x.js', text: t }]);
    expect(one('const u="https://sealed-video.invalid";')).toBe('VIDEO_BUNDLE_OK');
    expect(one("const u='https://sealed-video.invalid/rest/v1';")).toBe('VIDEO_BUNDLE_OK');
    for (const bad of ['https://sealed-video.invalid.evil', 'https://sealed-video.invalid:8443', 'https://sealed-video.invalid@not-fixture.example',
      'https://user@sealed-video.invalid', 'http://sealed-video.invalid', 'wss://sealed-video.invalid', 'https://sealed-video.invalid-x', 'https://xsealed-video.invalid']) {
      expect(one(`const u="${bad}";`), bad).toBe('VIDEO_BUNDLE_E_ORIGIN'); // alone
      expect(one(`${js}const v="${bad}";`), `${bad} beside exact`).toBe('VIDEO_BUNDLE_E_ORIGIN'); // the exact literal does not excuse it
    }
    // A mention outside JS is checked too, and an unquoted mention is not exact.
    expect(scanBundle([...good(), { rel: 'assets/a.css', text: 'url(https://sealed-video.invalid:8443/x)' }])).toBe('VIDEO_BUNDLE_E_ORIGIN');
    expect(one('const u=https://sealed-video.invalid;')).toBe('VIDEO_BUNDLE_E_ORIGIN');
    // Mutant control: the pre-correction substring check accepts the three reviewer inputs, the corrected one refuses them.
    const substring = (t: string) => t.includes(VIDEO_API_ORIGIN);
    for (const bad of ['https://sealed-video.invalid.evil', 'https://sealed-video.invalid:8443', 'https://sealed-video.invalid@not-fixture.example']) {
      expect(substring(`const u="${bad}";`)).toBe(true);
      expect(one(`const u="${bad}";`)).toBe('VIDEO_BUNDLE_E_ORIGIN');
    }
    expect(scanBundle([good()[0], { rel: 'notes.txt', text: js }])).toBe('VIDEO_BUNDLE_E_ORIGIN');
    expect(scanBundle([])).toBe('VIDEO_BUNDLE_E_EMPTY');
    expect(scanBundle([good()[1]])).toBe('VIDEO_BUNDLE_E_NO_INDEX');
    // the fallback literals of src/config/security.ts are exactly what the scanner forbids
    const sec = readFileSync(path.join(ROOT, 'src/config/security.ts'), 'utf8');
    expect(sec).toContain('https://siuqvhscuiycvdrtiqsh.supabase.co');
    expect(sec).toContain('InNpdXF2aHNjdWl5Y3ZkcnRpcXNo');
  });
  it('buildEnv is exact (no inherited key), buildArgs disables source maps and writes outside the repo', () => {
    expect(buildEnv({ PATH: '/usr/bin', HOME: '/home/r' })).toEqual({ PATH: '/usr/bin', HOME: '/home/r', NODE_ENV: 'production', VITE_SUPABASE_URL: VIDEO_API_ORIGIN, VITE_SUPABASE_ANON_KEY: SYNTHETIC_ANON_KEY });
    expect(() => buildEnv({ PATH: '', HOME: '/h' })).toThrow();
    expect(buildArgs(R, '/rt/sv-served')).toEqual([`${R}/node_modules/vite/bin/vite.js`, 'build', '--mode', 'production', '--outDir', '/rt/sv-served', '--emptyOutDir', '--sourcemap', 'false']);
  });
  it('buildVideo: refuses env files, an output inside the repo or pre-existing; the child gets exactly buildEnv; the scan decides', async () => {
    const mkd = (o: { envFiles?: string[]; exists?: boolean; code?: number; files?: { rel: string; text: string }[] } = {}) => {
      const runs: Obj[] = [];
      const files = o.files ?? good();
      const d = {
        env: { PATH: '/usr/bin', HOME: '/home/r', VITE_SUPABASE_URL: 'https://leak.supabase.co', SECRET: 'x' }, node: '/n/node',
        exists: () => o.exists ?? false,
        run: async (bin: string, args: string[], opt: Obj) => { runs.push({ bin, args, ...opt }); return { code: o.code ?? 0 }; },
        fs: {
          lstatSync: (p: string) => { if ((o.envFiles ?? []).some((f) => p === `${R}/${f}`)) return {}; throw new Error('ENOENT'); },
          readdirSync: (dir: string) => { const rel = path.relative('/rt/sv-served', dir); const kids = new Map<string, boolean>();
            for (const f of files) { const r = rel ? (f.rel.startsWith(`${rel}/`) ? f.rel.slice(rel.length + 1) : null) : f.rel; if (r) kids.set(r.split('/')[0], r.includes('/')); }
            return [...kids].map(([name, isDir]) => ({ name, isDirectory: () => isDir, isFile: () => !isDir })); },
          readFileSync: (p: string) => Buffer.from(files.find((f) => `/rt/sv-served/${f.rel}` === p)!.text, 'latin1'),
        },
      };
      return { d, runs };
    };
    const okRun = mkd();
    expect(await buildVideo(okRun.d as never, { repo: R, outDir: '/rt/sv-served' })).toBe('VIDEO_BUNDLE_OK');
    expect(okRun.runs).toEqual([{ bin: '/n/node', args: buildArgs(R, '/rt/sv-served'), env: buildEnv({ PATH: '/usr/bin', HOME: '/home/r' }), cwd: R }]);
    for (const f of ['.env.local', '.env.production', '.env.production.local']) expect(await buildVideo(mkd({ envFiles: [f] }).d as never, { repo: R, outDir: '/rt/sv-served' }), f).toBe('VIDEO_BUILD_E_ENV_FILE');
    expect(await buildVideo(mkd().d as never, { repo: R, outDir: `${R}/dist` })).toBe('VIDEO_BUILD_E_INPUT');
    expect(await buildVideo(mkd({ exists: true }).d as never, { repo: R, outDir: '/rt/sv-served' })).toBe('VIDEO_BUILD_E_INPUT');
    expect(await buildVideo(mkd({ code: 1 }).d as never, { repo: R, outDir: '/rt/sv-served' })).toBe('VIDEO_BUILD_E_BUILD');
    expect(await buildVideo(mkd({ files: [...good(), { rel: 'assets/b.js', text: 'https://x.supabase.co' }] }).d as never, { repo: R, outDir: '/rt/sv-served' })).toBe('VIDEO_BUNDLE_E_FORBIDDEN');
  });
});

describe('e2e.yml sealed-video job: dispatch-only, read-only, no secrets or stack, ordered, released only after teardown', () => {
  const wf = YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8')) as Obj;
  const job = wf.jobs['sealed-video'] as Obj;
  const steps: Obj[] = job.steps;
  const text = JSON.stringify(job);
  const ix = (re: RegExp) => steps.findIndex((s) => re.test(String(s.run ?? '')));
  it('is selected only by its own input, with contents: read and no secrets, services, containers or Supabase use', () => {
    expect(wf.on.workflow_dispatch.inputs.specs.options).toContain('sealed-video');
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
    expect(job.if).toBe("inputs.specs == 'sealed-video'");
    expect(job.permissions).toEqual({ contents: 'read' });
    expect(job.services).toBeUndefined();
    expect(job.container).toBeUndefined();
    expect(text).not.toMatch(/secrets\.|supabase (start|status|stop)|SUPABASE_DB_URL|SERVICE_ROLE|--no-sandbox|apply_migration|db push|export-status/);
    expect(steps[0]).toMatchObject({ uses: 'actions/checkout@v4', with: { 'fetch-depth': 0, 'persist-credentials': false } });
  });
  it('orders: overrides refused, static controls and the 24-test collection, preflight, pin, build+scan, image, preview, lane; then gates and cleanup', () => {
    const order = [/Refuse|for v in LE_ALLOW_SHIM/, /VIDEO_SEALED_LIST_ONLY=1 npx --no-install playwright test -c playwright\.sealed-video\.config\.ts --list/, /le-iso\/preflight\.mjs/,
      /le-iso\/browser-pin\.mjs/, /video-build\.mjs build/, /video-lane\.mjs image/, /owned-proc\.mjs start/, /video-lane\.mjs run/, /gates\.mjs verify/, /image\.mjs cleanup/,
      /video-summary\.mjs/, /owned-proc\.mjs stop/, /rm -rf/, /stage-evidence/].map(ix);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(String(steps[ix(/--list/)].run)).toContain('[ "$(tail -1 "$RUNNER_TEMP/sv-list.txt")" = "Total: 24 tests in 1 file" ]');
    for (const re of [/gates\.mjs verify/, /image\.mjs cleanup/, /owned-proc\.mjs stop/, /rm -rf/]) expect(String(steps[ix(re)].if ?? ''), String(re)).toMatch(/^always\(\)/);
  });
  it('the upload is gated on every teardown step and the staged manifest; the private parent is fresh and removed', () => {
    const up = steps.find((s) => s.uses === 'actions/upload-artifact@v4')!;
    for (const id of ['stage', 'sv_lane_gates', 'sv_image_cleanup', 'sv_owned_stop', 'sv_private']) expect(String(up.if)).toContain(`steps.${id}.outcome == 'success'`);
    expect(String(steps[ix(/video-lane\.mjs run/)].run)).toContain('[ ! -e "$P" ] && [ ! -L "$P" ]');
    expect(String(steps[ix(/rm -rf/)].run)).toContain('"$RUNNER_TEMP/sv-private"');
  });
});
