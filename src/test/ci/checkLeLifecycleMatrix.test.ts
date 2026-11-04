// ABOUTME: Fake and static controls for the SYNTHETIC lifecycle matrix, DESIGN-r3 with the five review constraints (LOCAL
// ABOUTME: candidate, unrun). No browser, Docker, listener, network or real filesystem write: one stateful in-memory filesystem.
//
// What these controls can and cannot show: they compose the matrix orchestrator, the in-container supervisor, the host summary
// and the owned-directory cleanup over ONE in-memory filesystem with a recording docker fake, and drive the arm driver with fake
// browsers. They read workflow and source text. They prove nothing about Chromium, the container, the kernel or E1.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
  ENV_KEYS, LE_TARGETS, SYN_ARMS, SYN_ENV_KEYS, SYN_FORBIDDEN_ENV, UNKNOWN_CLEANUP, expectedLaneConfig, laneCreateArgs, laneEnv, lanePaths, laneTarget,
  laneVerdict, parseLaneOut, parseSynArm, parseSynCleanup, parseSynCreated, parseSynOut, planSummary, selectLine, synAggregateGates, synArmPaths,
  synArmResult, synBinds, synCreatedRecord, synEnv, synLanePaths, synMatrix, synOwnership, synParent, synSummaryLines, unknownArm, IMAGE_PATH_ENV, LANE_NODE,
  compareLaneInspect,
} from '../../../scripts/e2e/le-lane/contract.mjs';
import { mkdirRecorded, runLane, runSynMatrix, synParentFree } from '../../../scripts/e2e/le-lane/run-lane.mjs';
import { laneMain, synArmFromReport, synDirsOk, synEnvProblems } from '../../../scripts/e2e/le-lane/lane-entry.mjs';
import { synCleanup, synResults } from '../../../scripts/e2e/le-lane/synthetic.mjs';
import { readVerdict } from '../../../scripts/e2e/le-lane/gates.mjs';
import { SECCOMP_PROFILE_REL } from '../../../scripts/e2e/le-iso/expect.mjs';
import { allowedOrigins } from '../../../e2e/lesson-editor/egress-boundary';
import { RESOLVER_ARG, serverOptions } from '../../../e2e/lesson-editor/sandbox-launch.mjs';
import {
  ARM_OUTER_MS, ARM_TIMEOUT_MS, DESKTOP_CHROME_UA, DUMMY_BODIES, JOIN_MS, SYN_CONTEXT_TABLE, SYN_TEST_TIMEOUT_MS, SYN_USE, armCallerOptions, combinedContextOptions,
  dummyHandler, effectiveArmOptions, mergeDefaults, runArm, runContainerArm, settleWithin, startDummyServer,
} from '../../../e2e/lesson-editor/lifecycle-matrix.mjs';

type Obj = Record<string, any>;
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const sha = (o: unknown) => createHash('sha256').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex');
const tick = () => new Promise((r) => setTimeout(r, 0));

const T = '/rt', RUN = '41900000000', ATT = '1', C = '/rt/syn-lane-ctl', R = '/w/repo';
const ROOTL = synLanePaths(T, RUN, ATT, C, R);
const P = ROOTL.P;
const AP = Object.fromEntries(SYN_ARMS.map((x) => [x, synArmPaths(ROOTL, x)])) as Record<string, Obj>;
const SL = AP.A;
const NODE = '/n/bin/node', SHELL = '/s/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
// The receipt readers check ownership against the REAL process uid, so the fake filesystem uses it too.
const COMMIT = 'a'.repeat(40), IMG = `sha256:${'b'.repeat(64)}`, CIDV = 'c'.repeat(64), UID = process.getuid!(), GID = 118;
const senv = (arm: string) => synEnv(AP[arm], { commit: COMMIT, shell: SHELL, arm });
const SENV = senv('A');
const DUMMY = 'http://127.0.0.1:40123';
const SECCOMP = readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL));

// ---------------------------------------------------------------------------------------------------------------------
describe('target selection: closed, first, no fallthrough', () => {
  it('unset is E1; exactly E1 or SYNTHETIC; anything else is refused', () => {
    expect(LE_TARGETS).toEqual(['E1', 'SYNTHETIC']);
    expect(laneTarget(undefined)).toBe('E1');
    expect(laneTarget('E1')).toBe('E1');
    expect(laneTarget('SYNTHETIC')).toBe('SYNTHETIC');
    for (const v of ['', 'e1', 'synthetic', 'SYNTHETIC ', ' E1', 'E1,SYNTHETIC', null, 0, 1, true, {}]) expect(laneTarget(v as never), String(v)).toBeNull();
  });
  it('lane-entry: an invalid target is refused before ANY dependency call, and the lane file is never opened', async () => {
    for (const bad of ['', 'bogus', 'e1']) {
      const calls: string[] = [];
      const d = new Proxy({ env: { LE_TARGET: bad }, repo: R, umask: () => 0o077 } as Obj, {
        get: (o, k: string) => (k in o ? o[k] : (...a: unknown[]) => { calls.push(k); void a; throw new Error(`unexpected ${k}`); }),
      });
      expect(await laneMain(d as never)).toEqual({ code: 1, lines: ['LANE_E_TARGET'] });
      expect(calls).toEqual([]);
    }
  });
  it('run-lane: an invalid target is refused before any read, directory or docker call', async () => {
    const calls: string[] = [];
    const rec = new Proxy({}, { get: (_o, k: string) => (...a: unknown[]) => { calls.push(k); void a; throw new Error(`unexpected ${k}`); } });
    for (const target of ['', 'e1', 'BOGUS']) {
      expect(await runLane({ fs: rec, exec: rec, files: rec, spawnBridge: rec, uid: () => UID, gid: () => GID } as never, { target, C, T, runId: RUN, attempt: ATT, R } as never))
        .toEqual({ ok: false, say: ['LANE_E_TARGET'] });
    }
    expect(calls).toEqual([]);
  });
  it('laneCreateArgs / expectedLaneConfig refuse an unknown target instead of falling back to E1', () => {
    expect(() => laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, target: 'synthetic' })).toThrow(/target/);
    expect(() => expectedLaneConfig(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, seccompText: '{}', cid: CIDV, target: '' })).toThrow(/target/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('E1 is byte-identical to 0f2d84c4 when the target is unset (or E1)', () => {
  // Computed at 0f2d84c4 BEFORE any matrix change (receipts/e1-baseline-pins.txt), with these exact fixed inputs.
  const L1 = lanePaths('/rt/le-private', '/rt/le-lane-ctl', '/ws/repo');
  const env1 = laneEnv(L1, { apiOrigin: 'http://127.0.0.1:54321', dbUrl: 'postgresql://postgres@127.0.0.1:54322/postgres', commit: 'a'.repeat(40), shell: '/s/chrome-headless-shell' });
  const img = 'sha256:' + 'b'.repeat(64);
  it('create argv, inspect expectation and env equal the 0f2d pins; an explicit E1 target gives the same bytes', () => {
    expect(sha(env1)).toBe('18783a1be7e7033c50be77a193e00e2c2f147cdc86c090b9fcf70290bf3986f0');
    for (const target of [undefined, 'E1']) {
      expect(sha(laneCreateArgs(L1, { imageId: img, uid: 1001, gid: 118, env: env1, target }))).toBe('c5757fed329c685525221ca36b79b67c181f410868dc10facdaf89db014b9c07');
      expect(sha(expectedLaneConfig(L1, { imageId: img, uid: 1001, gid: 118, env: env1, seccompText: '{"a":1}', cid: 'c'.repeat(64), target })))
        .toBe('6d590072acf064e1f949aa156c4173216a8a331eba09bfb5764bfb35b4f9569d');
    }
  });
  it('the lesson-editor E1 job text is byte-identical to 0f2d (selection is its own dispatch option, not a condition on E1 steps)', () => {
    const W = read('.github/workflows/e2e.yml');
    expect(sha(W.slice(W.indexOf('\n  lesson-editor:'), W.indexOf('\n  le-isolation-probe:')))).toBe('07dde7c1828cfa884f9525959551cd2ac983cef6fe727c384894e9129b2297e7');
  });
  it('the E1 supervisor body only gains the target check, placed before its lane file is opened', () => {
    const src = read('scripts/e2e/le-lane/lane-entry.mjs');
    const main = src.slice(src.indexOf('export async function laneMain'), src.indexOf('// SYNTHETIC target (lifecycle matrix'));
    const t = main.indexOf('const target = laneTarget(env.LE_TARGET);');
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(main.indexOf('fd = d.openExcl(L.laneTxt)'));
    expect(main).toContain("if (target === 'SYNTHETIC') return synMain(d);");
    const code = main.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code.match(/SYN/g)).toHaveLength(1); // the one routing line; no synthetic line is ever said on the E1 path
    expect(code).not.toMatch(/LANE SYN/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('synthetic container contract: one arm, three binds, a closed 14-key env, root image inputs never relocated', () => {
  it('paths come from runner temp, run id, attempt and a closed arm ONLY; E1 path variables change nothing', () => {
    expect(synParent(T, RUN, ATT)).toBe(`/rt/syn-${RUN}-${ATT}`);
    expect(SL.P).toBe(`${P}/A`);
    expect(SL.lane).toBe(`${P}/A/lane`);
    expect(SL.C).toBe(`${C}/arms/A`);
    const before = JSON.stringify(synArmPaths(synLanePaths(T, RUN, ATT, C, R), 'B'));
    const saved = { ...process.env };
    Object.assign(process.env, { LE_PRIV: '/rt/le-private', LE_LANE_DIR: '/rt/le-private/lane', RUNNER_TEMP: '/elsewhere', LE_SYN_ARM: 'D' });
    try { expect(JSON.stringify(synArmPaths(synLanePaths(T, RUN, ATT, C, R), 'B'))).toBe(before); } finally { for (const k of ['LE_PRIV', 'LE_LANE_DIR', 'RUNNER_TEMP', 'LE_SYN_ARM']) { if (k in saved) process.env[k] = saved[k]; else delete process.env[k]; } }
    for (const [t, r, a] of [['rt', RUN, ATT], ['/rt/', RUN, ATT], [T, '0', ATT], [T, 'x', ATT], [T, RUN, '0'], [T, RUN, '1/..'], ['/r:t', RUN, ATT]]) expect(() => synParent(t, r, a), `${t} ${r} ${a}`).toThrow();
    for (const arm of ['', 'E', 'a', 'AB', '../A', undefined]) expect(() => synArmPaths(ROOTL, arm as never), String(arm)).toThrow();
    expect(() => synArmPaths(lanePaths('/rt/le-private', C, R), 'A')).toThrow();
  });
  it('constraint 4: an arm path set carries NO image input; image.id and the manifest stay at the ROOT control dir', () => {
    for (const arm of SYN_ARMS) {
      for (const k of ['iid', 'manifest', 'ctx', 'imageBuildRec', 'imageCleanupRec']) expect(AP[arm][k], `${arm} ${k}`).toBeNull();
      expect(AP[arm].started).toBe(`${C}/arms/${arm}/run-lane.started`);
    }
    expect(ROOTL.iid).toBe(`${C}/image.id`);
    expect(ROOTL.manifest).toBe(`${C}/manifest.sha256`);
    const src = read('scripts/e2e/le-lane/run-lane.mjs');
    expect(src).toContain('imageId = fsx.readFileSync(img.iid, \'utf8\').trim();');
    expect(src).toContain("!fsx.readFileSync(img.manifest, 'utf8')");
    expect(src).not.toMatch(/L\.iid|L\.manifest/);
    expect(src).toContain('if (syn) { img = synLanePaths(o.T, o.runId, o.attempt, o.C, o.R); L = synArmPaths(img, o.arm); } else { L = lanePaths(o.P, o.C, o.R); img = L; }');
    // no hidden copy or second writer of the image inputs
    for (const f of ['run-lane.mjs', 'synthetic.mjs']) expect(read(`scripts/e2e/le-lane/${f}`), f).not.toMatch(/copyFile|image\.id['"]|manifest\.sha256['"]/);
  });
  it('create argv: exactly [R ro][arm lane rw][arm out rw] and the closed -e list in order, LE_SYN_ARM last; nothing authentic', () => {
    expect(synBinds(SL)).toEqual([[R, false], [SL.lane, true], [SL.out, true]]);
    const a = laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, target: 'SYNTHETIC' });
    expect(a.slice(0, 3)).toEqual(['create', '--cidfile', `${C}/arms/A/lane.cid`]);
    expect(a.flatMap((x, i) => (x === '-v' ? [a[i + 1]] : []))).toEqual([`${R}:${R}:ro,rprivate`, `${SL.lane}:${SL.lane}:rw,rprivate`, `${SL.out}:${SL.out}:rw,rprivate`]);
    expect(a.flatMap((x, i) => (x === '-e' ? [a[i + 1].split('=')[0]] : []))).toEqual([...SYN_ENV_KEYS]);
    expect(SYN_ENV_KEYS).toEqual(['HOME', 'TMPDIR', 'CI', 'LE_LANE_DIR', 'LE_OUT_DIR', 'LE_WORK_DIR', 'LE_EVIDENCE_DIR', 'LE_OUTPUT_DIR', 'LE_REPORT_JSON',
      'E2E_EVIDENCE_COMMIT', 'E2E_EVIDENCE_ENVIRONMENT', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', 'LE_TARGET', 'LE_SYN_ARM']);
    const text = a.join('\n');
    for (const p of [SL.keys, SL.dbpass, SL.proofDir, SL.sock, SL.pairRaw, 'state-', `${P}/B`, ...SYN_FORBIDDEN_ENV]) expect(text, p).not.toContain(p);
    expect(SENV).toContain('LE_TARGET=SYNTHETIC');
    expect(SENV.at(-1)).toBe('LE_SYN_ARM=A');
    for (const f of ['--network', 'none', '--cap-drop', 'ALL', 'no-new-privileges', '--read-only', '--init', `seccomp=${SL.seccomp}`]) expect(a).toContain(f);
    // every arm's argv is the same except its binds, its cidfile and LE_SYN_ARM (and the env paths under its own dir)
    const norm = (arm: string) => laneCreateArgs(AP[arm], { imageId: IMG, uid: UID, gid: GID, env: senv(arm), target: 'SYNTHETIC' }).join('\n').split(`/${arm}/`).join('/X/').split(`/arms/${arm}/`).join('/arms/X/').replace(`LE_SYN_ARM=${arm}`, 'LE_SYN_ARM=X');
    for (const arm of SYN_ARMS) expect(norm(arm), arm).toBe(norm('A'));
    // the arm in the env must be the arm of the paths
    expect(() => synEnv(AP.B, { commit: COMMIT, shell: SHELL, arm: 'A' })).toThrow(/arm/);
    expect(() => synEnv(AP.B, { commit: COMMIT, shell: SHELL })).toThrow(/arm/);
  });
  it('each forbidden env name, an E1 env, and one unexpected extra are refused before create', () => {
    const create = (env: string[]) => () => laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env, target: 'SYNTHETIC' });
    expect(create(SENV)).not.toThrow();
    for (const k of SYN_FORBIDDEN_ENV) {
      expect(create([...SENV.slice(0, -1), `${k}=x`]), k).toThrow(/env/);
      expect(create([...SENV, `${k}=x`]), k).toThrow(/env/);
    }
    expect(create([...SENV, 'EXTRA=1'])).toThrow(/env/);
    expect(create(SENV.slice(0, -1))).toThrow(/env/);
    const e1 = laneEnv(SL, { apiOrigin: 'http://127.0.0.1:54321', dbUrl: 'postgresql://postgres@127.0.0.1:54322/postgres', commit: COMMIT, shell: SHELL });
    expect(create(e1)).toThrow(/env/);
    expect(() => laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV })).toThrow(/env/);
  });
  it('inspect expectation: exactly the three binds as Binds and as mounts; a fourth (keys) mount is a Binds/Mounts difference', () => {
    const e = expectedLaneConfig(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, seccompText: SECCOMP.toString('utf8'), cid: CIDV, target: 'SYNTHETIC' });
    expect(e.Binds).toEqual([`${R}:${R}:ro,rprivate`, `${SL.lane}:${SL.lane}:rw,rprivate`, `${SL.out}:${SL.out}:rw,rprivate`]);
    expect(e.Config.Env).toEqual([IMAGE_PATH_ENV, ...SENV].sort());
    const good = synInspect('A', CIDV);
    expect(compareLaneInspect(good, e)).toEqual([]);
    const bad = synInspect('A', CIDV);
    bad.HostConfig.Binds = [...bad.HostConfig.Binds, `${SL.keys}:${SL.keys}:ro,rprivate`];
    bad.Mounts = [...bad.Mounts, { Type: 'bind', Source: SL.keys, Destination: SL.keys, RW: false, Propagation: 'rprivate', Mode: 'ro', Name: '' }];
    expect(compareLaneInspect(bad, e).length).toBeGreaterThan(0);
    // another arm's container never matches this arm's expectation
    expect(compareLaneInspect(synInspect('B', CIDV), e).length).toBeGreaterThan(0);
  });
  it('in-lane env check: the exact arm env passes; a forbidden name, an extra, a missing or foreign LE_SYN_ARM fails', () => {
    const ok = envObj('A');
    expect(synEnvProblems(ok, R)).toBe(false);
    for (const k of [...SYN_FORBIDDEN_ENV, 'EXTRA']) expect(synEnvProblems({ ...ok, [k]: 'x' }, R), k).toBe(true);
    const { LE_SYN_ARM: _a, ...noArm } = ok;
    void _a;
    expect(synEnvProblems(noArm, R)).toBe(true);
    for (const v of ['B', 'E', '', 'a']) expect(synEnvProblems({ ...ok, LE_SYN_ARM: v }, R), v).toBe(true);
    expect(synEnvProblems({ ...ok, LE_TARGET: 'E1' }, R)).toBe(true);
    expect(ENV_KEYS).not.toContain('LE_SYN_ARM');
  });
  it('select (the job\'s first lane step) refuses a wrong target and every authentic input or baseURL source', () => {
    expect(selectLine({ LE_TARGET: 'SYNTHETIC', CI: 'true' }).ok).toBe(true);
    expect(selectLine({}).line).toBe('LE-SYN SELECT REFUSED LE_TARGET');
    expect(selectLine({ LE_TARGET: 'E1' }).ok).toBe(false);
    for (const k of [...SYN_FORBIDDEN_ENV, 'SUPABASE_DB_URL', 'VITE_SUPABASE_URL', 'E2E_BASE_URL', 'PGPASSWORD', 'LE_ALLOWED_ORIGINS']) {
      expect(selectLine({ LE_TARGET: 'SYNTHETIC', [k]: '' }), k).toEqual({ ok: false, line: `LE-SYN SELECT REFUSED ${k}` });
    }
  });
});

function envObj(arm: string): Obj {
  return Object.fromEntries([...senv(arm).map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]), ['PATH', IMAGE_PATH_ENV.slice(5)], ['HOSTNAME', CIDV.slice(0, 12)]]);
}
function synInspect(arm: string, cid: string): Obj {
  const e = expectedLaneConfig(AP[arm], { imageId: IMG, uid: UID, gid: GID, env: senv(arm), seccompText: SECCOMP.toString('utf8'), cid, target: 'SYNTHETIC' }) as Obj;
  const { Image, User, EffectiveMounts, Config, ...hc } = e;
  return {
    Id: cid, Image,
    Config: { Hostname: cid.slice(0, 12), Domainname: '', User, AttachStdin: false, AttachStdout: true, AttachStderr: true, Tty: false, OpenStdin: false,
      StdinOnce: false, Env: [...Config.Env].reverse(), Cmd: Config.Cmd, Image: IMG, Volumes: null, WorkingDir: R, Entrypoint: null, OnBuild: null, Labels: {} },
    HostConfig: { ...hc, Mounts: [] },
    Mounts: [...EffectiveMounts].reverse().map((m: Obj) => ({ ...m, Mode: m.RW ? 'rw' : 'ro', Name: '' })),
    State: { Status: 'exited', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '2026-11-04T01:00:00Z' },
  };
}
// ---------------------------------------------------------------------------------------------------------------------
type FNode = { kind: 'dir' | 'file' | 'link'; mode: number; uid: number; dev: number; ino: number; data: Buffer; nlink: number };
/** ONE stateful in-memory filesystem, shared by run-lane, lane-entry (openExcl CREATES the entry), the host summary and the cleanup.
 *  `ops` is one timeline of every mutation and every docker call. */
function memFs(o: { failMkdir?: (p: string) => boolean; failLstatBig?: (p: string) => boolean; onUnlink?: (p: string, f: Obj) => void } = {}) {
  const nodes = new Map<string, FNode>();
  let ino = 1000;
  const ops: string[] = [];
  const err = (code: string) => Object.assign(new Error(code), { code });
  const make = (p: string, kind: FNode['kind'], mode: number, extra: Partial<FNode> = {}) => {
    nodes.set(p, { kind, mode, uid: UID, dev: 7, ino: ino++, data: Buffer.alloc(0), nlink: kind === 'dir' ? 2 : 1, ...extra });
  };
  const parentDir = (p: string) => nodes.get(path.dirname(p))?.kind === 'dir';
  const stat = (n: FNode, big = false) => {
    const typ = n.kind === 'dir' ? 0o40000 : n.kind === 'file' ? 0o100000 : 0o120000;
    const v: Obj = { dev: n.dev, ino: n.ino, uid: n.uid, mode: typ | n.mode, nlink: n.nlink, size: n.data.length };
    const conv = big ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, BigInt(x)])) : v;
    return { ...conv, isDirectory: () => n.kind === 'dir', isFile: () => n.kind === 'file', isSymbolicLink: () => n.kind === 'link' };
  };
  make('/', 'dir', 0o755);
  const fds = new Map<number, { n: FNode; pos: number }>();
  let nfd = 20;
  const f: Obj = {
    nodes, ops, fds,
    mkdirAll(p: string, mode = 0o755) { let cur = ''; for (const x of p.split('/').filter(Boolean)) { cur += `/${x}`; if (!nodes.has(cur)) make(cur, 'dir', mode); } },
    file(p: string, data: string | Buffer, mode = 0o600, extra: Partial<FNode> = {}) { make(p, 'file', mode, { data: Buffer.from(data), ...extra }); },
    dir(p: string, mode = 0o700, extra: Partial<FNode> = {}) { make(p, 'dir', mode, extra); },
    link(p: string) { make(p, 'link', 0o777); },
    names: (p: string) => [...nodes.keys()].filter((k) => k !== '/' && path.dirname(k) === p).map((k) => path.basename(k)).sort(),
    under: (p: string) => [...nodes.keys()].filter((k) => k === p || k.startsWith(`${p}/`)).sort(),
    text: (p: string) => nodes.get(p)?.data.toString('utf8') ?? null,
    lstatSync(p: string, opt?: Obj) { if (opt?.bigint && o.failLstatBig?.(p)) throw err('EIO'); const n = nodes.get(p); if (!n) throw err('ENOENT'); return stat(n, !!opt?.bigint); },
    statSync(p: string) { return f.lstatSync(p); },
    realpathSync(p: string) { const n = nodes.get(p); if (!n) { if (p.startsWith('/usr/')) return p; throw err('ENOENT'); } return n.kind === 'link' ? '/elsewhere' : p; },
    accessSync(p: string) { if (!(p === '/usr/lib/postgresql/16/bin/psql' || (p.startsWith('/usr/bin/') && p !== '/usr/bin/psql'))) throw err('ENOENT'); },
    mkdirSync(p: string, opt?: Obj) {
      ops.push(`mkdir ${p}`);
      if (opt?.recursive) throw err('EINVAL');
      if (o.failMkdir?.(p)) throw err('EIO');
      if (nodes.has(p)) throw err('EEXIST');
      if (!parentDir(p)) throw err('ENOENT');
      make(p, 'dir', (opt?.mode ?? 0o777) & 0o700);
    },
    readdirSync(p: string) { const n = nodes.get(p); if (!n) throw err('ENOENT'); if (n.kind !== 'dir') throw err('ENOTDIR'); return f.names(p); },
    readFileSync(p: string, enc?: string) { const n = nodes.get(p); if (!n || n.kind !== 'file') throw err('ENOENT'); return enc ? n.data.toString('utf8') : n.data; },
    put(p: string, t: string) { ops.push(`put ${p}`); if (nodes.has(p)) throw err('EEXIST'); if (!parentDir(p)) throw err('ENOENT'); make(p, 'file', 0o600, { data: Buffer.from(t) }); },
    openExcl(p: string) { ops.push(`open ${p}`); if (nodes.has(p)) throw err('EEXIST'); if (!parentDir(p)) throw err('ENOENT'); make(p, 'file', 0o600); const fd = nfd++; fds.set(fd, { n: nodes.get(p)!, pos: 0 }); return fd; },
    openSync(p: string) { const n = nodes.get(p); if (!n) throw err('ENOENT'); if (n.kind === 'link') throw err('ELOOP'); const fd = nfd++; fds.set(fd, { n, pos: 0 }); return fd; },
    fstatSync(fd: number) { const x = fds.get(fd); if (!x) throw err('EBADF'); return stat(x.n); },
    readSync(fd: number, buf: Buffer, off: number, len: number) { const x = fds.get(fd)!; const k = x.n.data.copy(buf, off, x.pos, Math.min(x.n.data.length, x.pos + len)); x.pos += k; return k; },
    writeSync(fd: number, t: string) { const x = fds.get(fd); if (!x) throw err('EBADF'); x.n.data = Buffer.concat([x.n.data, Buffer.from(t)]); return t.length; },
    closeSync(fd: number) { if (!fds.delete(fd)) throw err('EBADF'); },
    unlinkSync(p: string) { ops.push(`unlink ${p}`); o.onUnlink?.(p, f); const n = nodes.get(p); if (!n) throw err('ENOENT'); if (n.kind === 'dir') throw err('EISDIR'); nodes.delete(p); },
    rmdirSync(p: string) { ops.push(`rmdir ${p}`); const n = nodes.get(p); if (!n) throw err('ENOENT'); if (n.kind !== 'dir') throw err('ENOTDIR'); if (f.names(p).length) throw err('ENOTEMPTY'); nodes.delete(p); },
    rmSync() { throw new Error('recursive removal is never used'); },
  };
  return f;
}

const CLEAN = 'CLEANUP JOIN SETTLED CONTEXT CLOSED BROWSER CLOSED DUMMY CLOSED PROXY CLOSED';
const armBody = (a: string, status = 'DONE', m = 'DONE') => `ARM ${a} STATUS ${status} M ${m} BROWSER_EXIT_OBSERVED SHAPE CODE_0 FIRST_SEEN GATE_POST BODY_END_PAGE OPEN BROWSER_LOG NO_MATCH`;
const synReport = (anns: [string, string][], o: { title?: string; retry?: number; tests?: number } = {}) => {
  const test = { projectName: 'lifecycle-matrix-chromium', annotations: [], results: [{ retry: o.retry ?? 0, status: 'passed', annotations: anns.map(([type, description]) => ({ type, description })) }] };
  return JSON.stringify({ suites: [{ title: 'lifecycle-matrix.spec.ts', file: 'lifecycle-matrix.spec.ts',
    suites: [{ title: 'lifecycle matrix (synthetic)', file: 'lifecycle-matrix.spec.ts', specs: Array.from({ length: o.tests ?? 1 }, () => ({ title: o.title ?? 'one arm', file: 'lifecycle-matrix.spec.ts', tests: [test] })) }] }] });
};
type PW = { code: number; report: string | null };
const goodPw = (arm: string): PW => ({ code: 0, report: synReport([['syn-arm', armBody(arm)], ['syn-cleanup', CLEAN]]) });
type WO = {
  failMkdir?: (p: string) => boolean; failLstatBig?: (p: string) => boolean; failPut?: (p: string) => boolean; onUnlink?: (p: string, f: Obj) => void;
  pw?: (arm: string) => PW; beforeStart?: (arm: string, f: Obj) => void; beforeOpen?: (arm: string, f: Obj) => void; afterOpen?: (arm: string, p: string, f: Obj, fd: number) => void;
  rmFails?: (arm: string) => boolean; cidMismatch?: (arm: string) => boolean; preParent?: boolean; envExtra?: (arm: string) => Obj;
};
/** The composed world: memFs + a recording docker fake whose `start` runs the REAL lane-entry supervisor for that arm on the
 *  same filesystem (its `run` is the only stand-in: it writes the Playwright report and an output entry). */
function world(o: WO = {}) {
  const f = memFs({ failMkdir: o.failMkdir, failLstatBig: o.failLstatBig, onUnlink: o.onUnlink });
  f.mkdirAll('/rt');
  f.mkdirAll(C, 0o700);
  f.mkdirAll(path.dirname(SHELL)); f.file(SHELL, 'shell', 0o755);
  f.mkdirAll('/n/bin'); f.file(NODE, 'node-bytes', 0o755);
  f.mkdirAll(path.dirname(ROOTL.seccomp)); f.file(ROOTL.seccomp, SECCOMP, 0o644);
  f.file(ROOTL.iid, `${IMG}\n`);
  f.file(ROOTL.manifest, `${createHash('sha256').update('node-bytes').digest('hex')}  ${LANE_NODE}\n`);
  if (o.preParent) { f.dir(P, 0o755, { uid: 4242 }); f.dir(`${P}/keys`, 0o700, { uid: 4242 }); }
  const calls: string[][] = [];
  const lanes: Record<string, Obj> = {};
  const cons = new Map<string, Obj>();
  let n = 0, live = 0, maxLive = 0;
  const inContainer = async (arm: string) => {
    const A = AP[arm];
    o.beforeStart?.(arm, f);
    const d = {
      env: { ...envObj(arm), ...(o.envExtra?.(arm) ?? {}) }, repo: R, fs: f, execPath: LANE_NODE, uid: () => UID, umask: () => 0o077,
      openExcl: (p: string) => { o.beforeOpen?.(arm, f); const fd = f.openExcl(p); o.afterOpen?.(arm, p, f, fd); return fd; },
      write: (fd: number, t: string) => f.writeSync(fd, t), close: (fd: number) => f.closeSync(fd), fstat: (fd: number) => f.fstatSync(fd),
      readText: () => 'docker-default (enforce)\n',
      readReport: (p: string) => { const x = f.nodes.get(p); return !x ? { status: 'missing' } : { status: 'ok', text: x.data.toString('utf8') }; },
      run: async (bin: string, args: string[]) => {
        f.ops.push(`run ${arm} ${[bin, ...args].join(' ')}`);
        const pw = (o.pw ?? goodPw)(arm);
        if (pw.report !== null) f.put(A.report, pw.report);
        f.put(`${A.output}/.last-run.json`, '{}');
        f.mkdirSync(`${A.output}/arm-${arm}`, { mode: 0o700 }); f.put(`${A.output}/arm-${arm}/x.txt`, 'x');
        return { code: pw.code };
      },
      fetch: () => { throw new Error('authentic call'); }, psql: () => { throw new Error('authentic call'); }, forward: () => { throw new Error('authentic call'); },
    };
    const r = await laneMain(d as never);
    lanes[arm] = r;
    return r.code;
  };
  const exec = async (bin: string, args: string[], opt?: Obj) => {
    calls.push([bin, ...args]);
    f.ops.push(`docker ${args[0]}${args[0] === 'container' ? ` ${args[1]}` : ''}`);
    const c = args[0];
    if (c === 'create') {
      const arm = path.basename(path.dirname(args[2]));
      const cid = '0123456789abcdef'[++n].repeat(64);
      cons.set(cid, { arm, exists: true, state: { Status: 'created', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '0001-01-01T00:00:00Z' }, code: null });
      live++; maxLive = Math.max(maxLive, live);
      f.file(args[2], `${cid}\n`, 0o644);
      return { ok: true, stdout: `${o.cidMismatch?.(arm) ? 'f'.repeat(64) : cid}\n` };
    }
    if (c === 'container' && args[1] === 'ls') { const id = args[args.indexOf('--filter') + 1].slice(3); return { ok: true, stdout: cons.get(id)?.exists ? `${id}\n` : '' }; }
    const cid = args.at(-1)!, k = cons.get(cid);
    if (!k) return { ok: false, stdout: '' };
    if (c === 'container' && args[1] === 'inspect') { const g = synInspect(k.arm, cid); g.State = k.state; return k.exists ? { ok: true, stdout: JSON.stringify([g]) } : { ok: false, stdout: '' }; }
    if (c === 'start') {
      k.state = { ...k.state, Status: 'running', Running: true, Pid: 77, StartedAt: '2026-11-04T01:00:00Z' };
      k.code = await inContainer(k.arm);
      k.state = { ...k.state, Status: 'exited', Running: false, Pid: 0, ExitCode: k.code };
      return { ok: true, stdout: `${cid}\n` };
    }
    if (c === 'wait') return { ok: true, stdout: `${k.code}\n` };
    if (c === 'stop') return { ok: true, stdout: `${cid}\n` };
    if (c === 'rm') { if (o.rmFails?.(k.arm)) return { ok: false, stdout: '' }; k.exists = false; live--; return { ok: true, stdout: `${cid}\n` }; }
    void opt;
    return { ok: false, stdout: '' };
  };
  const d = {
    exec, fs: f, uid: () => UID, gid: () => GID, sleep: async () => {}, browserSha256: createHash('sha256').update('shell').digest('hex'),
    files: { put: (p: string, t: string) => { if (o.failPut?.(p)) { f.ops.push(`put-failed ${p}`); throw new Error('EIO'); } f.put(p, t); } },
    spawnBridge: () => { calls.push(['spawnBridge']); throw new Error('no bridge on the synthetic path'); },
  };
  const go = () => runSynMatrix(d as never, { C, T, runId: RUN, attempt: ATT, R, node: NODE, shell: SHELL, commit: COMMIT });
  const host = () => synSummaryLines(synResults(f, ROOTL));
  const clean = () => synCleanup(f, { C, P, R, uid: UID });
  return { f, d, calls, lanes, go, host, clean, live: () => live, maxLive: () => maxLive };
}
const idx = (ops: string[], s: string) => ops.indexOf(s);

describe('composed matrix on ONE stateful filesystem: orchestrator, in-lane supervisor, host summary, owned cleanup', () => {
  it('a valid run: root marker before any docker call, four sequential containers (one live at a time), host PASS, cleanup CLEAN', async () => {
    const w = world();
    const r = await w.go();
    expect(r.ok).toBe(true);
    const ops = w.f.ops as string[];
    const firstDocker = ops.findIndex((x) => x.startsWith('docker '));
    expect(idx(ops, `put ${ROOTL.started}`)).toBeGreaterThanOrEqual(0);
    expect(idx(ops, `put ${ROOTL.started}`)).toBeLessThan(firstDocker);
    expect(idx(ops, `put ${C}/syn-create-intent`)).toBeLessThan(idx(ops, `mkdir ${P}`));
    // syn-created exactly once, after the LAST mkdir; the aggregate after it
    expect(ops.filter((x) => x === `put ${C}/syn-created`)).toHaveLength(1);
    const lastMkdir = ops.map((x, i) => (x.startsWith('mkdir ') && !x.includes('/pw-output/') ? i : -1)).reduce((a, b) => Math.max(a, b));
    expect(idx(ops, `put ${C}/syn-created`)).toBeGreaterThan(lastMkdir);
    expect(idx(ops, `put ${ROOTL.gates}`)).toBeGreaterThan(idx(ops, `put ${C}/syn-created`));
    // one container at a time: each create comes after the previous arm's absence listing
    const creates = ops.map((x, i) => (x === 'docker create' ? i : -1)).filter((i) => i >= 0);
    const lists = ops.map((x, i) => (x === 'docker container ls' ? i : -1)).filter((i) => i >= 0);
    expect(creates).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(creates[i]).toBeGreaterThan(lists[i - 1]);
    expect(w.maxLive()).toBe(1);
    // each arm's dirs are created right before its own create, never earlier
    for (const [i, arm] of SYN_ARMS.entries()) {
      expect(idx(ops, `mkdir ${AP[arm].P}`)).toBeLessThan(creates[i]);
      if (i > 0) expect(idx(ops, `mkdir ${AP[arm].P}`)).toBeGreaterThan(lists[i - 1]);
    }
    expect(w.calls.filter((c) => c[1] === 'create').map((c) => c.slice(1)))
      .toEqual(SYN_ARMS.map((arm) => laneCreateArgs(AP[arm], { imageId: IMG, uid: UID, gid: GID, env: senv(arm), target: 'SYNTHETIC' })));
    expect(w.calls.some((c) => c[0] === 'spawnBridge')).toBe(false);
    // in each container: lane.txt opened only after the dirs check, then AppArmor, then the ONE spec run
    for (const arm of SYN_ARMS) {
      expect(idx(ops, `open ${AP[arm].laneTxt}`)).toBeLessThan(ops.findIndex((x) => x.startsWith(`run ${arm} `)));
      expect(parseSynOut(w.f.text(AP[arm].laneTxt))).toMatchObject({ ok: true, interrupted: false, ran: true, pwCode: 0, report: 'PARSED', arm: { arm, status: 'DONE' } });
      expect(w.lanes[arm].code).toBe(0);
    }
    expect(readVerdict(w.f, ROOTL)).toMatchObject({ ok: true, container: 'LANE_ABSENT', source: 'RECEIPT' });
    const s = w.host();
    expect(s.ok).toBe(true);
    expect(s.lines.at(-1)).toBe('LE-SYN RESULT PASS');
    for (const arm of SYN_ARMS) expect(s.lines).toContain(`LE-SYN ARM ${arm} RESULT DONE CONTAINER ABSENT RECORD OK`);
    const before = w.f.under(C);
    const cl = w.clean();
    expect(cl).toEqual({ ok: true, lines: ['SYN_CLEANUP REMOVED 25 OF 25', 'SYN_CLEANUP CLEAN'] });
    expect(w.f.under(P)).toEqual([]);
    expect(w.f.under(C)).toEqual(before); // the control receipts are never touched by the owned cleanup
    expect(ops.some((x) => x.startsWith('rmdir /rt/syn-lane-ctl') || x.startsWith(`unlink ${C}`))).toBe(false);
  });
  it('finding 1: a PRE-EXISTING lane.txt is LANE_E_DIRS with nothing opened and its bytes untouched', async () => {
    const w = world({ beforeStart: (arm, f) => { if (arm === 'B') f.file(AP.B.laneTxt, 'LANE SYN START\n'); } });
    await w.go();
    expect(w.lanes.B).toEqual({ code: 1, lines: ['LANE_E_DIRS'] });
    expect(w.f.ops).not.toContain(`open ${AP.B.laneTxt}`);
    expect(w.f.text(AP.B.laneTxt)).toBe('LANE SYN START\n');
    expect(w.f.ops.some((x: string) => x.startsWith('run B '))).toBe(false);
    const s = w.host();
    expect(s.lines).toContain('LE-SYN ARM B RESULT UNRESOLVED CONTAINER ABSENT RECORD INTERRUPTED');
    expect(s.lines.at(-1)).toBe('LE-SYN RESULT UNRESOLVED');
  });
  it('finding 1: a lane.txt created by a RACE after the empty check fails the exclusive open (LANE_E_OUT); a foreign file in out/ is DIRS', async () => {
    const w = world({ beforeOpen: (arm, f) => { if (arm === 'C') f.file(AP.C.laneTxt, 'racer'); }, beforeStart: (arm, f) => { if (arm === 'D') f.file(`${AP.D.out}/stale`, 'x'); } });
    await w.go();
    expect(w.lanes.C).toEqual({ code: 1, lines: ['LANE_E_OUT'] });
    expect(w.f.text(AP.C.laneTxt)).toBe('racer');
    expect(w.lanes.D).toEqual({ code: 1, lines: ['LANE_E_DIRS'] });
    expect(w.f.ops).not.toContain(`open ${AP.D.laneTxt}`);
    expect(w.f.nodes.has(AP.D.laneTxt)).toBe(false);
    for (const arm of ['C', 'D']) expect(w.f.ops.some((x: string) => x.startsWith(`run ${arm} `)), arm).toBe(false);
  });
  it('finding 1: a lane.txt REPLACED after the open (different identity) is LANE_E_DIRS; nothing is written and the fd is closed', async () => {
    let fdA = -1;
    const w = world({ afterOpen: (arm, p, f, fd) => { if (arm === 'A') { fdA = fd; f.nodes.delete(p); f.file(p, ''); } } });
    await w.go();
    expect(w.lanes.A).toEqual({ code: 1, lines: ['LANE_E_DIRS'] });
    expect(w.f.text(AP.A.laneTxt)).toBe('');
    expect(fdA).toBeGreaterThan(0);
    expect(w.f.fds.has(fdA)).toBe(false);
    expect(w.f.ops.some((x: string) => x.startsWith('run A '))).toBe(false);
  });
  it('an UNRESOLVED arm B (rm fails): C and D are NOT_RUN with no dirs and no create; aggregate UNRESOLVED; image held; nothing removed', async () => {
    const w = world({ rmFails: (arm) => arm === 'B' });
    const r = await w.go();
    expect(r.ok).toBe(false);
    expect(r.say).toEqual(expect.arrayContaining(['ARM B LANE_E_RM', 'ARM B SYN_E_ARM_UNRESOLVED', 'ARM C NOT_RUN', 'ARM D NOT_RUN', 'GATE CONTAINER UNRESOLVED']));
    expect(w.calls.filter((c) => c[1] === 'create')).toHaveLength(2);
    for (const arm of ['C', 'D']) { expect(w.f.nodes.has(AP[arm].P), arm).toBe(false); expect(w.f.nodes.has(AP[arm].C), arm).toBe(false); }
    const v = readVerdict(w.f, ROOTL);
    expect(v).toMatchObject({ ok: false, container: 'UNRESOLVED' });
    // image.mjs cleanup reads exactly these root receipts through laneVerdict, so it holds the image
    expect(laneVerdict({ runLaneStarted: true, gatesText: w.f.text(ROOTL.gates) })).toMatchObject({ ok: false, container: 'UNRESOLVED' });
    expect(read('scripts/e2e/le-lane/image.mjs')).toContain("const L = lanePaths('/nonexistent-p', ctl, repo);");
    const s = w.host();
    expect(s.lines.slice(-1)).toEqual(['LE-SYN RESULT UNRESOLVED LANE_TEARDOWN']);
    const before = w.f.under(P);
    expect(w.clean()).toEqual({ ok: false, lines: ['SYN_CLEANUP PRESERVED UNRESOLVED_TEARDOWN'] });
    expect(w.f.under(P)).toEqual(before);
  });
  it('constraint 2: an unknown container identity (cidfile and stdout disagree) is UNRESOLVED, stops later arms, never NOT_INVOKED', async () => {
    const w = world({ cidMismatch: (arm) => arm === 'A' });
    const r = await w.go();
    expect(r.say).toEqual(expect.arrayContaining(['ARM A LANE_E_CID', 'ARM A LANE_E_CID_UNKNOWN', 'ARM B NOT_RUN']));
    expect(readVerdict(w.f, ROOTL)).toMatchObject({ ok: false, container: 'UNRESOLVED', source: 'RECEIPT' });
    expect(synResults(w.f, ROOTL).arms.map((a: Obj) => a.result)).toEqual(['UNRESOLVED', 'NOT_RUN', 'NOT_RUN', 'NOT_RUN']);
  });
  it('constraint 2: the root marker is persisted before any possible container action; if it cannot be, nothing else happens', async () => {
    const w = world({ failPut: (p) => p === ROOTL.started });
    const r = await w.go();
    expect(r).toEqual({ ok: false, say: ['LANE_E_RECEIPT', 'ARM A NOT_RUN', 'ARM B NOT_RUN', 'ARM C NOT_RUN', 'ARM D NOT_RUN'] });
    expect(w.calls).toEqual([]);
    expect(w.f.nodes.has(ROOTL.gates)).toBe(false);
    expect(w.f.ops.filter((x: string) => x.startsWith('mkdir'))).toEqual([]);
    expect(w.f.nodes.has(`${C}/syn-create-intent`)).toBe(false);
  });
  it('constraint 2: after the marker, absent aggregate gates or absent/unparsable arm receipts are UNRESOLVED, never NOT_INVOKED', async () => {
    const w = world();
    await w.go();
    const g = w.f.nodes.get(ROOTL.gates);
    w.f.nodes.delete(ROOTL.gates);
    expect(readVerdict(w.f, ROOTL)).toMatchObject({ ok: false, container: 'UNRESOLVED', source: 'OWNER_LOST' });
    expect(w.clean().lines).toEqual(['SYN_CLEANUP PRESERVED UNRESOLVED_TEARDOWN']);
    w.f.nodes.set(ROOTL.gates, g);
    // an arm whose started receipt exists with gates missing or garbled
    for (const garble of [null, 'GATE CONTAINER LANE_ABSENT\n']) {
      const x = world();
      await x.go();
      if (garble === null) x.f.nodes.delete(AP.C.gates); else x.f.nodes.get(AP.C.gates).data = Buffer.from(garble);
      const v = readVerdict(x.f, AP.C);
      expect(v).toMatchObject({ ok: false, source: 'OWNER_LOST' });
      expect(synArmResult({ arm: 'C', verdict: v, laneText: x.f.text(AP.C.laneTxt), exit: 'ZERO' }).result).toBe('UNRESOLVED');
      expect(synAggregateGates({ A: readVerdict(x.f, AP.A), B: readVerdict(x.f, AP.B), C: v, D: readVerdict(x.f, AP.D) })).toContain('GATE CONTAINER UNRESOLVED');
      expect(x.host().lines.at(-1)).toBe('LE-SYN RESULT UNRESOLVED');
    }
    // an unreadable arm receipt is not NOT_INVOKED either
    expect(synAggregateGates({ A: null, B: null, C: null, D: null })).toContain('GATE CONTAINER UNRESOLVED');
  });
  it('a pre-existing parent is refused BEFORE any receipt (NOT_INVOKED): no docker call, nothing created, nothing removed', async () => {
    const w = world({ preParent: true });
    const before = w.f.under(P);
    expect(await w.go()).toEqual({ ok: false, say: ['SYN_E_DIR_EXISTS'] });
    expect(w.calls).toEqual([]);
    expect(w.f.ops).toEqual([]);
    expect(w.clean()).toEqual({ ok: true, lines: ['SYN_CLEANUP NOT_INVOKED'] });
    expect(w.f.under(P)).toEqual(before);
  });
});
// ---------------------------------------------------------------------------------------------------------------------
describe('ownership: created identities held in memory, written ONCE after creation stops; cleanup only through them', () => {
  it('interrupted creation (mkdir fails at the third dir of arm A): partial record, no container, only the recorded dirs removed', async () => {
    const w = world({ failMkdir: (p) => p === AP.A.out });
    const r = await w.go();
    expect(r.say).toEqual(expect.arrayContaining(['ARM A SYN_E_DIR_CREATE', 'ARM A NOT_RUN', 'ARM B NOT_RUN', 'SYN_CREATED 3', 'GATE CONTAINER LANE_NO_CONTAINER', 'GATE STARTED NO']));
    expect(w.calls).toEqual([]);
    expect(parseSynCreated(w.f.text(`${C}/syn-created`), P)!.map((e) => e.path)).toEqual([P, AP.A.P, AP.A.lane]);
    expect(readVerdict(w.f, ROOTL)).toMatchObject({ ok: true, container: 'LANE_NO_CONTAINER', source: 'RECEIPT' });
    expect(w.host().lines.at(-1)).toBe('LE-SYN RESULT FAIL');
    expect(w.clean()).toEqual({ ok: true, lines: ['SYN_CLEANUP REMOVED 3 OF 3', 'SYN_CLEANUP CLEAN'] });
    expect(w.f.under(P)).toEqual([]);
  });
  it('a crash before the final record (simulated: the record cannot be written) is intent-only: UNRESOLVED, everything preserved', async () => {
    const w = world({ failPut: (p) => p === `${C}/syn-created` });
    await w.go();
    expect(w.f.nodes.has(`${C}/syn-create-intent`)).toBe(true);
    expect(w.f.nodes.has(`${C}/syn-created`)).toBe(false);
    const before = w.f.under(P);
    expect(w.clean()).toEqual({ ok: false, lines: ['SYN_CLEANUP PRESERVED UNRESOLVED_OWNERSHIP'] });
    expect(w.f.under(P)).toEqual(before);
    expect(synOwnership({ intent: true, createdText: null, P }).state).toBe('UNRESOLVED');
    expect(synOwnership({ intent: null, createdText: null, P }).state).toBe('UNRESOLVED');
    expect(synOwnership({ intent: false, createdText: 'END\n', P }).state).toBe('UNRESOLVED');
    expect(synOwnership({ intent: false, createdText: null, P }).state).toBe('NOT_INVOKED');
  });
  it('a directory created but whose identity cannot be verified is never recorded, so it and every ancestor are preserved', async () => {
    const w = world({ failLstatBig: (p) => p === AP.A.lane });
    const r = await w.go();
    expect(r.say).toEqual(expect.arrayContaining(['ARM A SYN_E_DIR_VERIFY', 'SYN_CREATED 2']));
    expect(w.f.nodes.has(AP.A.lane)).toBe(true);
    const cl = w.clean();
    expect(cl.ok).toBe(false);
    expect(cl.lines).toEqual(['SYN_CLEANUP PRESERVED CHILD P', 'SYN_CLEANUP PRESERVED UNRECORDED P/A', 'SYN_CLEANUP REMOVED 0 OF 2', 'SYN_CLEANUP PRESERVED']);
    expect(w.f.nodes.has(AP.A.lane)).toBe(true);
  });
  it('the record grammar: creation order, P first, parents recorded before children, nothing outside P', () => {
    const e = (p: string) => ({ path: p, dev: '7', ino: '9', uid: UID, mode: 0o700 });
    const ok = synCreatedRecord([e(P), e(AP.A.P), e(AP.A.lane)]);
    expect(parseSynCreated(ok, P)).toHaveLength(3);
    expect(parseSynCreated('END\n', P)).toEqual([]);
    for (const bad of [synCreatedRecord([e(AP.A.P)]), synCreatedRecord([e(P), e(AP.A.lane)]), synCreatedRecord([e(P), e('/rt/other')]), synCreatedRecord([e(P), e(`${P}/../x`)]),
      synCreatedRecord([e(P), e(P)]), ok.replace('END\n', ''), ok.replace('MODE 0700', 'MODE 0755'), `${ok}DIR ${P}/x DEV 1 INO 1 UID 1 MODE 0700\n`]) expect(parseSynCreated(bad, P), bad).toBeNull();
  });
  it('mkdirRecorded and synParentFree: exclusive non-recursive mkdir; symlinked or non-canonical ancestors are refused before any write', () => {
    const f = memFs();
    f.mkdirAll('/rt');
    const created: Obj[] = [];
    expect(mkdirRecorded(f, P, UID, created)).toBeNull();
    expect(mkdirRecorded(f, P, UID, created)).toBe('SYN_E_DIR_CREATE');
    expect(created.map((c) => c.path)).toEqual([P]);
    expect(f.ops).toEqual([`mkdir ${P}`, `mkdir ${P}`]);
    const g = memFs(); g.link('/rt');
    expect(synParentFree(g, T, ROOTL)).toBe('SYN_E_DIR_ANCESTOR');
    expect(synParentFree(memFs(), T, ROOTL)).toBe('SYN_E_DIR_ANCESTOR');
    expect(synParentFree(f, T, lanePaths('/rt/le-private', C, R))).toBe('SYN_E_DIR_PARENT');
  });
});

describe('constraint 1: the whole owned subtree is validated first; any refusal propagates to EVERY ancestor', () => {
  const done = async (o: WO = {}) => { const w = world(o); await w.go(); return w; };
  it('a swapped recorded directory (new identity) is preserved with its ancestors; untouched siblings are removed', async () => {
    const w = await done();
    w.f.nodes.get(AP.B.out).ino = 999999;
    const cl = w.clean();
    expect(cl.ok).toBe(false);
    expect(cl.lines).toEqual(['SYN_CLEANUP PRESERVED CHILD P', 'SYN_CLEANUP PRESERVED CHILD P/B', 'SYN_CLEANUP PRESERVED MISMATCH P/B/out', 'SYN_CLEANUP REMOVED 22 OF 25', 'SYN_CLEANUP PRESERVED']);
    expect(w.f.under(P)).toEqual([P, AP.B.P, AP.B.out, AP.B.laneTxt]);
    expect(w.f.ops).not.toContain(`unlink ${AP.B.laneTxt}`);
  });
  it('a recorded directory replaced by a symlink is preserved (lstat only; nothing behind the link is read or removed)', async () => {
    const w = await done();
    for (const k of w.f.under(AP.C.work)) w.f.nodes.delete(k);
    w.f.link(AP.C.work);
    const cl = w.clean();
    expect(cl.lines).toContain('SYN_CLEANUP PRESERVED MISMATCH P/C/lane/work');
    expect(cl.lines).toContain('SYN_CLEANUP PRESERVED CHILD P/C/lane');
    expect(cl.lines).toContain('SYN_CLEANUP PRESERVED CHILD P/C');
    expect(w.f.nodes.get(AP.C.work).kind).toBe('link');
  });
  it('foreign owner, another device, a hard link, or an unrecorded entry outside a content dir: refused and propagated', async () => {
    const cases: [string, (f: Obj) => void, string][] = [
      ['foreign uid', (f) => f.file(`${AP.A.out}/x`, 'x', 0o600, { uid: UID + 4242 }), 'SYN_CLEANUP PRESERVED FOREIGN P/A/out'],
      ['other device', (f) => f.file(`${AP.A.output}/arm-A/y`, 'y', 0o600, { dev: 9 }), 'SYN_CLEANUP PRESERVED FOREIGN P/A/lane/evidence/pw-output'],
      ['hard link', (f) => f.file(`${AP.A.work}/h`, 'h', 0o600, { nlink: 2 }), 'SYN_CLEANUP PRESERVED FOREIGN P/A/lane/work'],
      ['unrecorded under the arm dir', (f) => f.dir(`${AP.A.P}/extra`), 'SYN_CLEANUP PRESERVED UNRECORDED P/A'],
      ['unrecorded under P', (f) => f.file(`${P}/note`, 'n'), 'SYN_CLEANUP PRESERVED UNRECORDED P'],
    ];
    for (const [name, plant, line] of cases) {
      const w = await done();
      plant(w.f);
      const cl = w.clean();
      expect(cl.ok, name).toBe(false);
      expect(cl.lines, name).toContain(line);
      if (!line.endsWith(' P')) expect(cl.lines, name).toContain('SYN_CLEANUP PRESERVED CHILD P');
      if (/ P\/A\//.test(line)) expect(cl.lines, name).toContain('SYN_CLEANUP PRESERVED CHILD P/A');
      expect(w.f.nodes.has(P), name).toBe(true);
      expect(cl.lines.at(-1)).toBe('SYN_CLEANUP PRESERVED');
    }
  });
  it('a symlink inside a content dir is removed as a link (never followed); its target is untouched', async () => {
    const w = await done();
    w.f.mkdirAll('/rt/outside'); w.f.file('/rt/outside/keep', 'k');
    w.f.link(`${AP.D.out}/to-outside`);
    expect(w.clean().ok).toBe(true);
    expect(w.f.text('/rt/outside/keep')).toBe('k');
    expect(w.f.ops).toContain(`unlink ${AP.D.out}/to-outside`);
  });
  it('identities are re-checked right before each removal: an entry swapped after validation is preserved as CHANGED', async () => {
    let swapped = false;
    const w = await done({ onUnlink: (p, f) => { if (!swapped && p === `${AP.A.output}/.last-run.json`) { swapped = true; const n = f.nodes.get(`${AP.A.output}/arm-A/x.txt`); f.nodes.set(`${AP.A.output}/arm-A/x.txt`, { ...n, ino: 777777 }); } } });
    // validation order is readdir order (sorted): .last-run.json is unlinked before arm-A/x.txt is re-checked
    const cl = w.clean();
    expect(swapped).toBe(true);
    expect(cl.lines).toContain('SYN_CLEANUP PRESERVED CHANGED P/A/lane/evidence/pw-output');
    expect(w.f.nodes.has(`${AP.A.output}/arm-A/x.txt`)).toBe(true);
    expect(cl.ok).toBe(false);
  });
  it('composed: pw-output created but its identity unverifiable is RESERVED, never content; preserved with every ancestor', async () => {
    let once = false;
    const w = await done({ failLstatBig: (p) => p === AP.A.output && !once && (once = true) });
    expect(parseSynCreated(w.f.text(`${C}/syn-created`), P)!.map((e) => e.path)).toEqual([P, AP.A.P, AP.A.lane, AP.A.out, AP.A.work, AP.A.evidence]);
    expect(w.f.nodes.has(AP.A.output)).toBe(true);
    const cl = w.clean();
    expect(cl).toEqual({ ok: false, lines: ['SYN_CLEANUP PRESERVED CHILD P', 'SYN_CLEANUP PRESERVED CHILD P/A', 'SYN_CLEANUP PRESERVED CHILD P/A/lane',
      'SYN_CLEANUP PRESERVED UNRECORDED P/A/lane/evidence', 'SYN_CLEANUP REMOVED 2 OF 6', 'SYN_CLEANUP PRESERVED'] });
    expect(w.f.nodes.has(AP.A.output)).toBe(true);
    expect(w.f.ops).not.toContain(`rmdir ${AP.A.output}`);
  });
  it('composed: a recorded ancestor swapped AFTER validation stops removal beneath it; its unchanged file is never unlinked', async () => {
    let swapped = false;
    const w = await done({ onUnlink: (p, f) => { if (!swapped && p === `${AP.A.output}/.last-run.json`) { swapped = true; f.nodes.set(AP.A.out, { ...f.nodes.get(AP.A.out), ino: 888888 }); } } });
    const cl = w.clean();
    expect(swapped).toBe(true);
    expect(cl.ok).toBe(false);
    expect(cl.lines).toEqual(expect.arrayContaining(['SYN_CLEANUP PRESERVED CHANGED P/A/out', 'SYN_CLEANUP PRESERVED CHILD P/A', 'SYN_CLEANUP PRESERVED CHILD P']));
    expect(w.f.nodes.has(AP.A.laneTxt)).toBe(true);
    expect(w.f.ops).not.toContain(`unlink ${AP.A.laneTxt}`);
  });
  it('static: the cleanup never removes recursively by API and has no writer; the control dir is not in its scope', () => {
    const src = read('scripts/e2e/le-lane/synthetic.mjs');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    expect(code).not.toMatch(/rmSync|recursive|copyFile|renameSync|chmod|chown/);
    // no writer token either, by the fs-write gate's OWN pattern (read from security.yml, so this file carries no token itself)
    const gate = /xargs -r grep -nE '([^']+)'/.exec(read('.github/workflows/security.yml'));
    expect(gate).not.toBeNull();
    expect(code).not.toMatch(new RegExp(gate![1]));
    expect(code.match(/fsx\.(unlinkSync|rmdirSync)\(/g)).toHaveLength(2);
    expect(code).not.toMatch(/fsx\.(unlinkSync|rmdirSync)\((C|root\.C)/);
  });
});
describe('effective context options: the 1.59.1 defaults merge, reproduced, with source-derived negatives', () => {
  const PW = 'node_modules/playwright/lib/index.js';
  it('static: the installed merge and fixture-default source is the reviewed 1.59.1 text (a version change fails closed)', () => {
    expect(JSON.parse(read('node_modules/playwright/package.json')).version).toBe('1.59.1');
    const lines = read(PW).split('\n');
    expect(lines.slice(282, 288).join('\n')).toBe('      runBeforeCreateBrowserContext: async (options) => {\n        for (const [key, value] of Object.entries(_combinedContextOptions)) {\n          if (!(key in options))\n            options[key] = value;\n        }\n      },');
    expect(sha(lines.slice(116, 218).join('\n'))).toBe('d6090f9c943e31ed1ef491398ba4b389198695b8e07d3cfff4991977bcbcd7ed');
    expect(lines.slice(139, 142).join('\n')).toBe('  baseURL: [async ({}, use) => {\n    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);\n  }, { option: true, box: true }],');
    const desc = JSON.parse(read('node_modules/playwright-core/lib/server/deviceDescriptorsSource.json'))['Desktop Chrome'];
    expect(desc.userAgent).toBe(DESKTOP_CHROME_UA);
    expect(desc.deviceScaleFactor).toBe(SYN_CONTEXT_TABLE.deviceScaleFactor);
  });
  it('mergeDefaults is the exact rule: a key present in the caller (even undefined) is never replaced', () => {
    expect(mergeDefaults({ a: 1, b: 2 }, { a: 9 })).toEqual({ a: 9, b: 2 });
    expect(Object.prototype.hasOwnProperty.call(mergeDefaults({ a: 1 }, { a: undefined }), 'a')).toBe(true);
    expect(mergeDefaults({ a: 1 }, { a: undefined }).a).toBeUndefined();
  });
  it('every arm: effective options equal the table exactly; B adds only its explicit storageState; no proxy, baseURL or storageState fills in', () => {
    const table = JSON.parse(JSON.stringify(SYN_CONTEXT_TABLE));
    for (const arm of SYN_ARMS) {
      const eff = effectiveArmOptions(arm, DUMMY, SYN_USE, {});
      expect(eff, arm).toEqual(arm === 'B' ? { ...table, storageState: { cookies: [], origins: [{ origin: DUMMY, localStorage: [{ name: 'k', value: 'v' }] }] } } : table);
      for (const k of ['proxy', 'baseURL', 'extraHTTPHeaders', 'geolocation', 'httpCredentials', 'permissions', 'timezoneId', 'clientCertificates', 'screen']) expect(k in eff, `${arm} ${k}`).toBe(false);
    }
  });
  it('NEGATIVE: E1\'s config, PLAYWRIGHT_TEST_BASE_URL, a proxy fixture and a storageState fixture are each detected', () => {
    const table = JSON.parse(JSON.stringify(SYN_CONTEXT_TABLE));
    const desktop = JSON.parse(read('node_modules/playwright-core/lib/server/deviceDescriptorsSource.json'))['Desktop Chrome'];
    // E1: config `use` (baseURL, serviceWorkers block) + project ...devices['Desktop Chrome'] + spec test.use({ storageState, viewport })
    const { defaultBrowserType: _b, screen: _s, ...dev } = desktop;
    void _b; void _s;
    const e1Use = { baseURL: 'http://127.0.0.1:8080', serviceWorkers: 'block', ...dev, storageState: '/p/state.json', viewport: { width: 1440, height: 900 } };
    const e1 = effectiveArmOptions('A', DUMMY, e1Use, {});
    expect(e1).not.toEqual(table);
    expect(e1).toMatchObject({ baseURL: 'http://127.0.0.1:8080', storageState: '/p/state.json' });
    const env = effectiveArmOptions('A', DUMMY, SYN_USE, { PLAYWRIGHT_TEST_BASE_URL: 'http://127.0.0.1:9' });
    expect(env.baseURL).toBe('http://127.0.0.1:9');
    expect(env).not.toEqual(table);
    const px = effectiveArmOptions('C', DUMMY, { ...SYN_USE, proxy: { server: 'http://127.0.0.1:1' } }, {});
    expect(px.proxy).toEqual({ server: 'http://127.0.0.1:1' });
    const ss = effectiveArmOptions('A', DUMMY, { ...SYN_USE, storageState: '/p/s.json' }, {});
    expect(ss.storageState).toBe('/p/s.json');
    // and through contextOptions too
    expect(effectiveArmOptions('D', DUMMY, { ...SYN_USE, contextOptions: { proxy: { server: 'x' } } }, {}).proxy).toEqual({ server: 'x' });
    // arm B's explicit key survives a storageState fixture
    expect(effectiveArmOptions('B', DUMMY, { ...SYN_USE, storageState: '/p/s.json' }, {}).storageState).toEqual({ cookies: [], origins: [{ origin: DUMMY, localStorage: [{ name: 'k', value: 'v' }] }] });
    // the reproduction's default path (no use at all) is Playwright's documented defaults
    expect(combinedContextOptions({}, {})).toEqual({ acceptDownloads: true, bypassCSP: false, colorScheme: 'light', hasTouch: false, ignoreHTTPSErrors: false, isMobile: false,
      javaScriptEnabled: true, locale: 'en-US', offline: false, viewport: { width: 1280, height: 720 }, serviceWorkers: 'allow' });
  });
  it('static: the synthetic config inherits nothing from E1 and its `use` is exactly SYN_USE plus the project launchOptions', () => {
    const cfg = read('e2e/lesson-editor/playwright.lifecycle-matrix.config.ts');
    const code = cfg.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).toContain('use: { ...SYN_USE },');
    expect(code).toContain("use: { launchOptions: { ...chromiumExecutableOption(), args: [RESOLVER_ARG] } },");
    expect(code).not.toMatch(/lesson-editor\.config|devices\[|baseURL|proxy|storageState|contextOptions|extraHTTPHeaders|LE_APP_ORIGIN|globalSetup|webServer/);
    expect(code.match(/\buse:/g)).toHaveLength(2);
    expect(code).toMatch(/workers: 1,/);
    expect(code).toMatch(/retries: 0,/);
    expect(RESOLVER_ARG).toBe('--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1');
    expect(SYN_USE).toMatchObject({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 30_000, navigationTimeout: 30_000, contextOptions: {} });
    expect(ARM_TIMEOUT_MS).toBe(120_000);
    expect(read('e2e/lesson-editor/playwright.lesson-editor.config.ts')).toMatch(/timeout: 120_000,/);
  });
  it('static: the spec imports the BASE test (never egress-test) and its one test requests only playwright and launchOptions', () => {
    const spec = read('e2e/lesson-editor/lifecycle-matrix.spec.ts');
    const code = spec.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("import { test } from '@playwright/test';");
    expect(code).not.toMatch(/egress-test|test\.use\(|test\.extend|beforeEach|afterEach|beforeAll|afterAll/);
    const fixtures = [...code.matchAll(/\btest\(\s*'[^']*',\s*async\s*\(\{([^}]*)\}\)/g)].map((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
    expect(fixtures).toEqual([['playwright', 'launchOptions']]);
    expect(code.match(/\btest\(/g)).toHaveLength(1);
    expect(code).toMatch(/for \(const k of \['LE_APP_ORIGIN'[^\]]*'PLAYWRIGHT_TEST_BASE_URL'/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function deferred() { let release!: (v?: unknown) => void; const promise = new Promise((r) => { release = r; }); return { promise, release }; }
type FW = { fail?: string; hold?: Record<string, { promise: Promise<unknown> }>; exit?: string; violations?: string[]; noState?: boolean; browserDelayMs?: number;
  ms?: Partial<Record<'timeoutMs' | 'joinMs' | 'closeMs' | 'outerMs', number>> };
/** Fake Browser/Context/Page recorder. `fail` throws FAKE_FAIL at the named step; `hold` keeps a step pending until released;
 *  `exit` is the shape the owned browser shows once closed ('CODE_0' default). `calls` = what guard() let through (onCall). */
function fakeWorld(o: FW = {}) {
  const log: string[] = [], calls: string[] = [];
  let pages = 0, contexts = 0, exited = false;
  const step = async (label: string, key = label) => {
    log.push(label);
    const h = o.hold?.[key];
    if (h) { await h.promise; log.push(`${key}:released`); }
    if (o.fail === key) throw new Error('FAKE_FAIL');
  };
  const mkPage = () => {
    const p = `page${pages++}`;
    let closed = false;
    return {
      goto: (u: string) => step(`${p}.goto ${new URL(u).pathname}`),
      close: async () => { await step(`${p}.close:start`); closed = true; log.push(`${p}.close:end`); },
      evaluate: () => step(`${p}.setItem`),
      locator: (s: string) => ({ waitFor: (x: Obj) => step(`${p}.visible ${s} ${x.state}`), click: () => step(`${p}.click ${s}`) }),
      keyboard: { type: (t: string) => step(`${p}.type ${t}`) },
      once: () => {}, isClosed: () => closed,
    };
  };
  const browser = {
    newContext: async (opts: Obj) => {
      contexts++;
      await step(`newContext ${JSON.stringify(opts)}`, 'newContext');
      return {
        setDefaultTimeout: (n: number) => log.push(`timeout ${n}`), setDefaultNavigationTimeout: (n: number) => log.push(`navTimeout ${n}`),
        newPage: async () => { await step(`newPage#${pages}`); return mkPage(); },
        close: () => step('context.close'),
      };
    },
    close: async () => { log.push('browser.close'); exited = true; },
  };
  const state = { exitShape: () => (exited ? o.exit ?? 'CODE_0' : 'NONE'), browserLog: () => 'NO_MATCH' };
  const withBrowser = async (onState: (s: unknown) => void, armBody: (b: unknown) => Promise<unknown>) => {
    log.push('launch');
    if (o.browserDelayMs) await sleep(o.browserDelayMs);
    if (!o.noState) onState(state);
    try { await armBody(browser); } finally { log.push('wb.close'); exited = true; }
  };
  const d = { dummy: DUMMY, allowed: allowedOrigins(DUMMY), timeoutMs: 60, joinMs: 200, closeMs: 60, outerMs: 2000, ...(o.ms ?? {}), withBrowser,
    installBoundary: async () => { await step('boundary'); return { violations: o.violations ?? [], aborted: 0 }; }, onCall: (n: string) => calls.push(n) };
  return { d, log, calls, counts: () => ({ contexts }) };
}
const EXPECTED: Record<string, string[]> = {
  A: ['newPage#0', 'page0.goto /doc'],
  B: ['newPage#0', 'page0.goto /doc'],
  C: ['newPage#0', 'page0.goto /blank', 'page0.close:start', 'page0.close:end', 'newPage#1', 'page1.goto /doc'],
  D: ['newPage#0', 'page0.goto /blank', 'page0.setItem', 'page0.goto /doc'],
};
const CALLS: Record<string, string[]> = {
  A: ['newContext', 'installBoundary', 'newPage', 'goto', 'waitFor', 'waitFor', 'click', 'type'],
  B: ['newContext', 'installBoundary', 'newPage', 'goto', 'waitFor', 'waitFor', 'click', 'type'],
  C: ['newContext', 'installBoundary', 'newPage', 'goto', 'pageClose', 'newPage', 'goto', 'waitFor', 'waitFor', 'click', 'type'],
  D: ['newContext', 'installBoundary', 'newPage', 'goto', 'evaluate', 'goto', 'waitFor', 'waitFor', 'click', 'type'],
};
describe('arm driver (fake browser): exact order, every browser-facing call guarded, cleanup never disabled', () => {
  it('each arm: launch, ONE newContext with only its caller options, guarded boundary, its page sequence, then context and browser closed', async () => {
    for (const arm of SYN_ARMS) {
      const w = fakeWorld();
      const r = await runArm(arm, w.d as never);
      expect(r, arm).toMatchObject({ status: 'DONE', milestone: 'DONE', join: 'SETTLED', context: 'CLOSED', browser: 'CLOSED', primary: null });
      expect(parseSynArm(r.line), arm).toMatchObject({ arm, status: 'DONE', exit: 'SHAPE CODE_0 FIRST_SEEN GATE_POST BODY_END_PAGE OPEN' });
      expect(w.counts().contexts).toBe(1);
      expect(w.calls, arm).toEqual(CALLS[arm]);
      const last = arm === 'C' ? 'page1' : 'page0';
      expect(w.log, arm).toEqual(['launch', `newContext ${JSON.stringify(armCallerOptions(arm, DUMMY))}`, 'timeout 30000', 'navTimeout 30000', 'boundary', ...EXPECTED[arm],
        `${last}.visible #t visible`, `${last}.visible #b visible`, `${last}.click #b`, `${last}.type abc`, 'context.close', 'browser.close', 'wb.close']);
    }
  });
  it('fault at each milestone: FAILED with the last milestone reached and the first failure primary; contexts and browser still closed', async () => {
    const cases: [string, string, string][] = [
      ['A', 'boundary', 'NONE'], ['A', 'newPage#0', 'CONTEXT'], ['C', 'page0.close:start', 'CONTEXT'], ['D', 'page0.setItem', 'CONTEXT'],
      ['A', 'page0.goto /doc', 'PRELIM'], ['B', 'page0.visible #b visible', 'FINAL_GOTO'], ['A', 'page0.type abc', 'VISIBLE'],
    ];
    for (const [arm, fail, m] of cases) {
      const w = fakeWorld({ fail });
      const r = await runArm(arm, w.d as never);
      expect(r, `${arm} ${fail}`).toMatchObject({ status: 'FAILED', milestone: m, primary: 'FAKE_FAIL', context: 'CLOSED', browser: 'CLOSED', join: 'SETTLED' });
      expect(w.log.includes('context.close'), `${arm} ${fail}`).toBe(true);
      expect(w.log.at(-1)).toBe('wb.close');
      expect(parseSynArm(r.line)).not.toBeNull();
    }
    // body complete, context close failed: FAILED with M DONE and CONTEXT ERROR (cleanup uncertainty never folded into success)
    expect(await runArm('A', fakeWorld({ fail: 'context.close' }).d as never)).toMatchObject({ status: 'FAILED', milestone: 'DONE', context: 'ERROR', primary: null });
    expect(await runArm('A', fakeWorld({ violations: ['blocked http://x'] }).d as never)).toMatchObject({ status: 'FAILED', milestone: 'TYPED', primary: 'SYN_E_BOUNDARY' });
    // no owned-browser state (launch refused before it existed) and an exit never observed are never DONE
    expect(await runArm('A', fakeWorld({ noState: true }).d as never)).toMatchObject({ status: 'FAILED', exit: 'UNKNOWN' });
    expect(await runArm('A', fakeWorld({ exit: 'NONE' }).d as never)).toMatchObject({ status: 'FAILED' });
  });
  it('late settlement: a newContext released AFTER the bound is retained and closed; zero later browser-facing calls; JOIN SETTLED', async () => {
    const h = deferred();
    const w = fakeWorld({ hold: { newContext: h } });
    const p = runArm('A', w.d as never);
    await sleep(100);
    h.release();
    const r = await p;
    expect(w.calls).toEqual(['newContext']);
    expect(r).toMatchObject({ status: 'FAILED', milestone: 'NONE', join: 'SETTLED', primary: 'SYN_E_ARM_TIMEOUT', context: 'CLOSED' });
    expect(w.log.filter((x) => x === 'context.close')).toHaveLength(1);
    expect(w.log.indexOf('newContext:released')).toBeLessThan(w.log.indexOf('context.close'));
  });
  it('late settlement: a goto released after the bound produces no waitFor, click or type; never DONE', async () => {
    const h = deferred();
    const w = fakeWorld({ hold: { 'page0.goto /doc': h } });
    const p = runArm('A', w.d as never);
    await sleep(100);
    h.release();
    const r = await p;
    expect(w.calls).toEqual(['newContext', 'installBoundary', 'newPage', 'goto']);
    expect(r).toMatchObject({ status: 'FAILED', milestone: 'PRELIM', join: 'SETTLED', context: 'CLOSED', browser: 'CLOSED' });
  });
  it('delayed boundary installation: released after the bound, no page is ever opened; the context is still closed', async () => {
    const h = deferred();
    const w = fakeWorld({ hold: { boundary: h } });
    const p = runArm('B', w.d as never);
    await sleep(100);
    h.release();
    const r = await p;
    expect(w.calls).toEqual(['newContext', 'installBoundary']);
    expect(w.log.some((x) => x.startsWith('newPage'))).toBe(false);
    expect(r).toMatchObject({ status: 'FAILED', milestone: 'NONE', join: 'SETTLED', context: 'CLOSED' });
  });
  it('a step that never settles: JOIN UNRESOLVED is recorded, cancellation does not disable cleanup (context and browser closed)', async () => {
    const w = fakeWorld({ hold: { 'page0.goto /doc': deferred() } });
    const r = await runArm('D', w.d as never);
    expect(r).toMatchObject({ status: 'FAILED', join: 'UNRESOLVED', context: 'CLOSED', browser: 'CLOSED', primary: 'SYN_E_ARM_TIMEOUT' });
    expect(w.log).toEqual(expect.arrayContaining(['context.close', 'browser.close']));
  });
  it('late browser resolution: a browser handed over AFTER the outer bound gets no call but close; JOIN SETTLED or UNRESOLVED as it lands', async () => {
    const w = fakeWorld({ browserDelayMs: 150, ms: { outerMs: 80, joinMs: 400 } });
    const r = await runArm('A', w.d as never);
    expect(w.calls).toEqual([]);
    expect(w.log).toContain('browser.close');
    expect(r).toMatchObject({ status: 'FAILED', join: 'SETTLED', primary: 'SYN_E_ARM_OUTER_TIMEOUT', milestone: 'NONE' });
    const x = fakeWorld({ browserDelayMs: 300, ms: { outerMs: 50, joinMs: 50 } });
    expect(await runArm('A', x.d as never)).toMatchObject({ status: 'FAILED', join: 'UNRESOLVED' });
    await sleep(300);
    expect(x.calls).toEqual([]); // still nothing but close once it finally arrives
    expect(x.log).toContain('browser.close');
  });
  it('settleWithin: its own timer; a sync throw is ERROR; a late rejection is absorbed', async () => {
    expect(await settleWithin(Promise.resolve(1), 50)).toEqual({ state: 'OK', value: 1 });
    expect((await settleWithin(() => { throw new Error('X'); }, 50)).state).toBe('ERROR');
    expect(await settleWithin(new Promise(() => {}), 10)).toEqual({ state: 'TIMEOUT' });
    let rej!: (e: unknown) => void;
    const late = new Promise((_, j) => { rej = j; });
    expect(await settleWithin(late, 10)).toEqual({ state: 'TIMEOUT' });
    rej(new Error('late'));
    await tick();
  });
});

/** A fake node:http whose server.close behaves as told; `conn` hands a socket to the connection handler. */
function fakeHttp(mode: 'ok' | 'hang' | 'error' | 'tracked') {
  const h: Obj = {};
  h.createServer = () => {
    const s: Obj = { listening: true };
    s.on = (ev: string, fn: (x: unknown) => void) => { if (ev === 'connection') h.onConn = fn; return s; };
    s.once = () => s; s.off = () => s;
    s.listen = (_p: number, _h: string, cb: () => void) => { cb(); return s; };
    s.address = () => ({ port: 40123 });
    s.close = (cb: (e?: Error) => void) => { s.listening = false; if (mode === 'hang') return; if (mode === 'error') cb(new Error('x')); else cb(); };
    return s;
  };
  h.conn = () => { const sock: Obj = { on: () => sock, destroy: () => {} }; h.onConn(sock); };
  return h;
}
describe('per-container dummy and proxy: tri-state closes from their own completion, primary failure preserved', () => {
  const run = async (o: { dummy?: 'ok' | 'hang' | 'error' | 'tracked'; proxyHangs?: boolean; proxyFails?: boolean; fw?: FW; dummyStartFails?: boolean } = {}) => {
    const w = fakeWorld(o.fw);
    const http = fakeHttp(o.dummy ?? 'ok');
    const r = await runContainerArm('A', {
      startDummy: async () => { if (o.dummyStartFails) throw new Error('SYN_E_DUMMY_LISTEN'); const s = await startDummyServer(http, 60); if (o.dummy === 'tracked') http.conn(); return s; },
      allowedOrigins, installBoundary: w.d.installBoundary,
      startProxy: async (allowed: Set<string>) => { expect([...allowed].sort()).toEqual(['http://127.0.0.1:40123', 'ws://127.0.0.1:40123']); return { url: 'http://127.0.0.1:5000', close: () => (o.proxyHangs ? new Promise(() => {}) : o.proxyFails ? Promise.reject(new Error('x')) : Promise.resolve()) }; },
      withBrowser: (proxyUrl: string) => { expect(proxyUrl).toBe('http://127.0.0.1:5000'); return w.d.withBrowser; },
      timeoutMs: 60, joinMs: 200, closeMs: 60, outerMs: 2000,
    } as never);
    expect(parseSynArm(r.armLine)).not.toBeNull();
    expect(parseSynCleanup(r.cleanupLine)).not.toBeNull();
    return r;
  };
  it('all closes proven: DONE with the clean cleanup body', async () => {
    expect(await run()).toEqual({ armLine: armBody('A'), cleanupLine: CLEAN, primary: null, done: true });
  });
  it('dummy close never calls back: TIMEOUT; calls back with an error: ERROR; a socket still tracked: ERROR; proxy never resolves: TIMEOUT', async () => {
    const cases: [Obj, string][] = [[{ dummy: 'hang' }, 'DUMMY TIMEOUT'], [{ dummy: 'error' }, 'DUMMY ERROR'], [{ dummy: 'tracked' }, 'DUMMY ERROR'], [{ proxyHangs: true }, 'PROXY TIMEOUT'], [{ proxyFails: true }, 'PROXY ERROR']];
    for (const [o, frag] of cases) {
      const r = await run(o);
      expect(r.cleanupLine, frag).toContain(frag);
      expect(r, frag).toMatchObject({ done: false, primary: 'SYN_E_CLEANUP' });
      expect(parseSynArm(r.armLine)).toMatchObject({ status: 'FAILED', milestone: 'DONE' });
    }
  });
  it('a body failure stays primary while a cleanup failure is recorded alongside it; a failed dummy start never launches', async () => {
    const r = await run({ dummy: 'hang', fw: { fail: 'page0.goto /doc' } });
    expect(r.primary).toBe('FAKE_FAIL');
    expect(r.cleanupLine).toBe('CLEANUP JOIN SETTLED CONTEXT CLOSED BROWSER CLOSED DUMMY TIMEOUT PROXY CLOSED');
    const s = await run({ dummyStartFails: true });
    expect(s).toEqual({ armLine: 'ARM A STATUS FAILED M NONE BROWSER_EXIT_OBSERVED NOT_RUN BROWSER_LOG NOT_RUN', cleanupLine: 'CLEANUP JOIN SETTLED CONTEXT NONE BROWSER NONE DUMMY NONE PROXY NONE', primary: 'SYN_E_DUMMY_LISTEN', done: false });
    expect((await runContainerArm('E', {} as never)).primary).toBe('SYN_E_ARM_SELECT');
  });
  it('bounds nest: body < outer; outer + dummy and proxy closes <= test backstop < in-lane child bound < container wait', () => {
    expect([ARM_TIMEOUT_MS, JOIN_MS, ARM_OUTER_MS, SYN_TEST_TIMEOUT_MS]).toEqual([120_000, 15_000, 265_000, 300_000]);
    expect(ARM_OUTER_MS).toBe(60_000 + 15_000 + 15_000 + ARM_TIMEOUT_MS + 10_000 + 10_000 + JOIN_MS + 10_000 + 10_000);
    expect(ARM_OUTER_MS + 2 * 10_000).toBeLessThanOrEqual(SYN_TEST_TIMEOUT_MS);
    expect(read('scripts/e2e/le-lane/lane-entry.mjs')).toContain('export const SYN_PW_TIMEOUT_MS = 330_000;');
    expect(read('scripts/e2e/le-lane/run-lane.mjs')).toContain('export const SYN_ARM_WAIT_MS = 400_000;');
    expect(read('scripts/e2e/le-lane/run-lane.mjs')).not.toMatch(/SYN_WAIT_MS\b|1_200_000/);
  });
  it('static: the spec runs exactly its container\'s arm, with its own dummy and proxy; no matrix loop in-container', () => {
    const spec = read('e2e/lesson-editor/lifecycle-matrix.spec.ts');
    expect(spec.match(/startEgressProxy\(/g)).toHaveLength(1);
    expect(spec).toContain('startDummy: () => startDummyServer(http),');
    expect(spec).toContain('startProxy: (allowed: Set<string>) => startEgressProxy(allowed),');
    expect(spec).toContain('const r = await runContainerArm(arm, {');
    expect(spec).toContain("if (!['A', 'B', 'C', 'D'].includes(process.env.LE_SYN_ARM ?? '')) throw new Error('lifecycle matrix refused: LE_SYN_ARM');");
    expect(spec).not.toMatch(/runMatrix|for \(const arm/);
    for (const arm of SYN_ARMS) expect(Object.prototype.hasOwnProperty.call(armCallerOptions(arm, DUMMY), 'proxy'), arm).toBe(false);
    expect(serverOptions({ shell: SHELL, proxyUrl: 'http://127.0.0.1:5000' }).proxy).toEqual({ server: 'http://127.0.0.1:5000', bypass: '<-loopback>' });
    const mx = read('e2e/lesson-editor/lifecycle-matrix.mjs');
    const body = mx.slice(mx.indexOf('const body = async (browser) => {'), mx.indexOf('const use = async (browser) => {'));
    // every browser-facing await in the body is inside guard(); setDefault* are local settings
    const awaits = body.split('\n').filter((l) => /\bawait\b/.test(l));
    expect(awaits.length).toBeGreaterThan(10);
    for (const l of awaits) expect(l, l).toMatch(/await guard\('/);
  });
  it('dummy server handler: exactly /blank and /doc, fixed bodies, no script; everything else 404 (handler only; no listener)', () => {
    const call = (method: string, url: string) => { const r: Obj = { head: null, body: undefined }; dummyHandler({ method, url }, { writeHead: (s: number, hd: Obj) => { r.head = [s, hd]; }, end: (b?: string) => { r.body = b; } }); return r; };
    expect(call('GET', '/blank')).toMatchObject({ head: [200, expect.anything()], body: '<html></html>' });
    expect(call('GET', '/doc').body).toBe(DUMMY_BODIES['/doc']);
    for (const b of Object.values(DUMMY_BODIES)) expect(b).not.toMatch(/<script|\son[a-z]+=|javascript:/i);
    for (const [m, u] of [['GET', '/'], ['GET', '/doc?x'], ['GET', '/blank/'], ['POST', '/doc'], ['GET', '/favicon.ico'], ['GET', '//doc']]) expect(call(m, u).head[0], `${m} ${u}`).toBe(404);
  });
});
// ---------------------------------------------------------------------------------------------------------------------
const lane = (body: string[]) => `${body.map((l) => `LANE SYN ${l}`).join('\n')}\n`;
const RAN = (arm: string, o: { result?: string; pw?: string; report?: string; armText?: string; cleanup?: string } = {}) => lane(['START', 'NOT_ACCEPTANCE', 'APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'RAN',
  `RESULT ${o.result ?? 'CLOSE_WITH_CODE'}`, `PW_CODE ${o.pw ?? '0'}`, `REPORT ${o.report ?? 'PARSED'}`, o.armText ?? armBody(arm), o.cleanup ?? CLEAN, 'END']);
const V_ABSENT = { ok: true, container: 'LANE_ABSENT', bridge: 'BRIDGE_NOT_STARTED', clients: 'REAPED', started: 'YES', source: 'RECEIPT' };
const ROOT_OK = { ok: true, container: 'LANE_ABSENT', source: 'RECEIPT' };
describe('finding 5: verdicts are derived on the host, never trusted; contradictory PASS records are refused or not PASS', () => {
  it('a coherent DONE record, a proven-absent container and LANE_EXIT_ZERO: DONE; four of them and an ok root: PASS', () => {
    const a = SYN_ARMS.map((arm) => synArmResult({ arm, verdict: V_ABSENT, laneText: RAN(arm), exit: 'ZERO' }));
    expect(a.map((x: Obj) => x.result)).toEqual(['DONE', 'DONE', 'DONE', 'DONE']);
    expect(synMatrix({ rootVerdict: ROOT_OK, arms: a })).toBe('PASS');
    expect(synMatrix({ rootVerdict: { ok: false }, arms: a })).toBe('UNRESOLVED');
    expect(synMatrix({ rootVerdict: ROOT_OK, arms: [a[1], a[0], a[2], a[3]] })).toBe('UNRESOLVED');
    expect(synMatrix({ rootVerdict: ROOT_OK, arms: a.slice(0, 3) })).toBe('UNRESOLVED');
  });
  it('each inconsistent record is refused (or UNRESOLVED), never DONE', () => {
    const cases: [string, Obj][] = [
      ['an in-container MATRIX line', { laneText: RAN('A').replace('LANE SYN END\n', 'LANE SYN MATRIX PASS\nLANE SYN END\n') }],
      ['DONE with RESULT NO_CODE', { laneText: RAN('A', { result: 'NO_CODE', pw: 'NONE' }) }],
      ['CLOSE_WITH_CODE without a numeric code', { laneText: RAN('A', { pw: 'NONE' }) }],
      ['DONE with REPORT INVALID', { laneText: RAN('A', { report: 'INVALID' }) }],
      ['DONE with M TYPED', { laneText: RAN('A', { armText: armBody('A', 'DONE', 'TYPED') }) }],
      ['DONE with CLEANUP DUMMY TIMEOUT', { laneText: RAN('A', { cleanup: CLEAN.replace('DUMMY CLOSED', 'DUMMY TIMEOUT') }) }],
      ['DONE with JOIN UNRESOLVED', { laneText: RAN('A', { cleanup: CLEAN.replace('JOIN SETTLED', 'JOIN UNRESOLVED') }) }],
      ['DONE with no observed exit', { laneText: RAN('A', { armText: armBody('A').replace('SHAPE CODE_0 FIRST_SEEN GATE_POST', 'SHAPE NONE FIRST_SEEN NOT_SEEN') }) }],
      ['DONE with a nonzero Playwright code', { laneText: RAN('A', { pw: '1' }) }],
      ['FAILED with a zero Playwright code', { laneText: RAN('A', { armText: armBody('A', 'FAILED', 'TYPED') }) }],
      ['DONE with CONTAINER UNRESOLVED', { verdict: { ...V_ABSENT, ok: false, container: 'UNRESOLVED' } }],
      ['DONE whose container exit is not zero', { exit: 'NONZERO' }],
      ['DONE with no container exit receipt', { exit: 'NONE' }],
      ['a missing arm record', { laneText: null }],
      ['an arm record from the wrong arm', { laneText: RAN('B') }],
      ['a truncated record', { laneText: RAN('A').replace('LANE SYN END\n', '') }],
      ['an E1 lane.txt', { laneText: 'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE CLEANUP PASS\nLANE END\n' }],
      ['a precheck refusal with a zero container exit', { laneText: lane(['START', 'NOT_ACCEPTANCE', 'APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'NOT RUN LANE_E_ENV', 'END']) }],
    ];
    for (const [name, o] of cases) {
      const r = synArmResult({ arm: 'A', verdict: V_ABSENT, laneText: RAN('A'), exit: 'ZERO', ...o });
      expect(r.result, name).toBe('UNRESOLVED');
      const arms = [r, ...['B', 'C', 'D'].map((arm) => synArmResult({ arm, verdict: V_ABSENT, laneText: RAN(arm), exit: 'ZERO' }))];
      expect(synMatrix({ rootVerdict: ROOT_OK, arms }), name).toBe('UNRESOLVED');
      expect(synSummaryLines({ rootVerdict: ROOT_OK, arms }).ok, name).toBe(false);
    }
  });
  it('honest failures are FAIL, not UNRESOLVED: a FAILED record with a nonzero code and exit, a precheck refusal, a never-started container', () => {
    const failed = RAN('A', { pw: '1', armText: armBody('A', 'FAILED', 'TYPED'), cleanup: CLEAN.replace('PROXY CLOSED', 'PROXY TIMEOUT') });
    expect(synArmResult({ arm: 'A', verdict: V_ABSENT, laneText: failed, exit: 'NONZERO' }).result).toBe('FAILED');
    expect(synArmResult({ arm: 'A', verdict: V_ABSENT, laneText: lane(['START', 'NOT_ACCEPTANCE', 'APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'NOT RUN LANE_E_ENV', 'END']), exit: 'NONZERO' }))
      .toMatchObject({ result: 'FAILED', record: 'NOT_RUN_LANE_E_ENV' });
    expect(synArmResult({ arm: 'A', verdict: { ...V_ABSENT, started: 'NO' }, laneText: null, exit: 'NONE' }).result).toBe('FAILED');
    expect(synArmResult({ arm: 'A', verdict: { ...V_ABSENT, started: 'NO' }, laneText: RAN('A'), exit: 'NONE' }).result).toBe('UNRESOLVED');
    expect(synArmResult({ arm: 'A', verdict: laneVerdict({ runLaneStarted: false, gatesText: null }), laneText: null, exit: 'NONE' })).toMatchObject({ result: 'NOT_RUN', container: 'NOT_RUN' });
    expect(synArmResult({ arm: 'A', verdict: laneVerdict({ runLaneStarted: false, gatesText: null }), laneText: RAN('A'), exit: 'NONE' }).result).toBe('UNRESOLVED');
  });
  it('grammar: unknown bodies only with an unparsed report; a parsed report needs known bodies; bodies are closed', () => {
    expect(parseSynOut(RAN('A', { report: 'MISSING', pw: '1', armText: unknownArm('A'), cleanup: UNKNOWN_CLEANUP }))).toMatchObject({ ok: true, interrupted: false });
    expect(parseSynOut(RAN('A', { report: 'PARSED', pw: '1', armText: unknownArm('A'), cleanup: UNKNOWN_CLEANUP }))).toMatchObject({ ok: true, arm: { status: 'UNKNOWN' } });
    expect(parseSynOut(RAN('A', { report: 'PARSED', pw: '1', armText: unknownArm('A'), cleanup: CLEAN }))).toEqual({ ok: false });
    expect(parseSynOut(RAN('A', { report: 'PARSED', pw: '1', armText: armBody('A', 'FAILED', 'TYPED'), cleanup: UNKNOWN_CLEANUP }))).toEqual({ ok: false });
    expect(parseSynOut(RAN('A', { report: 'MISSING', pw: '1', armText: unknownArm('A'), cleanup: CLEAN }))).toEqual({ ok: false });
    expect(parseSynArm('ARM A STATUS UNKNOWN M DONE BROWSER_EXIT_OBSERVED UNKNOWN BROWSER_LOG UNKNOWN')).toBeNull();
    expect(parseSynArm('ARM A STATUS NOT_RUN M NONE BROWSER_EXIT_OBSERVED NOT_RUN BROWSER_LOG NOT_RUN')).toBeNull();
    expect(parseSynArm('ARM A STATUS DONE M DONE REAP PROVEN BROWSER_EXIT SHAPE CODE_0 FIRST_SEEN GATE_POST BODY_END_PAGE OPEN BROWSER_LOG NO_MATCH')).toBeNull();
    expect(parseSynCleanup('CLEANUP JOIN SETTLED CONTEXT CLOSED BROWSER CLOSED DUMMY CLOSED PROXY UNKNOWN')).toBeNull();
    expect(parseSynCleanup('CLEANUP JOIN DONE CONTEXT CLOSED BROWSER CLOSED DUMMY CLOSED PROXY CLOSED')).toBeNull();
  });
  it('in-lane report reading: exactly one `one arm` test, retry 0, one valid arm body for THIS arm and one known cleanup body', () => {
    const ok = synReport([['syn-arm', armBody('C')], ['syn-cleanup', CLEAN]]);
    expect(synArmFromReport({ status: 'ok', text: ok }, 'C')).toEqual({ report: 'PARSED', arm: armBody('C'), cleanup: CLEAN });
    const unknown = (report: string) => ({ report, arm: unknownArm('C'), cleanup: UNKNOWN_CLEANUP });
    expect(synArmFromReport({ status: 'missing' }, 'C')).toEqual(unknown('MISSING'));
    expect(synArmFromReport({ status: 'ok', text: '{x' }, 'C')).toEqual(unknown('INVALID'));
    for (const t of [synReport([['syn-arm', armBody('B')], ['syn-cleanup', CLEAN]]), synReport([['syn-arm', armBody('C')]]), synReport([['syn-arm', armBody('C')], ['syn-arm', armBody('C')], ['syn-cleanup', CLEAN]]),
      synReport([['syn-arm', armBody('C')], ['syn-cleanup', CLEAN]], { retry: 1 }), synReport([['syn-arm', armBody('C')], ['syn-cleanup', CLEAN]], { title: 'arms A to D' }),
      synReport([['syn-arm', armBody('C')], ['syn-cleanup', CLEAN]], { tests: 2 }), synReport([['syn-arm', unknownArm('C')], ['syn-cleanup', UNKNOWN_CLEANUP]])]) {
      expect(synArmFromReport({ status: 'ok', text: t }, 'C')).toEqual(unknown('PARSED'));
    }
  });
  it('in-lane exit: 0 only for a coherent DONE of this arm with PW_CODE 0; a nonzero Playwright code or a report without the arm is 1', async () => {
    const w = world({ pw: (arm) => (arm === 'A' ? { code: 1, report: synReport([['syn-arm', armBody('A', 'FAILED', 'TYPED')], ['syn-cleanup', CLEAN]]) }
      : arm === 'B' ? { code: 0, report: null } : arm === 'C' ? { code: 0, report: synReport([['syn-arm', armBody('C')], ['syn-cleanup', CLEAN.replace('PROXY CLOSED', 'PROXY ERROR')]]) } : goodPw(arm)) });
    await w.go();
    expect(Object.fromEntries(SYN_ARMS.map((a) => [a, w.lanes[a].code]))).toEqual({ A: 1, B: 1, C: 1, D: 0 });
    const res = synResults(w.f, ROOTL);
    expect(res.arms.map((a: Obj) => `${a.arm} ${a.result} ${a.record}`)).toEqual(['A FAILED OK', 'B UNRESOLVED OK', 'C UNRESOLVED REFUSED', 'D DONE OK']);
    expect(synMatrix(res)).toBe('UNRESOLVED');
  });
  it('static: the in-container supervisor writes no matrix line, and the old REAP field is gone from every synthetic source', () => {
    const le = read('scripts/e2e/le-lane/lane-entry.mjs');
    const syn = le.slice(le.indexOf('// SYNTHETIC target (lifecycle matrix'), le.indexOf('/** psql through a private passfile'));
    expect(syn).not.toMatch(/MATRIX|synMatrix/);
    expect(syn.indexOf('if (!synDirsOk(d.fs, L, d.uid())) return { code: 1, lines: [\'LANE_E_DIRS\'] };')).toBeLessThan(syn.indexOf('fd = d.openExcl(L.laneTxt)'));
    for (const f of ['scripts/e2e/le-lane/contract.mjs', 'scripts/e2e/le-lane/lane-entry.mjs', 'e2e/lesson-editor/lifecycle-matrix.mjs', 'e2e/lesson-editor/lifecycle-matrix.spec.ts', 'scripts/e2e/le-lane/synthetic.mjs']) {
      const t = read(f);
      expect(t, f).not.toMatch(/REAP (PROVEN|UNPROVEN)|SYN_REAPS|reap === 'PROVEN'/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('acceptance isolation: synthetic output can never reach an E1 summary or acceptance', () => {
  const E1_OK = 'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE CLEANUP PASS\nLANE END\n';
  it('parseLaneOut refuses any text holding a LANE SYN line, wherever it is; planSummary refuses it as LANE_OUT', () => {
    expect(parseLaneOut(E1_OK).ok).toBe(true);
    const ls = E1_OK.slice(0, -1).split('\n');
    for (let i = 0; i <= ls.length; i++) {
      const t = [...ls.slice(0, i), 'LANE SYN RAN', ...ls.slice(i)].join('\n') + '\n';
      expect(parseLaneOut(t), String(i)).toEqual({ ok: false });
      expect(planSummary({ verdict: { ok: true, started: 'YES' }, laneText: t, pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_LANE_OUT' });
    }
    expect(parseLaneOut(RAN('A'))).toEqual({ ok: false });
  });
  it('the synthetic grammar refuses E1 text, and its summary never prints an LE-E1 line', () => {
    expect(parseSynOut(E1_OK)).toEqual({ ok: false });
    const arms = SYN_ARMS.map((arm) => synArmResult({ arm, verdict: V_ABSENT, laneText: RAN(arm), exit: 'ZERO' }));
    for (const rootVerdict of [ROOT_OK, { ok: false }]) {
      const s = synSummaryLines({ rootVerdict, arms });
      expect(s.lines[0]).toBe('LE-SYN NOT_ACCEPTANCE synthetic lifecycle matrix; never E1 evidence');
      expect(s.lines.every((l: string) => l.startsWith('LE-SYN '))).toBe(true);
      expect(s.lines.join('\n')).not.toMatch(/LE-E1|ACCEPTED/);
    }
    for (const f of ['scripts/e2e/le-lane/synthetic.mjs', 'e2e/lesson-editor/lifecycle-matrix.mjs', 'e2e/lesson-editor/lifecycle-matrix.spec.ts']) expect(read(f), f).not.toMatch(/LE-E1 ACCEPTED/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('workflow: the synthetic job exists alone, with no authentic step; cleanup goes through the recorded ownership', () => {
  const W = read('.github/workflows/e2e.yml');
  const DOC = YAML.parse(W) as Obj;
  const J = DOC.jobs['lesson-editor-syn'];
  const steps = J.steps as Obj[];
  const runs = steps.map((s) => String(s.run ?? ''));
  const by = (id: string) => steps.find((s) => s.id === id)!;
  it('own dispatch option, read-only permissions, LE_TARGET=SYNTHETIC, no secret, environment, upload or retry', () => {
    expect(DOC.on.workflow_dispatch.inputs.specs.options.at(-1)).toBe('lesson-editor-syn');
    expect(J.if).toBe("inputs.specs == 'lesson-editor-syn'");
    expect(J.permissions).toEqual({ contents: 'read' });
    expect(J.environment).toBeUndefined();
    expect(J.env).toEqual({ CI: 'true', LE_TARGET: 'SYNTHETIC' });
    expect(J['timeout-minutes']).toBe(45);
    expect(W.slice(W.indexOf('\n  lesson-editor-syn:'))).not.toMatch(/secrets\.|upload-artifact|continue-on-error|E2E_[A-Z_]*PASSWORD/);
  });
  it('zero authentic steps; exactly one matrix run; selection before any install script, browser, image or lane step', () => {
    const all = runs.join('\n');
    expect(all).not.toMatch(/supabase|stack-net|bootstrap\.sh|apply-reviewed|stage-pre|verify-identities|stack-ownership|gb-job-psql|pairing-producer|export-status|lesson-editor\/run\.sh|owned-proc|vite|served-app|avatar|hermetic|psql|dbpass|keys|state-|LE_PRIV|le-private|le-priv\b/);
    expect(all.match(/le-lane\/run-lane\.mjs --synthetic /g)).toHaveLength(1);
    const names = steps.map((s) => String(s.name ?? s.uses));
    const sel = names.findIndex((n) => n.startsWith('Synthetic target selection'));
    expect(runs[sel]).toBe('node scripts/e2e/le-lane/synthetic.mjs select');
    for (const later of ['npm rebuild', 'Early runner preflight', 'Install Chromium', 'Pin the headless shell', 'Build and check the lane image', 'Synthetic matrix, once']) {
      expect(names.findIndex((n) => n.startsWith(later)), later).toBeGreaterThan(sel);
    }
  });
  it('finding 2: no bash removal of the synthetic parent; the owned cleanup always runs; controls only go when ALL cleanups are proven', () => {
    const C0 = '"$RUNNER_TEMP/syn-lane-ctl"', P0 = '"$RUNNER_TEMP/syn-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"';
    expect(by('syn_gates').run).toContain(`gates.mjs verify ${C0} ${P0} "$GITHUB_WORKSPACE"`);
    expect(by('syn_cleanup').if).toBe('always()');
    expect(by('syn_cleanup').run).toBe(`node scripts/e2e/le-lane/synthetic.mjs cleanup ${C0} ${P0} "$GITHUB_WORKSPACE"`);
    const ix = (id: string) => steps.findIndex((s) => s.id === id);
    expect(ix('syn_cleanup')).toBeGreaterThan(ix('syn_image_cleanup'));
    const last = steps.at(-1)!;
    expect(last.if).toBe('always()');
    expect(last.env).toEqual({ O_GATES: '${{ steps.syn_gates.outcome }}', O_IMAGE_CLEANUP: '${{ steps.syn_image_cleanup.outcome }}', O_DIR_CLEANUP: '${{ steps.syn_cleanup.outcome }}' });
    expect(last.run).toContain('if [ "$O_GATES" = success ] && [ "$O_IMAGE_CLEANUP" = success ] && [ "$O_DIR_CLEANUP" = success ]; then');
    const body = W.slice(W.indexOf('\n  lesson-editor-syn:'));
    expect(body).not.toMatch(/rm -rf -- "\$P"|syn-\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT"\s*(\||;|&&)?\s*$/m);
    expect(body.match(/rm -rf/g)).toHaveLength(1); // the control dir only, under the three-way condition
    expect(last.run).not.toMatch(/le-private|le-lane-ctl|test-results|playwright-report|syn-\$GITHUB_RUN_ID/);
  });
});
