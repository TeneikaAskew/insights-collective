// ABOUTME: Fake and static controls for the SYNTHETIC lifecycle matrix (DESIGN-r2 with r2.1 and r2.2; LOCAL candidate, unrun).
// ABOUTME: No browser, Docker, listener, network or real filesystem write: every runtime piece is an in-memory recorder.
//
// What these controls can and cannot show: they exercise the selection, contract, directory, grammar, merge and arm-ordering
// code with fakes, and read workflow and source text. They prove nothing about Chromium, the container, or E1.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
  ENV_KEYS, LE_TARGETS, SYN_ARMS, SYN_ENV_KEYS, SYN_FORBIDDEN_ENV, expectedLaneConfig, laneCreateArgs, laneEnv, lanePaths, laneTarget,
  notRunArm, parseLaneOut, parseSynArm, parseSynOut, planSummary, selectLine, synBinds, synEnv, synLanePaths, synMatrix, synParent,
  synSummaryLines, unknownArm, IMAGE_PATH_ENV, LANE_NODE, compareLaneInspect,
} from '../../../scripts/e2e/le-lane/contract.mjs';
import { createSynDirs, runLane } from '../../../scripts/e2e/le-lane/run-lane.mjs';
import { laneMain, synArmsFromReport, synDirsOk, synEnvProblems } from '../../../scripts/e2e/le-lane/lane-entry.mjs';
import { SECCOMP_PROFILE_REL } from '../../../scripts/e2e/le-iso/expect.mjs';
import { allowedOrigins } from '../../../e2e/lesson-editor/egress-boundary';
import { RESOLVER_ARG, serverOptions } from '../../../e2e/lesson-editor/sandbox-launch.mjs';
import {
  ARM_TIMEOUT_MS, DESKTOP_CHROME_UA, DUMMY_BODIES, SYN_CONTEXT_TABLE, SYN_USE, armCallerOptions, combinedContextOptions, dummyHandler, effectiveArmOptions,
  mergeDefaults, runArm, runMatrix,
} from '../../../e2e/lesson-editor/lifecycle-matrix.mjs';

type Obj = Record<string, any>;
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const sha = (o: unknown) => createHash('sha256').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex');

const T = '/rt', RUN = '41900000000', ATT = '1', C = '/rt/syn-lane-ctl', R = '/w/repo';
const SL = synLanePaths(T, RUN, ATT, C, R);
const NODE = '/n/bin/node', SHELL = '/s/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const COMMIT = 'a'.repeat(40), IMG = `sha256:${'b'.repeat(64)}`, CIDV = 'c'.repeat(64), UID = 1001, GID = 118;
const SENV = synEnv(SL, { commit: COMMIT, shell: SHELL });
const DUMMY = 'http://127.0.0.1:40123';

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
describe('synthetic container contract: three binds and a closed env, refused before create', () => {
  it('synthetic paths come from runner temp, run id and attempt ONLY; E1 path variables change nothing', () => {
    expect(synParent(T, RUN, ATT)).toBe(`/rt/syn-${RUN}-${ATT}`);
    expect(SL.lane).toBe(`/rt/syn-${RUN}-${ATT}/lane`);
    const before = JSON.stringify(SL);
    const saved = { ...process.env };
    Object.assign(process.env, { LE_PRIV: '/rt/le-private', LE_LANE_DIR: '/rt/le-private/lane', RUNNER_TEMP: '/elsewhere' });
    try { expect(JSON.stringify(synLanePaths(T, RUN, ATT, C, R))).toBe(before); } finally { for (const k of ['LE_PRIV', 'LE_LANE_DIR', 'RUNNER_TEMP']) { if (k in saved) process.env[k] = saved[k]; else delete process.env[k]; } }
    for (const [t, r, a] of [['rt', RUN, ATT], ['/rt/', RUN, ATT], [T, '0', ATT], [T, 'x', ATT], [T, RUN, '0'], [T, RUN, '1/..'], ['/r:t', RUN, ATT]]) expect(() => synParent(t, r, a), `${t} ${r} ${a}`).toThrow();
    const src = read('scripts/e2e/le-lane/contract.mjs');
    const fn = src.slice(src.indexOf('export function synParent'), src.indexOf('export function synLanePaths'));
    expect(fn).not.toMatch(/process\.env|le-private|LE_PRIV/);
  });
  it('create argv: exactly [R ro][lane rw][out rw] and the closed -e list in order; nothing authentic anywhere', () => {
    expect(synBinds(SL)).toEqual([[R, false], [SL.lane, true], [SL.out, true]]);
    const a = laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, target: 'SYNTHETIC' });
    expect(a.flatMap((x, i) => (x === '-v' ? [a[i + 1]] : []))).toEqual([`${R}:${R}:ro,rprivate`, `${SL.lane}:${SL.lane}:rw,rprivate`, `${SL.out}:${SL.out}:rw,rprivate`]);
    expect(a.flatMap((x, i) => (x === '-e' ? [a[i + 1].split('=')[0]] : []))).toEqual([...SYN_ENV_KEYS]);
    expect(SYN_ENV_KEYS).toEqual(['HOME', 'TMPDIR', 'CI', 'LE_LANE_DIR', 'LE_OUT_DIR', 'LE_WORK_DIR', 'LE_EVIDENCE_DIR', 'LE_OUTPUT_DIR', 'LE_REPORT_JSON',
      'E2E_EVIDENCE_COMMIT', 'E2E_EVIDENCE_ENVIRONMENT', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', 'LE_TARGET']);
    const text = a.join('\n');
    for (const p of [SL.keys, SL.dbpass, SL.proofDir, SL.sock, SL.pairRaw, 'state-', ...SYN_FORBIDDEN_ENV]) expect(text, p).not.toContain(p);
    expect(SENV).toContain('LE_TARGET=SYNTHETIC');
    expect(SENV).toContain('E2E_EVIDENCE_ENVIRONMENT=synthetic-lifecycle-matrix');
    // the rest of the argv is the E1 hardening, unchanged
    for (const f of ['--network', 'none', '--cap-drop', 'ALL', 'no-new-privileges', '--read-only', '--init', `seccomp=${SL.seccomp}`]) expect(a).toContain(f);
  });
  it('each forbidden env name, an E1 env, and one unexpected extra are refused before create', () => {
    const create = (env: string[]) => () => laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env, target: 'SYNTHETIC' });
    expect(create(SENV)).not.toThrow();
    for (const k of SYN_FORBIDDEN_ENV) {
      expect(create([...SENV.slice(0, -1), `${k}=x`]), k).toThrow(/env/);
      expect(create([...SENV, `${k}=x`]), k).toThrow(/env/);
    }
    expect(create([...SENV, 'EXTRA=1'])).toThrow(/env/);
    const e1 = laneEnv(SL, { apiOrigin: 'http://127.0.0.1:54321', dbUrl: 'postgresql://postgres@127.0.0.1:54322/postgres', commit: COMMIT, shell: SHELL });
    expect(create(e1)).toThrow(/env/);
    // and an E1 create never accepts the synthetic env
    expect(() => laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV })).toThrow(/env/);
  });
  it('inspect expectation: exactly the three binds as Binds and as mounts; a fourth (keys) mount is a Binds/Mounts difference', () => {
    const e = expectedLaneConfig(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, seccompText: readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL), 'utf8'), cid: CIDV, target: 'SYNTHETIC' });
    expect(e.Binds).toEqual([`${R}:${R}:ro,rprivate`, `${SL.lane}:${SL.lane}:rw,rprivate`, `${SL.out}:${SL.out}:rw,rprivate`]);
    expect(e.EffectiveMounts.map((m: Obj) => m.Destination)).toEqual([SL.lane, SL.out, R].sort());
    expect(e.Config.Env).toEqual([IMAGE_PATH_ENV, ...SENV].sort());
    const good = synInspect();
    expect(compareLaneInspect(good, e)).toEqual([]);
    const bad = synInspect();
    bad.HostConfig.Binds = [...bad.HostConfig.Binds, `${SL.keys}:${SL.keys}:ro,rprivate`];
    bad.Mounts = [...bad.Mounts, { Type: 'bind', Source: SL.keys, Destination: SL.keys, RW: false, Propagation: 'rprivate', Mode: 'ro', Name: '' }];
    expect(compareLaneInspect(bad, e).length).toBeGreaterThan(0);
  });
  it('in-lane env check: exact synthetic env passes; a forbidden name, PLAYWRIGHT_TEST_BASE_URL, an extra or a missing LE_TARGET fails', () => {
    const ok = Object.fromEntries([...SENV.map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]), ['PATH', IMAGE_PATH_ENV.slice(5)], ['HOSTNAME', CIDV.slice(0, 12)]]);
    expect(synEnvProblems(ok, R)).toBe(false);
    for (const k of [...SYN_FORBIDDEN_ENV, 'EXTRA']) expect(synEnvProblems({ ...ok, [k]: 'x' }, R), k).toBe(true);
    const { LE_TARGET: _t, ...noTarget } = ok;
    void _t;
    expect(synEnvProblems(noTarget, R)).toBe(true);
    expect(synEnvProblems({ ...ok, LE_TARGET: 'E1' }, R)).toBe(true);
    expect(ENV_KEYS).not.toContain('LE_TARGET'); // the E1 env check therefore refuses any LE_TARGET in an E1 lane
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

function synInspect(): Obj {
  const e = expectedLaneConfig(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, seccompText: readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL), 'utf8'), cid: CIDV, target: 'SYNTHETIC' }) as Obj;
  const { Image, User, EffectiveMounts, Config, ...hc } = e;
  return {
    Id: CIDV, Image,
    Config: { Hostname: CIDV.slice(0, 12), Domainname: '', User, AttachStdin: false, AttachStdout: true, AttachStderr: true, Tty: false, OpenStdin: false,
      StdinOnce: false, Env: [...Config.Env].reverse(), Cmd: Config.Cmd, Image: IMG, Volumes: null, WorkingDir: R, Entrypoint: null, OnBuild: null, Labels: {} },
    HostConfig: { ...hc, Mounts: [] },
    Mounts: [...EffectiveMounts].reverse().map((m: Obj) => ({ ...m, Mode: m.RW ? 'rw' : 'ro', Name: '' })),
    State: { Status: 'exited', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '2026-11-04T01:00:00Z' },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
/** In-memory directory tree: lstat, realpath, mkdir (exclusive, no recursion), readdir. Records every call. */
function dirFs(init: { dirs?: string[]; links?: string[]; modeOf?: (p: string) => number; uidOf?: (p: string) => number; mkdirFails?: string } = {}) {
  const dirs = new Set(['/', ...(init.dirs ?? ['/rt'])]), links = new Set(init.links ?? []);
  const calls: string[] = [];
  const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  const st = (p: string) => ({ isDirectory: () => dirs.has(p) && !links.has(p), isSymbolicLink: () => links.has(p), isFile: () => false, mode: 0o40000 | (init.modeOf?.(p) ?? 0o700), uid: init.uidOf?.(p) ?? UID, nlink: 2 });
  return {
    calls, dirs,
    lstatSync: (p: string) => { calls.push(`lstat ${p}`); if (!dirs.has(p) && !links.has(p)) throw enoent(); return st(p); },
    realpathSync: (p: string) => { calls.push(`realpath ${p}`); return links.has(p) ? '/elsewhere' : p; },
    mkdirSync: (p: string, o: Obj) => {
      calls.push(`mkdir ${p} ${JSON.stringify(o)}`);
      if (p === init.mkdirFails || dirs.has(p) || links.has(p)) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
      if (!dirs.has(path.dirname(p))) throw enoent();
      dirs.add(p);
    },
    readdirSync: (p: string) => [...dirs].filter((d) => d !== p && path.dirname(d) === p).map((d) => path.basename(d)),
  };
}
describe('fresh synthetic-only directories (DESIGN-r2.2 A order)', () => {
  it('lstat ENOENT, ancestors real, then exclusive non-recursive mkdir of parent, lane, out, work, evidence, pw-output, each verified', () => {
    const f = dirFs();
    expect(createSynDirs(f, T, SL, UID)).toBeNull();
    const mk = f.calls.filter((c) => c.startsWith('mkdir'));
    expect(mk).toEqual([SL.P, SL.lane, SL.out, SL.work, SL.evidence, SL.output].map((p) => `mkdir ${p} {"mode":448}`));
    expect(f.calls.indexOf(`lstat ${SL.P}`)).toBeLessThan(f.calls.indexOf('lstat /'));
    expect(f.calls.indexOf('realpath /rt')).toBeLessThan(f.calls.findIndex((c) => c.startsWith('mkdir')));
    expect(f.calls.join('\n')).not.toMatch(/recursive/);
  });
  it('a pre-existing parent is refused at step 2, even one holding authentic names, and nothing is created', () => {
    const f = dirFs({ dirs: ['/rt', SL.P, SL.keys, SL.sock, SL.proofDir, `${SL.P}/pair-raw`] });
    expect(createSynDirs(f, T, SL, UID)).toBe('SYN_E_DIR_EXISTS');
    expect(f.calls.filter((c) => c.startsWith('mkdir'))).toEqual([]);
    const g = dirFs({ dirs: ['/rt'], links: [SL.P] });
    expect(createSynDirs(g, T, SL, UID)).toBe('SYN_E_DIR_EXISTS');
  });
  it('a symlinked or non-canonical ancestor, a missing ancestor, a wrong parent name: refused before any mkdir', () => {
    for (const f of [dirFs({ dirs: [], links: ['/rt'] }), dirFs({ dirs: [] })]) {
      expect(createSynDirs(f, T, SL, UID)).toBe('SYN_E_DIR_ANCESTOR');
      expect(f.calls.some((c) => c.startsWith('mkdir'))).toBe(false);
    }
    const e1 = lanePaths('/rt/le-private', C, R);
    expect(createSynDirs(dirFs(), T, e1, UID)).toBe('SYN_E_DIR_PARENT');
  });
  it('EEXIST during creation, a wrong mode or a foreign owner fails closed', () => {
    expect(createSynDirs(dirFs({ mkdirFails: SL.out }), T, SL, UID)).toBe('SYN_E_DIR_CREATE');
    expect(createSynDirs(dirFs({ modeOf: (p) => (p === SL.P ? 0o755 : 0o700) }), T, SL, UID)).toBe('SYN_E_DIR_VERIFY');
    expect(createSynDirs(dirFs({ uidOf: (p) => (p === SL.work ? 0 : UID) }), T, SL, UID)).toBe('SYN_E_DIR_VERIFY');
  });
  it('in-lane: the mounted dirs are exactly lane/{work,evidence/pw-output} and out/, all empty, 0700, own uid', () => {
    const f = dirFs();
    createSynDirs(f, T, SL, UID);
    expect(synDirsOk(f, SL, UID)).toBe(true);
    f.dirs.add(`${SL.lane}/state-x.json`);
    expect(synDirsOk(f, SL, UID)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
type SO = { dirsTaken?: boolean; waitOut?: string };
function synLaneFake(o: SO = {}) {
  const nodeSha = createHash('sha256').update('node-bytes').digest('hex');
  const files = new Map<string, string | Buffer>([[SL.iid, `${IMG}\n`], [SL.seccomp, readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL))], [SHELL, Buffer.from('shell')],
    [NODE, Buffer.from('node-bytes')], [SL.manifest, `${nodeSha}  ${LANE_NODE}\n`]]);
  const df = dirFs({ dirs: ['/rt', C, ...(o.dirsTaken ? [SL.P] : [])] });
  const calls: string[][] = [];
  let exists = false, state: Obj = { Status: 'created', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '0001-01-01T00:00:00Z' };
  const enoent = () => Object.assign(new Error('x'), { code: 'ENOENT' });
  const fsx = { ...df, readFileSync: (p: string, enc?: string) => { const v = files.get(p); if (v === undefined) throw enoent(); return enc ? v.toString() : v; }, statSync: () => { throw enoent(); } };
  const exec = async (bin: string, args: string[]) => {
    calls.push([bin, ...args]);
    const c = args[0];
    if (c === 'create') { files.set(SL.cidfile, `${CIDV}\n`); exists = true; return { ok: true, stdout: `${CIDV}\n` }; }
    if (c === 'container' && args[1] === 'inspect') { const g = synInspect(); g.State = state; return exists ? { ok: true, stdout: JSON.stringify([g]) } : { ok: false, stdout: '' }; }
    if (c === 'start') { state = { ...state, Status: 'running', Running: true, Pid: 77, StartedAt: '2026-11-04T01:00:00Z' }; return { ok: true, stdout: `${CIDV}\n` }; }
    if (c === 'wait') { state = { ...state, Status: 'exited', Running: false, Pid: 0 }; return { ok: true, stdout: `${o.waitOut ?? '0'}\n` }; }
    if (c === 'stop') return { ok: true, stdout: `${CIDV}\n` };
    if (c === 'rm') { exists = false; return { ok: true, stdout: `${CIDV}\n` }; }
    if (c === 'container' && args[1] === 'ls') return { ok: true, stdout: exists ? `${CIDV}\n` : '' };
    return { ok: false, stdout: '' };
  };
  const put: string[] = [];
  const d = { exec, fs: fsx, uid: () => UID, gid: () => GID, sleep: async () => {}, browserSha256: createHash('sha256').update('shell').digest('hex'),
    files: { put: (p: string, t: string) => { put.push(p); files.set(p, t); } },
    spawnBridge: (...a: unknown[]) => { calls.push(['spawnBridge', ...(a as string[])]); throw new Error('no bridge on the synthetic path'); } };
  return { d, calls, put, df };
}
describe('run-lane SYNTHETIC: fresh dirs, the synthetic create argv, no bridge, the same teardown gates', () => {
  const go = (o: SO = {}) => { const f = synLaneFake(o); return runLane(f.d as never, { target: 'SYNTHETIC', C, T, runId: RUN, attempt: ATT, R, node: NODE, shell: SHELL, commit: COMMIT }).then((r) => ({ ...r, ...f })); };
  it('creates the dirs before the started receipt, creates with the synthetic argv, never spawns a bridge, proves absence', async () => {
    const r = await go();
    expect(r.ok).toBe(true);
    expect(r.calls.some((c) => c[0] === 'spawnBridge')).toBe(false);
    const create = r.calls.find((c) => c[1] === 'create')!;
    expect(create.slice(1)).toEqual(laneCreateArgs(SL, { imageId: IMG, uid: UID, gid: GID, env: SENV, target: 'SYNTHETIC' }));
    expect(r.say).toEqual(expect.arrayContaining(['LANE_CREATE_OK', 'LANE_CONFIG_OK', 'LANE_STARTED', 'LANE_EXIT_ZERO', 'LANE_ABSENT',
      'GATE CONTAINER LANE_ABSENT', 'GATE BRIDGE BRIDGE_NOT_STARTED', 'GATE CLIENTS REAPED', 'GATE STARTED YES']));
    expect(r.say).not.toContain('LANE_BRIDGE_OK');
    expect(r.df.calls.filter((c) => c.startsWith('mkdir')).length).toBe(6);
    expect(r.put[0]).toBe(SL.started);
  });
  it('a pre-existing synthetic parent is LANE_E_INPUT with no receipt and no docker call', async () => {
    const r = await go({ dirsTaken: true });
    expect(r).toMatchObject({ ok: false, say: ['LANE_E_INPUT'] });
    expect(r.calls).toEqual([]);
    expect(r.put).toEqual([]);
  });
  it('static: the synthetic branch is selected only by exactly --synthetic, and E1 argv parsing is unchanged', () => {
    const src = read('scripts/e2e/le-lane/run-lane.mjs');
    const main = src.slice(src.indexOf("if (process.argv[1] && /le-lane\\/run-lane\\.mjs$/"));
    expect(main).toContain("if (a[0] === '--synthetic')");
    expect(main).toContain('else { const [C, P, R, node, shell, apiOrigin, dbUrl, commit] = a; o = { C, P, R, node, shell, apiOrigin, dbUrl, commit }; }');
    expect(src).toContain("if (ok && !syn) {\n      let spawnError = false;");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('proxy and boundary: exactly the dummy origin pair', () => {
  it('allowedOrigins(DUMMY) is exactly {http, ws} of 127.0.0.1:<dummy port>; any other host or port is outside it', () => {
    const a = allowedOrigins(DUMMY);
    expect([...a].sort()).toEqual(['http://127.0.0.1:40123', 'ws://127.0.0.1:40123']);
    for (const o of ['http://127.0.0.1:40124', 'http://localhost:40123', 'http://127.0.0.2:40123', 'https://127.0.0.1:40123', 'http://127.0.0.1:8080']) expect(a.has(o), o).toBe(false);
  });
  it('the browser-level proxy is the one egress proxy with loopback forced through it; no per-context proxy exists', () => {
    expect(serverOptions({ shell: SHELL, proxyUrl: 'http://127.0.0.1:5000' }).proxy).toEqual({ server: 'http://127.0.0.1:5000', bypass: '<-loopback>' });
    const spec = read('e2e/lesson-editor/lifecycle-matrix.spec.ts');
    expect(spec.match(/startEgressProxy\(/g)).toHaveLength(1);
    expect(spec).toContain('const allowed = allowedOrigins(dummy.origin);');
    expect(spec).toContain('const proxy = await startEgressProxy(allowed);');
    expect(spec).toMatch(/dummy: dummy\.origin, allowed, timeoutMs: ARM_TIMEOUT_MS, installBoundary,/);
    expect(spec).toContain('proxyUrl: proxy.url');
    for (const arm of SYN_ARMS) expect(Object.prototype.hasOwnProperty.call(armCallerOptions(arm, DUMMY), 'proxy'), arm).toBe(false);
  });
  it('dummy server: exactly /blank and /doc, fixed bodies, no script; everything else 404 (handler only; no listener started)', () => {
    const call = (method: string, url: string) => { const r: Obj = { head: null, body: undefined }; dummyHandler({ method, url }, { writeHead: (s: number, h: Obj) => { r.head = [s, h]; }, end: (b?: string) => { r.body = b; } }); return r; };
    expect(call('GET', '/blank')).toMatchObject({ head: [200, expect.anything()], body: '<html></html>' });
    expect(call('GET', '/doc').body).toBe(DUMMY_BODIES['/doc']);
    expect(DUMMY_BODIES['/doc']).toMatch(/<input id="t"[^>]*>.*<div id="b" contenteditable="true"/);
    for (const b of Object.values(DUMMY_BODIES)) expect(b).not.toMatch(/<script|\son\w+=|javascript:/i);
    for (const [m, u] of [['GET', '/'], ['GET', '/doc?x'], ['GET', '/blank/'], ['POST', '/doc'], ['GET', '/favicon.ico'], ['GET', '//doc']]) expect(call(m, u).head[0], `${m} ${u}`).toBe(404);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
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
/** Fake Browser/Context/Page recorder. `fail` throws at the named call; `hang` never resolves there; `exit` is the shape the owned
 *  browser shows after close ('CODE_0' = reaped). */
function fakeWorld(o: { fail?: string; hang?: string; exit?: string; violations?: string[]; noState?: boolean } = {}) {
  const log: string[] = [];
  let pages = 0, contexts = 0;
  const step = async (name: string, v?: unknown) => {
    log.push(name);
    if (o.hang === name) await new Promise(() => {});
    if (o.fail === name) throw new Error(`fail ${name}`);
    return v;
  };
  const mkPage = () => {
    const id = pages++;
    const p = `page${id}`;
    let closed = false;
    return {
      goto: (u: string) => step(`${p}.goto ${new URL(u).pathname}`),
      close: async () => { await step(`${p}.close:start`); closed = true; log.push(`${p}.close:end`); },
      evaluate: () => step(`${p}.setItem`),
      locator: (s: string) => ({ waitFor: (w: Obj) => step(`${p}.visible ${s} ${w.state}`), click: () => step(`${p}.click ${s}`) }),
      keyboard: { type: (t: string) => step(`${p}.type ${t}`) },
      once: () => {}, isClosed: () => closed,
    };
  };
  const browser = {
    newContext: async (opts: Obj) => {
      contexts++;
      await step(`newContext ${JSON.stringify(opts)}`);
      return {
        setDefaultTimeout: (n: number) => log.push(`timeout ${n}`), setDefaultNavigationTimeout: (n: number) => log.push(`navTimeout ${n}`),
        newPage: async () => { await step(`newPage#${pages}`); return mkPage(); },
        close: () => step('context.close'),
      };
    },
  };
  let exited = false;
  const state = { exitShape: () => (exited ? o.exit ?? 'CODE_0' : 'NONE'), browserLog: () => 'NO_MATCH' };
  const withBrowser = async (onState: (s: unknown) => void, armBody: (b: unknown) => Promise<unknown>) => {
    log.push('launch');
    if (!o.noState) onState(state);
    try { await armBody(browser); } finally { log.push('browser.close'); exited = true; }
  };
  const d = { dummy: DUMMY, allowed: allowedOrigins(DUMMY), timeoutMs: 50, withBrowser,
    installBoundary: async () => { log.push('boundary'); return { violations: o.violations ?? [], aborted: 0 }; } };
  return { d, log, counts: () => ({ contexts }) };
}
const EXPECTED: Record<string, string[]> = {
  A: ['newPage#0', 'page0.goto /doc'],
  B: ['newPage#0', 'page0.goto /doc'],
  C: ['newPage#0', 'page0.goto /blank', 'page0.close:start', 'page0.close:end', 'newPage#1', 'page1.goto /doc'],
  D: ['newPage#0', 'page0.goto /blank', 'page0.setItem', 'page0.goto /doc'],
};
describe('arm lifecycle (fake recorder): exact per-arm order, one context, bounded cleanup, failure preserved', () => {
  it('each arm: launch, ONE newContext with only its caller options, timeouts, boundary, its exact page sequence, visible, typed, context close, browser close', async () => {
    for (const arm of SYN_ARMS) {
      const w = fakeWorld();
      const r = await runArm(arm, w.d as never);
      expect(r, arm).toMatchObject({ status: 'DONE', milestone: 'DONE', reap: 'PROVEN' });
      expect(parseSynArm(r.line), arm).toMatchObject({ arm, status: 'DONE' });
      expect(w.counts().contexts).toBe(1);
      const last = arm === 'C' ? 'page1' : 'page0';
      expect(w.log, arm).toEqual(['launch', `newContext ${JSON.stringify(armCallerOptions(arm, DUMMY))}`, 'timeout 30000', 'navTimeout 30000', 'boundary', ...EXPECTED[arm],
        `${last}.visible #t visible`, `${last}.visible #b visible`, `${last}.click #b`, `${last}.type abc`, 'context.close', 'browser.close']);
    }
    // C: P0's close COMPLETES before the final page is requested
    const w = fakeWorld();
    await runArm('C', w.d as never);
    expect(w.log.indexOf('page0.close:end')).toBeLessThan(w.log.indexOf('newPage#1'));
  });
  it('fault at each milestone: FAILED with the last milestone reached, context and browser still closed, reap still checked', async () => {
    const cases: [string, string, string][] = [
      ['A', 'boundary', 'NONE'], ['A', 'newPage#0', 'CONTEXT'], ['C', 'page0.close:start', 'CONTEXT'], ['D', 'page0.setItem', 'CONTEXT'],
      ['A', 'page0.goto /doc', 'PRELIM'], ['B', 'page0.visible #b visible', 'FINAL_GOTO'], ['A', 'page0.type abc', 'VISIBLE'], ['A', 'context.close', 'DONE'], // body complete, cleanup failed: FAILED with M DONE
    ];
    for (const [arm, fail, m] of cases) {
      const w = fakeWorld({ fail: fail === 'boundary' ? undefined : fail });
      if (fail === 'boundary') w.d.installBoundary = async () => { w.log.push('boundary'); throw new Error('route'); };
      const r = await runArm(arm, w.d as never);
      expect(r, `${arm} ${fail}`).toMatchObject({ status: 'FAILED', milestone: m, reap: 'PROVEN' });
      expect(w.log.includes('context.close'), `${arm} ${fail}`).toBe(true);
      expect(w.log.at(-1)).toBe('browser.close');
      expect(parseSynArm(r.line)).not.toBeNull();
    }
    const v = await runArm('A', fakeWorld({ violations: ['blocked http://x'] }).d as never);
    expect(v).toMatchObject({ status: 'FAILED', milestone: 'TYPED' });
  });
  it('a hung step hits the per-arm bound (FAILED), and the browser is still closed', async () => {
    const w = fakeWorld({ hang: 'page0.goto /doc' });
    const r = await runArm('A', w.d as never);
    expect(r).toMatchObject({ status: 'FAILED', milestone: 'PRELIM', reap: 'PROVEN' });
    expect(w.log.at(-1)).toBe('browser.close');
  });
  it('an unproven reap stops the matrix: later arms NOT_RUN (never launched), matrix UNRESOLVED; a failure is never overwritten', async () => {
    const seen: string[] = [];
    const launched: string[] = [];
    const exits: Record<string, string> = { A: 'CODE_0', B: 'NONE' };
    const res = await runMatrix({ runArm: async (arm: string) => { launched.push(arm); const w = fakeWorld({ exit: exits[arm] }); return runArm(arm, w.d as never); } } as never, (l: string) => seen.push(l));
    expect(launched).toEqual(['A', 'B']);
    expect(seen.map((l) => parseSynArm(l)?.status)).toEqual(['DONE', 'FAILED', 'NOT_RUN', 'NOT_RUN']);
    expect(seen[1]).toMatch(/REAP UNPROVEN/);
    expect(seen.slice(2)).toEqual([notRunArm('C'), notRunArm('D')]);
    expect(res.allDone).toBe(false);
    expect(synMatrix({ report: 'PARSED', pwCode: 1, arms: seen.map(parseSynArm) })).toBe('UNRESOLVED');
    // no state at all (launch refused before the owned browser existed) is never a proven reap
    expect(await runArm('A', fakeWorld({ noState: true }).d as never)).toMatchObject({ status: 'FAILED', reap: 'UNPROVEN' });
    // a failed arm with a proven reap does not stop later arms, and a later DONE never turns the matrix into PASS
    const all = await runMatrix({ runArm: async (arm: string) => runArm(arm, fakeWorld(arm === 'A' ? { fail: 'page0.goto /doc' } : {}).d as never) } as never, () => {});
    expect(all.results.map((x) => x.status)).toEqual(['FAILED', 'DONE', 'DONE', 'DONE']);
    expect(synMatrix({ report: 'PARSED', pwCode: 1, arms: all.results.map((x) => parseSynArm(x.line)) })).toBe('FAIL');
    expect(synMatrix({ report: 'PARSED', pwCode: 0, arms: all.results.map((x) => parseSynArm(x.line)) })).toBe('FAIL');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const armDone = (a: string) => `ARM ${a} STATUS DONE M DONE REAP PROVEN BROWSER_EXIT SHAPE CODE_0 FIRST_SEEN GATE_POST BODY_END_PAGE OPEN BROWSER_LOG NO_MATCH`;
const synReport = (bodies: string[], o: { title?: string; retry?: number } = {}) => JSON.stringify({ suites: [{ title: 'lifecycle-matrix.spec.ts', file: 'lifecycle-matrix.spec.ts',
  suites: [{ title: 'lifecycle matrix (synthetic)', file: 'lifecycle-matrix.spec.ts', specs: [{ title: o.title ?? 'arms A to D', file: 'lifecycle-matrix.spec.ts',
    tests: [{ projectName: 'lifecycle-matrix-chromium', annotations: bodies.map((b) => ({ type: 'syn-arm', description: b })),
      results: [{ retry: o.retry ?? 0, status: 'passed', annotations: bodies.map((b) => ({ type: 'syn-arm', description: b })) }] }] }] }] }] });
function synEntryFake(o: { report?: string | null; pwCode?: number; label?: string; envExtra?: Obj; dirsBad?: boolean } = {}) {
  const writes: string[] = [];
  const runs: string[][] = [];
  const called: string[] = [];
  const env = { ...Object.fromEntries(SENV.map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)])), PATH: IMAGE_PATH_ENV.slice(5), HOSTNAME: CIDV.slice(0, 12), ...(o.envExtra ?? {}) };
  const df = dirFs();
  createSynDirs(df, T, SL, UID);
  if (o.dirsBad) df.dirs.add(`${SL.out}/stale`);
  const fsx = { ...df, accessSync: (p: string) => { if (!(p === '/usr/lib/postgresql/16/bin/psql' || (p.startsWith('/usr/bin/') && p !== '/usr/bin/psql'))) throw new Error('ENOENT'); } };
  const banned = (k: string) => () => { called.push(k); throw new Error(`authentic call ${k}`); };
  const d = {
    env, repo: R, fs: fsx, execPath: LANE_NODE, uid: () => UID, umask: () => 0o077,
    openExcl: (p: string) => { if (p !== SL.laneTxt) throw new Error('path'); return 3; }, write: (_fd: number, t: string) => writes.push(t), close: () => {},
    readText: () => o.label ?? 'docker-default (enforce)\n',
    readReport: (p: string) => (p !== SL.report ? { status: 'refused', why: 'path' } : o.report === null ? { status: 'missing' } : { status: 'ok', text: o.report ?? synReport(SYN_ARMS.map(armDone)) }),
    run: async (bin: string, args: string[]) => { runs.push([bin, ...args]); return { code: o.pwCode ?? 0 }; },
    fetch: banned('fetch'), psql: banned('psql'), forward: banned('forward'), assertPairingProof: banned('assertPairingProof'), assertLivePairing: banned('assertLivePairing'), randomUUID: banned('randomUUID'),
  };
  return { d, writes, runs, called, lane: () => writes.join('') };
}
describe('lane-entry SYNTHETIC: zero authentic calls, only the synthetic spec, LANE SYN lines only', () => {
  it('a full PASS run: AppArmor, env, closure, dirs, ONE Playwright run of the synthetic config, one report read, four arms, MATRIX PASS', async () => {
    const f = synEntryFake();
    const r = await laneMain(f.d as never);
    expect(r.code).toBe(0);
    expect(f.called).toEqual([]);
    expect(f.runs).toEqual([[LANE_NODE, `${R}/node_modules/@playwright/test/cli.js`, 'test', '-c', `${R}/e2e/lesson-editor/playwright.lifecycle-matrix.config.ts`]]);
    expect(f.lane().split('\n').filter(Boolean).every((l) => l.startsWith('LANE SYN '))).toBe(true);
    const p = parseSynOut(f.lane());
    expect(p).toMatchObject({ ok: true, interrupted: false, ran: true, report: 'PARSED', matrix: 'PASS' });
    expect(parseLaneOut(f.lane())).toEqual({ ok: false });
  });
  it('refusals before the spec: AppArmor, env (each forbidden name), dirs; never an authentic call', async () => {
    for (const [o, code] of [[{ label: 'unconfined\n' }, 'LANE_E_APPARMOR'], [{ envExtra: { LE_APP_ORIGIN: 'http://127.0.0.1:8080' } }, 'LANE_E_ENV'],
      [{ envExtra: { PLAYWRIGHT_TEST_BASE_URL: 'http://x' } }, 'LANE_E_ENV'], [{ envExtra: { LE_DB_URL: 'postgresql://x' } }, 'LANE_E_ENV'], [{ dirsBad: true }, 'LANE_E_DIRS']] as [Obj, string][]) {
      const f = synEntryFake(o);
      const r = await laneMain(f.d as never);
      expect(r.code).toBe(1);
      expect(f.runs).toEqual([]);
      expect(f.called).toEqual([]);
      expect(parseSynOut(f.lane())).toMatchObject({ ok: true, interrupted: false, precheck: code });
    }
  });
  it('report shapes: missing, invalid, wrong test, retry, out-of-order or invalid arm bodies are never a PASS', async () => {
    const cases: [string | null, string][] = [
      [null, 'UNRESOLVED'], ['{not json', 'UNRESOLVED'], [synReport(SYN_ARMS.map(armDone), { title: 'E1 save' }), 'UNRESOLVED'],
      [synReport(SYN_ARMS.map(armDone), { retry: 1 }), 'UNRESOLVED'], [synReport(['B', 'A', 'C', 'D'].map(armDone)), 'UNRESOLVED'],
      [synReport([...SYN_ARMS.slice(0, 3).map(armDone), 'ARM D STATUS DONE M TYPED REAP PROVEN BROWSER_EXIT UNKNOWN BROWSER_LOG NO_MATCH']), 'UNRESOLVED'],
    ];
    for (const [report, m] of cases) {
      const f = synEntryFake({ report });
      expect((await laneMain(f.d as never)).code).toBe(1);
      expect(parseSynOut(f.lane()).matrix, String(report).slice(0, 40)).toBe(m);
    }
    const nonzero = synEntryFake({ pwCode: 1 });
    expect((await laneMain(nonzero.d as never)).code).toBe(1);
    expect(parseSynOut(nonzero.lane()).matrix).toBe('FAIL');
    expect(synArmsFromReport({ status: 'missing' }).arms).toEqual(SYN_ARMS.map(unknownArm));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('acceptance isolation: synthetic output can never reach an E1 summary or acceptance', () => {
  const E1_OK = 'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE CLEANUP PASS\nLANE END\n';
  it('parseLaneOut refuses any text holding a LANE SYN line, wherever it is; planSummary refuses it as LANE_OUT', () => {
    expect(parseLaneOut(E1_OK).ok).toBe(true);
    const ls = E1_OK.slice(0, -1).split('\n');
    for (let i = 0; i <= ls.length; i++) {
      const t = [...ls.slice(0, i), 'LANE SYN MATRIX PASS', ...ls.slice(i)].join('\n') + '\n';
      expect(parseLaneOut(t), String(i)).toEqual({ ok: false });
      expect(planSummary({ verdict: { ok: true, started: 'YES' }, laneText: t, pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_LANE_OUT' });
    }
  });
  it('the synthetic grammar refuses E1 text, and its summary never prints an LE-E1 line', () => {
    expect(parseSynOut(E1_OK)).toEqual({ ok: false });
    const full = ['START', 'NOT_ACCEPTANCE', 'APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE', 'RAN', 'RESULT CLOSE_WITH_CODE', 'REPORT PARSED', ...SYN_ARMS.map(armDone), 'MATRIX PASS', 'END'].map((l) => `LANE SYN ${l}`).join('\n') + '\n';
    expect(parseSynOut(full)).toMatchObject({ ok: true, matrix: 'PASS' });
    for (const verdict of [{ ok: true }, { ok: false }]) {
      for (const laneText of [full, E1_OK, null]) {
        const s = synSummaryLines({ verdict, laneText });
        expect(s.lines[0]).toBe('LE-SYN NOT_ACCEPTANCE synthetic lifecycle matrix; never E1 evidence');
        expect(s.lines.every((l) => l.startsWith('LE-SYN '))).toBe(true);
        expect(s.lines.join('\n')).not.toMatch(/LE-E1|ACCEPTED/);
      }
    }
    expect(synSummaryLines({ verdict: { ok: false }, laneText: full }).ok).toBe(false);
    for (const f of ['scripts/e2e/le-lane/synthetic.mjs', 'e2e/lesson-editor/lifecycle-matrix.mjs', 'e2e/lesson-editor/lifecycle-matrix.spec.ts']) expect(read(f), f).not.toMatch(/LE-E1 ACCEPTED/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('workflow: the synthetic job exists alone, with no authentic step at all', () => {
  const W = read('.github/workflows/e2e.yml');
  const DOC = YAML.parse(W) as Obj;
  const J = DOC.jobs['lesson-editor-syn'];
  const runs = (J.steps as Obj[]).map((s) => String(s.run ?? ''));
  it('own dispatch option, read-only permissions, LE_TARGET=SYNTHETIC, no secret, environment, upload or retry', () => {
    expect(DOC.on.workflow_dispatch.inputs.specs.options.at(-1)).toBe('lesson-editor-syn');
    expect(J.if).toBe("inputs.specs == 'lesson-editor-syn'");
    expect(J.permissions).toEqual({ contents: 'read' });
    expect(J.environment).toBeUndefined();
    expect(J.env).toEqual({ CI: 'true', LE_TARGET: 'SYNTHETIC' });
    const body = W.slice(W.indexOf('\n  lesson-editor-syn:'));
    expect(body).not.toMatch(/secrets\.|upload-artifact|continue-on-error|E2E_[A-Z_]*PASSWORD/);
  });
  it('zero authentic steps: no stack, network, migration, D1, actors, preseed, keys, password, state, identity carrier, served app or bridge', () => {
    const all = runs.join('\n');
    expect(all).not.toMatch(/supabase|stack-net|bootstrap\.sh|apply-reviewed|stage-pre|verify-identities|stack-ownership|gb-job-psql|pairing-producer|export-status|lesson-editor\/run\.sh|owned-proc|vite|served-app|avatar|hermetic|psql|dbpass|keys|state-|LE_PRIV|le-private|le-priv\b/);
    expect(all.match(/le-lane\/run-lane\.mjs --synthetic /g)).toHaveLength(1);
    expect(all).not.toMatch(/le-lane\/run-lane\.mjs "/);
  });
  it('selection runs before any install script, browser, image or lane step', () => {
    const names = (J.steps as Obj[]).map((s) => String(s.name ?? s.uses));
    const sel = names.findIndex((n) => n.startsWith('Synthetic target selection'));
    expect(runs[sel]).toBe('node scripts/e2e/le-lane/synthetic.mjs select');
    for (const later of ['npm rebuild', 'Early runner preflight', 'Install Chromium', 'Pin the headless shell', 'Build and check the lane image', 'Synthetic lane, once']) {
      expect(names.findIndex((n) => n.startsWith(later)), later).toBeGreaterThan(sel);
    }
    expect(names.slice(0, sel)).toEqual(['actions/checkout@v4', 'Record tested commit and tree', 'actions/setup-node@v4', 'npm ci (no lifecycle scripts)',
      'Workflow policy check (executed file; no secrets, no writes, no remote Supabase)', 'Directly invoked scripts are executable (tracked mode 100755 and a shebang; static, read-only)']);
  });
  it('teardown gates, image cleanup, summary and output removal always run on the synthetic scope only', () => {
    const by = (id: string) => (J.steps as Obj[]).find((s) => s.id === id)!;
    expect(by('syn_gates').if).toBe("always() && steps.syn_image.outcome != 'skipped'");
    expect(by('syn_image_cleanup').if).toBe("always() && steps.syn_image.outcome != 'skipped'");
    const P = '"$RUNNER_TEMP/syn-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"';
    expect(by('syn_gates').run).toContain(`gates.mjs verify "$RUNNER_TEMP/syn-lane-ctl" ${P} "$GITHUB_WORKSPACE"`);
    const rm = (J.steps as Obj[]).at(-1)!;
    expect(rm.if).toBe('always()');
    expect(rm.run).toContain('P="$RUNNER_TEMP/syn-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"');
    expect(rm.run).not.toMatch(/le-private|le-lane-ctl|test-results|playwright-report/);
  });
});
