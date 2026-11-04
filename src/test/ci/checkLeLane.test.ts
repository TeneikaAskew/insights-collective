// ABOUTME: Pure and fake-only controls for the sealed E1 lane candidate: exact container contract, inspect gate, lane output
// ABOUTME: grammar, host receipts, bridge seal, orchestrator create states and reaping, supervisor order, sandbox launch, job shape.
//
// Read-only on purpose: nothing here writes a file, starts docker, a listener, a browser or a real child. Fakes live in memory.
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { constants as fsConstants, readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import { SECCOMP_PROFILE_REL, createdNeverStarted } from '../../../scripts/e2e/le-iso/expect.mjs';
import {
  ENV_KEYS, GATE_KEYS, IMAGE_PATH_ENV, LANE_LIMITS, LANE_NODE, PRECHECK_CODES, PSQL_REAL, TOOLS, cleanupScope, consumerState, compareLaneInspect, expectedLaneConfig, imageBuildRecord,
  imageCleanupRecord, imageConfigProblems, IMAGE_CHECK_FIELDS, IMAGE_VALUE_CLASSES, IMAGE_WORKDIR, imageFieldLines, imageValueClass, laneBinds, laneCreateArgs, laneEnv, lanePaths, lanePorts, laneTmpfsSpec, laneVerdict, parseGates, parseImageBuildRecord,
  parseImageCleanupRecord, parseLaneOut, planSummary, pwExitContent,
  E1_RESULT_CLASSES, REPORTED_ERROR_CODES, REPORT_STATES, e1ResultClass, refusalDetail, reportedErrorCode,
  ATTEMPT_STATUSES, E1_STEP_CODES, FAILED_STEP_TOKENS, POST_EXIT_OBSERVATIONS, POST_READ_OUTCOMES, attemptStatusToken, failedStepToken, postObservedEvidence,
  BODY_END_PAGE_STATES, BROWSER_EXIT_CHECKPOINTS, BROWSER_EXIT_SIGNALS, browserExitEvidence,
  BROWSER_LOG_CODES,
} from '../../../scripts/e2e/le-lane/contract.mjs';
import { SEALED_HOLD_MAX_MS, createBridge, parseBridgeFinal } from '../../../scripts/e2e/le-lane/bridge.mjs';
import { inputsOk, runLane } from '../../../scripts/e2e/le-lane/run-lane.mjs';
import { buildLaneImage, cleanupLaneImage, sanitizedEnv } from '../../../scripts/e2e/le-lane/image.mjs';
import { detailLine, planLine, readVerdict, verifyLines } from '../../../scripts/e2e/le-lane/gates.mjs';
import { REPORT_MAX, REPORT_MAX_DEPTH, REPORT_MAX_NODES, closureProblems, e1Attempt, envProblems, laneMain, readReportBounded, reportSnapshot, runChild, sessionParentOk, workerAppArmorFromReport } from '../../../scripts/e2e/le-lane/lane-entry.mjs';
import { NOTRUN_CODES, notRunLines } from '../../../scripts/e2e/le-e1-notrun.mjs';
import {
  FORBIDDEN_FLAGS, LAUNCH_BOUND_MS, RESOLVER_ARG, SandboxLaunchError, attestArgv, defaultsProblem, effectiveOptions, effectiveProblem, incomingProblem, labelCode,
  postrunAppArmor, serverOptions, withSandboxedBrowser,
  EXIT_OBSERVATIONS, READ_OUTCOMES, exitObserver, postrunAppArmorObserved, readErrorOutcome, readLabelAttempts, readTextOutcome,
  BODY_END_PAGES, EXIT_CHECKPOINTS, EXIT_SIGNALS, browserExitLine, exitRecorder, exitShape, pageEndState, pageTeardownRecord, sampleExitShape,
  BROWSER_LOG_CODES as SL_LOG_CODES, BROWSER_LOG_LIMITS, browserLogClassifier, browserLogLine, browserLogRecorder,
} from '../../../e2e/lesson-editor/sandbox-launch.mjs';
import { E1_STEPS } from '../../../e2e/lesson-editor/step-codes.mjs';
import { E1_IDENTITY } from '../../../scripts/e2e/le-e1-summary.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const P = '/rt/le-private', C = '/rt/le-lane-ctl', R = '/w/repo';
const L = lanePaths(P, C, R);
const NODE = '/n/bin/node';
const SHELL = '/s/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const API = 'http://127.0.0.1:54321', DB = 'postgresql://postgres@127.0.0.1:54322/postgres', COMMIT = 'a'.repeat(40);
const IMG = `sha256:${'b'.repeat(64)}`, CIDV = 'c'.repeat(64);
const UID = 1001, GID = 118;
const PROFILE_RAW = readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL));
const PROFILE_TEXT = PROFILE_RAW.toString('utf8');
const ENV = laneEnv(L, { apiOrigin: API, dbUrl: DB, commit: COMMIT, shell: SHELL });
const EXP = () => expectedLaneConfig(L, { imageId: IMG, uid: UID, gid: GID, node: NODE, env: ENV, seccompText: PROFILE_TEXT, cid: CIDV });

/** A container inspect object exactly as Docker 28 would report the expected config (tmpfs only in HostConfig.Tmpfs). */
function goodInspect(state: Record<string, unknown> = {}) {
  const e = EXP();
  const { Image, User, EffectiveMounts, Config, ...hc } = e;
  return {
    Id: CIDV, Image,
    Config: { Hostname: CIDV.slice(0, 12), Domainname: '', User, AttachStdin: false, AttachStdout: true, AttachStderr: true, Tty: false, OpenStdin: false,
      StdinOnce: false, Env: [...Config.Env].reverse(), Cmd: Config.Cmd, Image: IMG, Volumes: null, WorkingDir: R, Entrypoint: null, OnBuild: null, Labels: {} },
    HostConfig: { ...hc, Mounts: [] },
    Mounts: [...EffectiveMounts].reverse().map((m) => ({ ...m, Mode: m.RW ? 'rw' : 'ro', Name: '' })),
    State: { Status: 'exited', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '2026-11-04T01:00:00Z', ...state },
  };
}
const CREATED = { Status: 'created', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '0001-01-01T00:00:00Z' };
type Obj = Record<string, any>;
const mut = (f: (o: Obj) => void) => { const o = goodInspect() as Obj; f(o); return compareLaneInspect(o, EXP()); };

describe('lane contract: exact create argv, environment and binds', () => {
  it('builds the one docker create argv, with all seven binds (out/ rw) and the exact -e list in order', () => {
    const a = laneCreateArgs(L, { imageId: IMG, uid: UID, gid: GID, node: NODE, env: ENV });
    expect(a.slice(0, 3)).toEqual(['create', '--cidfile', `${C}/lane.cid`]);
    const vs = a.flatMap((x, i) => (x === '-v' ? [a[i + 1]] : []));
    expect(vs).toEqual([`${R}:${R}:ro,rprivate`, `${P}/keys:${P}/keys:ro,rprivate`, `${P}/dbpass:${P}/dbpass:ro,rprivate`, `${P}/proof:${P}/proof:ro,rprivate`,
      `${P}/sock:${P}/sock:ro,rprivate`, `${P}/lane:${P}/lane:rw,rprivate`, `${P}/out:${P}/out:rw,rprivate`]);
    const es = a.flatMap((x, i) => (x === '-e' ? [a[i + 1]] : []));
    expect(es.map((e) => e.split('=')[0])).toEqual([...ENV_KEYS]);
    expect(a.slice(-4)).toEqual([IMG, LANE_NODE, `${R}/scripts/e2e/le-lane/lane-entry.mjs`, R]);
    for (const f of ['--network', 'none', '--cap-drop', 'ALL', 'no-new-privileges', `seccomp=${R}/${SECCOMP_PROFILE_REL}`, '--read-only', '--init', '--log-driver', '--workdir'])
      expect(a).toContain(f);
    for (const forbidden of ['--privileged', '--pid', '--cap-add', '--name', '--hostname', '--entrypoint', '-p', '--userns', '--uts', '--device', '--add-host', '--env-file', '--label', '--mount'])
      expect(a, forbidden).not.toContain(forbidden);
    expect(a.some((x) => /apparmor=|unconfined/.test(x))).toBe(false);
    expect(a[a.indexOf('--tmpfs') + 1]).toBe(`/tmp:${laneTmpfsSpec(UID, GID)}`);
  });
  it('passes only the closed environment: no secret-bearing or override variable, password-free DSN only', () => {
    const keys = ENV.map((e) => e.split('=')[0]);
    for (const k of keys) expect(k).not.toMatch(/PASSWORD$|^SUPABASE|^VITE_|^PG|^E2E_(TEST|INSTRUCTOR|MEMBER)|^LE_ALLOW|^LE_EGRESS/);
    expect(() => laneEnv(L, { apiOrigin: API, dbUrl: 'postgresql://postgres:pw@127.0.0.1:54322/postgres', commit: COMMIT, shell: SHELL })).toThrow();
    expect(() => laneEnv(L, { apiOrigin: 'http://localhost:54321', dbUrl: DB, commit: COMMIT, shell: SHELL })).toThrow();
    expect(() => laneEnv(L, { apiOrigin: API, dbUrl: DB, commit: 'HEAD', shell: SHELL })).toThrow();
    expect(() => laneEnv(L, { apiOrigin: 'http://127.0.0.1:8080', dbUrl: DB, commit: COMMIT, shell: SHELL })).toThrow(); // ports must be distinct
    expect(lanePorts({ apiOrigin: API, dbUrl: DB })).toEqual({ api: 54321, db: 54322, app: 8080 });
    // an env list that is reordered, extended or carries a newline is refused by the argv builder
    for (const bad of [[...ENV].reverse(), [...ENV, 'PGPASSWORD=x'], ENV.map((e, i) => (i === 0 ? 'HOME=/tmp\nX=1' : e))])
      expect(() => laneCreateArgs(L, { imageId: IMG, uid: UID, gid: GID, node: NODE, env: bad })).toThrow();
    expect(() => lanePaths('/rt/le-private/', C, R)).toThrow();
    expect(() => lanePaths('/rt/a,b', C, R)).toThrow();
  });
  it('ships the closed tool list with the REAL psql binary and sed, and no fonts (rendering without fonts stays unproved)', async () => {
    const c = await import('../../../scripts/e2e/le-lane/contract.mjs');
    expect(TOOLS).toEqual(expect.arrayContaining(['bash', 'sed', 'git', 'grep', 'mktemp', 'env']));
    expect(PSQL_REAL).toBe('/usr/lib/postgresql/16/bin/psql');
    expect(c.FONTS_SHIPPED).toBe(false);
    expect(IMAGE_PATH_ENV).toBe('PATH=/usr/lib/postgresql/16/bin:/usr/bin');
    expect(laneBinds(L)).toHaveLength(7);
  });
});

describe('lane inspect gate (Docker 28 effective config, exact)', () => {
  it('accepts exactly the expected config, with Env and Mounts in any order', () => {
    expect(compareLaneInspect(goodInspect(), EXP())).toEqual([]);
  });
  it('effective Mounts are exactly the seven binds; tmpfs is checked ONLY through HostConfig.Tmpfs', () => {
    expect(mut((o) => { o.Mounts.push({ Type: 'tmpfs', Source: '', Destination: '/tmp', RW: true, Propagation: '' }); })).toContain('EffectiveMounts');
    expect(mut((o) => { o.HostConfig.Tmpfs = { '/tmp': 'rw' }; })).toEqual(['Tmpfs']);
    expect(mut((o) => { o.HostConfig.Mounts = [{ Type: 'tmpfs', Target: '/tmp' }]; })).toEqual(['Mounts']);
  });
  it('rejects every out/ and bind drift', () => {
    const outIdx = (o: Obj) => o.Mounts.findIndex((m: Obj) => m.Destination === `${P}/out`);
    expect(mut((o) => { o.Mounts.splice(outIdx(o), 1); })).toContain('EffectiveMounts');
    expect(mut((o) => { o.Mounts[outIdx(o)].RW = false; })).toContain('EffectiveMounts');
    expect(mut((o) => { o.Mounts[outIdx(o)].Source = '/elsewhere'; })).toContain('EffectiveMounts');
    expect(mut((o) => { o.Mounts[outIdx(o)].Propagation = 'rshared'; })).toContain('EffectiveMounts');
    expect(mut((o) => { const k = o.Mounts.find((m: Obj) => m.Destination === `${P}/keys`); k.RW = true; })).toContain('EffectiveMounts');
    expect(mut((o) => { o.Mounts.push({ Type: 'bind', Source: '/x', Destination: '/x', RW: false, Propagation: 'rprivate' }); })).toContain('EffectiveMounts');
    expect(mut((o) => { o.HostConfig.Binds = o.HostConfig.Binds.filter((b: string) => !b.startsWith(`${P}/out:`)); })).toContain('Binds');
    expect(mut((o) => { o.HostConfig.Binds = [...o.HostConfig.Binds, '/x:/x:ro,rprivate']; })).toContain('Binds');
  });
  it('rejects every container Config drift by field name (no alternatives kept)', () => {
    const cases: [string, (o: Obj) => void][] = [
      ['Env', (o) => o.Config.Env.push('PLAYWRIGHT_BROWSERS_PATH=/x')],
      ['Env', (o) => o.Config.Env.push('PGPASSWORD=x')],
      ['Env', (o) => o.Config.Env.pop()],
      ['Env', (o) => o.Config.Env.push(o.Config.Env[0])],
      ['Env', (o) => { o.Config.Env[0] = `${o.Config.Env[0]}x`; }],
      ['Cmd', (o) => { o.Config.Cmd = [NODE, '/w/repo/other.mjs', R]; }],
      ['Entrypoint', (o) => { o.Config.Entrypoint = ['/bin/sh']; }],
      ['Entrypoint', (o) => { delete o.Config.Entrypoint; }],
      ['WorkingDir', (o) => { o.Config.WorkingDir = '/'; }],
      ['Tty', (o) => { o.Config.Tty = true; }],
      ['OpenStdin', (o) => { o.Config.OpenStdin = true; }],
      ['AttachStdout', (o) => { o.Config.AttachStdout = false; }],
      ['AttachStderr', (o) => { delete o.Config.AttachStderr; }],
      ['Labels', (o) => { o.Config.Labels = { a: 'b' }; }],
      ['Labels', (o) => { o.Config.Labels = null; }],
      ['Hostname', (o) => { o.Config.Hostname = 'lane'; }],
      ['Domainname', (o) => { o.Config.Domainname = 'x'; }],
      ['OnBuild', (o) => { delete o.Config.OnBuild; }],
      ['StopSignal', (o) => { o.Config.StopSignal = 'SIGINT'; }],
      ['Healthcheck', (o) => { o.Config.Healthcheck = { Test: ['NONE'] }; }],
      ['ConfigImage', (o) => { o.Config.Image = 'other'; }],
      ['User', (o) => { o.Config.User = '0:0'; }],
      ['SecurityOpt', (o) => { o.HostConfig.SecurityOpt = ['no-new-privileges']; }],
      ['CapAdd', (o) => { o.HostConfig.CapAdd = ['SYS_ADMIN']; }],
      ['PidMode', (o) => { o.HostConfig.PidMode = 'host'; }],
      ['NetworkMode', (o) => { o.HostConfig.NetworkMode = 'bridge'; }],
      ['PidsLimit', (o) => { o.HostConfig.PidsLimit = 4096; }],
    ];
    for (const [field, f] of cases) expect(mut(f), field).toContain(field);
    expect(compareLaneInspect({ ...goodInspect(), Config: undefined }, EXP())).toEqual(expect.arrayContaining(['Env', 'Cmd']));
  });
  it('checks the built image exactly (PATH-only Env, WorkingDir exactly /, no Entrypoint/Cmd, one layer, amd64)', () => {
    const img = { Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], Entrypoint: null, Cmd: null, WorkingDir: '/', Labels: null, OnBuild: null } };
    expect(imageConfigProblems(img, { id: IMG, uid: UID, gid: GID })).toEqual([]);
    const m = (f: (o: Obj) => void) => { const o = JSON.parse(JSON.stringify(img)); f(o); return imageConfigProblems(o, { id: IMG, uid: UID, gid: GID }); };
    expect(m((o) => o.Config.Env.push('X=1'))).toEqual(['Env']);
    expect(m((o) => { o.Config.Entrypoint = ['/x']; })).toEqual(['Entrypoint']);
    expect(m((o) => { o.Config.Cmd = ['/x']; })).toEqual(['Cmd']);
    expect(m((o) => { o.Config.WorkingDir = '/w'; })).toEqual(['WorkingDir']);
    expect(m((o) => { o.Architecture = 'arm64'; })).toEqual(['Architecture']);
    expect(m((o) => { o.RootFS.Layers.push('y'); })).toEqual(['Layers']);
    expect(m((o) => { o.Config.Labels = { a: 'b' }; })).toEqual(['Labels']);
  });
  it('WorkingDir must be exactly / (no default accepted): empty, absent, null, other path, relative, padded or non-string all fail', () => {
    expect(IMAGE_WORKDIR).toBe('/');
    const img = { Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], Entrypoint: null, Cmd: null, WorkingDir: '/', Labels: null, OnBuild: null } };
    const m = (f: (o: Obj) => void) => { const o = JSON.parse(JSON.stringify(img)); f(o); return imageConfigProblems(o, { id: IMG, uid: UID, gid: GID }); };
    expect(m(() => {})).toEqual([]);
    for (const v of ['', null, '/w', '//', '/ ', ' /', '.', 'w', 0, false, [], ['/'], {}]) expect(m((o) => { o.Config.WorkingDir = v; })).toEqual(['WorkingDir']);
    expect(m((o) => { delete o.Config.WorkingDir; })).toEqual(['WorkingDir']);
  });
  it('field lines use closed sets only: known field or UNKNOWN, value class from a fixed list, never the raw value', () => {
    const img = { Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], WorkingDir: '/', Labels: null } };
    const at = (wd: unknown, present = true) => { const o = JSON.parse(JSON.stringify(img)); if (present) o.Config.WorkingDir = wd; else delete o.Config.WorkingDir; return imageFieldLines(o, ['WorkingDir'])[0]; };
    expect(at('')).toBe('LANE_IMAGE_FIELD WorkingDir EMPTY_STRING');
    expect(at(undefined, false)).toBe('LANE_IMAGE_FIELD WorkingDir ABSENT');
    expect(at(null)).toBe('LANE_IMAGE_FIELD WorkingDir NULL');
    expect(at('/')).toBe('LANE_IMAGE_FIELD WorkingDir ROOT');
    expect(at('/secret-host-path')).toBe('LANE_IMAGE_FIELD WorkingDir ABS_PATH');
    expect(at('sentinel-db-url')).toBe('LANE_IMAGE_FIELD WorkingDir OTHER_STRING');
    expect(at([])).toBe('LANE_IMAGE_FIELD WorkingDir EMPTY_ARRAY');
    expect(at(['x'])).toBe('LANE_IMAGE_FIELD WorkingDir ARRAY');
    expect(at({})).toBe('LANE_IMAGE_FIELD WorkingDir EMPTY_OBJECT');
    expect(at({ a: 1 })).toBe('LANE_IMAGE_FIELD WorkingDir OBJECT');
    expect(at(7)).toBe('LANE_IMAGE_FIELD WorkingDir NUMBER');
    expect(at(true)).toBe('LANE_IMAGE_FIELD WorkingDir BOOLEAN');
    expect(imageFieldLines({ ...img, Config: undefined }, ['WorkingDir'])).toEqual(['LANE_IMAGE_FIELD WorkingDir ABSENT']);
    expect(imageFieldLines({ ...img, Config: 'x' }, ['User'])).toEqual(['LANE_IMAGE_FIELD User ABSENT']);
    expect(imageFieldLines(img, ['Layers', 'Id', 'Os'])).toEqual(['LANE_IMAGE_FIELD Layers ARRAY', 'LANE_IMAGE_FIELD Id OTHER_STRING', 'LANE_IMAGE_FIELD Os OTHER_STRING']);
    expect(imageFieldLines(null, ['INSPECT'])).toEqual(['LANE_IMAGE_FIELD INSPECT NOT_APPLICABLE']);
    expect(imageFieldLines(img, ['Evil Field\nLANE_IMAGE_OK', '__proto__', 'constructor'])).toEqual(Array(3).fill('LANE_IMAGE_FIELD UNKNOWN NOT_APPLICABLE'));
    expect(imageFieldLines(img, 'WorkingDir' as never)).toEqual([]);
    const bigBad = JSON.parse(JSON.stringify(img));
    Object.assign(bigBad.Config, { WorkingDir: '/leak-a', User: 'leak-b', Env: ['LEAK=c'], Entrypoint: ['leak-d'], Cmd: ['leak-e'], Labels: { leak: 'f' } });
    bigBad.Id = 'leak-g'; bigBad.Os = 'leak-h'; bigBad.Architecture = 'leak-i'; bigBad.RootFS.Layers = ['leak-j', 'leak-k'];
    const bad = imageConfigProblems(bigBad, { id: IMG, uid: UID, gid: GID });
    const lines = imageFieldLines(bigBad, bad);
    expect(lines).toHaveLength(bad.length);
    for (const l of lines) {
      expect(l).not.toMatch(/leak/i);
      const [tag, f, cls, ...rest] = l.split(' ');
      expect([tag, rest.length]).toEqual(['LANE_IMAGE_FIELD', 0]);
      expect(IMAGE_CHECK_FIELDS).toContain(f);
      expect(IMAGE_VALUE_CLASSES).toContain(cls);
    }
    expect(Object.isFrozen(IMAGE_CHECK_FIELDS) && Object.isFrozen(IMAGE_VALUE_CLASSES)).toBe(true);
    expect(imageValueClass(undefined, 'x')).toBe('ABSENT');
  });
  it('causal control (MODEL, not a daemon run): scratch WorkingDir default differs by builder; only an explicit WORKDIR / is builder-independent', () => {
    // Model of the two builders' scratch defaults, per moby v28.0.4 vendored BuildKit v0.20.2 dockerfile2llb/image.go emptyImage
    // (WorkingDir "/") and the classic builder (empty). WORKDIR / sets "/" in both and, in BuildKit, adds no layer (convert.go dispatchWorkdir).
    const model = (dockerfile: string, builder: 'buildkit' | 'classic') => {
      let wd = builder === 'buildkit' ? '/' : '';
      for (const line of dockerfile.split('\n')) { const mm = /^WORKDIR (.+)$/.exec(line); if (mm) wd = mm[1]; }
      return wd;
    };
    const cfg = (wd: string) => ({ Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], WorkingDir: wd } });
    const check = (wd: string) => imageConfigProblems(cfg(wd), { id: IMG, uid: UID, gid: GID });
    const OLD = `FROM scratch\nCOPY rootfs/ /\nENV ${IMAGE_PATH_ENV}\nUSER ${UID}:${GID}\n`;
    const NEW = `FROM scratch\nCOPY rootfs/ /\nENV ${IMAGE_PATH_ENV}\nWORKDIR /\nUSER ${UID}:${GID}\n`;
    expect(model(OLD, 'buildkit')).not.toBe(model(OLD, 'classic'));
    expect(model(NEW, 'buildkit')).toBe(model(NEW, 'classic'));
    for (const b of ['buildkit', 'classic'] as const) expect(check(model(NEW, b))).toEqual([]);
    expect(check(model(OLD, 'classic'))).toEqual(['WorkingDir']);
    expect(check(model(OLD, 'buildkit'))).toEqual([]);
  });
});

const ENF = 'APPARMOR_DOCKER_DEFAULT_ENFORCE';
const AA_LINE = `LANE E1 APPARMOR PRE ${ENF} ${ENF} POST ${ENF} ${ENF}`;
// E1 diagnostics r2: the three diagnostic lines for a report with no observation annotation and no full-identity E1 test;
// r3 adds the BROWSER_EXIT line (no `lane-browser-exit` annotation: MISSING).
const DIAG_TAIL = 'LANE E1 POST_OBSERVED MISSING\nLANE E1 ATTEMPT_STATUS UNKNOWN\nLANE E1 FAILED_STEP UNKNOWN\nLANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\n';
const LANE_OK = `LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP PASS\nLANE E1 RAN\nLANE E1 RESULT CLOSE_WITH_CODE\n${AA_LINE}\nLANE E1 REPORT PARSED\nLANE E1 REPORTED_ERROR UNKNOWN\n${DIAG_TAIL}LANE CLEANUP PASS\nLANE END\n`;
const OKV = laneVerdict({ runLaneStarted: true, gatesText: 'x\nGATE CONTAINER LANE_ABSENT\nGATE BRIDGE BRIDGE_REAPED\nGATE CLIENTS REAPED\nGATE STARTED YES\nLANE_GATES_END\n' });

describe('lane output grammar and the summary plan (untrusted container data; nothing fabricated)', () => {
  it('parses the closed shapes and refuses everything else', () => {
    expect(parseLaneOut(LANE_OK)).toMatchObject({ ok: true, interrupted: false, setup: 'PASS', e1: 'RAN', cleanup: 'PASS' });
    expect(parseLaneOut('LANE START\nLANE APPARMOR APPARMOR_E_UNCONFINED\nLANE SETUP NOT RUN LANE_E_APPARMOR\nLANE END\n')).toMatchObject({ ok: true, setup: 'NOT_RUN', precheck: 'LANE_E_APPARMOR' });
    expect(parseLaneOut('LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE CLEANUP FAIL\nLANE END\n')).toMatchObject({ ok: true, setup: 'FAIL', e1: 'NOT_RUN' });
    expect(parseLaneOut('LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP PASS\n')).toMatchObject({ ok: true, interrupted: true });
    for (const bad of [
      LANE_OK.replace('LANE END\n', 'LANE END\nLANE END\n'), LANE_OK.replace('LANE SETUP PASS', 'LANE SETUP FAIL'), // E1 RAN after a failed setup
      LANE_OK.replace('APPARMOR_DOCKER_DEFAULT_ENFORCE', 'APPARMOR_E_UNCONFINED'), // setup ran without the gate
      'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP NOT RUN LANE_E_APPARMOR\nLANE END\n', // gate passed but refused as AppArmor
      'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP NOT RUN LANE_E_BOGUS\nLANE END\n',
      LANE_OK.replace('LANE START\n', ''), `${LANE_OK}extra\n`, LANE_OK.slice(0, -1), LANE_OK.replace('PASS\nLANE E1', 'PASS secret\nLANE E1'), 'x'.repeat(5000),
      // worker AppArmor evidence: required right after E1 RAN, closed form only, never after E1 NOT RUN
      LANE_OK.replace(`${AA_LINE}\n`, ''), LANE_OK.replace(AA_LINE, `${AA_LINE} extra`), LANE_OK.replace(AA_LINE, AA_LINE.replace('POST', 'AFTER')),
      LANE_OK.replace(AA_LINE, `LANE E1 APPARMOR PRE ${ENF} ${ENF} POST ${ENF}`), LANE_OK.replace(AA_LINE, AA_LINE.replace(`POST ${ENF}`, 'POST docker-default')),
      LANE_OK.replace(AA_LINE, 'LANE E1 APPARMOR ABSENT'),
      `LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP FAIL\nLANE E1 NOT RUN\n${AA_LINE}\nLANE CLEANUP PASS\nLANE END\n`,
    ]) expect(parseLaneOut(bad).ok, bad.slice(0, 60)).toBe(false);
  });
  it('worker-side AppArmor evidence: any non-ENFORCE code, MISSING or INVALID parses but refuses the summary', () => {
    const ok = { state: 'ok', digits: '0' };
    expect(parseLaneOut(LANE_OK).workerAppArmor).toEqual({ state: 'EVIDENCE', codes: [ENF, ENF, ENF, ENF], enforced: true });
    for (const code of ['APPARMOR_E_UNKNOWN', 'APPARMOR_E_UNCONFINED', 'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE', 'APPARMOR_E_OTHER_PROFILE'])
      for (let slot = 0; slot < 4; slot++) {
        const codes = [ENF, ENF, ENF, ENF]; codes[slot] = code;
        const t = LANE_OK.replace(AA_LINE, `LANE E1 APPARMOR PRE ${codes[0]} ${codes[1]} POST ${codes[2]} ${codes[3]}`);
        expect(parseLaneOut(t)).toMatchObject({ ok: true, workerAppArmor: { enforced: false } });
        expect(planSummary({ verdict: OKV, laneText: t, pwExit: ok })).toEqual({ kind: 'refused', code: 'LE_SUM_E_WORKER_APPARMOR' });
      }
    for (const st of ['MISSING', 'INVALID']) {
      const t = LANE_OK.replace(AA_LINE, `LANE E1 APPARMOR ${st}`);
      expect(parseLaneOut(t).workerAppArmor).toEqual({ state: st, codes: null, enforced: false });
      expect(planSummary({ verdict: OKV, laneText: t, pwExit: ok })).toEqual({ kind: 'refused', code: 'LE_SUM_E_WORKER_APPARMOR' });
    }
    expect(parseLaneOut(`LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP PASS\nLANE E1 RAN\n`)).toMatchObject({ ok: true, interrupted: true });
  });
  it('plans the summary only after lane absence AND bridge reaping, with the exit CONTENT and true distinctions', () => {
    const ok = (digits: string) => ({ state: 'ok', digits });
    expect(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: ok('0') })).toEqual({ kind: 'summary', pw: '0', setup: 'PASS', cleanup: 'PASS' });
    expect(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: ok('1') })).toMatchObject({ kind: 'summary', pw: '1' });
    expect(planSummary({ verdict: { ...OKV, ok: false }, laneText: LANE_OK, pwExit: ok('0') })).toEqual({ kind: 'skip' });
    expect(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_PW_MISSING' });
    expect(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: { state: 'bad' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_PW' });
    const failed = 'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE CLEANUP PASS\nLANE END\n';
    expect(planSummary({ verdict: OKV, laneText: failed, pwExit: { state: 'absent' } })).toEqual({ kind: 'summary', pw: '255', setup: 'FAIL', cleanup: 'PASS' });
    expect(planSummary({ verdict: OKV, laneText: failed, pwExit: ok('0') })).toEqual({ kind: 'refused', code: 'LE_SUM_E_PW_UNEXPECTED' });
    const pre = 'LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP NOT RUN LANE_E_PAIR_RECHECK\nLANE END\n';
    expect(planSummary({ verdict: OKV, laneText: pre, pwExit: { state: 'absent' } })).toEqual({ kind: 'notrun', at: 'lane-precheck', code: 'LANE_E_PAIR_RECHECK' });
    expect(planSummary({ verdict: OKV, laneText: 'LANE START\n', pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_LANE_INTERRUPTED' });
    expect(planSummary({ verdict: OKV, laneText: null, pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_LANE_OUT' });
    expect(planSummary({ verdict: OKV, laneText: 'garbage\n', pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_LANE_OUT' });
    const never = laneVerdict({ runLaneStarted: false, gatesText: null });
    expect(planSummary({ verdict: never, laneText: null, pwExit: { state: 'absent' } })).toEqual({ kind: 'notrun', at: 'not-started', code: 'LANE_NOT_STARTED' });
    expect(planSummary({ verdict: never, laneText: LANE_OK, pwExit: { state: 'absent' } })).toEqual({ kind: 'refused', code: 'LE_SUM_E_LANE_OUT' });
    expect(pwExitContent('0\n')).toEqual({ state: 'ok', digits: '0' });
    for (const bad of ['0\n0', 'abc', '', '256', '-1', '1 ', '/rt/le-private/out/pw-exit']) expect(pwExitContent(bad).state, bad).toBe('bad');
  });
  it('the not-run adapter prints the same nine lines with NOT RUN values and never creates setup evidence', () => {
    const l = notRunLines([COMMIT, 'lane-precheck', 'LANE_E_PAIR_RECHECK']);
    expect(l).toHaveLength(9);
    expect(l.slice(1, 5)).toEqual(['LE-E1 setup: NOT RUN', 'LE-E1 setup refused at: lane-precheck', 'LE-E1 setup code: LANE_E_PAIR_RECHECK', 'LE-E1 backend-contract: unattempted']);
    expect(l.slice(6)).toEqual(['LE-E1 result: unattempted', 'LE-E1 failed step: none', 'LE-E1 cleanup: NOT RUN']);
    expect(notRunLines([COMMIT, 'not-started', 'LANE_NOT_STARTED'])[2]).toBe('LE-E1 setup refused at: not-started');
    expect(NOTRUN_CODES['lane-precheck']).toEqual([...PRECHECK_CODES]);
    for (const bad of [[COMMIT, 'lane-precheck', 'LANE_NOT_STARTED'], [COMMIT, 'x', 'LANE_E_ENV'], ['HEAD', 'not-started', 'LANE_NOT_STARTED'], [COMMIT, 'not-started']])
      expect(notRunLines(bad)).toEqual(['LE-E1 REFUSED LE_SUM_E_NOTRUN_USAGE']);
    // no fs use at all in the adapter's own code (comments stripped): it reads and creates nothing
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-e1-notrun.mjs'), 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
    expect(src).not.toMatch(/\bfs\b|\.write|openSync|setup\.txt'|child_process/);
  });
});

describe('host gate receipts (verify only; abrupt owner loss is UNRESOLVED)', () => {
  const block = (c: string, b: string, cl = 'REAPED', st = 'YES') => `LANE_CREATE_OK\nGATE CONTAINER ${c}\nGATE BRIDGE ${b}\nGATE CLIENTS ${cl}\nGATE STARTED ${st}\nLANE_GATES_END\n`;
  it('never-started orchestrator = no container; started without a complete block = UNRESOLVED', () => {
    expect(laneVerdict({ runLaneStarted: false, gatesText: null })).toMatchObject({ ok: true, container: 'LANE_NO_CONTAINER', bridge: 'BRIDGE_NOT_STARTED', source: 'NOT_INVOKED' });
    for (const t of [null, '', 'LANE_CREATE_OK\n', block('LANE_ABSENT', 'BRIDGE_REAPED').replace('LANE_GATES_END\n', ''), block('LANE_ABSENT', 'BRIDGE_REAPED') + 'GATE CONTAINER LANE_ABSENT\n'])
      expect(laneVerdict({ runLaneStarted: true, gatesText: t })).toMatchObject({ ok: false, container: 'UNRESOLVED', source: 'OWNER_LOST' });
  });
  it('accepts only a consistent block and never turns UNRESOLVED into absence', () => {
    expect(laneVerdict({ runLaneStarted: true, gatesText: block('LANE_ABSENT', 'BRIDGE_REAPED') }).ok).toBe(true);
    expect(laneVerdict({ runLaneStarted: true, gatesText: block('LANE_NO_CONTAINER', 'BRIDGE_NOT_STARTED', 'REAPED', 'NO') }).ok).toBe(true);
    expect(parseGates(block('LANE_NO_CONTAINER', 'BRIDGE_NOT_STARTED', 'REAPED', 'YES'))).toBeNull();
    expect(laneVerdict({ runLaneStarted: true, gatesText: block('UNRESOLVED', 'BRIDGE_REAPED') }).ok).toBe(false);
    expect(laneVerdict({ runLaneStarted: true, gatesText: block('LANE_ABSENT', 'UNRESOLVED') }).ok).toBe(false);
    expect(laneVerdict({ runLaneStarted: true, gatesText: block('LANE_ABSENT', 'BRIDGE_REAPED', 'UNRESOLVED') }).ok).toBe(false);
    expect(parseGates(block('LANE_ABSENT', 'BRIDGE_REAPED').replace('GATE BRIDGE', 'GATE BRIDGEX'))).toBeNull();
    expect(GATE_KEYS).toEqual(['CONTAINER', 'BRIDGE', 'CLIENTS', 'STARTED']);
    expect(verifyLines(laneVerdict({ runLaneStarted: true, gatesText: null })).at(-1)).toBe('LANE_GATE UNRESOLVED');
  });
  const read = new Map<string, number>();
  const fsFor = (files: Record<string, string>, opts: { unreadable?: string[] } = {}) => ({
    lstatSync: (p: string) => { if (opts.unreadable?.includes(p)) throw Object.assign(new Error('x'), { code: 'EACCES' }); if (!(p in files)) throw Object.assign(new Error('x'), { code: 'ENOENT' }); return { isFile: () => true, isSymbolicLink: () => false }; },
    openSync: (p: string) => { if (!(p in files)) throw Object.assign(new Error('x'), { code: 'ENOENT' }); read.set(p, 0); return p; },
    fstatSync: (fd: string) => ({ isFile: () => true, uid: process.getuid!(), mode: 0o100600, nlink: 1, size: Buffer.byteLength(files[fd]) }),
    readSync: (fd: string, buf: Buffer, off: number, len: number) => { const b = Buffer.from(files[fd]); const at = read.get(fd) ?? 0; const n = b.copy(buf, off, at, Math.min(b.length, at + len)); read.set(fd, at + n); return n; },
    closeSync: () => {},
  });
  it('plans from host receipts and private lane files; an unreadable receipt is UNRESOLVED, never "not started"', () => {
    expect(readVerdict(fsFor({}, { unreadable: [L.started] }), L)).toMatchObject({ ok: false, source: 'UNREADABLE' });
    expect(planLine(fsFor({}), L)).toBe('PLAN NOTRUN not-started LANE_NOT_STARTED');
    const done = { [L.started]: 'x', [L.gates]: block('LANE_ABSENT', 'BRIDGE_REAPED'), [L.laneTxt]: LANE_OK, [L.pwExit]: '0\n' };
    expect(planLine(fsFor(done), L)).toBe('PLAN SUMMARY 0 PASS PASS');
    expect(planLine(fsFor({ ...done, [L.gates]: 'LANE_CREATE_OK\n' }), L)).toBe('PLAN SKIP');
    const { [L.pwExit]: _, ...noPw } = done;
    expect(planLine(fsFor(noPw), L)).toBe('PLAN REFUSED LE_SUM_E_PW_MISSING');
  });
  // ---- image build and cleanup records (client state carried across steps) ----
  const BUILT_REC = imageBuildRecord({ invoked: true, id: IMG, clientsReaped: true, result: 'LANE_IMAGE_OK' });
  const fsx = (files: Record<string, string>) => ({
    lstatSync: (p: string) => { if (!(p in files)) throw Object.assign(new Error(), { code: 'ENOENT' }); return {}; },
    readFileSync: (p: string) => { if (!(p in files)) throw new Error('x'); return files[p]; },
  });
  const cleanup = async (files: Record<string, string>, exec?: (b: string, a: string[]) => Promise<Obj>) => {
    const put = new Map<string, string>();
    const calls: string[][] = [];
    const ex = exec ?? (async (_b: string, args: string[]) => (args[1] === 'rm' ? { ok: true, stdout: IMG } : { ok: true, stdout: `sha256:${'d'.repeat(64)}\n` }));
    const r = await cleanupLaneImage({ exec: async (b2: string, a2: string[]) => { calls.push(a2); return ex(b2, a2); }, fs: fsx(files),
      files: { put: (p2: string, t: string) => { if (p2 in files || put.has(p2)) throw new Error('EEXIST'); put.set(p2, t); } } } as never, { ctl: C, repo: R });
    return { ...r, rec: put.get(L.imageCleanupRec) ?? null, calls };
  };
  it('image cleanup removes the image only when the build record, its clients and the lane receipts all allow it', async () => {
    const notBuilt = { [L.imageBuildRec]: imageBuildRecord({ invoked: false, id: null, clientsReaped: true, result: 'LANE_E_IMAGE_CLOSURE' }) };
    expect(await cleanup(notBuilt)).toMatchObject({ ok: true, lines: ['LANE_IMAGE_NOT_BUILT', 'LANE_IMAGE_CLIENTS REAPED', 'LANE_IMAGE_CLEANUP CLEAN'] });
    const built = { [`${C}/build-invoked`]: 'x', [L.iid]: `${IMG}\n`, [L.imageBuildRec]: BUILT_REC };
    const removed = await cleanup(built); // never-invoked lane
    expect(removed).toMatchObject({ ok: true, lines: ['LANE_IMAGE_REMOVED', 'LANE_IMAGE_CLIENTS REAPED', 'LANE_IMAGE_CLEANUP CLEAN'] });
    expect(parseImageCleanupRecord(removed.rec)).toEqual({ code: 'LANE_IMAGE_REMOVED', clients: 'REAPED', result: 'CLEAN' });
    const held: [Record<string, string>, string][] = [
      [{}, 'LANE_E_IMAGE_RECORD'], // no build record at all (owner lost)
      [{ [`${C}/build-invoked`]: 'x', [L.iid]: `${IMG}\n` }, 'LANE_E_IMAGE_RECORD'],
      [{ ...built, [L.imageBuildRec]: 'BUILD_INVOKED YES\n' }, 'LANE_E_IMAGE_RECORD'],
      [{ ...notBuilt, [`${C}/build-invoked`]: 'x' }, 'LANE_E_IMAGE_RECORD'], // record disagrees with the receipt
      [{ ...built, [L.imageBuildRec]: imageBuildRecord({ invoked: true, id: IMG, clientsReaped: false, result: 'LANE_IMAGE_OK' }) }, 'LANE_E_IMAGE_BUILD_CLIENTS_UNRESOLVED'],
      [{ ...notBuilt, [L.imageBuildRec]: imageBuildRecord({ invoked: false, id: null, clientsReaped: false, result: 'LANE_E_IMAGE_CLOSURE' }) }, 'LANE_E_IMAGE_BUILD_CLIENTS_UNRESOLVED'],
      [{ ...built, [L.imageBuildRec]: imageBuildRecord({ invoked: true, id: null, clientsReaped: true, result: 'LANE_E_IMAGE_BUILD' }) }, 'LANE_E_IMAGE_ID'],
      [{ ...built, [L.iid]: `sha256:${'e'.repeat(64)}\n` }, 'LANE_E_IMAGE_ID'],
      [{ ...built, [L.started]: 'x' }, 'LANE_E_IMAGE_HELD_UNRESOLVED'],
      [{ ...built, [L.started]: 'x', [L.gates]: block('UNRESOLVED', 'BRIDGE_REAPED') }, 'LANE_E_IMAGE_HELD_UNRESOLVED'],
    ];
    for (const [files, code] of held) {
      const r = await cleanup(files);
      expect(r.lines[0], code).toBe(code);
      expect(r.ok).toBe(false);
      expect(r.calls.some((c) => c[1] === 'rm'), code).toBe(false); // nothing removed while held
    }
    const still = await cleanup(built, async (_b, args) => (args[1] === 'rm' ? { ok: true, stdout: IMG } : { ok: true, stdout: `${IMG}\n` }));
    expect(still.lines[0]).toBe('LANE_E_IMAGE_STILL_PRESENT');
    const lsFails = await cleanup(built, async (_b, args) => (args[1] === 'rm' ? { ok: true, stdout: IMG } : { ok: false, stdout: '' }));
    expect(lsFails.lines[0]).toBe('LANE_E_IMAGE_ABSENCE');
    // an unreaped cleanup client is recorded and never reads as clean, even when the listing looked empty
    const unreaped = await cleanup(built, async (_b, args) => (args[1] === 'rm' ? { ok: true, stdout: IMG } : { ok: true, stdout: '', unreaped: true }));
    expect(unreaped).toMatchObject({ ok: false, lines: ['LANE_IMAGE_REMOVED', 'LANE_IMAGE_CLIENTS UNRESOLVED', 'LANE_IMAGE_CLEANUP UNRESOLVED'] });
    expect(parseImageCleanupRecord(unreaped.rec)?.result).toBe('UNRESOLVED');
    // a pre-existing cleanup record (a second cleanup) is never overwritten
    const twice = await cleanup({ ...built, [L.imageCleanupRec]: 'x' });
    expect(twice.ok).toBe(false);
    expect(twice.lines.at(-1)).toBe('LANE_E_IMAGE_CLEANUP_RECORD');
    expect(sanitizedEnv({ PATH: '/x', HOME: '/home/runner', SUPABASE_DB_URL: 'sentinel-db-url', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ PATH: '/usr/bin:/bin', HOME: '/home/runner' });
  });
  it('image records parse only in their closed, self-consistent forms', () => {
    expect(parseImageBuildRecord(BUILT_REC)).toEqual({ invoked: true, id: IMG, clients: 'REAPED', result: 'LANE_IMAGE_OK' });
    for (const bad of [BUILT_REC.replace('END\n', ''), BUILT_REC.replace('YES', 'NO'), BUILT_REC.replace(IMG, 'NONE'), BUILT_REC.replace(IMG, 'UNKNOWN'),
      BUILT_REC.replace('LANE_IMAGE_OK', 'LANE_X'), `${BUILT_REC}x`, BUILT_REC.replace('REAPED', 'reaped')]) expect(parseImageBuildRecord(bad), bad).toBeNull();
    const c = imageCleanupRecord({ code: 'LANE_IMAGE_REMOVED', clientsReaped: true });
    expect(parseImageCleanupRecord(c)?.result).toBe('CLEAN');
    expect(parseImageCleanupRecord(c.replace('CLEAN', 'UNRESOLVED'))).toBeNull();
    expect(parseImageCleanupRecord(imageCleanupRecord({ code: 'LANE_E_IMAGE_REMOVE', clientsReaped: true }).replace('RESULT UNRESOLVED', 'RESULT CLEAN'))).toBeNull();
    expect(parseImageCleanupRecord(imageCleanupRecord({ code: 'LANE_IMAGE_REMOVED', clientsReaped: false }))?.result).toBe('UNRESOLVED');
  });
  // ---- image build: the job's Node becomes LANE_NODE; every client's state reaches the record ----
  type BF = { lddUnreaped?: string; lddFails?: string; buildOk?: boolean; buildUnreaped?: boolean; iid?: string | null; inspectUnreaped?: boolean; inspectBad?: boolean; inspectWorkdir?: unknown; ctlExists?: boolean; putFails?: boolean };
  const TOOLCACHE_NODE = '/opt/hostedtoolcache/node/22.11.0/x64/bin/node';
  const buildFake = (o: BF = {}) => {
    const files = new Map<string, Buffer>([[TOOLCACHE_NODE, Buffer.from('node-bytes')], [PSQL_REAL, Buffer.from('psql')], [SHELL, Buffer.from('shell')],
      [`${path.dirname(SHELL)}/libGLESv2.so`, Buffer.from('gl')], ['/lib/x86_64-linux-gnu/libc.so.6', Buffer.from('libc')], ...TOOLS.map((t) => [`/usr/bin/${t}`, Buffer.from(t)] as [string, Buffer])]);
    const dirs = new Set<string>(o.ctlExists ? [C] : []);
    const puts = new Map<string, string>();
    const calls: string[][] = [];
    const fsx = {
      existsSync: (p: string) => dirs.has(p) || files.has(p),
      mkdirSync: (p: string) => { dirs.add(p); },
      readdirSync: (p: string) => [...files.keys()].filter((f) => path.dirname(f) === p).map((f) => ({ name: path.basename(f), isFile: () => true })),
      realpathSync: (p: string) => p, statSync: () => ({ mode: 0o100755 }), chmodSync: () => {},
      copyFileSync: (a: string, b: string) => { if (files.has(b)) throw new Error('EEXIST'); files.set(b, files.get(a)!); },
      readFileSync: (p: string, enc?: string) => {
        if (p === L.iid) { if (o.iid === null) throw new Error('ENOENT'); return `${o.iid ?? IMG}\n`; }
        const v = files.get(p) ?? (puts.has(p) ? Buffer.from(puts.get(p)!) : undefined);
        if (!v) throw new Error('ENOENT');
        return enc ? v.toString() : v;
      },
    };
    const exec = async (bin: string, args: string[]) => {
      calls.push([bin, ...args]);
      if (bin === 'ldd') return o.lddFails === args[0] ? { ok: false, stdout: '' } : { ok: true, stdout: '\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x0)\n', unreaped: o.lddUnreaped === args[0] };
      if (args[0] === 'build') return { ok: o.buildOk ?? true, stdout: '', unreaped: o.buildUnreaped };
      if (args[0] === 'image') {
        const img = { Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], Entrypoint: null, Cmd: null, WorkingDir: '/', Labels: null, OnBuild: null } };
        if (o.inspectBad) img.Config.Env.push('X=1');
        if ('inspectWorkdir' in o) (img.Config as Obj).WorkingDir = o.inspectWorkdir;
        return { ok: true, stdout: JSON.stringify([img]), unreaped: o.inspectUnreaped };
      }
      return { ok: false, stdout: '' };
    };
    const d = { fs: fsx, exec, uid: () => UID, gid: () => GID, files: { put: (p: string, t: string) => { if (o.putFails && p === L.imageBuildRec) throw new Error('EIO'); if (puts.has(p)) throw new Error('EEXIST'); puts.set(p, String(t)); } } };
    return { d, files, puts, calls };
  };
  const build = async (o: BF = {}) => { const f = buildFake(o); const r = await buildLaneImage(f.d as never, { ctl: C, repo: R, node: TOOLCACHE_NODE, shell: SHELL }); return { ...r, ...f, rec: parseImageBuildRecord(f.puts.get(L.imageBuildRec) ?? '') }; };
  it('build copies the job Node byte-for-byte to LANE_NODE (on the enforced PATH), hash-recorded; never at its toolcache path', async () => {
    const r = await build();
    expect(r.code).toBe('LANE_IMAGE_OK');
    const root = `${C}/ctx/rootfs`;
    expect(r.files.get(`${root}${LANE_NODE}`)?.toString()).toBe('node-bytes');
    expect(r.files.has(`${root}${TOOLCACHE_NODE}`)).toBe(false);
    const manifest = r.puts.get(L.manifest)!;
    expect(manifest.split('\n')).toContain(`${createHash('sha256').update('node-bytes').digest('hex')}  ${LANE_NODE}`);
    expect(IMAGE_PATH_ENV.slice(5).split(':')).toContain(path.dirname(LANE_NODE));
    expect(r.puts.get(`${C}/ctx/Dockerfile`)).toBe(`FROM scratch\nCOPY rootfs/ /\nENV ${IMAGE_PATH_ENV}\nWORKDIR /\nUSER ${UID}:${GID}\n`);
    expect(r.fieldLines).toEqual([]);
    expect(r.rec).toEqual({ invoked: true, id: IMG, clients: 'REAPED', result: 'LANE_IMAGE_OK' });
    expect((await build({ ctlExists: true })).code).toBe('LANE_E_IMAGE_INPUT');
    const f = buildFake();
    expect((await buildLaneImage(f.d as never, { ctl: C, repo: R, node: LANE_NODE, shell: SHELL })).code).toBe('LANE_E_IMAGE_INPUT');
  });
  it('build records every client and unknown result: an unreaped ldd, build or inspect client, or a missing iid, is never clean', async () => {
    const lddU = await build({ lddUnreaped: PSQL_REAL });
    expect(lddU.code).toBe('LANE_E_IMAGE_UNRESOLVED');
    expect(lddU.rec).toMatchObject({ invoked: true, clients: 'UNRESOLVED' });
    const lddF = await build({ lddFails: '/usr/bin/sed' });
    expect(lddF.rec).toEqual({ invoked: false, id: 'NONE', clients: 'REAPED', result: 'LANE_E_IMAGE_CLOSURE' });
    expect(lddF.calls.some((c) => c[0] === 'docker')).toBe(false);
    const bU = await build({ buildOk: false, buildUnreaped: true, iid: null });
    expect(bU.rec).toEqual({ invoked: true, id: 'UNKNOWN', clients: 'UNRESOLVED', result: 'LANE_E_IMAGE_BUILD' });
    const noIid = await build({ iid: null });
    expect(noIid.rec).toEqual({ invoked: true, id: 'UNKNOWN', clients: 'REAPED', result: 'LANE_E_IMAGE_BUILD' });
    const iU = await build({ inspectUnreaped: true });
    expect(iU.code).toBe('LANE_E_IMAGE_UNRESOLVED');
    expect(iU.rec).toEqual({ invoked: true, id: IMG, clients: 'UNRESOLVED', result: 'LANE_IMAGE_OK' });
    expect((await build({ inspectBad: true })).rec?.result).toBe('LANE_E_IMAGE_CONFIG');
    for (const [wd, cls] of [['', 'EMPTY_STRING'], [null, 'NULL'], ['/home/runner/secret', 'ABS_PATH']] as const) {
      const w = await build({ inspectWorkdir: wd });
      expect([w.code, w.rec?.result, w.bad, w.fieldLines]).toEqual(['LANE_E_IMAGE_CONFIG', 'LANE_E_IMAGE_CONFIG', ['WorkingDir'], [`LANE_IMAGE_FIELD WorkingDir ${cls}`]]);
      expect(JSON.stringify(w.fieldLines)).not.toContain('secret');
    }
    const noRec = await build({ putFails: true });
    expect(noRec).toMatchObject({ code: 'LANE_E_IMAGE_UNRESOLVED', record: false });
  });
  it('bare `node` in the unchanged run.sh resolves, on the enforced lane PATH inside the BUILT rootfs, to the copied job Node', async () => {
    const r = await build();
    const root = `${C}/ctx/rootfs`;
    const view = (files: Map<string, Buffer>) => ({ accessSync: (p: string) => { if (!files.has(`${root}${p}`)) throw new Error('ENOENT'); }, realpathSync: (p: string) => p });
    const lanePath = { PATH: IMAGE_PATH_ENV.slice(5) };
    expect(closureProblems(view(r.files), lanePath, LANE_NODE)).toBe(false);
    // every bare node invocation in run.sh (no path qualifier) is what the lane PATH must resolve
    const runsh = readFileSync(path.join(ROOT, 'scripts/local-stack/lesson-editor/run.sh'), 'utf8');
    const bare = runsh.split('\n').filter((l) => /(^|[\s;|&(]|"\s*)node\s/.test(l) && !l.trim().startsWith('#'));
    expect(bare.length).toBeGreaterThanOrEqual(5);
    const which = (fx: Obj, t: string) => { for (const d of lanePath.PATH.split(':')) { try { fx.accessSync(`${d}/${t}`); return `${d}/${t}`; } catch { /* next */ } } return null; };
    expect(which(view(r.files), 'node')).toBe(LANE_NODE);
    expect(r.files.get(`${root}${which(view(r.files), 'node')}`)?.toString()).toBe('node-bytes');
    // the f47b3553 layout (Node only at its toolcache path) fails: bare node does not resolve
    const old = new Map<string, Buffer>(r.files);
    old.delete(`${root}${LANE_NODE}`);
    old.set(`${root}${TOOLCACHE_NODE}`, Buffer.from('node-bytes'));
    expect(which(view(old), 'node')).toBeNull();
    expect(closureProblems(view(old), lanePath, LANE_NODE)).toBe(true);
  });
  it('cleanup scope: lane-only scope vs complete effective cleanup over every credential consumer; controls kept unless all clean', () => {
    const okV = laneVerdict({ runLaneStarted: false, gatesText: null });
    const badV = laneVerdict({ runLaneStarted: true, gatesText: null });
    const ok3 = { preview: 'success', stack: 'success', producers: 'success' };
    const cleanRec = imageCleanupRecord({ code: 'LANE_IMAGE_REMOVED', clientsReaped: true });
    const base = { verdict: okV, privateRemoved: true, outcomes: ok3, buildRec: BUILT_REC, cleanupRec: cleanRec, controlsPresent: true };
    const CS = (o: Obj = {}) => ['preview', 'stack', 'producers'].map((k) => `SECRET_CONSUMER ${k} ${o[k] ?? 'STOPPED'}`);
    expect(cleanupScope(base)).toEqual({ effective: true, controls: 'REMOVE', lines: ['LANE_SECRET_SCOPE CLEAN', ...CS(), 'SECRET_CLEANUP_EFFECTIVE', 'CONTROLS REMOVE'] });
    for (const start of [undefined, 'success', 'skipped'])
      for (const k of ['preview', 'stack', 'producers'])
        for (const v of ['failure', 'cancelled', 'skipped', '', undefined]) {
          // a skipped stop with a reported start of 'skipped' is the only never-started case, and only for stack/producers
          if (start === 'skipped' && v === 'skipped' && k !== 'preview') continue;
          const r = cleanupScope({ ...base, outcomes: { ...ok3, start, [k]: v } });
          expect(r.effective, `${k}=${v} start=${start}`).toBe(false);
          expect(r.lines).toEqual(['LANE_SECRET_SCOPE CLEAN', ...CS({ [k]: 'UNRESOLVED' }), `SECRET_CLEANUP_UNRESOLVED ${k}`, 'CONTROLS REMOVE']);
        }
    expect(cleanupScope({ ...base, verdict: badV }).lines).toEqual(['LANE_SECRET_SCOPE UNRESOLVED', ...CS(), 'SECRET_CLEANUP_UNRESOLVED lane', 'CONTROLS KEEP']);
    expect(cleanupScope({ ...base, privateRemoved: false }).lines).toEqual(['LANE_SECRET_SCOPE UNRESOLVED', ...CS(), 'SECRET_CLEANUP_UNRESOLVED private', 'CONTROLS REMOVE']);
    expect(cleanupScope({ ...base, outcomes: {}, verdict: badV, privateRemoved: false }).lines[4]).toBe('SECRET_CLEANUP_UNRESOLVED preview,stack,producers,lane,private');
    for (const over of [{ buildRec: null }, { cleanupRec: null }, { cleanupRec: imageCleanupRecord({ code: 'LANE_E_IMAGE_REMOVE', clientsReaped: true }) },
      { cleanupRec: imageCleanupRecord({ code: 'LANE_IMAGE_REMOVED', clientsReaped: false }) }, { buildRec: imageBuildRecord({ invoked: true, id: IMG, clientsReaped: false, result: 'LANE_IMAGE_OK' }) }]) {
      const r = cleanupScope({ ...base, ...over });
      expect(r.controls, JSON.stringify(over)).toBe('KEEP');
      expect(r.effective).toBe(true); // image/control state is not a secret consumer; it is kept, never deleted, and fails the step separately
    }
    expect(cleanupScope({ ...base, controlsPresent: false, buildRec: null, cleanupRec: null }).controls).toBe('NONE');
  });
  it('never-started consumers: only an exact skipped start AND an exact skipped own stop count, and only for stack and psql producers', () => {
    const okV = laneVerdict({ runLaneStarted: false, gatesText: null });
    const cleanRec = imageCleanupRecord({ code: 'LANE_IMAGE_REMOVED', clientsReaped: true });
    const base = { verdict: okV, privateRemoved: true, buildRec: BUILT_REC, cleanupRec: cleanRec, controlsPresent: true };
    // Run 41792791076 shape: image refused before le_prep, so le_start, le_stop and le_producers were skipped; preview stop ran.
    const r1 = cleanupScope({ ...base, outcomes: { preview: 'success', stack: 'skipped', producers: 'skipped', start: 'skipped' } });
    expect(r1).toEqual({ effective: true, controls: 'REMOVE', lines: ['LANE_SECRET_SCOPE CLEAN', 'SECRET_CONSUMER preview STOPPED',
      'SECRET_CONSUMER stack NEVER_STARTED', 'SECRET_CONSUMER producers NEVER_STARTED', 'SECRET_CLEANUP_EFFECTIVE', 'CONTROLS REMOVE'] });
    // the same run before this change (no start outcome passed): unchanged UNRESOLVED
    expect(cleanupScope({ ...base, outcomes: { preview: 'success', stack: 'skipped', producers: 'skipped' } }).lines)
      .toContain('SECRET_CLEANUP_UNRESOLVED stack,producers');
    const VALS = ['success', 'skipped', 'failure', 'cancelled', '', undefined, null, 'Skipped', 'skipped ', ' skipped', 'SKIPPED', 'skipped\n', 0, true, ['skipped'], { v: 'skipped' }];
    for (const name of ['preview', 'stack', 'producers'])
      for (const own of VALS)
        for (const start of VALS) {
          const got = consumerState(name, { [name]: own, start } as never);
          const want = own === 'success' ? 'STOPPED' : name !== 'preview' && own === 'skipped' && start === 'skipped' ? 'NEVER_STARTED' : 'UNRESOLVED';
          expect(got, `${name} own=${JSON.stringify(own)} start=${JSON.stringify(start)}`).toBe(want);
        }
    // missing or malformed outcome containers never yield NEVER_STARTED
    for (const o of [undefined, null, {}, 'skipped', ['skipped'], { start: 'skipped' }]) for (const n of ['stack', 'producers']) expect(consumerState(n, o as never)).toBe('UNRESOLVED');
    // an inherited (prototype) value is not an outcome the runner reported
    const proto = Object.create({ stack: 'skipped', start: 'skipped' });
    expect(consumerState('stack', proto)).toBe('UNRESOLVED');
    expect(consumerState('stack', Object.assign(Object.create({ start: 'skipped' }), { stack: 'skipped' }))).toBe('UNRESOLVED');
    expect(consumerState('stack', { stack: 'skipped', start: 'skipped' })).toBe('NEVER_STARTED');
    expect(consumerState('lane', { lane: 'skipped', start: 'skipped' })).toBe('UNRESOLVED');
    // partially-started or interrupted stacks: start failed, cancelled or succeeded while the stop was skipped
    for (const start of ['failure', 'cancelled', 'success']) {
      const r = cleanupScope({ ...base, outcomes: { preview: 'success', stack: 'skipped', producers: 'skipped', start } });
      expect(r.effective).toBe(false);
      expect(r.lines).toContain('SECRET_CLEANUP_UNRESOLVED stack,producers');
    }
    // a started-and-stopped stack is still STOPPED, never NEVER_STARTED
    expect(cleanupScope({ ...base, outcomes: { preview: 'success', stack: 'success', producers: 'success', start: 'success' } }).lines.filter((l) => /NEVER_STARTED/.test(l))).toEqual([]);
    // a skipped preview stop is never excused, whatever the start outcome
    expect(cleanupScope({ ...base, outcomes: { preview: 'skipped', stack: 'skipped', producers: 'skipped', start: 'skipped' } }).lines).toContain('SECRET_CLEANUP_UNRESOLVED preview');
  });
  it('le_private: secrets and controls are separate decisions; the control dir is removed ONLY on CONTROLS REMOVE', () => {
    const job = (YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8')) as Obj).jobs['lesson-editor'];
    const st = job.steps.find((x: Obj) => x.id === 'le_private');
    expect(st.env).toEqual({ O_PREVIEW: '${{ steps.le_owned_stop.outcome }}', O_STACK: '${{ steps.le_stop.outcome }}', O_PRODUCERS: '${{ steps.le_producers.outcome }}',
      O_START: '${{ steps.le_start.outcome }}' });
    const run: string = st.run;
    expect(run).toContain('gates.mjs scope "$C" "$RUNNER_TEMP/le-private" "$GITHUB_WORKSPACE" "$O_PREVIEW" "$O_STACK" "$O_PRODUCERS" "$rc" "$O_START")');
    expect(run.match(/rm -rf -- "\$C"/g)).toHaveLength(1);
    const rmAt = run.indexOf('rm -rf -- "$C"');
    expect(run.lastIndexOf('*"CONTROLS REMOVE"*)', rmAt)).toBeGreaterThan(run.indexOf('SCOPE=$('));
    expect(run.slice(run.indexOf('*"CONTROLS REMOVE"*)'), rmAt)).not.toMatch(/;;/);
    expect(run).not.toMatch(/echo "SECRET_CLEANUP_EFFECTIVE/); // only gates.mjs may print it
    const ids = job.steps.map((x: Obj) => x.id);
    for (const dep of ['le_owned_stop', 'le_stop', 'le_producers']) expect(ids.indexOf(dep)).toBeLessThan(ids.indexOf('le_private'));
  });
});

describe('bridge: seal before any upstream connect, seal ack independent of drain, bounded close, exact records', () => {
  // Realistic listener fake: like net.Server, close(cb) stops accepting at once but calls cb ONLY after every connection that
  // listener accepted has ended (destroyed). `hang` = a listener whose close callback never fires.
  const fakeNet = (o: { hang?: number } = {}) => {
    const servers: Obj[] = [];
    const ups: Obj[] = [];
    const mkSock = (srv?: Obj) => {
      const so: Obj = Object.assign(new EventEmitter(), { destroyed: false, pipe() {} });
      so.destroy = () => { if (so.destroyed) return; so.destroyed = true; if (srv) { srv.conns.delete(so); srv.check(); } };
      return so;
    };
    const net = {
      createServer: (h: (c: Obj) => void) => {
        const idx = servers.length;
        const srv: Obj = Object.assign(new EventEmitter(), { h, closing: false, conns: new Set(), cbs: [] as (() => void)[], closedFired: false,
          listen: (_p: string, cb: () => void) => cb(),
          close: (cb: () => void) => { srv.closing = true; srv.cbs.push(cb); srv.check(); },
          check: () => { if (srv.closing && srv.conns.size === 0 && o.hang !== idx && !srv.closedFired) { srv.closedFired = true; for (const f of srv.cbs) setTimeout(f, 0); } },
          // the kernel delivering a (possibly queued) connection to this listener
          accept: () => { const c = mkSock(srv); srv.conns.add(c); srv.h(c); return c; } });
        servers.push(srv);
        return srv;
      },
      connect: (to: Obj) => { const u = mkSock(); u.to = to; ups.push(u); return u; },
    };
    return { net, servers, ups };
  };
  // Process-liveness model (Node event loop): the process stays alive only while a REFERENCED handle exists: an open listener
  // (until its close callback has fired), an undestroyed client or upstream socket, or the bridge's own hold. Signal watchers
  // and the unref'd sleeps count for nothing, exactly like Node 20.
  const mk = (o: { hang?: number; ceiling?: boolean; noHold?: boolean } = {}) => {
    const f = fakeNet(o);
    const put: [string, string][] = [];
    const unlinked: string[] = [];
    const events: string[] = [];
    const holds = new Set<number>();
    let nextHold = 0;
    const exits: number[] = [];
    const hold = () => { const id = nextHold++; if (!o.noHold) holds.add(id); events.push('hold'); return { release: () => { holds.delete(id); events.push('release'); } }; };
    const sleep = (ms: number) => new Promise<void>((r) => { if (ms === SEALED_HOLD_MAX_MS && !o.ceiling) return; setTimeout(r, Math.min(ms, 20)); });
    const b = createBridge({ net: f.net, files: { put: (p: string, t: string) => { put.push([p, t]); events.push(`put ${p.split('/').at(-1)}`); }, unlink: (p: string) => unlinked.push(p) },
      pid: 9, starttime: '77', sleep, hold, exit: (c: number) => { exits.push(c); events.push(`exit ${c}`); } }, { sockDir: L.sock, ctl: C, ports: { api: 54321, db: 54322, app: 8080 } });
    const alive = () => holds.size > 0 || f.servers.some((x) => !x.closedFired) || f.servers.some((x) => x.conns.size > 0) || f.ups.some((u) => !u.destroyed);
    return { ...f, put, unlinked, b, events, exits, alive, holds };
  };
  const tick = () => new Promise<void>((r) => { setTimeout(r, 5); });
  const finalOf = (t: { put: [string, string][] }) => t.put.find(([p]) => p === `${C}/bridge-final`)?.[1] ?? null;
  it('listens on exactly three sockets and forwards each to its one fixed loopback port', async () => {
    const t = mk();
    await t.b.listen();
    expect(t.servers).toHaveLength(3);
    expect(t.put).toEqual([[`${C}/bridge-ready`, '9 77 54321 54322 8080\n']]);
    t.servers[1].accept();
    expect(t.ups.map((u) => u.to)).toEqual([{ host: '127.0.0.1', port: 54322 }]);
    expect(() => createBridge({ net: t.net, files: { put() {}, unlink() {} }, hold() {}, exit() {} } as never, { sockDir: L.sock, ctl: C, ports: { api: 1, db: 2 } as never })).toThrow();
    for (const miss of [{ hold: undefined }, { exit: undefined }])
      expect(() => createBridge({ net: t.net, files: { put() {}, unlink() {} }, sleep() {}, hold() {}, exit() {}, ...miss } as never, { sockDir: L.sock, ctl: C, ports: { api: 1, db: 2, app: 3 } })).toThrow('lifetime');
  });
  it('liveness, no client: after seal every listener has closed and nothing else is referenced, yet the bridge stays alive on its own hold until close writes bridge-final; then released', async () => {
    const t = mk();
    await t.b.listen();
    expect(t.b.holding()).toBe(true);
    await t.b.seal();
    await tick(); // listener close callbacks fire (no connections)
    expect(t.servers.every((x) => x.closedFired)).toBe(true);
    expect(t.alive()).toBe(true); // ONLY the hold: without it Node would exit here, before SIGTERM, with no bridge-final
    expect(t.holds.size).toBe(1);
    await tick(); await tick();
    expect(t.alive()).toBe(true); // still alive later: nothing releases it except close (or the bounded ceiling)
    await t.b.close();
    expect(t.events.slice(-2)).toEqual(['put bridge-final', 'release']); // release strictly AFTER the final receipt
    expect(t.alive()).toBe(false);
    expect(parseBridgeFinal(finalOf(t)!)).toMatchObject({ listeners: 'CLOSED', closeBy: 'OWNER' });
    expect(t.exits).toEqual([]); // the owner path exits through the SIGTERM handler (exit 0), not here
  });
  it('liveness, already-drained client: a connection that ended before seal leaves nothing referenced but the hold', async () => {
    const t = mk();
    await t.b.listen();
    const c = t.servers[1].accept();
    c.destroy(); t.ups[0].destroy(); c.emit('close'); // the peer finished before the seal
    await t.b.seal();
    await tick();
    expect(t.servers.every((x) => x.closedFired) && t.ups.every((u) => u.destroyed)).toBe(true);
    expect(t.alive()).toBe(true);
    await t.b.close();
    expect(t.alive()).toBe(false);
    expect(parseBridgeFinal(finalOf(t)!)).toEqual({ api: { accepted: 0, refused: 0, open: 0 }, db: { accepted: 1, refused: 0, open: 0 }, app: { accepted: 0, refused: 0, open: 0 }, listeners: 'CLOSED', closeBy: 'OWNER' });
  });
  it('liveness regression: with NO referenced hold (the r2 shape) the process is dead after seal plus drain, before any SIGTERM could write bridge-final', async () => {
    const t = mk({ noHold: true });
    await t.b.listen();
    const c = t.servers[0].accept();
    await t.b.seal();
    c.destroy(); t.ups[0].destroy(); // active connection drains after the seal
    await tick();
    expect(t.alive()).toBe(false);
    expect(finalOf(t)).toBeNull();
  });
  it('bounded hold: with no owner SIGTERM the bridge closes itself after SEALED_HOLD_MAX_MS, records CLOSE CEILING, releases, exits 4; run-lane rejects it', async () => {
    const t = mk({ ceiling: true });
    await t.b.listen();
    t.servers[2].accept();
    await t.b.seal();
    for (let n = 0; n < 20 && t.exits.length === 0; n++) await tick();
    expect(t.exits).toEqual([4]);
    expect(t.events.slice(-3)).toEqual(['put bridge-final', 'release', 'exit 4']);
    expect(parseBridgeFinal(finalOf(t)!)).toMatchObject({ closeBy: 'CEILING', app: { open: 1 } });
    expect(t.alive()).toBe(false);
    await t.b.close(); // a late owner close is a no-op: one final record only
    expect(t.put.filter(([p]) => p.endsWith('bridge-final'))).toHaveLength(1);
  });
  it('the hold is released even when writing bridge-final fails; the real main holds a referenced (never unref\'d) interval', async () => {
    const t = mk();
    await t.b.listen();
    const b2 = createBridge({ net: fakeNet().net, files: { put: (p: string) => { if (p.endsWith('bridge-final')) throw new Error('EEXIST'); }, unlink() {} }, pid: 1, starttime: '1',
      sleep: () => new Promise<void>(() => {}), hold: () => ({ release: () => { rel++; } }), exit() {} }, { sockDir: L.sock, ctl: C, ports: { api: 1, db: 2, app: 3 } });
    let rel = 0;
    await b2.listen();
    await expect(b2.close()).rejects.toThrow('EEXIST');
    expect(rel).toBe(1);
    expect(b2.holding()).toBe(false);
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/bridge.mjs'), 'utf8');
    const main = src.slice(src.indexOf("if (process.argv[1]"));
    expect(main).toMatch(/const hold = \(\) => \{ const t = setInterval\(\(\) => \{\}, 1 << 30\); return \{ release: \(\) => clearInterval\(t\) \}; \};/);
    expect(main).not.toMatch(/t\.unref|hold[^\n]*unref/);
    expect(main).toMatch(/createBridge\(\{ net, files, pid: process\.pid, starttime, sleep, hold, exit \}/);
    expect(main).toMatch(/process\.on\('SIGTERM', \(\) => \{ b\.close\(\)\.then\(\(\) => process\.exit\(0\)/);
    await t.b.close();
  });
  it('seal acks with ACTIVE connections still open (no deadlock); queued accepts after seal never open an upstream', async () => {
    const t = mk();
    await t.b.listen();
    const active = t.servers[1].accept(); // a live DB connection, as during E1
    expect(t.ups).toHaveLength(1);
    const sealing = t.b.seal();
    expect(t.b.isSealed()).toBe(true); // synchronously, before anything else
    const queued = t.servers[0].accept(); // the kernel delivering an accept that was queued before close took effect
    await sealing; // resolves although `active` is still open and its listener's close callback has NOT fired
    expect(active.destroyed).toBe(false);
    expect(t.servers[1].closedFired).toBe(false);
    expect(t.ups).toHaveLength(1);
    expect(queued.destroyed).toBe(true);
    expect(t.put.at(-1)).toEqual([`${C}/seal-ack`, 'sealed\n']);
    expect(t.servers.every((x) => x.closing)).toBe(true);
    expect(t.unlinked).toEqual(['api', 'db', 'app'].map((k) => `${L.sock}/${k}.sock`));
    expect(t.b.stats.api.refusedAfterSeal).toBe(1);
  });
  it('close destroys live connections FIRST, then the listener callbacks fire; records open-at-close and LISTENERS CLOSED', async () => {
    const t = mk();
    await t.b.listen();
    const c1 = t.servers[2].accept();
    const c2 = t.servers[1].accept();
    await t.b.seal();
    await t.b.close();
    expect(c1.destroyed && c2.destroyed && t.ups.every((u) => u.destroyed)).toBe(true);
    expect(t.servers.every((x) => x.closedFired)).toBe(true);
    expect(parseBridgeFinal(finalOf(t)!)).toEqual({ api: { accepted: 0, refused: 0, open: 0 }, db: { accepted: 1, refused: 0, open: 1 }, app: { accepted: 1, refused: 0, open: 1 }, listeners: 'CLOSED', closeBy: 'OWNER' });
    const fin = finalOf(t)!;
    for (const bad of ['', 'api accepted=1 refused=0 open=0\nEND\n', fin.replace('END', 'END2'), fin.replace('db ', 'xx '), fin.replace('LISTENERS CLOSED\n', ''), fin.replace('CLOSED', 'DONE'), fin.replace('CLOSE OWNER\n', ''), fin.replace('CLOSE OWNER', 'CLOSE OTHER'), fin.replace('CLOSE OWNER\nEND', 'END\nCLOSE OWNER')])
      expect(parseBridgeFinal(bad)).toBeNull();
  });
  it('close without a prior seal (SIGTERM path) still seals, destroys and completes; a listener that never closes is bounded and UNRESOLVED', async () => {
    const t = mk();
    await t.b.listen();
    t.servers[0].accept();
    await t.b.close();
    expect(t.put.map(([p]) => p)).toEqual([`${C}/bridge-ready`, `${C}/seal-ack`, `${C}/bridge-final`]);
    expect(parseBridgeFinal(finalOf(t)!)?.listeners).toBe('CLOSED');
    const h = mk({ hang: 2 });
    await h.b.listen();
    h.servers[2].accept();
    await h.b.close(); // returns after the bounded wait
    expect(parseBridgeFinal(finalOf(h)!)?.listeners).toBe('UNRESOLVED');
  });
  it('the pre-fix ordering would deadlock under this fake: awaiting the close callbacks before destroying never resolves', async () => {
    const t = mk();
    await t.b.listen();
    t.servers[1].accept();
    for (const srv of t.servers) srv.close(() => {});
    const waited = await Promise.race([new Promise((r) => { const iv = setInterval(() => { if (t.servers.every((x) => x.closedFired)) { clearInterval(iv); r('closed'); } }, 1); setTimeout(() => clearInterval(iv), 60); }),
      new Promise((r) => { setTimeout(() => r('stuck'), 50); })]);
    expect(waited).toBe('stuck'); // so the fake really models callbacks that wait for active connections
  });
  it('source order: the sealed check is the handler\'s first statement; seal() awaits nothing; close() destroys before waiting', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/bridge.mjs'), 'utf8');
    const h = src.slice(src.indexOf('const handler = (name) => (client) => {'));
    expect(h.split('\n')[2].trim()).toMatch(/^if \(sealed\) \{ stats\[name\]\.refusedAfterSeal\+\+; client\.destroy\(\); return; \}$/);
    expect(src.indexOf('const seal = () => {')).toBeGreaterThan(0);
    expect(src.indexOf('const finalize = async () => {')).toBeGreaterThan(src.indexOf('const seal = () => {'));
    const seal = src.slice(src.indexOf('const seal = () => {'), src.indexOf('const finalize = async () => {'));
    const code = seal.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code.indexOf('sealed = true')).toBeGreaterThan(0);
    expect(code).not.toMatch(/\bawait\b/);
    const fin = src.slice(src.indexOf('const finalize = async () => {'), src.indexOf("const close = (by = 'OWNER') => {"));
    expect(fin.indexOf('p.client.destroy()')).toBeGreaterThan(0);
    expect(fin.indexOf('p.client.destroy()')).toBeLessThan(fin.indexOf('Promise.race'));
    const close = src.slice(src.indexOf("const close = (by = 'OWNER') => {"), src.indexOf('return { listen, seal, close'));
    expect(close).toMatch(/try \{ await finalize\(\); \} finally \{[^]*life\?\.release\(\)/);
    expect(src).not.toMatch(/console\.|\.on\('data'/);
  });
});

// ---- orchestrator ----
type RO = { createOk?: boolean; cidFile?: string | null; createOut?: string; createUnreaped?: boolean; inspectBad?: (o: Obj) => void; neverStartedState?: Obj;
  lsOut?: [boolean, string]; bridgeNoExit?: boolean; procStays?: boolean; finalOpen?: number; noBridgeReady?: boolean; startOut?: string; waitOut?: string; failPut?: string[];
  inputsBad?: boolean; shellSha?: string; manifestNode?: string; listeners?: string; closeBy?: string; earlyExit?: boolean };
function laneFake(o: RO = {}) {
  const nodeSha = createHash('sha256').update('node-bytes').digest('hex');
  const files = new Map<string, string | Buffer>([[L.iid, `${IMG}\n`], [L.seccomp, PROFILE_RAW], [SHELL, Buffer.from('shell')], [NODE, Buffer.from('node-bytes')],
    [L.manifest, `${'1'.repeat(64)}  /usr/bin/sed\n${o.manifestNode ?? nodeSha}  ${LANE_NODE}\n`]]);
  const procs = new Set<string>();
  const calls: string[][] = [];
  const put: string[] = [];
  let state: Obj = CREATED, exists = false;
  const dir = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, mode: 0o40700, uid: UID, nlink: 2 };
  const file = { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, mode: 0o100600, uid: UID, nlink: 1 };
  const stats = new Map<string, Obj>([[L.P, dir], [L.keys, dir], [L.anon, file], [L.service, file], [L.dbpass, o.inputsBad ? { ...file, mode: 0o100644 } : file], [L.proofDir, dir], [L.proof, file], [L.sock, dir], [L.lane, dir], [L.out, dir], [L.C, dir]]);
  const enoent = () => Object.assign(new Error('x'), { code: 'ENOENT' });
  const fsx = {
    readFileSync: (p: string, enc?: string) => { if (p.startsWith('/proc/')) { if (!procs.has(p)) throw enoent(); return '9 (node) S 1 1 1 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 555 0 0'; } const v = files.get(p); if (v === undefined) throw enoent(); return enc ? v.toString() : v; },
    lstatSync: (p: string) => { const s = stats.get(p); if (!s) throw enoent(); return s; },
    readdirSync: () => [],
    statSync: (p: string) => { if (!procs.has(`${p}/stat`) && !(o.procStays && p === '/proc/4242')) throw enoent(); return {}; },
  };
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null as number | null, signalCode: null as string | null, kill: (sig: string) => {
    calls.push(['kill', sig]);
    if (sig === 'SIGUSR2') files.set(L.sealAck, 'sealed\n');
    // the r2 failure shape: the bridge exits on its own after seal plus drain, before SIGTERM, with no bridge-final
    if (sig === 'SIGUSR2' && o.earlyExit) { procs.delete('/proc/4242/stat'); child.exitCode = 0; process.nextTick(() => child.emit('exit', 0)); }
    if ((sig === 'SIGTERM' || sig === 'SIGKILL') && !o.bridgeNoExit) {
      files.set(L.bridgeFinal, `api accepted=1 refused=0 open=0\ndb accepted=1 refused=0 open=${o.finalOpen ?? 0}\napp accepted=1 refused=0 open=0\nLISTENERS ${o.listeners ?? 'CLOSED'}\nCLOSE ${o.closeBy ?? 'OWNER'}\nEND\n`);
      procs.delete('/proc/4242/stat');
      child.exitCode = 0;
      process.nextTick(() => child.emit('exit', 0));
    }
    return true; } });
  const exec = async (bin: string, args: string[]) => {
    calls.push([bin, ...args]);
    const c = args[0];
    if (c === 'create') { if (o.cidFile !== null) files.set(L.cidfile, `${o.cidFile ?? CIDV}\n`); exists = true; return { ok: o.createOk ?? true, stdout: `${o.createOut ?? CIDV}\n`, unreaped: o.createUnreaped }; }
    if (c === 'container' && args[1] === 'inspect') { const g = goodInspect(state) as Obj; if (o.inspectBad && state === CREATED) o.inspectBad(g); return exists ? { ok: true, stdout: JSON.stringify([g]) } : { ok: false, stdout: '' }; }
    if (c === 'start') { state = { Status: 'running', Running: true, Paused: false, Restarting: false, Pid: 77, Dead: false, StartedAt: '2026-11-04T01:00:00Z' }; return { ok: true, stdout: `${o.startOut ?? CIDV}\n` }; }
    if (c === 'wait') { state = { Status: 'exited', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '2026-11-04T01:00:00Z' }; return { ok: true, stdout: `${o.waitOut ?? '0'}\n` }; }
    if (c === 'stop') return { ok: true, stdout: `${CIDV}\n` };
    if (c === 'rm') { exists = false; return { ok: true, stdout: `${CIDV}\n` }; }
    if (c === 'container' && args[1] === 'ls') return o.lsOut ? { ok: o.lsOut[0], stdout: o.lsOut[1] } : { ok: true, stdout: exists ? `${CIDV}\n` : '' };
    return { ok: false, stdout: '' };
  };
  const d = {
    exec, fs: fsx, uid: () => UID, gid: () => GID, sleep: () => new Promise<void>((r) => { setTimeout(r, 2); }) /* a real macrotask: an exit emitted on the next tick wins */, browserSha256: o.shellSha,
    files: { put: (p: string, t: string) => { if (o.failPut?.includes(p)) throw new Error('EEXIST'); put.push(p); files.set(p, t); } },
    spawnBridge: (script: string, args: string[]) => { calls.push(['spawnBridge', script, ...args]); if (!o.noBridgeReady) { files.set(L.bridgeReady, '4242 555 54321 54322 8080\n'); procs.add('/proc/4242/stat'); } return child; },
  };
  return { d, calls, put, files };
}
// the browserSha256 seam takes the digest of the fake shell bytes; main() never sets it (checked below)
const go = (o: RO = {}) => { const f = laneFake({ shellSha: createHash('sha256').update('shell').digest('hex'), ...o }); return runLane(f.d as never, { C, P, R, node: NODE, shell: SHELL, apiOrigin: API, dbUrl: DB, commit: COMMIT }).then((r) => ({ ...r, ...f })); };
const gatesOf = (say: string[]) => Object.fromEntries(say.filter((l) => l.startsWith('GATE ')).map((l) => l.split(' ').slice(1)));
const order = (calls: string[][], ...keys: string[]) => keys.map((k) => calls.findIndex((c) => c.join(' ').startsWith(k)));

describe('run-lane: one orchestrator owns create, start, bridge seal/terminate/reap and teardown', () => {
  it('happy path: receipt, create, inspect, bridge, start, wait, then SEAL, container teardown, bridge reap; gates block last', async () => {
    const r = await go();
    expect(r.ok).toBe(true);
    expect(gatesOf(r.say)).toEqual({ CONTAINER: 'LANE_ABSENT', BRIDGE: 'BRIDGE_REAPED', CLIENTS: 'REAPED', STARTED: 'YES' });
    const ix = order(r.calls, 'docker create', 'docker container inspect', 'spawnBridge', 'docker start', 'docker wait', 'kill SIGUSR2', 'docker stop', 'docker rm', 'docker container ls', 'kill SIGTERM');
    expect([...ix].sort((a, b) => a - b)).toEqual(ix);
    expect(ix.every((i) => i >= 0)).toBe(true);
    expect(r.put.slice(0, 2)).toEqual([L.started, L.createInvoked]);
    expect(r.put.at(-1)).toBe(L.gates);
    expect(r.say.at(-1)).toBe('LANE_GATES_END');
    expect(parseGates(String(r.files.get(L.gates)))).not.toBeNull();
    // bridge spawned with exactly its fixed destinations and the sanitized env (realDeps), never a destination from the container
    expect(r.calls.find((c) => c[0] === 'spawnBridge')).toEqual(['spawnBridge', L.bridge, L.sock, C, '54321', '54322', '8080']);
  });
  it('invalid inputs or a failed started receipt: no docker call at all, so "never invoked" stays true', async () => {
    // the lane Node must equal this job's Node byte for byte (manifest entry for LANE_NODE), else nothing starts
    for (const o of [{ inputsBad: true }, { shellSha: '0'.repeat(64) }, { failPut: [L.started] }, { manifestNode: '2'.repeat(64) }] as RO[]) {
      const r = await go(o);
      expect(r.ok).toBe(false);
      expect(r.calls.filter((c) => c[0] === 'docker' || c[0] === 'spawnBridge')).toEqual([]);
      expect(r.put).not.toContain(L.gates);
    }
  });
  it('invoked create with a missing, invalid or disagreeing CID is UNRESOLVED: no bridge, no start, no absence inferred', async () => {
    for (const o of [{ cidFile: null }, { cidFile: 'nope' }, { createOut: 'd'.repeat(64) }, { createOut: '' }, { createOk: false, cidFile: null }] as RO[]) {
      const r = await go(o);
      expect(gatesOf(r.say), JSON.stringify(o)).toEqual({ CONTAINER: 'UNRESOLVED', BRIDGE: 'BRIDGE_NOT_STARTED', CLIENTS: 'REAPED', STARTED: 'NO' });
      expect(r.say).toContain('LANE_E_CID_UNKNOWN');
      expect(r.calls.some((c) => c[0] === 'spawnBridge' || c[1] === 'start' || c[1] === 'rm')).toBe(false);
      expect(laneVerdict({ runLaneStarted: true, gatesText: String(r.files.get(L.gates)) }).ok).toBe(false);
    }
    const u = await go({ createUnreaped: true });
    expect(gatesOf(u.say).CLIENTS).toBe('UNRESOLVED');
  });
  it('config mismatch: the created-never-started branch (no stop), plain rm by full CID, successful-empty listing', async () => {
    const r = await go({ inspectBad: (g) => { g.Config.Env.push('X=1'); } });
    expect(r.say).toEqual(expect.arrayContaining(['LANE_E_CONFIG', 'LANE_CONFIG_FIELD Env', 'LANE_STOP_SKIPPED_NEVER_STARTED', 'LANE_CREATED_NEVER_STARTED', 'LANE_RM_OK', 'LANE_ABSENT']));
    expect(gatesOf(r.say)).toEqual({ CONTAINER: 'LANE_ABSENT', BRIDGE: 'BRIDGE_NOT_STARTED', CLIENTS: 'REAPED', STARTED: 'NO' });
    expect(r.calls.some((c) => c[1] === 'stop' || c[1] === 'start' || c[0] === 'spawnBridge')).toBe(false);
    expect(r.calls.find((c) => c[1] === 'rm')).toEqual(['docker', 'rm', CIDV]);
  });
  it('a never-started inspect that is not exactly created-never-started is UNRESOLVED (no rm)', async () => {
    const r = await go({ inspectBad: (g) => { g.Config.Env.push('X=1'); g.State = { ...CREATED, StartedAt: '2026-11-04T00:00:00Z' }; } });
    expect(createdNeverStarted({ State: { ...CREATED, StartedAt: '2026-11-04T00:00:00Z' } })).toBe(false);
    expect(r.say).toContain('LANE_E_EXIT_STATE');
    expect(gatesOf(r.say).CONTAINER).toBe('UNRESOLVED');
    expect(r.calls.some((c) => c[1] === 'rm')).toBe(false);
  });
  it('absence only from a successful EMPTY listing: a failed listing or the CID listed stays UNRESOLVED', async () => {
    for (const ls of [[false, ''], [true, `${CIDV}\n`], [true, 'other\n']] as [boolean, string][]) {
      const r = await go({ lsOut: ls });
      expect(gatesOf(r.say).CONTAINER, ls.join()).toBe('UNRESOLVED');
      expect(gatesOf(r.say).BRIDGE).toBe('BRIDGE_REAPED'); // the bridge is still closed and reaped independently
    }
  });
  it('bridge reap needs OUR handle reaped AND /proc ENOENT; otherwise UNRESOLVED (never a PID-based claim)', async () => {
    const stays = await go({ procStays: true });
    expect(gatesOf(stays.say).BRIDGE).toBe('UNRESOLVED');
    const noExit = await go({ bridgeNoExit: true });
    expect(gatesOf(noExit.say).BRIDGE).toBe('UNRESOLVED');
    expect(noExit.calls.filter((c) => c[0] === 'kill').map((c) => c[1])).toEqual(['SIGUSR2', 'SIGTERM', 'SIGKILL']);
    expect(gatesOf(noExit.say).CONTAINER).toBe('LANE_ABSENT');
    const drain = await go({ finalOpen: 2 });
    expect(drain.say).toContain('BRIDGE_E_DRAIN');
    expect(drain.ok).toBe(false);
    const listeners = await go({ listeners: 'UNRESOLVED' });
    expect(listeners.say).toContain('BRIDGE_E_LISTENERS');
    expect(listeners.ok).toBe(false);
    const ceiling = await go({ closeBy: 'CEILING' });
    expect(ceiling.say).toContain('BRIDGE_E_CEILING');
    expect(ceiling.ok).toBe(false);
    const early = await go({ earlyExit: true }); // exited before SIGTERM: reaped, but no final receipt, never OK
    expect(early.calls.filter((c) => c[0] === 'kill').map((c) => c[1])).toEqual(['SIGUSR2']);
    expect(early.say).toContain('BRIDGE_E_FINAL');
    expect(early.say).not.toContain('BRIDGE_FINAL_OK');
    expect(early.ok).toBe(false);
  });
  it('a bridge that never becomes ready: the container is never started, and is removed as created-never-started', async () => {
    const r = await go({ noBridgeReady: true });
    expect(r.say).toEqual(expect.arrayContaining(['LANE_E_BRIDGE_START', 'LANE_CREATED_NEVER_STARTED', 'LANE_ABSENT']));
    expect(r.calls.some((c) => c[1] === 'start')).toBe(false);
    expect(gatesOf(r.say).BRIDGE).not.toBe('BRIDGE_NOT_STARTED'); // a spawned child is always closed and reap-checked
  });
  it('inputsOk refuses a non-empty lane/out/sock dir, a group-readable key, a symlink or a foreign owner', () => {
    const f = laneFake();
    expect(inputsOk(f.d.fs, L, UID)).toBe(true);
    expect(inputsOk({ ...f.d.fs, readdirSync: (p: string) => (p === L.lane ? ['work'] : []) }, L, UID)).toBe(false);
    expect(inputsOk({ ...f.d.fs, lstatSync: (p: string) => ({ ...f.d.fs.lstatSync(p), uid: p === L.out ? 0 : UID }) }, L, UID)).toBe(false);
    expect(inputsOk({ ...f.d.fs, lstatSync: (p: string) => (p === L.anon ? { ...f.d.fs.lstatSync(p), mode: 0o100640 } : f.d.fs.lstatSync(p)) }, L, UID)).toBe(false);
    expect(inputsOk({ ...f.d.fs, lstatSync: (p: string) => (p === L.proof ? { ...f.d.fs.lstatSync(p), isSymbolicLink: () => true } : f.d.fs.lstatSync(p)) }, L, UID)).toBe(false);
  });
  it('static: main never sets the browser digest seam; children get a sanitized env; no exec/--pid/--privileged anywhere in the lane code', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/run-lane.mjs'), 'utf8');
    expect(src.slice(src.indexOf('if (process.argv[1]')).includes('browserSha256')).toBe(false);
    expect(src).toMatch(/spawnBridge: \(script, args\) => spawn\(process\.execPath, \[script, \.\.\.args\], \{ stdio: 'ignore', env: sanitizedEnv\(process\.env\) \}\)/);
    expect(src).toMatch(/exec: makeExec\(spawnClean\)/);
    for (const f of ['run-lane.mjs', 'image.mjs', 'bridge.mjs', 'contract.mjs', 'gates.mjs', 'lane-entry.mjs']) {
      const t = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane', f), 'utf8');
      expect(t, f).not.toMatch(/'exec'|--privileged|'--pid'|seccomp=unconfined|apparmor=|--cap-add/);
    }
  });
});

// ---- in-container supervisor ----
type EO = { label?: string | null; umask?: number; env?: Obj; closure?: boolean; forwardFails?: boolean; apiStatus?: number; appBody?: string; dbOut?: string;
  laneNotEmpty?: boolean; proofThrows?: boolean; liveThrows?: boolean; pairDb?: string; setupCode?: number; e1Code?: number | null; cleanupCode?: number;
  execPath?: string; nodeMissing?: boolean; report?: string | null; e1Res?: unknown };
/** A Playwright-JSON-shaped report carrying the worker's lane-apparmor annotation (on the test and on its result, as the reporter does). */
const reportWith = (...descs: string[]) => JSON.stringify({ suites: [{ specs: [{ title: 'E1 save', tests: [{ annotations: descs.map((d) => ({ type: 'lane-apparmor', description: d })),
  results: [{ status: 'passed', annotations: descs.map((d) => ({ type: 'lane-apparmor', description: d })) }] }] }] }] });
const AA_DESC = AA_LINE.slice('LANE E1 APPARMOR '.length);
function entryFake(o: EO = {}) {
  const writes = new Map<number, string>();
  const opened: string[] = [];
  const runs: string[][] = [];
  const envOk = Object.fromEntries([...ENV.map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]), ['PATH', IMAGE_PATH_ENV.slice(5)], ['HOSTNAME', CIDV.slice(0, 12)]]);
  const fsx = {
    accessSync: () => {}, realpathSync: (p: string) => (o.closure === false && p.endsWith('/sed') ? '/usr/bin/busybox' : p.replace('/usr/lib/postgresql/16/bin/', '/usr/lib/postgresql/16/bin/')),
    readFileSync: () => 'anon-key\n',
    lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, mode: 0o40700, uid: UID }),
    readdirSync: () => (o.laneNotEmpty ? ['work'] : []),
  };
  // closure: each tool resolves in the first PATH dir that has it; psql lives in the postgres bin dir
  fsx.accessSync = ((p: string) => { const ok = p === PSQL_REAL || (p.startsWith('/usr/bin/') && p !== '/usr/bin/psql' && !(o.nodeMissing && p === LANE_NODE)); if (!ok) throw new Error('ENOENT'); }) as never;
  const d: Obj = {
    env: o.env ?? envOk, repo: R, fs: fsx, execPath: o.execPath ?? LANE_NODE, uid: () => UID, umask: () => o.umask ?? 0o077,
    openExcl: (p: string) => { opened.push(p); writes.set(opened.length, ''); return opened.length; },
    write: (fd: number, t: string) => writes.set(fd, (writes.get(fd) ?? '') + t), close: () => {},
    readText: (p: string) => (p === L.report ? 'NOT THROUGH readText' : o.label === undefined ? 'docker-default (enforce)\n' : o.label),
    readReport: (p: string) => (p !== L.report ? { status: 'refused', why: 'path' } : o.report === null ? { status: 'missing' } : { status: 'ok', text: o.report === undefined ? reportWith(AA_DESC) : o.report }),
    fetch: async (u: string) => (u.endsWith('/rest/v1/') ? { status: o.apiStatus ?? 200 } : { status: 200, text: async () => o.appBody ?? '<div id="root"></div>' }),
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
    forward: async () => { if (o.forwardFails) throw new Error('EADDRINUSE'); return { close() {} }; },
    psql: async (_L: unknown, args: string[]) => (args.includes('select 1') ? { code: 0, out: o.dbOut ?? '1\n' } : { code: 0, out: o.pairDb ?? 'BEGIN\ngb-journey-pairing:abc\nCOMMIT\n' }),
    assertPairingProof: () => { if (o.proofThrows) throw new Error('JOURNEY_GATE3_E_MODE'); return { stack_id: 'abc', control_course_id: 'x' }; },
    assertLivePairing: async () => { if (o.liveThrows) throw new Error('JOURNEY_GATE3_E_LIVE_MISMATCH'); return 'ok'; },
    run: async (bin: string, args: string[]) => {
      runs.push([bin, ...args]);
      if (bin === PSQL_REAL) return { code: 0, out: 'psql (PostgreSQL) 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)\n' };
      if (args.includes('setup')) return { code: o.setupCode ?? 0 };
      if (args.includes('test')) return o.e1Res !== undefined ? o.e1Res : { code: o.e1Code === undefined ? 0 : o.e1Code };
      if (args[0] === 'cleanup') return { code: o.cleanupCode ?? 0 };
      return { code: 1 };
    },
  };
  return { d, writes, opened, runs, lane: () => writes.get(1) ?? '' };
}
const enter = async (o: EO = {}) => { const f = entryFake(o); const r = await laneMain(f.d as never); return { ...r, ...f }; };

describe('lane-entry supervisor: umask, AppArmor first, closure, forwarders, reach, session parent, read-only pairing recheck', () => {
  it('happy path writes the closed grammar, runs setup through redact, E1 once, cleanup, and the exit CONTENT', async () => {
    const r = await enter();
    expect(r.lane()).toBe(LANE_OK);
    expect(parseLaneOut(r.lane())).toMatchObject({ ok: true, interrupted: false });
    expect(r.opened).toEqual([L.laneTxt, L.setupTxt, L.pwExit]);
    expect(r.writes.get(3)).toBe('0\n');
    const setup = r.runs.find((x) => x.includes('setup'))!;
    expect(setup.slice(0, 3)).toEqual(['/usr/bin/bash', '-c', 'set -o pipefail; "$0" "$@" 2>&1 | /usr/bin/bash "$LE_REDACT" redact']);
    expect(setup.slice(3)).toEqual([`${R}/scripts/local-stack/lesson-editor/run.sh`, 'setup', API, 'http://127.0.0.1:8080', DB, L.anon, L.service, L.work, L.evidence]);
    expect(r.runs.filter((x) => x.includes('test'))).toEqual([[LANE_NODE, `${R}/node_modules/@playwright/test/cli.js`, 'test', '-c', `${R}/e2e/lesson-editor/playwright.lesson-editor.config.ts`, '--grep', 'E1 save']]);
    expect(r.code).toBe(0);
  });
  it('the AppArmor gate runs before anything else; a failed gate spawns, forwards and fetches nothing', async () => {
    for (const label of ['unconfined', 'docker-default (complain)', null, 'other (enforce)']) {
      const f = entryFake({ label });
      const spies = { fwd: vi.fn(f.d.forward), fetch: vi.fn(f.d.fetch), run: vi.fn(f.d.run), psql: vi.fn(f.d.psql) };
      Object.assign(f.d, { forward: spies.fwd, fetch: spies.fetch, run: spies.run, psql: spies.psql });
      await laneMain(f.d as never);
      expect(f.lane(), String(label)).toMatch(/^LANE START\nLANE APPARMOR APPARMOR_E_[A-Z_]+\nLANE SETUP NOT RUN LANE_E_APPARMOR\nLANE END\n$/);
      for (const s of Object.values(spies)) expect(s).not.toHaveBeenCalled();
    }
  });
  it('each pre-check refusal stops before run.sh setup, with its fixed code', async () => {
    const cases: [EO, string][] = [
      [{ env: { ...entryFake().d.env, PGPASSWORD: 'x' } }, 'LANE_E_ENV'],
      [{ env: { ...entryFake().d.env, LE_DB_URL: 'postgresql://postgres:pw@127.0.0.1:54322/postgres' } }, 'LANE_E_ENV'],
      [{ closure: false }, 'LANE_E_CLOSURE'],
      [{ nodeMissing: true }, 'LANE_E_CLOSURE'], // bare `node` would not resolve on the lane PATH
      [{ execPath: '/opt/hostedtoolcache/node/22.11.0/x64/bin/node' }, 'LANE_E_CLOSURE'], // the supervisor is not the lane Node
      [{ forwardFails: true }, 'LANE_E_FORWARD'],
      [{ apiStatus: 401 }, 'LANE_E_BRIDGE_REACH'],
      [{ appBody: 'nope' }, 'LANE_E_BRIDGE_REACH'],
      [{ dbOut: '2\n' }, 'LANE_E_BRIDGE_REACH'],
      [{ laneNotEmpty: true }, 'LANE_E_SESSION_PARENT'],
      [{ proofThrows: true }, 'LANE_E_PAIR_RECHECK'],
      [{ liveThrows: true }, 'LANE_E_PAIR_RECHECK'],
      [{ pairDb: 'BEGIN\ngb-journey-pairing:other\nCOMMIT\n' }, 'LANE_E_PAIR_RECHECK'],
    ];
    for (const [o, code] of cases) {
      const r = await enter(o);
      expect(r.lane(), code).toBe(`LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP NOT RUN ${code}\nLANE END\n`);
      expect(r.runs.some((x) => x.includes('setup') || x.includes('test'))).toBe(false);
      expect(r.opened).toEqual([L.laneTxt]);
    }
    const u = await enter({ umask: 0o022 });
    expect(u.lines).toEqual(['LANE_E_UMASK_NOT_SET']);
    expect(u.opened).toEqual([]);
  });
  it('a failed setup records NOT RUN for E1 and writes no pw-exit; cleanup still runs', async () => {
    const r = await enter({ setupCode: 1 });
    expect(r.lane()).toBe('LANE START\nLANE APPARMOR APPARMOR_DOCKER_DEFAULT_ENFORCE\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE CLEANUP PASS\nLANE END\n');
    expect(r.opened).not.toContain(L.pwExit);
    const killed = await enter({ e1Code: null });
    expect(killed.writes.get(3)).toBe('255\n');
  });
  it('worker AppArmor evidence: copied from the report only in its closed form; MISSING, INVALID or non-ENFORCE fails the lane', async () => {
    const ok = await enter();
    expect(ok.lane()).toContain(`LANE E1 RAN\nLANE E1 RESULT CLOSE_WITH_CODE\n${AA_LINE}\nLANE E1 REPORT PARSED\nLANE E1 REPORTED_ERROR UNKNOWN\n${DIAG_TAIL}LANE CLEANUP PASS`);
    const nonEnf = AA_DESC.replace(/ENFORCE$/, 'ENFORCE').replace(/POST (\S+) (\S+)$/, 'POST $1 APPARMOR_E_UNCONFINED');
    const cases: [string | null, string, number][] = [
      [null, 'LANE E1 APPARMOR MISSING', 1], // no report at all (the worker fixture failed before the test)
      [JSON.stringify({ suites: [] }), 'LANE E1 APPARMOR MISSING', 1],
      ['{not json', 'LANE E1 APPARMOR INVALID', 1],
      [reportWith(AA_DESC, nonEnf), 'LANE E1 APPARMOR INVALID', 1], // two distinct descriptions
      [reportWith(`${AA_DESC} extra`), 'LANE E1 APPARMOR INVALID', 1],
      [reportWith('PRE docker-default (enforce)'), 'LANE E1 APPARMOR INVALID', 1],
      [reportWith(nonEnf), `LANE E1 APPARMOR ${nonEnf}`, 1], // recorded faithfully, but the lane fails
      ['x'.repeat(8 * 1024 * 1024 + 1), 'LANE E1 APPARMOR INVALID', 1], // over the byte budget is a refusal, not absence
    ];
    for (const [report, line, code] of cases) {
      const r = await enter({ report });
      expect(r.lane(), line).toContain(`LANE E1 RESULT CLOSE_WITH_CODE\n${line}\nLANE E1 REPORT `);
      expect(parseLaneOut(r.lane()).ok).toBe(true);
      expect(r.code).toBe(code);
    }
    expect(workerAppArmorFromReport(okR(reportWith(AA_DESC)))).toBe(AA_LINE);
    expect(workerAppArmorFromReport({ status: 'missing' })).toBe('LANE E1 APPARMOR MISSING');
    for (const why of ['open', 'owner', 'mode', 'size', 'grew', 'path']) expect(workerAppArmorFromReport({ status: 'refused', why })).toBe('LANE E1 APPARMOR INVALID');
    expect(workerAppArmorFromReport(AA_DESC as never)).toBe('LANE E1 APPARMOR INVALID'); // a bare string is not a reader result
  });
  const okR = (text: string) => ({ status: 'ok', text });
  const PASS = { type: 'lane-apparmor', description: AA_DESC };
  const CONFLICT = { type: 'lane-apparmor', description: AA_DESC.replace(/POST (\S+) (\S+)$/, 'POST $1 APPARMOR_E_UNCONFINED') };
  // root { annotations: [PASS], child: ... } with `leaf` at exactly depth n (root is depth 0)
  const atDepth = (n: number, leaf: Obj) => { let v: Obj = leaf; for (let i = 1; i < n; i++) v = { child: v }; return { annotations: [PASS], child: v }; };
  it('report walk, DEPTH budget: early PASS with a conflicting record beyond the limit is INVALID, never a truncated PASS', () => {
    expect(REPORT_MAX_DEPTH).toBe(64);
    // inside the budget the walk sees the conflict (two distinct records) and refuses; a lone PASS at the limit is accepted
    expect(workerAppArmorFromReport(okR(JSON.stringify(atDepth(REPORT_MAX_DEPTH, { annotations: [CONFLICT] }))))).toBe('LANE E1 APPARMOR INVALID');
    expect(workerAppArmorFromReport(okR(JSON.stringify(atDepth(REPORT_MAX_DEPTH, { annotations: [PASS] }))))).toBe(AA_LINE);
    // one level past the budget: the r2 walker returned the early PASS here; now exhaustion itself refuses
    expect(workerAppArmorFromReport(okR(JSON.stringify(atDepth(REPORT_MAX_DEPTH + 1, { annotations: [CONFLICT] }))))).toBe('LANE E1 APPARMOR INVALID');
    expect(workerAppArmorFromReport(okR(JSON.stringify(atDepth(REPORT_MAX_DEPTH + 1, { annotations: [PASS] }))))).toBe('LANE E1 APPARMOR INVALID');
    expect(workerAppArmorFromReport(okR(JSON.stringify(atDepth(REPORT_MAX_DEPTH + 1, { nothing: true }))))).toBe('LANE E1 APPARMOR INVALID');
    let deep: Obj = { annotations: [PASS] };
    for (let i = 0; i < 100; i++) deep = { child: deep };
    expect(workerAppArmorFromReport(okR(JSON.stringify(deep)))).toBe('LANE E1 APPARMOR INVALID');
    let arr: unknown = [CONFLICT];
    for (let i = 0; i < 100; i++) arr = [arr]; // arrays count toward depth too
    expect(workerAppArmorFromReport(okR(JSON.stringify({ annotations: [PASS], a: arr })))).toBe('LANE E1 APPARMOR INVALID');
  });
  it('report walk, NODE budget: early PASS with a conflicting record after the node limit is INVALID; exactly at the limit is walked', () => {
    expect(REPORT_MAX_NODES).toBe(200000);
    // nodes = root + items array + N items + late = N + 3
    const doc = (n: number, late: Obj) => JSON.stringify({ annotations: [PASS], items: Array.from({ length: n }, () => ({})), late: { annotations: [late] } });
    expect(workerAppArmorFromReport(okR(doc(REPORT_MAX_NODES - 3, PASS)))).toBe(AA_LINE);
    expect(workerAppArmorFromReport(okR(doc(REPORT_MAX_NODES - 3, CONFLICT)))).toBe('LANE E1 APPARMOR INVALID'); // seen: distinct
    expect(workerAppArmorFromReport(okR(doc(REPORT_MAX_NODES - 2, CONFLICT)))).toBe('LANE E1 APPARMOR INVALID'); // r2: early PASS
    expect(workerAppArmorFromReport(okR(doc(REPORT_MAX_NODES - 2, PASS)))).toBe('LANE E1 APPARMOR INVALID'); // exhausted
  });
  it('report BYTE budget: an early PASS followed by a conflict past REPORT_MAX bytes is INVALID, measured in bytes not UTF-16 units', () => {
    expect(REPORT_MAX).toBe(8 * 1024 * 1024);
    const pad = (k: number) => JSON.stringify({ annotations: [PASS], pad: '\u00e9'.repeat(k), late: { annotations: [CONFLICT] } });
    const big = pad(REPORT_MAX / 2 + 16);
    expect(big.length).toBeLessThan(REPORT_MAX);
    expect(Buffer.byteLength(big)).toBeGreaterThan(REPORT_MAX);
    expect(workerAppArmorFromReport(okR(big))).toBe('LANE E1 APPARMOR INVALID');
    const fitPass = JSON.stringify({ annotations: [PASS], pad: 'x'.repeat(1000) });
    expect(workerAppArmorFromReport(okR(fitPass))).toBe(AA_LINE);
  });
  // fake fs for the bounded reader: one fd, fstat on it, chunked reads that may grow past the fstat size
  const readerFs = (o: { openErr?: string; isFile?: boolean; uid?: number; mode?: number; nlink?: number; size?: number; link?: string; text?: string; grow?: boolean; chunk?: number } = {}) => {
    const calls: string[] = [];
    const data = Buffer.from(o.text ?? reportWith(AA_DESC));
    const served = o.grow ? Buffer.concat([data, Buffer.from(' ')]) : data;
    let pos = 0;
    return {
      calls,
      openSync: (p: string, flags: number) => { calls.push(`open ${p} ${flags}`); if (o.openErr) throw Object.assign(new Error(o.openErr), { code: o.openErr }); return 7; },
      fstatSync: (fd: number) => { calls.push(`fstat ${fd}`); return { isFile: () => o.isFile ?? true, uid: o.uid ?? UID, mode: o.mode ?? 0o100600, nlink: o.nlink ?? 1, size: o.size ?? data.length }; },
      readlinkSync: (p: string) => { calls.push(`readlink ${p}`); return o.link ?? L.report; },
      readSync: (fd: number, buf: Buffer, off: number, len: number) => { calls.push('read'); const n = Math.min(len, o.chunk ?? 4096, served.length - pos); served.copy(buf, off, pos, pos + n); pos += n; return n; },
      closeSync: (fd: number) => { calls.push(`close ${fd}`); },
    };
  };
  it('bounded reader: one O_NOFOLLOW|O_NONBLOCK open, secure fstat checks and size BEFORE any read, bounded chunked read, fd always closed', () => {
    const f = readerFs({ chunk: 1000 });
    const r = readReportBounded(f, L.report, UID);
    expect(r).toEqual({ status: 'ok', text: reportWith(AA_DESC) });
    expect(f.calls[0]).toBe(`open ${L.report} ${fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK}`);
    expect(f.calls.slice(1, 3)).toEqual(['fstat 7', 'readlink /proc/self/fd/7']);
    expect(f.calls.at(-1)).toBe('close 7');
    expect(readReportBounded(readerFs({ openErr: 'ENOENT' }), L.report, UID)).toEqual({ status: 'missing' });
    for (const code of ['ELOOP', 'EACCES', 'EISDIR']) expect(readReportBounded(readerFs({ openErr: code }), L.report, UID)).toEqual({ status: 'refused', why: 'open' });
    const refusedBeforeRead: [Obj, string][] = [
      [{ isFile: false }, 'type'], [{ uid: 0 }, 'owner'], [{ mode: 0o100640 }, 'mode'], [{ mode: 0o100604 }, 'mode'], [{ nlink: 2 }, 'links'],
      [{ size: REPORT_MAX + 1 }, 'size'], [{ size: -1 }, 'size'], [{ link: '/elsewhere/report.json' }, 'path'],
    ];
    for (const [over, why] of refusedBeforeRead) {
      const g = readerFs(over);
      expect(readReportBounded(g, L.report, UID), why).toEqual({ status: 'refused', why });
      expect(g.calls).not.toContain('read'); // nothing is read before every check on the fd has passed
      expect(g.calls.at(-1)).toBe('close 7');
    }
    // grew after fstat: refused as soon as one byte past the fstat size arrives (at most size+1 bytes buffered)
    const grow = readerFs({ grow: true });
    expect(readReportBounded(grow, L.report, UID)).toEqual({ status: 'refused', why: 'grew' });
    expect(grow.calls.at(-1)).toBe('close 7');
    expect(readReportBounded(readerFs({ size: reportWith(AA_DESC).length + 5 }), L.report, UID)).toEqual({ status: 'refused', why: 'short' });
    // exactly at the byte limit is read; one byte over is refused before reading (an early PASS cannot be accepted from a prefix)
    const atMax = readerFs({ size: 64, text: 'x'.repeat(64) });
    expect(readReportBounded(atMax, L.report, UID, 64)).toEqual({ status: 'ok', text: 'x'.repeat(64) });
    const over = readerFs({ size: 65, text: `${reportWith(AA_DESC)}` });
    expect(readReportBounded(over, L.report, UID, 64)).toEqual({ status: 'refused', why: 'size' });
    expect(over.calls).not.toContain('read');
    // the supervisor reads the report ONLY through the bounded reader, never readText
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/lane-entry.mjs'), 'utf8');
    expect(src).toContain('const snap = reportSnapshot(d.readReport(L.report));');
    expect(src.match(/d\.readReport\(/g)).toHaveLength(1); // E1 diagnostics r1: ONE read, shared by AppArmor and diagnostics
    expect(src).toContain('readReport: (p) => readReportBounded(fs, p, process.getuid(), REPORT_MAX),');
    expect(src).not.toMatch(/readText\(L\.report\)/);
  });
  it('env, closure and session-parent rules (pure)', () => {
    const env = entryFake().d.env;
    expect(envProblems(env, R)).toBe(false);
    expect(envProblems({ ...env, EXTRA: '1' }, R)).toBe(true);
    expect(envProblems({ ...env, PATH: '/bin' }, R)).toBe(true);
    const { HOME: _h, ...noHome } = env;
    expect(envProblems(noHome, R)).toBe(true);
    expect(closureProblems(entryFake().d.fs, env, LANE_NODE)).toBe(false);
    expect(closureProblems(entryFake({ closure: false }).d.fs, env, LANE_NODE)).toBe(true);
    expect(closureProblems(entryFake({ nodeMissing: true }).d.fs, env, LANE_NODE)).toBe(true);
    expect(closureProblems(entryFake().d.fs, env, '/opt/hostedtoolcache/node/22.11.0/x64/bin/node')).toBe(true);
    const st = (over: Obj) => ({ lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, mode: 0o40700, uid: UID, ...over }), readdirSync: () => [] });
    expect(sessionParentOk(st({}), L.lane, UID)).toBe(true);
    for (const over of [{ mode: 0o40755 }, { uid: 0 }, { isSymbolicLink: () => true }, { isDirectory: () => false }]) expect(sessionParentOk(st(over), L.lane, UID)).toBe(false);
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/lane-entry.mjs'), 'utf8');
    const body = src.split('\n').filter((l) => !l.startsWith('//') && l.trim() !== '');
    expect(body[0]).toBe('process.umask(0o077);');
  });
});

// ---- sandbox launch ----
const ART = `${L.output}/.playwright-artifacts-0`;
const DEFAULTS = () => ({ handleSIGINT: false, executablePath: SHELL, args: [RESOLVER_ARG], tracesDir: `${ART}/traces`, artifactsDir: ART, headless: true });
const PROXY = 'http://127.0.0.1:40001';
describe('sandbox launch: closed incoming and EFFECTIVE options, sandbox true last, owned-browser argv, awaited cleanup', () => {
  it('incoming launchOptions: absent or exactly-true chromiumSandbox only; exact args; bound shell', () => {
    expect(incomingProblem({ executablePath: SHELL, args: [RESOLVER_ARG] }, { shell: SHELL })).toBeNull();
    expect(incomingProblem({ executablePath: SHELL, args: [RESOLVER_ARG], chromiumSandbox: true }, { shell: SHELL })).toBeNull();
    for (const v of [false, undefined, 'true', 1, null]) expect(incomingProblem({ executablePath: SHELL, args: [RESOLVER_ARG], chromiumSandbox: v }, { shell: SHELL }), String(v)).toBe('LANE_E_SANDBOX_OPTION');
    for (const extra of [{ ignoreDefaultArgs: true }, { ignoreDefaultArgs: false }, { ignoreDefaultArgs: ['--x'] }, { env: {} }, { headless: false }, { channel: 'chrome' }, { proxy: {} }])
      expect(incomingProblem({ executablePath: SHELL, args: [RESOLVER_ARG], ...extra }, { shell: SHELL }), JSON.stringify(extra)).toBe('LANE_E_SANDBOX_OPTION');
    for (const args of [[RESOLVER_ARG, '--disable-gpu'], [], ['--disable-gpu', RESOLVER_ARG], undefined]) expect(incomingProblem({ executablePath: SHELL, args }, { shell: SHELL })).toBe('LANE_E_SANDBOX_OPTION');
    expect(incomingProblem({ executablePath: '/other', args: [RESOLVER_ARG] }, { shell: SHELL })).toBe('LANE_E_SANDBOX_OPTION');
  });
  it('the auto-fixture defaults (merged AFTER validation) are pinned exactly, with artifacts confined to the private output dir', () => {
    expect(defaultsProblem(DEFAULTS(), { shell: SHELL, outputDir: L.output })).toBeNull();
    const m = (f: (o: Obj) => void) => { const o: Obj = DEFAULTS(); f(o); return defaultsProblem(o, { shell: SHELL, outputDir: L.output }); };
    expect(m((o) => { o.ignoreDefaultArgs = ['--no-sandbox']; })).toBe('LANE_E_SANDBOX_DEFAULTS');
    expect(m((o) => { o.chromiumSandbox = false; })).toBe('LANE_E_SANDBOX_DEFAULTS');
    expect(m((o) => { o.headless = false; })).toBe('LANE_E_SANDBOX_DEFAULTS');
    expect(m((o) => { o.handleSIGINT = true; })).toBe('LANE_E_SANDBOX_DEFAULTS');
    expect(m((o) => { o.args = [RESOLVER_ARG, '--x']; })).toBe('LANE_E_SANDBOX_DEFAULTS');
    expect(m((o) => { o.artifactsDir = '/w/repo/test-results/.playwright-artifacts-0'; o.tracesDir = `${o.artifactsDir}/traces`; })).toBe('LANE_E_SANDBOX_ARTIFACTS');
    expect(m((o) => { o.tracesDir = '/tmp/traces'; })).toBe('LANE_E_SANDBOX_ARTIFACTS');
    expect(defaultsProblem(undefined, { shell: SHELL, outputDir: L.output })).toBe('LANE_E_SANDBOX_DEFAULTS');
  });
  it('the effective merged object is checked against an explicit expectation; true is written last in ours', () => {
    const ours = serverOptions({ shell: SHELL, proxyUrl: PROXY });
    expect(Object.keys(ours).at(-1)).toBe('chromiumSandbox');
    expect(ours).not.toHaveProperty('ignoreDefaultArgs');
    const eff = effectiveOptions(DEFAULTS(), ours);
    expect(effectiveProblem(eff, { shell: SHELL, proxyUrl: PROXY, defaults: DEFAULTS() })).toBeNull();
    expect(effectiveProblem(effectiveOptions({ ...DEFAULTS(), chromiumSandbox: true }, ours), { shell: SHELL, proxyUrl: PROXY, defaults: DEFAULTS() })).toBeNull();
    for (const bad of [{ ...eff, chromiumSandbox: false }, { ...eff, ignoreDefaultArgs: ['--no-sandbox'] }, { ...eff, args: [] }, { ...eff, proxy: undefined }, { ...eff, env: { HOME: '/tmp' } }])
      expect(effectiveProblem(bad, { shell: SHELL, proxyUrl: PROXY, defaults: DEFAULTS() })).toBe('LANE_E_SANDBOX_EFFECTIVE');
  });
  it('owned-browser argv attestation: pinned exe, no sandbox-disabling flag in any case or =value form, bounded claim', () => {
    const cmd = (...a: string[]) => () => `${a.join('\0')}\0`;
    expect(attestArgv(10, cmd(SHELL, '--headless', '--remote-debugging-pipe'), SHELL)).toBeNull();
    for (const f of FORBIDDEN_FLAGS) {
      expect(attestArgv(10, cmd(SHELL, f), SHELL), f).toBe('LANE_E_SANDBOX_OFF');
      expect(attestArgv(10, cmd(SHELL, f.toUpperCase()), SHELL)).toBe('LANE_E_SANDBOX_OFF');
      expect(attestArgv(10, cmd(SHELL, `${f}=1`), SHELL)).toBe('LANE_E_SANDBOX_OFF');
    }
    for (const pid of [undefined, 0, -1, Number.NaN, 1.5]) expect(attestArgv(pid as never, cmd(SHELL, '--x'), SHELL)).toBe('LANE_E_SANDBOX_PID');
    for (const code of ['ENOENT', 'EACCES', 'EPERM']) expect(attestArgv(10, () => { throw Object.assign(new Error(), { code }); }, SHELL)).toBe('LANE_E_SANDBOX_UNREAD');
    expect(attestArgv(10, () => '', SHELL)).toBe('LANE_E_SANDBOX_UNREAD');
    expect(attestArgv(10, cmd('/other/chrome', '--x'), SHELL)).toBe('LANE_E_SANDBOX_EXE');
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');
    expect(src).not.toMatch(/readdirSync|\/children|\/task\/|\/exe'|ptrace|SIGSTOP|freezer/);
  });
  type CF = { launchThrows?: boolean; pid?: number; argv?: string; connectThrows?: boolean; closeHangs?: boolean; killHangs?: boolean; browserCloseThrows?: boolean;
    launchNever?: boolean; launchLateMs?: number; launchRejectLateMs?: number; labels?: Record<string, string | null>; labelsAfterUse?: Record<string, string | null> };
  const chromiumFake = (o: CF = {}) => {
    const ev: string[] = [];
    let launched: Obj | null = null;
    const server = {
      process: () => ({ pid: o.pid ?? 10 }), wsEndpoint: () => 'ws://127.0.0.1:1/x',
      close: () => { ev.push('server.close'); return o.closeHangs ? new Promise(() => {}) : Promise.resolve(); },
      kill: () => { ev.push('server.kill'); return o.killHangs ? new Promise(() => {}) : Promise.resolve(); },
    };
    const browser = { close: () => { ev.push('browser.close'); return o.browserCloseThrows ? Promise.reject(new Error('x')) : Promise.resolve(); } };
    const chromium = {
      launchServer: async (opts: Obj) => {
        ev.push('launchServer'); launched = opts;
        if (o.launchThrows) throw new Error('No usable sandbox!');
        if (o.launchNever) return new Promise(() => {});
        if (o.launchLateMs !== undefined) return new Promise((r) => { setTimeout(() => { ev.push('late-handle'); r(server); }, o.launchLateMs); });
        if (o.launchRejectLateMs !== undefined) return new Promise((_, j) => { setTimeout(() => j(new Error('listen EADDRINUSE')), o.launchRejectLateMs); });
        return server;
      },
      connect: async () => { ev.push('connect'); if (o.connectThrows) throw new Error('x'); return browser; },
    };
    let used = false;
    const enforce = 'docker-default (enforce)\n';
    const labelOf = (who: number | 'self') => { const m = used && o.labelsAfterUse ? o.labelsAfterUse : o.labels ?? {}; const k = String(who); if (k in m) { const v = m[k]; if (v === null) throw new Error('EACCES'); return v; } return enforce; };
    const states: Obj[] = [];
    const opts = { launchOptions: { executablePath: SHELL, args: [RESOLVER_ARG] }, defaults: DEFAULTS(), shell: SHELL, outputDir: L.output, proxyUrl: PROXY,
      readCmdline: () => o.argv ?? `${SHELL}\0--headless\0` };
    const aaOpts = { ...opts, readLabel: labelOf, onAppArmor: (st: Obj) => { states.push(st); } };
    return { chromium, opts, aaOpts, ev, states, markUsed: () => { used = true; }, launched: () => launched };
  };
  const codeOf = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as SandboxLaunchError).code ?? 'other'; } };
  it('cleans up on success, failed attestation, failed connect, test exception and close failure (awaited, bounded kill)', async () => {
    const ok = chromiumFake();
    const use = vi.fn(async () => { ok.ev.push('use'); });
    expect(await codeOf(withSandboxedBrowser(ok.chromium, ok.opts, use))).toBe('ok');
    expect(ok.ev).toEqual(['launchServer', 'connect', 'use', 'browser.close', 'server.close']);
    expect(ok.launched()).toMatchObject({ chromiumSandbox: true, executablePath: SHELL, args: [RESOLVER_ARG] });
    const flag = chromiumFake({ argv: `${SHELL}\0--no-sandbox\0` });
    expect(await codeOf(withSandboxedBrowser(flag.chromium, flag.opts, async () => { flag.ev.push('use'); }))).toBe('LANE_E_SANDBOX_OFF');
    expect(flag.ev).toEqual(['launchServer', 'server.close']);
    const conn = chromiumFake({ connectThrows: true });
    expect(await codeOf(withSandboxedBrowser(conn.chromium, conn.opts, async () => {}))).toBe('LANE_E_CONNECT');
    expect(conn.ev).toEqual(['launchServer', 'connect', 'server.close']);
    const boom = chromiumFake();
    expect(await codeOf(withSandboxedBrowser(boom.chromium, boom.opts, async () => { throw new Error('test failed'); }))).toBe('other');
    expect(boom.ev).toEqual(['launchServer', 'connect', 'browser.close', 'server.close']);
    const launch = chromiumFake({ launchThrows: true });
    expect(await codeOf(withSandboxedBrowser(launch.chromium, launch.opts, async () => {}))).toBe('LANE_E_LAUNCH_REJECTED');
    expect(launch.ev).toEqual(['launchServer']); // no handle: nothing to close, and nothing claimed
    const pre = chromiumFake();
    expect(await codeOf(withSandboxedBrowser(pre.chromium, { ...pre.opts, launchOptions: { ...pre.opts.launchOptions, chromiumSandbox: false } }, async () => {}))).toBe('LANE_E_SANDBOX_OPTION');
    expect(pre.ev).toEqual([]); // refused before any launch
    const bc = chromiumFake({ browserCloseThrows: true });
    expect(await codeOf(withSandboxedBrowser(bc.chromium, bc.opts, async () => {}))).toBe('LANE_E_BROWSER_CLOSE');
    expect(bc.ev.at(-1)).toBe('server.close');
  });
  it('a hanging server.close is bounded and followed by an AWAITED bounded kill; a hanging kill is reported, never ignored', async () => {
    vi.useFakeTimers();
    try {
      const h = chromiumFake({ closeHangs: true });
      const p = codeOf(withSandboxedBrowser(h.chromium, h.opts, async () => {}));
      await vi.advanceTimersByTimeAsync(10_001);
      expect(h.ev).toContain('server.kill');
      await vi.advanceTimersByTimeAsync(10_001);
      expect(await p).toBe('LANE_E_SERVER_CLOSE');
      const k = chromiumFake({ closeHangs: true, killHangs: true });
      const q = codeOf(withSandboxedBrowser(k.chromium, k.opts, async () => {}));
      await vi.advanceTimersByTimeAsync(20_002);
      expect(await q).toBe('LANE_E_SERVER_CLOSE');
    } finally { vi.useRealTimers(); }
  });
  const errOf = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e as SandboxLaunchError & { browserState?: string }; } };
  const quick = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });
  it('launch is bounded HERE: rejected, never-returning, late-returning and late-rejected attempts never claim absence', async () => {
    // our bound passes at once (injected sleep); the grace is 40 ms of real time
    const sleep = (ms: number) => (ms === LAUNCH_BOUND_MS ? Promise.resolve() : quick(40));
    const rej = chromiumFake({ launchThrows: true });
    const e1 = await errOf(withSandboxedBrowser(rej.chromium, rej.opts, async () => {})); // default (real) bound; rejects inside it
    expect([e1?.code, e1?.browserState]).toEqual(['LANE_E_LAUNCH_REJECTED', 'UNKNOWN']); // it may have failed AFTER the browser started (listen)
    const never = chromiumFake({ launchNever: true });
    const use = vi.fn();
    const e2 = await errOf(withSandboxedBrowser(never.chromium, { ...never.opts, sleep }, use));
    expect([e2?.code, e2?.browserState]).toEqual(['LANE_E_LAUNCH_HUNG', 'UNKNOWN']);
    expect(use).not.toHaveBeenCalled();
    const late = chromiumFake({ launchLateMs: 5 });
    const e3 = await errOf(withSandboxedBrowser(late.chromium, { ...late.opts, sleep }, use));
    expect([e3?.code, e3?.browserState]).toEqual(['LANE_E_LAUNCH_LATE', 'LATE_HANDLE_CLOSED']);
    expect(late.ev).toEqual(['launchServer', 'late-handle', 'server.close']); // the late handle was closed (awaited) before returning
    expect(use).not.toHaveBeenCalled();
    const lateRej = chromiumFake({ launchRejectLateMs: 5 });
    const e4 = await errOf(withSandboxedBrowser(lateRej.chromium, { ...lateRej.opts, sleep }, use));
    expect([e4?.code, e4?.browserState]).toEqual(['LANE_E_LAUNCH_LATE_REJECTED', 'UNKNOWN']);
    // a handle arriving after the grace is still closed when it arrives, but the result already said UNKNOWN
    const veryLate = chromiumFake({ launchLateMs: 80 });
    const e5 = await errOf(withSandboxedBrowser(veryLate.chromium, { ...veryLate.opts, sleep }, use));
    expect([e5?.code, e5?.browserState]).toEqual(['LANE_E_LAUNCH_HUNG', 'UNKNOWN']);
    await quick(120);
    expect(veryLate.ev).toEqual(['launchServer', 'late-handle', 'server.close']);
    for (const e of [e1, e2, e3, e4, e5]) expect(String(e?.browserState)).not.toMatch(/ABSENT|REAPED|NONE/);
  });
  it('a late handle whose close AND kill hang is UNKNOWN (bounded, awaited), never closed', async () => {
    vi.useFakeTimers();
    try {
      const sleep = (ms: number) => (ms === LAUNCH_BOUND_MS ? Promise.resolve() : new Promise<void>((r) => { setTimeout(r, 1000); }));
      const f = chromiumFake({ launchLateMs: 10, closeHangs: true, killHangs: true });
      const p = errOf(withSandboxedBrowser(f.chromium, { ...f.opts, sleep }, async () => {}));
      await vi.advanceTimersByTimeAsync(25_000);
      const e = await p;
      expect([e?.code, e?.browserState, e?.laneMarks]).toEqual(['LANE_E_LAUNCH_LATE', 'UNKNOWN', ['LANE_E_SERVER_CLOSE', 'LANE_E_SERVER_KILL']]);
      expect(f.ev).toEqual(['launchServer', 'late-handle', 'server.close', 'server.kill']);
    } finally { vi.useRealTimers(); }
  });
  it('worker-side AppArmor: pre-launch worker gate, owned-browser gate after attestation, post-run equality; all fail closed', async () => {
    const ok = chromiumFake();
    expect(await codeOf(withSandboxedBrowser(ok.chromium, ok.aaOpts, async () => { ok.ev.push('use'); }))).toBe('ok');
    expect(ok.states).toHaveLength(1);
    expect(ok.states[0].pre).toEqual({ worker: ENF, browser: ENF });
    expect(postrunAppArmor(ok.states[0] as never)).toEqual({ worker: ENF, browser: ENF, ok: true, line: `PRE ${ENF} ${ENF} POST ${ENF} ${ENF}` });
    for (const bad of ['unconfined\n', 'docker-default (complain)\n', 'other (enforce)\n', '', null]) {
      const w = chromiumFake({ labels: { self: bad } });
      const e = await errOf(withSandboxedBrowser(w.chromium, w.aaOpts, async () => {}));
      expect(e?.code, String(bad)).toBe('LANE_E_APPARMOR_PRE');
      expect(w.ev).toEqual([]); // the worker gate runs BEFORE any launch
      const b = chromiumFake({ labels: { 10: bad } });
      const use = vi.fn();
      const eb = await errOf(withSandboxedBrowser(b.chromium, b.aaOpts, use));
      expect(eb?.code).toBe('LANE_E_APPARMOR_PRE');
      expect(use).not.toHaveBeenCalled();
      expect(b.ev).toEqual(['launchServer', 'server.close']);
      for (const who of ['self', '10']) {
        const post = chromiumFake({ labelsAfterUse: { [who]: bad } });
        const ep = await errOf(withSandboxedBrowser(post.chromium, post.aaOpts, async () => { post.markUsed(); }));
        expect(ep?.code, `${who} ${bad}`).toBe('LANE_E_APPARMOR_POST');
        expect(post.ev).toEqual(['launchServer', 'connect', 'browser.close', 'server.close']); // still cleaned up
        expect(postrunAppArmor(post.states[0] as never).ok).toBe(false);
      }
    }
    // without readLabel (the self-test path) no AppArmor gate runs and no state is published
    const st = chromiumFake();
    expect(await codeOf(withSandboxedBrowser(st.chromium, st.opts, async () => {}))).toBe('ok');
    expect(st.states).toHaveLength(0);
    expect(labelCode(() => { throw new Error('EACCES'); }, 'self')).toBe('APPARMOR_E_UNKNOWN');
  });
  it('the E1 fixture wires the worker gate for the authentic lane only and publishes the closed annotation', () => {
    const eg = readFileSync(path.join(ROOT, 'e2e/lesson-editor/egress-test.ts'), 'utf8');
    expect(eg).toContain("...(authentic ? { readLabel, onAppArmor: (s: AppArmorState) => { laneAppArmor = s; } } : {}),");
    const gate = eg.slice(eg.indexOf('laneAppArmorGate: ['), eg.indexOf('boundary: ['));
    for (const t of ["if (!state) throw new Error('LANE_E_APPARMOR_PRE');", 'await use();', 'const post = postrunAppArmorObserved(state);',
      "test.info().annotations.push({ type: 'lane-apparmor', description: post.line });", "if (!post.ok) throw new Error('LANE_E_APPARMOR_POST');", '{ auto: true }',
      "test.info().annotations.push({ type: 'lane-post-observed', description: post.observed });"])
      expect(gate).toContain(t);
    expect(gate.indexOf('annotations.push')).toBeLessThan(gate.indexOf("throw new Error('LANE_E_APPARMOR_POST')"));
    // E1 diagnostics r2: the observation is pushed AFTER the lane-apparmor annotation and BEFORE the unchanged throw
    expect(gate.indexOf("type: 'lane-apparmor'")).toBeLessThan(gate.indexOf("type: 'lane-post-observed'"));
    expect(gate.indexOf("type: 'lane-post-observed'")).toBeLessThan(gate.indexOf("throw new Error('LANE_E_APPARMOR_POST')"));
  });
  it('source pins: the installed Playwright 1.59.1 merge, fixture defaults and sandbox switch are the ones this contract assumes', () => {
    const nm = (p: string) => readFileSync(path.join(ROOT, 'node_modules', p), 'utf8');
    expect(JSON.parse(nm('playwright-core/package.json')).version).toBe('1.59.1');
    const bt = nm('playwright-core/lib/client/browserType.js');
    const ls = bt.slice(bt.indexOf('async launchServer(options = {})'), bt.indexOf('async launchPersistentContext('));
    expect(ls).toContain('options = { ...this._playwright._defaultLaunchOptions, ...options };');
    const idx = nm('playwright/lib/index.js');
    const bo = idx.slice(idx.indexOf('_browserOptions: [async'), idx.indexOf('browser: [async'));
    for (const s of ['handleSIGINT: false,', '...launchOptions,', 'tracesDir: tracing().tracesDir(),', 'artifactsDir: tracing().artifactsDir()', 'playwright._defaultLaunchOptions = options;']) expect(bo).toContain(s);
    expect(nm('playwright-core/lib/server/chromium/chromium.js')).toContain('if (options.chromiumSandbox !== true)');
    // launchServer's ProgressController.run gets NO timeout, and the server listens only AFTER the browser was launched
    const bsi = nm('playwright-core/lib/browserServerImpl.js');
    const lsi = bsi.slice(bsi.indexOf('async launchServer(options = {})'));
    expect(lsi).toContain('browser = await controller.run(async (progress) => {');
    expect(lsi).toMatch(/\}\);\n {4}\} catch \(e\) \{/); // run(fn) closes with no second (timeout) argument
    expect(lsi.indexOf('await server.listen(options.port, options.host)')).toBeGreaterThan(lsi.indexOf('controller.run('));
    expect(nm('playwright/lib/runner/workerHost.js')).toContain('artifactsDir: import_path.default.join(options.outputDir, (0, import_folders.artifactsFolderName)(workerIndex))');
    const eg = readFileSync(path.join(ROOT, 'e2e/lesson-editor/egress-test.ts'), 'utf8');
    expect(eg.match(/withSandboxedBrowser\(/g)).toHaveLength(1);
    expect(eg).not.toMatch(/\.launch\(|launchPersistentContext\(|ignoreDefaultArgs|chromiumSandbox: false/);
  });
});

// ---- host boundary: what runs on the host once credentials exist, and what each host lane script can load ----
/**
 * Static import graph from `entry`, through a source reader (so mutations can be injected). Follows every static form:
 * `import ... from`, `export ... from`, side-effect `import 'x'`, single or double quotes, across lines. Dynamic `import(` and
 * `require(` are collected as violations, never followed.
 */
type Graph = { files: string[]; builtins: string[]; packages: string[]; dynamic: string[] };
const importGraph = (entry: string, read: (rel: string) => string = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')): Graph => {
  const seen = new Set<string>(), builtins = new Set<string>(), packages = new Set<string>(), dynamic = new Set<string>();
  const walk = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    if (/\bimport\s*\(|\brequire\s*\(/.test(src)) dynamic.add(rel);
    for (const m of src.matchAll(/(?:^|[;\s])(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?(['"])([^'"]+)\1/gm)) {
      const spec = m[2];
      if (spec.startsWith('node:')) builtins.add(spec);
      else if (spec.startsWith('.')) walk(path.relative(ROOT, path.resolve(ROOT, path.dirname(rel), spec)));
      else packages.add(spec);
    }
  };
  walk(entry);
  return { files: [...seen].sort(), builtins: [...builtins].sort(), packages: [...packages].sort(), dynamic: [...dynamic].sort() };
};
/** Host policies for code that runs after export-status (credentials in GITHUB_ENV). Returns the violated rule names. */
const HOST_POLICY: Record<string, { builtins: string[]; files?: string[] }> = {
  'scripts/e2e/le-lane/gates.mjs': { builtins: ['node:fs', 'node:path'], files: ['e2e/lesson-editor/step-codes.mjs', 'scripts/e2e/le-e1-summary.mjs', 'scripts/e2e/le-iso/expect.mjs', 'scripts/e2e/le-lane/contract.mjs', 'scripts/e2e/le-lane/gates.mjs'] },
  'scripts/e2e/le-e1-notrun.mjs': { builtins: ['node:fs'], files: ['e2e/lesson-editor/step-codes.mjs', 'scripts/e2e/le-e1-notrun.mjs', 'scripts/e2e/le-e1-summary.mjs'] },
  'scripts/e2e/le-e1-summary.mjs': { builtins: ['node:fs'], files: ['e2e/lesson-editor/step-codes.mjs', 'scripts/e2e/le-e1-summary.mjs'] },
  'scripts/e2e/le-lane/run-lane.mjs': { builtins: ['node:child_process', 'node:crypto', 'node:fs', 'node:net', 'node:path'],
    files: ['scripts/e2e/le-iso/expect.mjs', 'scripts/e2e/le-iso/run-probe.mjs', 'scripts/e2e/le-lane/bridge.mjs', 'scripts/e2e/le-lane/contract.mjs', 'scripts/e2e/le-lane/image.mjs', 'scripts/e2e/le-lane/run-lane.mjs'] },
  'scripts/e2e/le-lane/image.mjs': { builtins: ['node:child_process', 'node:crypto', 'node:fs', 'node:path'],
    files: ['scripts/e2e/le-iso/expect.mjs', 'scripts/e2e/le-iso/run-probe.mjs', 'scripts/e2e/le-lane/contract.mjs', 'scripts/e2e/le-lane/image.mjs'] },
  'scripts/e2e/le-lane/bridge.mjs': { builtins: ['node:fs', 'node:net', 'node:path'], files: ['scripts/e2e/le-lane/bridge.mjs'] },
};
const policyProblems = (entry: string, g: Graph) => {
  const pol = HOST_POLICY[entry];
  const out: string[] = [];
  if (g.dynamic.length) out.push('dynamic');
  if (g.packages.length) out.push('package');
  if (g.builtins.some((b) => !pol.builtins.includes(b))) out.push('builtin');
  if (pol.files && JSON.stringify(g.files) !== JSON.stringify(pol.files)) out.push('files');
  // whatever the exact list says: lane code, the pairing module and in-container helpers never load on the host
  if (g.files.some((f) => /lane-entry\.mjs$|pairing-proof|^scripts\/local-stack\/|^e2e\/(?!lesson-editor\/step-codes\.mjs$)/.test(f))) out.push('lane-code');
  return out;
};
describe('host boundary after export-status (credentials in GITHUB_ENV): closed script set, closed import closures', () => {
  const job = (YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8')) as Obj).jobs['lesson-editor'];
  const steps: Obj[] = job.steps;
  const exportIx = steps.findIndex((s) => /export-status\.mjs/.test(s.run ?? '') && /GITHUB_ENV/.test(s.run ?? ''));
  // shell variables naming a script directory are expanded first (le_run: GBJ=scripts/gradebook-fixture/journey), so no invoked script hides behind one
  const expand = (run: string) => { let t = run; for (const m of run.matchAll(/^\s*([A-Z][A-Z0-9_]*)=((?:scripts|e2e)\/[\w./-]+)\s*$/gm)) t = t.split(`$${m[1]}/`).join(`${m[2]}/`); return t; };
  const scriptsIn = (s: Obj) => [...new Set(expand(String(s.run ?? '')).match(/(?:scripts|e2e|src|node_modules)\/[\w./@-]+\.(?:mjs|sh|ts|js|cjs)/g) ?? [])];
  it('trusted browser/image checks are all BEFORE the export step; nothing under the lane dirs or a browser runs on the host after it', () => {
    expect(exportIx).toBeGreaterThan(0);
    const before = steps.slice(0, exportIx).flatMap(scriptsIn);
    for (const s of ['scripts/e2e/le-iso/preflight.mjs', 'scripts/e2e/le-iso/browser-pin.mjs', 'scripts/e2e/gb-launch-binding.ts', 'scripts/e2e/le-lane/image.mjs']) expect(before).toContain(s);
    const after = [...new Set(steps.slice(exportIx).flatMap(scriptsIn))].sort();
    expect(after).toEqual([
      'scripts/ci/check-local-target.mjs', 'scripts/e2e/assert-safe-target.mjs', 'scripts/e2e/gb-job-psql.mjs', 'scripts/e2e/le-e1-notrun.mjs', 'scripts/e2e/le-e1-summary.mjs',
      'scripts/e2e/le-lane/gates.mjs', 'scripts/e2e/le-lane/image.mjs', 'scripts/e2e/le-lane/run-lane.mjs', 'scripts/e2e/stack-ownership.mjs',
      'scripts/gradebook-fixture/journey/pairing-producer.mjs', 'scripts/local-stack/bootstrap.sh',
      'scripts/local-stack/learner-quiz/noedge-probes.sh', 'scripts/local-stack/learner-quiz/owned-proc.mjs', 'scripts/local-stack/t09/apply-reviewed.sh',
      'scripts/local-stack/t09/export-status.mjs', 'scripts/local-stack/t09/stack-checks.sh', 'scripts/local-stack/t09/stack-net.mjs', 'scripts/local-stack/t09/stage-pre.sh',
      'scripts/local-stack/verify-identities.sh', 'scripts/served-app/avatar-fixture.mjs', 'scripts/served-app/avatar-live-check.mjs', 'scripts/served-app/hermetic-dist.mjs',
      'scripts/served-app/served-app-check.mjs', 'scripts/served-app/tests/hermetic-dist-selftest.sh',
    ]);
    expect(after.filter((s) => s.startsWith('e2e/lesson-editor/') || s.startsWith('scripts/local-stack/lesson-editor/'))).toEqual([]);
    const afterText = steps.slice(exportIx).map((s) => String(s.run ?? '')).join('\n');
    expect(expand(afterText).match(/\$\{?[A-Za-z_]+\}?\/[\w./-]+\.(?:mjs|sh|ts|js|cjs)\b/g)).toBeNull(); // no script path left behind a variable
    expect(afterText).not.toMatch(/playwright test|npx playwright|@playwright\/test\/cli|chrome-headless-shell|--version|lane-entry\.mjs|run\.sh/); // 'playwright-report' occurs only as an rm path
    // the only image.mjs call after export is cleanup, never build
    expect(afterText.match(/le-lane\/image\.mjs"? (\w+)/g)?.map((x) => x.split(' ').at(-1))).toEqual(['cleanup']);
  });
  it('every host lane script satisfies its import policy today (exact files, builtins; no package, no dynamic load, no lane code)', () => {
    for (const e of Object.keys(HOST_POLICY)) expect(policyProblems(e, importGraph(e)), e).toEqual([]);
    expect(importGraph('scripts/e2e/le-lane/gates.mjs').builtins).toEqual(['node:fs', 'node:path']);
    expect(readFileSync(path.join(ROOT, 'e2e/lesson-editor/step-codes.mjs'), 'utf8')).not.toMatch(/^\s*(import|export)\s[^;]*from\s/m);
  });
  it('import-graph MUTATIONS: each added load, in the entry or deep in its closure, violates the policy', () => {
    const rel = (from: string, to: string) => { const r = path.relative(path.dirname(from), to); return r.startsWith('.') ? r : `./${r}`; };
    const mutations: [string, (file: string) => string, string][] = [
      ['child_process import', () => "import { spawn } from 'node:child_process';\n", 'builtin'],
      ['double-quoted builtin', () => 'import net from "node:http";\n', 'builtin'],
      ['multi-line import', () => "import {\n  request,\n} from 'node:https';\n", 'builtin'],
      ['side-effect lane import', (f) => `import '${rel(f, 'scripts/e2e/le-lane/lane-entry.mjs')}';\n`, 'lane-code'],
      ['re-export from the pairing module', (f) => `export { assertPairingProof } from '${rel(f, 'e2e/gradebook-roles/journey/pairing-proof.mjs')}';\n`, 'lane-code'],
      ['package import', () => "import YAML from 'yaml';\n", 'package'],
      ['dynamic import', () => "const m = await import('node:child_process');\n", 'dynamic'],
      ['require', () => "const n = require('node:net');\n", 'dynamic'],
    ];
    for (const entry of Object.keys(HOST_POLICY)) {
      const targets = [entry, ...importGraph(entry).files.filter((f) => f !== entry)].slice(0, 3); // the entry and its first dependencies
      for (const target of targets)
        for (const [name, add, rule] of mutations) {
          if (name === 'child_process import' && HOST_POLICY[entry].builtins.includes('node:child_process')) continue; // the orchestrator and builder must spawn docker
          const g = importGraph(entry, (r) => (r === target ? add(target) : '') + readFileSync(path.join(ROOT, r), 'utf8'));
          expect(policyProblems(entry, g), `${entry} <- ${target}: ${name}`).toContain(rule);
        }
    }
    // a comment that merely mentions an import is not a load
    const g = importGraph('scripts/e2e/le-lane/gates.mjs', (r) => (r === 'scripts/e2e/le-lane/gates.mjs' ? "// import x from 'node:http';\n" : '') + readFileSync(path.join(ROOT, r), 'utf8'));
    expect(policyProblems('scripts/e2e/le-lane/gates.mjs', g)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// E1 diagnostics r1 (fakes only). Diagnostic lines never change acceptance, the refusal code, the exit or any gate.
describe('E1 diagnostics r1: run-result class, report state, reported-error lead, refusal detail', () => {
  const errReport = (results: Obj[], rootErrors: Obj[] = [], aa: string[] = [AA_DESC]) => JSON.stringify({
    errors: rootErrors,
    suites: [{ suites: [{ specs: [{ title: 'E1 save', tests: [{ annotations: aa.map((d) => ({ type: 'lane-apparmor', description: d })), results }] }] }] }],
  });
  const R1 = (message: unknown, extra: Obj = {}) => ({ status: 'failed', error: { message, stack: `Error: ${String(message)}\n    at x (/w/repo/e2e/x.ts:1:1)` }, ...extra });
  const snap = (text: string) => reportSnapshot({ status: 'ok', text });

  it('the code list is exactly the fixed codes the launcher and the egress fixture throw', () => {
    const codesIn = (rel: string) => [...readFileSync(path.join(ROOT, rel), 'utf8').matchAll(/'(LANE_E_[A-Z_]+)'/g)].map((m) => m[1]);
    const thrown = new Set([...codesIn('e2e/lesson-editor/sandbox-launch.mjs'), ...codesIn('e2e/lesson-editor/egress-test.ts')]);
    expect([...REPORTED_ERROR_CODES].sort()).toEqual([...thrown].sort());
    expect(E1_RESULT_CLASSES).toEqual(['CLOSE_WITH_CODE', 'REAP_UNCONFIRMED', 'NO_CODE']);
    expect(REPORT_STATES).toEqual(['MISSING', 'INVALID', 'PARSED']);
  });

  it('result class: an actual 255 and a missing code differ; unknown or conflicting shapes are NO_CODE', () => {
    expect(e1ResultClass({ code: 255, out: '' })).toBe('CLOSE_WITH_CODE');
    expect(e1ResultClass({ code: 0 })).toBe('CLOSE_WITH_CODE');
    expect(e1ResultClass({ code: null, out: '' })).toBe('NO_CODE');
    expect(e1ResultClass({ code: null, out: '', unreaped: true })).toBe('REAP_UNCONFIRMED');
    for (const bad of [null, undefined, 0, 'x', [], {}, { code: '0' }, { code: 1.5 }, { code: -1 }, { code: 256 }, { code: 0, unreaped: true },
      { code: null, unreaped: 'yes' }, { code: 0, unreaped: false }, { code: 0, signal: 'SIGTERM' }, { code: 0, extra: 1 }])
      expect(e1ResultClass(bad), JSON.stringify(bad)).toBe('NO_CODE');
  });

  it('result class needs OWN DATA fields of the right type: inherited, accessor, symbol, proxy or mistyped shapes are NO_CODE', () => {
    const getterCalls: string[] = [];
    const withGetter = (k: string, v: unknown) => Object.defineProperty({ code: 0 }, k, { get: () => { getterCalls.push(k); return v; }, enumerable: true });
    const nullProto = Object.assign(Object.create(null), { code: 0 });
    const cases: [string, unknown][] = [
      ['inherited code', Object.create({ code: 0 })],
      ['own null code + inherited unreaped', Object.assign(Object.create({ unreaped: true }), { code: null })],
      ['inherited code via prototype chain of a class', new (class { code = 0; })()],
      ['null prototype', nullProto],
      ['out is a number', { code: 0, out: 123 }],
      ['out is a buffer', { code: 0, out: Buffer.from('x') }],
      ['out null', { code: 0, out: null }],
      ['code getter', withGetter('code', 0)],
      ['out getter', withGetter('out', '')],
      ['unreaped getter', Object.defineProperty({ code: null }, 'unreaped', { get: () => true, enumerable: true })],
      ['non-enumerable unreaped', Object.defineProperty({ code: null, out: '' }, 'unreaped', { value: true, enumerable: false })],
      ['symbol key', { code: 0, [Symbol('x')]: 1 }],
      ['unreaped false', { code: null, unreaped: false }],
      ['unreaped with a code', { code: 0, out: '', unreaped: true }],
      ['no code at all', { out: '' }],
      ['proxy that throws', new Proxy({ code: 0 }, { ownKeys: () => { throw new Error('trap'); } })],
    ];
    for (const [name, v] of cases) expect(e1ResultClass(v), name).toBe('NO_CODE');
    expect(getterCalls).toEqual([]); // getters are never invoked
    // the exact shapes runChild builds still classify
    expect(e1ResultClass({ code: 7, out: '' })).toBe('CLOSE_WITH_CODE');
    expect(e1ResultClass({ code: null, out: '', unreaped: true })).toBe('REAP_UNCONFIRMED');
    expect(e1ResultClass({ code: null, out: '' })).toBe('NO_CODE');
  });

  const fakeChild = () => { const c = new EventEmitter() as EventEmitter & { kill: (s: string) => void; kills: string[]; stdout: null }; c.kills = []; c.kill = (s) => { c.kills.push(s); }; c.stdout = null; return c; };
  it('runChild (unchanged) through the classifier: close, timeout then close, error, spawn throw, final unreaped fallback, late events', async () => {
    vi.useFakeTimers();
    try {
      const go = async (drive: (c: ReturnType<typeof fakeChild>) => void, spawnThrows = false) => {
        const c = fakeChild();
        const p = runChild(() => { if (spawnThrows) throw new Error('ENOENT secret=x'); return c as never; }, '/bin/x', [], { env: {}, cwd: '/', timeout: 100, grace: 10 });
        drive(c);
        await vi.advanceTimersByTimeAsync(1000);
        return { r: await p, c };
      };
      expect(e1ResultClass((await go((c) => c.emit('close', 255))).r)).toBe('CLOSE_WITH_CODE');
      expect(e1ResultClass((await go((c) => c.emit('close', null))).r)).toBe('NO_CODE');
      expect(e1ResultClass((await go((c) => c.emit('error', new Error('x')))).r)).toBe('NO_CODE');
      expect(e1ResultClass((await go(() => {}, true)).r)).toBe('NO_CODE');
      // timeout signalling, then close WITH a code: still CLOSE_WITH_CODE (the class never claims "returned normally")
      const t = await go((c) => { setTimeout(() => c.emit('close', 143), 105); });
      expect(t.c.kills).toEqual(['SIGTERM']);
      expect(e1ResultClass(t.r)).toBe('CLOSE_WITH_CODE');
      // timeout, then close WITHOUT a code (killed by signal)
      expect(e1ResultClass((await go((c) => { setTimeout(() => c.emit('close', null), 105); })).r)).toBe('NO_CODE');
      // never reaped: the final fallback, and a late close or error afterwards changes nothing
      const u = await go((c) => { setTimeout(() => { c.emit('close', 0); c.emit('error', new Error('late')); }, 500); });
      expect(u.c.kills).toEqual(['SIGTERM', 'SIGKILL']);
      expect(u.r).toEqual({ code: null, out: '', unreaped: true });
      expect(e1ResultClass(u.r)).toBe('REAP_UNCONFIRMED');
      // a late close after a first close changes nothing either
      expect(e1ResultClass((await go((c) => { c.emit('close', 1); c.emit('close', null); })).r)).toBe('CLOSE_WITH_CODE');
    } finally { vi.useRealTimers(); }
  });

  it('supervisor: actual 255 vs no code write the SAME pw-exit (unchanged) and differ only in the RESULT line; acceptance unchanged', async () => {
    const a = await enter({ e1Code: 255 });
    const b = await enter({ e1Code: null });
    const u = await enter({ e1Res: { code: null, out: '', unreaped: true } });
    for (const r of [a, b, u]) { expect(r.writes.get(3)).toBe('255\n'); expect(r.code).toBe(1); expect(parseLaneOut(r.lane()).ok).toBe(true); }
    expect(a.lane()).toContain('LANE E1 RAN\nLANE E1 RESULT CLOSE_WITH_CODE\n');
    expect(b.lane()).toContain('LANE E1 RAN\nLANE E1 RESULT NO_CODE\n');
    expect(u.lane()).toContain('LANE E1 RAN\nLANE E1 RESULT REAP_UNCONFIRMED\n');
    // conflicting shapes are NO_CODE in the diagnostic; the existing acceptance rule (e1.code === 0) is untouched
    const conflict = await enter({ e1Res: { code: 0, unreaped: true } });
    expect(conflict.lane()).toContain('LANE E1 RESULT NO_CODE\n');
    expect(conflict.writes.get(3)).toBe('0\n');
    const ok = await enter();
    expect(ok.code).toBe(0);
    expect(ok.lane()).toBe(LANE_OK);
  });

  it('report state and the AppArmor line come from ONE read and agree; missing report plus NO_CODE stays unresolved', async () => {
    const r = await enter({ report: null, e1Code: null });
    expect(r.lane()).toContain('LANE E1 RESULT NO_CODE\nLANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING\nLANE E1 REPORTED_ERROR UNKNOWN\n');
    expect(r.code).toBe(1);
    expect(snap('{not json')).toEqual({ aaLine: 'LANE E1 APPARMOR INVALID', report: 'INVALID', reportedError: 'UNKNOWN', postObserved: 'INVALID', attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN', browserExit: 'INVALID', browserLog: 'INVALID' });
    for (const why of ['open', 'owner', 'mode', 'size', 'grew', 'path', 'read'])
      expect(reportSnapshot({ status: 'refused', why })).toEqual({ aaLine: 'LANE E1 APPARMOR INVALID', report: 'INVALID', reportedError: 'UNKNOWN', postObserved: 'INVALID', attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN', browserExit: 'INVALID', browserLog: 'INVALID' });
    expect(reportSnapshot({ status: 'ok', text: 'x'.repeat(REPORT_MAX + 1) }).report).toBe('INVALID');
    // budget exhaustion, even with a recognisable code earlier in the walk, is INVALID and UNKNOWN
    let deep: Obj = {}; for (let i = 0; i < 100; i++) deep = { child: deep };
    expect(snap(JSON.stringify({ errors: [{ message: 'Error: LANE_E_CONNECT' }], deep }))).toEqual({ aaLine: 'LANE E1 APPARMOR INVALID', report: 'INVALID', reportedError: 'UNKNOWN', postObserved: 'INVALID', attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN', browserExit: 'INVALID', browserLog: 'INVALID' });
    const wide = JSON.stringify({ errors: [{ message: 'Error: LANE_E_CONNECT' }], items: Array.from({ length: REPORT_MAX_NODES }, () => ({})) });
    expect(snap(wide).report).toBe('INVALID');
    // parsed with no annotation: AppArmor MISSING, report PARSED
    expect(snap(errReport([R1('Error: LANE_E_LAUNCH_HUNG')], [], []))).toEqual({ aaLine: 'LANE E1 APPARMOR MISSING', report: 'PARSED', reportedError: 'LANE_E_LAUNCH_HUNG', postObserved: 'MISSING', attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN', browserExit: 'MISSING', browserLog: 'MISSING' });
    // the old function is the same snapshot's AppArmor line
    expect(workerAppArmorFromReport({ status: 'ok', text: errReport([R1('Error: LANE_E_CONNECT')]) })).toBe(AA_LINE);
  });

  it('reported error: only defined error fields, exact message or the `Error: ` wrapper; spoofing elsewhere and near matches are UNKNOWN', () => {
    expect(snap(errReport([R1('Error: LANE_E_SANDBOX_OFF')])).reportedError).toBe('LANE_E_SANDBOX_OFF');
    expect(snap(errReport([R1('LANE_E_SANDBOX_OFF')])).reportedError).toBe('LANE_E_SANDBOX_OFF');
    expect(snap(errReport([], [{ message: 'Error: LANE_E_LAUNCH_REJECTED', stack: 'x' }])).reportedError).toBe('LANE_E_LAUNCH_REJECTED');
    expect(snap(errReport([{ status: 'passed' }])).reportedError).toBe('UNKNOWN');
    const spoofs: Obj[] = [
      { status: 'failed', errors: [{ message: 'Error: LANE_E_CONNECT' }] }, // formatted errors[] of a result: not a defined field
      { status: 'failed', error: { message: 'x', stack: 'Error: LANE_E_CONNECT', snippet: 'LANE_E_CONNECT', value: 'LANE_E_CONNECT' } },
      { status: 'failed', error: { message: 'x', cause: { message: 'Error: LANE_E_CONNECT' } } },
      { status: 'failed', stdout: [{ text: 'Error: LANE_E_CONNECT' }], stderr: [{ text: 'LANE_E_CONNECT' }] },
      { status: 'failed', attachments: [{ name: 'Error: LANE_E_CONNECT', body: 'LANE_E_CONNECT' }] },
      { status: 'failed', steps: [{ title: 'x', error: { message: 'Error: LANE_E_CONNECT' } }] },
      { status: 'failed', annotations: [{ type: 'error', description: 'Error: LANE_E_CONNECT' }], message: 'Error: LANE_E_CONNECT' },
    ];
    for (const sp of spoofs) expect(snap(errReport([sp])).reportedError, JSON.stringify(sp)).toBe('UNKNOWN');
    // an `error` key outside the results path, or a message on an unexpected node, is not a defined field
    expect(snap(JSON.stringify({ error: { message: 'Error: LANE_E_CONNECT' }, config: { errors: [{ message: 'LANE_E_CONNECT' }] }, suites: [{ error: { message: 'LANE_E_CONNECT' } }] })).reportedError).toBe('UNKNOWN');
    expect(snap(JSON.stringify([{ errors: [{ message: 'LANE_E_CONNECT' }] }])).reportedError).toBe('UNKNOWN'); // a root array is not the report
    for (const near of ['Error: LANE_E_CONNECTX', 'Error: LANE_E_CONNEC', ' LANE_E_CONNECT', 'LANE_E_CONNECT ', 'LANE_E_CONNECT\n', 'Error:  LANE_E_CONNECT',
      'TypeError: LANE_E_CONNECT', 'SandboxLaunchError: LANE_E_CONNECT', 'error: LANE_E_CONNECT', 'lane_e_connect', 'Error: LANE_E_CONNECT\n    at x', '\u001b[31mError: LANE_E_CONNECT\u001b[39m', 'LANE_E_BOGUS', 'LANE_E_TEXT_RENDER'])
      expect(reportedErrorCode(near), JSON.stringify(near)).toBeNull();
    for (const v of [null, 1, {}, ['LANE_E_CONNECT']]) expect(reportedErrorCode(v)).toBeNull();
  });

  it('distinct codes are MULTIPLE; the same code twice is that code; secret-bearing messages never reach lane.txt or the detail', async () => {
    expect(snap(errReport([R1('Error: LANE_E_CONNECT'), R1('Error: LANE_E_SERVER_KILL')])).reportedError).toBe('MULTIPLE');
    expect(snap(errReport([R1('Error: LANE_E_CONNECT')], [{ message: 'LANE_E_LAUNCH_HUNG' }])).reportedError).toBe('MULTIPLE');
    expect(snap(errReport([R1('Error: LANE_E_CONNECT'), R1('LANE_E_CONNECT')])).reportedError).toBe('LANE_E_CONNECT');
    expect(snap(errReport([R1('Error: LANE_E_CONNECT'), R1('Test timeout of 30000ms exceeded.')])).reportedError).toBe('LANE_E_CONNECT');
    const secret = 'postgresql://postgres:hunter2@127.0.0.1:54322/postgres eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';
    const r = await enter({ report: errReport([R1(`Error: LANE_E_CONNECT ${secret}`), R1(secret)], [{ message: secret }]) });
    expect(r.lane()).toContain('LANE E1 REPORTED_ERROR UNKNOWN\n');
    expect(r.lane()).not.toMatch(/hunter2|eyJ|postgresql:|127\.0\.0\.1/);
    expect(r.lane().split('\n').every((l) => l === '' || /^LANE [A-Z0-9_ ]+$/.test(l))).toBe(true);
    expect(r.code).toBe(0); // diagnostics decide nothing: E1 exit 0, AppArmor ENFORCE and cleanup PASS still accept exactly as before
  });

  it('grammar: the three lines are required in order after E1 RAN, closed values only, consistent with the AppArmor line', () => {
    const base = LANE_OK;
    const swap = (from: string, to: string) => base.replace(from, to);
    for (const bad of [
      swap('LANE E1 RESULT CLOSE_WITH_CODE\n', ''), swap('LANE E1 REPORT PARSED\n', ''), swap('LANE E1 REPORTED_ERROR UNKNOWN\n', ''),
      swap('LANE E1 RESULT CLOSE_WITH_CODE', 'LANE E1 RESULT SPAWN_FAILED'), swap('LANE E1 RESULT CLOSE_WITH_CODE', 'LANE E1 RESULT TIMED_OUT'),
      swap('LANE E1 RESULT CLOSE_WITH_CODE', 'LANE E1 RESULT RETURNED_NORMALLY'), swap('LANE E1 RESULT CLOSE_WITH_CODE', 'LANE E1 RESULT CLOSE_WITH_CODE 255'),
      swap('LANE E1 REPORT PARSED', 'LANE E1 REPORT OK'), swap('LANE E1 REPORTED_ERROR UNKNOWN', 'LANE E1 REPORTED_ERROR LANE_E_BOGUS'),
      swap('LANE E1 REPORTED_ERROR UNKNOWN', 'LANE E1 REPORTED_ERROR NONE'), swap('LANE E1 REPORTED_ERROR UNKNOWN', 'LANE E1 REPORTED_ERROR LANE_E_CONNECT secret'),
      swap('LANE E1 REPORT PARSED', 'LANE E1 REPORT MISSING'), // AppArmor line is evidence, so the report was not missing
      swap('LANE E1 REPORT PARSED', 'LANE E1 REPORT INVALID'),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT INVALID'),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED\nLANE E1 REPORTED_ERROR UNKNOWN`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING\nLANE E1 REPORTED_ERROR LANE_E_CONNECT'),
      swap(`LANE E1 RESULT CLOSE_WITH_CODE\n${AA_LINE}`, `${AA_LINE}\nLANE E1 RESULT CLOSE_WITH_CODE`), // order
      swap('LANE E1 REPORT PARSED\nLANE E1 REPORTED_ERROR UNKNOWN', 'LANE E1 REPORTED_ERROR UNKNOWN\nLANE E1 REPORT PARSED'),
      `LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP FAIL\nLANE E1 NOT RUN\nLANE E1 RESULT NO_CODE\nLANE CLEANUP PASS\nLANE END\n`,
    ]) expect(parseLaneOut(bad).ok, bad).toBe(false);
    for (const good of [
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING'),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED\nLANE E1 REPORTED_ERROR UNKNOWN\nLANE E1 POST_OBSERVED MISSING`, 'LANE E1 APPARMOR INVALID\nLANE E1 REPORT INVALID\nLANE E1 REPORTED_ERROR UNKNOWN\nLANE E1 POST_OBSERVED INVALID').replace('BROWSER_EXIT MISSING', 'BROWSER_EXIT INVALID').replace('BROWSER_LOG MISSING', 'BROWSER_LOG INVALID'),
      swap(AA_LINE, 'LANE E1 APPARMOR MISSING'), swap(AA_LINE, 'LANE E1 APPARMOR INVALID'),
      swap('LANE E1 REPORTED_ERROR UNKNOWN', 'LANE E1 REPORTED_ERROR MULTIPLE'), swap('LANE E1 REPORTED_ERROR UNKNOWN', 'LANE E1 REPORTED_ERROR LANE_E_SANDBOX_PID'),
    ]) expect(parseLaneOut(good).ok, good).toBe(true);
    // each prefix is a valid interrupted prefix
    const ls = base.split('\n');
    for (let n = 4; n < ls.length - 2; n++) expect(parseLaneOut(`${ls.slice(0, n).join('\n')}\n`)).toMatchObject({ ok: true, interrupted: true });
  });

  it('refusal and exit behaviour unchanged; detail only for LE_SUM_E_WORKER_APPARMOR, closed tokens only, 255 left ambiguous', () => {
    const okPw = (d: string) => ({ state: 'ok', digits: d });
    const lane = (result: string, aa: string, report: string, err: string, cleanup = 'PASS') =>
      `LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP PASS\nLANE E1 RAN\nLANE E1 RESULT ${result}\n${aa}\nLANE E1 REPORT ${report}\nLANE E1 REPORTED_ERROR ${err}\n${DIAG_TAIL}LANE CLEANUP ${cleanup}\nLANE END\n`;
    const missing = lane('NO_CODE', 'LANE E1 APPARMOR MISSING', 'MISSING', 'UNKNOWN', 'FAIL');
    expect(planSummary({ verdict: OKV, laneText: missing, pwExit: okPw('255') })).toEqual({ kind: 'refused', code: 'LE_SUM_E_WORKER_APPARMOR' });
    expect(refusalDetail({ verdict: OKV, laneText: missing, pwExit: okPw('255') })).toBe('LE-E1 DETAIL exit=255 result=NO_CODE aa=MISSING report=MISSING error=UNKNOWN post=MISSING attempt_status=UNKNOWN failed_step=UNKNOWN browser_exit=MISSING browser_log=MISSING cleanup=FAIL');
    const real255 = lane('CLOSE_WITH_CODE', 'LANE E1 APPARMOR MISSING', 'PARSED', 'LANE_E_LAUNCH_HUNG');
    expect(refusalDetail({ verdict: OKV, laneText: real255, pwExit: okPw('255') })).toBe('LE-E1 DETAIL exit=255 result=CLOSE_WITH_CODE aa=MISSING report=PARSED error=LANE_E_LAUNCH_HUNG post=MISSING attempt_status=UNKNOWN failed_step=UNKNOWN browser_exit=MISSING browser_log=MISSING cleanup=PASS');
    const nonEnf = lane('CLOSE_WITH_CODE', `LANE E1 APPARMOR PRE ${ENF} ${ENF} POST ${ENF} APPARMOR_E_UNCONFINED`, 'PARSED', 'MULTIPLE');
    expect(refusalDetail({ verdict: OKV, laneText: nonEnf, pwExit: okPw('001') })).toBe(`LE-E1 DETAIL exit=1 result=CLOSE_WITH_CODE aa=PRE:${ENF},${ENF};POST:${ENF},APPARMOR_E_UNCONFINED report=PARSED error=MULTIPLE post=MISSING attempt_status=UNKNOWN failed_step=UNKNOWN browser_exit=MISSING browser_log=MISSING cleanup=PASS`);
    // every other plan: NONE (summary, not-run, other refusals, skip), and the plan itself is unchanged by the new lines
    const other: [string | null, Obj, Obj][] = [[LANE_OK, okPw('0'), OKV], [LANE_OK, { state: 'absent' }, OKV], [LANE_OK, { state: 'bad' }, OKV], [null, { state: 'absent' }, OKV],
      ['LANE START\n', { state: 'absent' }, OKV], [missing, okPw('255'), { ...OKV, ok: false }], ['garbage\n', okPw('0'), OKV]];
    for (const [t, pw, v] of other) expect(refusalDetail({ verdict: v as never, laneText: t, pwExit: pw as never })).toBe('LE-E1 DETAIL NONE');
    expect(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: okPw('0') })).toEqual({ kind: 'summary', pw: '0', setup: 'PASS', cleanup: 'PASS' });
    const DETAIL = /^LE-E1 DETAIL (NONE|exit=\d{1,3} result=[A-Z_]+ aa=[A-Z_:,;]+ report=[A-Z]+ error=[A-Z_]+ post=[A-Z_:,;]+ attempt_status=[A-Z_]+ failed_step=[A-Z0-9_]+ browser_exit=[A-Z0-9_,]+ browser_log=[A-Z_]+ cleanup=(PASS|FAIL))$/;
    for (const t of [missing, real255, nonEnf]) expect(refusalDetail({ verdict: OKV, laneText: t, pwExit: okPw('255') })).toMatch(DETAIL);
  });

  it('gates.mjs detail reads the same private files as plan; the workflow keeps the refusal line first and exits 1', () => {
    const block = 'LANE_CREATE_OK\nGATE CONTAINER LANE_ABSENT\nGATE BRIDGE BRIDGE_REAPED\nGATE CLIENTS REAPED\nGATE STARTED YES\nLANE_GATES_END\n';
    const read = new Map<string, number>();
    const fsFor = (files: Record<string, string>) => ({
      lstatSync: (p: string) => { if (!(p in files)) throw Object.assign(new Error('x'), { code: 'ENOENT' }); return { isFile: () => true, isSymbolicLink: () => false }; },
      openSync: (p: string) => { if (!(p in files)) throw Object.assign(new Error('x'), { code: 'ENOENT' }); read.set(p, 0); return p; },
      fstatSync: (fd: string) => ({ isFile: () => true, uid: process.getuid!(), mode: 0o100600, nlink: 1, size: Buffer.byteLength(files[fd]) }),
      readSync: (fd: string, buf: Buffer, off: number, len: number) => { const b = Buffer.from(files[fd]); const at = read.get(fd) ?? 0; const n = b.copy(buf, off, at, Math.min(b.length, at + len)); read.set(fd, at + n); return n; },
      closeSync: () => {},
    });
    const lane = LANE_OK.replace(AA_LINE, 'LANE E1 APPARMOR MISSING');
    const files = { [L.started]: 'x', [L.gates]: block, [L.laneTxt]: lane, [L.pwExit]: '1\n' };
    expect(planLine(fsFor(files), L)).toBe('PLAN REFUSED LE_SUM_E_WORKER_APPARMOR');
    expect(detailLine(fsFor(files), L)).toBe('LE-E1 DETAIL exit=1 result=CLOSE_WITH_CODE aa=MISSING report=PARSED error=UNKNOWN post=MISSING attempt_status=UNKNOWN failed_step=UNKNOWN browser_exit=MISSING browser_log=MISSING cleanup=PASS');
    expect(detailLine(fsFor({ ...files, [L.laneTxt]: LANE_OK, [L.pwExit]: '0\n' }), L)).toBe('LE-E1 DETAIL NONE');
    const step = (YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8')) as Obj).jobs as Obj;
    const run = (Object.values(step).flatMap((j) => ((j as Obj).steps as Obj[] | undefined) ?? []).find((s) => s.id === 'le_summary') as Obj).run as string;
    const refused = run.split('\n').filter((l) => l.includes('LE-E1 REFUSED'));
    expect(refused.map((l) => l.trim())).toEqual(['{ echo "LE-E1 REFUSED $3"; node scripts/e2e/le-lane/gates.mjs detail "$C" "$LE_PRIV" "$GITHUB_WORKSPACE" || echo "LE-E1 DETAIL NONE"; } | tee "$LE_EVIDENCE/checks/le-e1.txt"; exit 1 ;;']);
    expect(run).toContain('case "$3" in LE_SUM_E_LANE_OUT|LE_SUM_E_LANE_INTERRUPTED|LE_SUM_E_PW_MISSING|LE_SUM_E_PW|LE_SUM_E_PW_UNEXPECTED|LE_SUM_E_WORKER_APPARMOR) ;; *) set -- x x LE_SUM_E_UNCLASSIFIED ;; esac');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// E1 diagnostics r2 (fakes only; no browser, DB, Docker, process or file). Diagnostic values never change a gate, the
// refusal code, the exit, cleanup or upload. Read outcomes come from the SAME attempts; exit is observed, never ALIVE.
describe('E1 diagnostics r2: POST read outcomes, owned-child exit observation, attempt status and failed step', () => {
  const PRIMARY = (who: string | number) => `/proc/${who}/attr/apparmor/current`;
  const FALLBACK = (who: string | number) => `/proc/${who}/attr/current`;
  const errno = (code: unknown, message = 'secret hunter2 /proc/10/attr') => Object.assign(new Error(message), { code });
  /** A readFile fake: per path either text or a thrown error; records every attempted path. */
  const files = (m: Record<string, string | Error>) => { const calls: string[] = []; return { calls, read: (p: string) => { calls.push(p); const v = m[p]; if (v === undefined) throw errno('ENOENT'); if (v instanceof Error) throw v; return v; } }; };
  const SECRET = /hunter2|eyJ|postgresql:|127\.0\.0\.1|\/proc\/|secret/;

  it('closed-list copies in contract.mjs equal their sources; no ALIVE token exists anywhere', () => {
    expect([...POST_READ_OUTCOMES]).toEqual([...READ_OUTCOMES]);
    expect([...POST_EXIT_OBSERVATIONS]).toEqual([...EXIT_OBSERVATIONS]);
    expect([...E1_STEP_CODES]).toEqual([...E1_STEPS]);
    expect([...FAILED_STEP_TOKENS]).toEqual([...E1_STEPS, 'NONE', 'UNKNOWN']);
    expect([...ATTEMPT_STATUSES]).toEqual(['PASSED', 'FAILED', 'TIMED_OUT', 'INTERRUPTED', 'SKIPPED', 'UNKNOWN']);
    for (const list of [READ_OUTCOMES, EXIT_OBSERVATIONS, ATTEMPT_STATUSES, FAILED_STEP_TOKENS]) expect(list.join(' ')).not.toMatch(/ALIVE|RUNNING|LIVE\b/);
    for (const rel of ['e2e/lesson-editor/sandbox-launch.mjs', 'scripts/e2e/le-lane/contract.mjs', 'scripts/e2e/le-lane/lane-entry.mjs', 'e2e/lesson-editor/egress-test.ts'])
      expect(readFileSync(path.join(ROOT, rel), 'utf8'), rel).not.toMatch(/'ALIVE'|"ALIVE"|\bALIVE\b(?! \(no| claim)/);
  });

  it('label read: same attempts, first successful read returned (even blank), fallback only after a primary throw', () => {
    // primary success: one attempt, fallback NOT_TRIED
    let n: unknown = null;
    const a = files({ [PRIMARY(10)]: 'docker-default (enforce)\n' });
    expect(readLabelAttempts(a.read, 10, (o: unknown) => { n = o; })).toBe('docker-default (enforce)\n');
    expect(a.calls).toEqual([PRIMARY(10)]);
    expect(n).toEqual(['OK', 'NOT_TRIED']);
    // primary failure, fallback success
    const b = files({ [PRIMARY(10)]: errno('EACCES'), [FALLBACK(10)]: 'docker-default (enforce)\n' });
    expect(readLabelAttempts(b.read, 10, (o: unknown) => { n = o; })).toBe('docker-default (enforce)\n');
    expect(b.calls).toEqual([PRIMARY(10), FALLBACK(10)]);
    expect(n).toEqual(['EACCES', 'OK']);
    // blank primary: returned as is, NO fallback attempt, and the gate code is UNKNOWN (unchanged fail-closed)
    for (const blank of ['', '\n', '  \0\n', '\0']) {
      const c = files({ [PRIMARY('self')]: blank, [FALLBACK('self')]: 'docker-default (enforce)\n' });
      expect(readLabelAttempts(c.read, 'self', (o: unknown) => { n = o; })).toBe(blank);
      expect(c.calls).toEqual([PRIMARY('self')]);
      expect(n).toEqual(['BLANK', 'NOT_TRIED']);
      expect(labelCode((who: number | 'self') => readLabelAttempts(c.read, who, undefined), 'self')).toBe('APPARMOR_E_UNKNOWN');
    }
    // mixed errno outcomes, both failing: null, two attempts
    const mixed: [unknown, unknown, string[]][] = [['ENOENT', 'ENOENT', ['ENOENT', 'ENOENT']], ['EACCES', 'EPERM', ['EACCES', 'EPERM']], ['ESRCH', 'EINVAL', ['ESRCH', 'OTHER']],
      [undefined, 'ENOENT', ['OTHER', 'ENOENT']], [2, 'enoent', ['OTHER', 'OTHER']], ['EPERM', null, ['EPERM', 'OTHER']]];
    for (const [p, f, want] of mixed) {
      const d = files({ [PRIMARY(10)]: errno(p), [FALLBACK(10)]: errno(f) });
      expect(readLabelAttempts(d.read, 10, (o: unknown) => { n = o; })).toBeNull();
      expect(d.calls).toEqual([PRIMARY(10), FALLBACK(10)]);
      expect(n, String(p)).toEqual(want);
    }
    // a primary error followed by a BLANK fallback
    const e = files({ [PRIMARY(10)]: errno('ENOENT'), [FALLBACK(10)]: '\n' });
    expect(readLabelAttempts(e.read, 10, (o: unknown) => { n = o; })).toBe('\n');
    expect(n).toEqual(['ENOENT', 'BLANK']);
  });

  it('label read: the note changes nothing (with or without it, a throwing note, odd error objects); messages are never read', () => {
    const cases: Record<string, string | Error>[] = [
      { [PRIMARY(10)]: 'docker-default (enforce)\n' }, { [PRIMARY(10)]: '' }, { [PRIMARY(10)]: errno('EACCES'), [FALLBACK(10)]: 'unconfined\n' },
      { [PRIMARY(10)]: errno('ENOENT'), [FALLBACK(10)]: errno('ENOENT') }, {},
    ];
    for (const m of cases) {
      const x = files(m), y = files(m), z = files(m);
      const plain = readLabelAttempts(x.read, 10, undefined);
      expect(readLabelAttempts(y.read, 10, () => {})).toBe(plain);
      expect(readLabelAttempts(z.read, 10, () => { throw new Error('note failed'); })).toBe(plain);
      expect(y.calls).toEqual(x.calls);
      expect(z.calls).toEqual(x.calls);
    }
    // the code must be an OWN string data property; a getter is never invoked; a message naming an errno is not a code
    let invoked = false;
    const getter = Object.defineProperty(new Error('ENOENT'), 'code', { get: () => { invoked = true; return 'ENOENT'; }, enumerable: true });
    expect(readErrorOutcome(getter)).toBe('OTHER');
    expect(invoked).toBe(false);
    expect(readErrorOutcome(new Error('ENOENT: no such file'))).toBe('OTHER');
    expect(readErrorOutcome(Object.create({ code: 'ENOENT' }))).toBe('OTHER');
    expect(readErrorOutcome(new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error('trap'); } }))).toBe('OTHER');
    for (const v of [null, undefined, 'ENOENT', 7]) expect(readErrorOutcome(v)).toBe('OTHER');
    expect(readTextOutcome('docker-default (enforce)')).toBe('OK');
    expect(readTextOutcome('x')).toBe('OK');
    for (const v of ['', ' ', '\0\0', null, undefined, 5]) expect(readTextOutcome(v)).toBe('BLANK');
  });

  /** A ChildProcess-like handle: EventEmitter with exitCode/signalCode fields. */
  const child = (exitCode: number | null = null, signalCode: string | null = null) => Object.assign(new EventEmitter(), { pid: 10, exitCode, signalCode });

  it('exit observation: before registration, after a later exit event, unusable handles; never a liveness claim', () => {
    expect(exitObserver(child(0))()).toBe('EXIT_OBSERVED'); // exited before the listener was registered
    expect(exitObserver(child(null, 'SIGKILL'))()).toBe('EXIT_OBSERVED');
    const c = child();
    const obs = exitObserver(c);
    expect(obs()).toBe('NO_EXIT_OBSERVED');
    c.emit('exit', null, 'SIGTRAP');
    expect(obs()).toBe('EXIT_OBSERVED'); // the listener fired even though the fields were not updated
    const d = child();
    const od = exitObserver(d);
    d.exitCode = 1 as never;
    expect(od()).toBe('EXIT_OBSERVED'); // fields set without an event
    expect(exitObserver(undefined)()).toBe('UNKNOWN');
    expect(exitObserver(null)()).toBe('UNKNOWN');
    expect(exitObserver({ pid: 10 })()).toBe('UNKNOWN'); // no once(): no registration, so no-exit is not claimed
    expect(exitObserver({ pid: 10, exitCode: null, signalCode: null })()).toBe('UNKNOWN');
    expect(exitObserver({ pid: 10, once: () => { throw new Error('x'); }, exitCode: null, signalCode: null })()).toBe('UNKNOWN');
    expect(exitObserver(Object.assign(new EventEmitter(), { pid: 10 }))()).toBe('UNKNOWN'); // fields absent (undefined)
    const thrower = Object.defineProperty(Object.assign(new EventEmitter(), { signalCode: null }), 'exitCode', { get: () => { throw new Error('x'); } });
    expect(exitObserver(thrower)()).toBe('UNKNOWN');
    for (const v of EXIT_OBSERVATIONS) expect(v).not.toMatch(/ALIVE/);
  });

  /** Gate state as withSandboxedBrowser builds it, with a file-level label fake (readLabel = readLabelAttempts over `m`). */
  const gateState = (m: Record<string, string | Error>, handle: unknown = child()) => {
    const f = files(m);
    const readLabel = (who: number | 'self', note?: (o: string[]) => void) => readLabelAttempts(f.read, who, note);
    return { f, state: { pid: 10, readLabel, exitObservation: exitObserver(handle), pre: { worker: ENF, browser: ENF } } };
  };
  const ENFORCE = 'docker-default (enforce)\n';

  it('observed POST equals postrunAppArmor exactly (same reads, same order, same decision) and adds only the closed line', () => {
    const matrix: Record<string, string | Error>[] = [
      { [PRIMARY('self')]: ENFORCE, [PRIMARY(10)]: ENFORCE },
      { [PRIMARY('self')]: ENFORCE, [PRIMARY(10)]: '' },
      { [PRIMARY('self')]: ENFORCE },
      { [PRIMARY('self')]: ENFORCE, [PRIMARY(10)]: errno('EACCES'), [FALLBACK(10)]: errno('EPERM') },
      { [PRIMARY('self')]: errno('ENOENT'), [FALLBACK('self')]: ENFORCE, [PRIMARY(10)]: 'unconfined\n' },
      { [PRIMARY('self')]: 'docker-default (complain)\n', [PRIMARY(10)]: ENFORCE },
      {},
    ];
    for (const m of matrix) {
      const a = gateState(m), b = gateState(m);
      const plain = postrunAppArmor(a.state as never);
      const obs = postrunAppArmorObserved(b.state as never);
      const { observed, ...rest } = obs;
      expect(rest).toEqual(plain);
      expect(b.f.calls).toEqual(a.f.calls); // no extra read, no retry, same order (worker then owned browser)
      expect(postObservedEvidence(observed), observed).not.toBeNull();
      expect(observed).not.toMatch(SECRET);
    }
    const { state } = gateState({ [PRIMARY('self')]: ENFORCE, [PRIMARY(10)]: errno('ENOENT'), [FALLBACK(10)]: errno('ENOENT') });
    const r = postrunAppArmorObserved(state as never);
    expect(r.ok).toBe(false);
    expect(r.line).toBe(`PRE ${ENF} ${ENF} POST ${ENF} APPARMOR_E_UNKNOWN`);
    // missing proc entry while NO exit was observed: reported as such, never as ALIVE or as an exit
    expect(r.observed).toBe('WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED');
  });

  it('exit sampled before and after the reads: an exit during sampling and an exit before registration are told apart', () => {
    const h = child();
    const f = files({ [PRIMARY('self')]: ENFORCE });
    const readLabel = (who: number | 'self', note?: (o: string[]) => void) => { if (who === 10) h.exitCode = 0 as never; return readLabelAttempts(f.read, who, note); };
    const during = postrunAppArmorObserved({ pid: 10, readLabel, exitObservation: exitObserver(h), pre: { worker: ENF, browser: ENF } } as never);
    expect(during.observed).toBe('WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT NO_EXIT_OBSERVED EXIT_OBSERVED');
    const before = postrunAppArmorObserved(gateState({ [PRIMARY('self')]: ENFORCE }, child(null, 'SIGSEGV')).state as never);
    expect(before.observed).toBe('WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT EXIT_OBSERVED EXIT_OBSERVED');
    // a state without an observer (or a throwing / out-of-list one) is UNKNOWN, and the decision is unchanged
    const base = gateState({ [PRIMARY('self')]: ENFORCE, [PRIMARY(10)]: ENFORCE }).state;
    for (const exitObservation of [undefined, () => { throw new Error('x'); }, () => 'ALIVE', () => 'EXIT_OBSERVED secret']) {
      const r = postrunAppArmorObserved({ ...base, exitObservation } as never);
      expect(r.ok).toBe(true);
      expect(r.observed).toBe('WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN');
    }
    // a readLabel that ignores the note (or throws) gives UNKNOWN pairs, never a guessed outcome
    const deaf = postrunAppArmorObserved({ ...base, readLabel: () => ENFORCE } as never);
    expect(deaf.observed).toBe('WORKER_READ UNKNOWN UNKNOWN BROWSER_READ UNKNOWN UNKNOWN EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED');
    expect(deaf.ok).toBe(true);
    const noisy = postrunAppArmorObserved({ ...base, readLabel: (_w: unknown, note?: (o: unknown) => void) => { note?.(['OK', 'secret hunter2']); return ENFORCE; } } as never);
    expect(noisy.observed).toBe('WORKER_READ UNKNOWN UNKNOWN BROWSER_READ UNKNOWN UNKNOWN EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED');
  });

  it('launcher: the observer rides on the owned handle only; enforcement, refusal and cleanup sequences are identical', async () => {
    const run = async (handle: unknown, labelsAfter: Record<string, string | null> | null) => {
      const ev: string[] = [];
      let used = false;
      const server = { process: () => handle, wsEndpoint: () => 'ws://127.0.0.1:1/x', close: () => { ev.push('server.close'); return Promise.resolve(); }, kill: () => Promise.resolve() };
      const chromium = { launchServer: async () => { ev.push('launchServer'); return server; }, connect: async () => { ev.push('connect'); return { close: () => { ev.push('browser.close'); return Promise.resolve(); } }; } };
      const states: Obj[] = [];
      const readLabel = (who: number | 'self') => { const k = String(who); if (used && labelsAfter && k in labelsAfter) { const v = labelsAfter[k]; if (v === null) throw errno('ENOENT'); return v; } return ENFORCE; };
      const opts = { launchOptions: { executablePath: SHELL, args: [RESOLVER_ARG] }, defaults: DEFAULTS(), shell: SHELL, outputDir: L.output, proxyUrl: PROXY,
        readCmdline: () => `${SHELL}\0--headless\0`, readLabel, onAppArmor: (st: Obj) => { states.push(st); } };
      let code = 'ok';
      try { await withSandboxedBrowser(chromium, opts, async () => { used = true; ev.push('use'); }); } catch (e) { code = (e as SandboxLaunchError).code ?? 'other'; }
      return { ev, states, code };
    };
    for (const after of [null, { 10: null }, { self: 'unconfined\n' }, { 10: '' }]) {
      const withEmitter = await run(child(), after);
      const plainPid = await run({ pid: 10 }, after);
      expect(withEmitter.code).toBe(plainPid.code);
      expect(withEmitter.ev).toEqual(plainPid.ev);
      expect(withEmitter.code).toBe(after === null ? 'ok' : 'LANE_E_APPARMOR_POST');
      expect(withEmitter.states[0].pid).toBe(10);
      expect(typeof withEmitter.states[0].exitObservation).toBe('function');
      expect(withEmitter.states[0].exitObservation()).toBe('NO_EXIT_OBSERVED');
      expect(plainPid.states[0].exitObservation()).toBe('UNKNOWN');
    }
    // the worker-teardown POST keeps the unchanged postrunAppArmor; only the test-scoped gate uses the observed variant
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8');
    expect(src).toContain("if (state && !postrunAppArmor(state).ok) marks.push('LANE_E_APPARMOR_POST');");
    expect(src.match(/postrunAppArmorObserved\(/g)).toHaveLength(1); // its definition only
    const eg = readFileSync(path.join(ROOT, 'e2e/lesson-editor/egress-test.ts'), 'utf8');
    expect(eg.match(/postrunAppArmorObserved\(/g)).toHaveLength(1); // the gate
    expect(eg).toContain("return readLabelAttempts((p: string) => readFileSync(p, 'utf8'), who, note);");
    expect(eg.match(/readFileSync\(/g)).toHaveLength(2); // unchanged from a134131d: the label read and readCmdline; no other /proc read was added
  });

  it('observation grammar: closed tokens and attempt-consistent pairs only', () => {
    const good = ['WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED',
      'WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT NO_EXIT_OBSERVED EXIT_OBSERVED',
      'WORKER_READ EACCES BLANK BROWSER_READ BLANK NOT_TRIED EXIT UNKNOWN UNKNOWN',
      'WORKER_READ UNKNOWN UNKNOWN BROWSER_READ OTHER OK EXIT EXIT_OBSERVED EXIT_OBSERVED'];
    for (const g of good) expect(postObservedEvidence(g), g).not.toBeNull();
    const bad = ['WORKER_READ OK OK BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN', 'WORKER_READ NOT_TRIED NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN',
      'WORKER_READ ENOENT NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN', 'WORKER_READ UNKNOWN OK BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN',
      'WORKER_READ ENOENT UNKNOWN BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN', 'WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT ALIVE ALIVE',
      'WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT UNKNOWN', 'WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN extra',
      'WORKER_READ ok NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN', 'WORKER_READ OK NOT_TRIED  BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN',
      'WORKER_READ EINVAL ENOENT BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN', '', null, 'docker-default (enforce)'];
    for (const b of bad) expect(postObservedEvidence(b), String(b)).toBeNull();
    expect(attemptStatusToken('timedOut')).toBe('TIMED_OUT');
    for (const v of ['constructor', 'toString', '__proto__', 'PASSED', 'Passed', '', null, 1]) expect(attemptStatusToken(v), String(v)).toBe('UNKNOWN');
    expect(failedStepToken('none')).toBe('NONE');
    expect(failedStepToken('unknown')).toBe('UNKNOWN');
    for (const v of ['E1_BOGUS', 'NONE', 'e1_open', null]) expect(failedStepToken(v), String(v)).toBe('UNKNOWN');
  });

  // A report with the FULL E1 identity, shaped as Playwright 1.59.1's JSON reporter writes it (file suite > describe suite > spec).
  const OBS = 'WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED';
  const AA_POST_UNKNOWN = `PRE ${ENF} ${ENF} POST ${ENF} APPARMOR_E_UNKNOWN`;
  type TO = { title?: string; file?: string; describe?: string; project?: string; results?: unknown; extraTests?: Obj[]; extraSpecs?: Obj[]; ann?: Obj[]; rootErrors?: Obj[] };
  const e1Report = (o: TO = {}) => {
    const file = o.file ?? E1_IDENTITY.file;
    const ann = o.ann ?? [{ type: 'lane-apparmor', description: AA_POST_UNKNOWN }, { type: 'lane-post-observed', description: OBS }];
    return JSON.stringify({ errors: o.rootErrors ?? [], suites: [{ title: file, file, specs: [], suites: [{ title: o.describe ?? E1_IDENTITY.describe, file, specs: [
      { title: o.title ?? E1_IDENTITY.title, file, tests: [{ projectName: o.project ?? E1_IDENTITY.project, annotations: ann, results: o.results ?? [attempt()] }, ...(o.extraTests ?? [])] },
      ...(o.extraSpecs ?? [])] }] }] });
  };
  const attempt = (x: Obj = {}) => ({ retry: 0, status: 'failed', error: { message: 'Test timeout of 120000ms exceeded.', stack: 'x' }, errors: [], annotations: [], steps: [], ...x });
  const snapOf = (text: string) => reportSnapshot({ status: 'ok', text });

  it('selection: exactly one test with the full E1 identity, one attempt, retry 0; anything else is UNKNOWN for both values', () => {
    expect(snapOf(e1Report({ results: [attempt({ status: 'passed', error: undefined })] }))).toMatchObject({ attemptStatus: 'PASSED', failedStep: 'NONE' });
    expect(snapOf(e1Report())).toMatchObject({ attemptStatus: 'FAILED', failedStep: 'UNKNOWN', postObserved: OBS, aaLine: `LANE E1 APPARMOR ${AA_POST_UNKNOWN}` });
    const U = { attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN' };
    const wrong: [string, TO][] = [
      ['short title (the summary refuses substrings too)', { title: 'E1 save' }], ['title with suffix', { title: `${E1_IDENTITY.title} ` }],
      ['other file', { file: 'other.spec.ts' }], ['other describe', { describe: 'owner' }], ['other project', { project: 'chromium-member' }],
      ['duplicate identity', { extraTests: [{ projectName: E1_IDENTITY.project, results: [attempt()] }] }],
      ['extra other test', { extraSpecs: [{ title: 'E2 other', file: E1_IDENTITY.file, tests: [{ projectName: E1_IDENTITY.project, results: [] }] }] }],
      ['two attempts', { results: [attempt(), attempt({ retry: 1 })] }], ['no attempt', { results: [] }], ['retry 1 only', { results: [attempt({ retry: 1 })] }],
      ['retry missing', { results: [attempt({ retry: undefined })] }], ['retry string', { results: [attempt({ retry: '0' })] }],
      ['status unknown word', { results: [attempt({ status: 'flaky' })] }], ['status proto key', { results: [attempt({ status: 'constructor' })] }],
      ['status missing', { results: [attempt({ status: undefined })] }], ['results not an array', { results: { 0: attempt() } }],
      ['attempt is an array', { results: [[attempt()]] }], ['attempt is null', { results: [null] }],
    ];
    for (const [name, o] of wrong) expect(snapOf(e1Report(o)), name).toMatchObject(U);
    expect(e1Attempt([])).toEqual(U);
    expect(e1Attempt(null)).toEqual(U);
    expect(e1Attempt({ suites: 'x' })).toEqual(U);
  });

  it('failed step: the existing titles-only classifier; timeout means last RECORDED phase; secondary or wrapped errors change nothing', () => {
    const st = (title: string, x: Obj = {}) => ({ title, duration: 1, ...x });
    // deepest listed step with an error
    expect(snapOf(e1Report({ results: [attempt({ steps: [st('E1_OPEN'), st('E1_SAVED', { error: { message: 'x' } })] })] }))).toMatchObject({ attemptStatus: 'FAILED', failedStep: 'E1_SAVED' });
    // timedOut with no step error: the last listed top-level phase recorded (not necessarily the failing operation)
    expect(snapOf(e1Report({ results: [attempt({ status: 'timedOut', steps: [st('E1_OPEN'), st('E1_BASELINE'), st('E1_SETTLE')] })] }))).toMatchObject({ attemptStatus: 'TIMED_OUT', failedStep: 'E1_SETTLE' });
    // a failure outside every listed step (e.g. fixture teardown) is UNKNOWN, as in the summary
    expect(snapOf(e1Report({ results: [attempt({ steps: [st('E1_OPEN'), st('fixture: context')] })] }))).toMatchObject({ attemptStatus: 'FAILED', failedStep: 'UNKNOWN' });
    // unlisted titles are never echoed
    expect(snapOf(e1Report({ results: [attempt({ steps: [st('secret hunter2', { error: { message: 'x' } })] })] })).failedStep).toBe('UNKNOWN');
    // secondary gate error in errors[], wrapped root teardown error: reportedError stays UNKNOWN (unchanged r1 rule), and the
    // attempt values do not depend on any message
    const withSecondary = attempt({ errors: [{ message: 'Test timeout of 120000ms exceeded.' }, { message: 'Error: LANE_E_APPARMOR_POST\n    at x' }], steps: [st('E1_RELOAD', { error: { message: 'y' } })] });
    const wrappedRoot = [{ message: 'Error: LANE_E_APPARMOR_POST\n\nFailed worker ran 1 test:\n  [lesson-editor-chromium] > x', stack: 'x' }];
    const a = snapOf(e1Report({ results: [withSecondary], rootErrors: wrappedRoot }));
    expect(a).toMatchObject({ reportedError: 'UNKNOWN', attemptStatus: 'FAILED', failedStep: 'E1_RELOAD' });
    const swapped = snapOf(e1Report({ results: [{ ...withSecondary, error: { message: 'Error: LANE_E_CONNECT' }, errors: [] }], rootErrors: [] }));
    expect(swapped).toMatchObject({ reportedError: 'LANE_E_CONNECT', attemptStatus: 'FAILED', failedStep: 'E1_RELOAD' });
    // two errors in errors[] do not establish an order, and nothing here claims one: no ordering value exists
    expect(Object.keys(a).sort()).toEqual(['aaLine', 'attemptStatus', 'browserExit', 'browserLog', 'failedStep', 'postObserved', 'report', 'reportedError']);
  });

  it('observation annotation: one valid description, else MISSING or INVALID; budgets exhausted are INVALID for every value', () => {
    expect(snapOf(e1Report({ ann: [{ type: 'lane-apparmor', description: AA_POST_UNKNOWN }] })).postObserved).toBe('MISSING');
    const two = 'WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED';
    for (const ann of [[{ type: 'lane-post-observed', description: OBS }, { type: 'lane-post-observed', description: two }], [{ type: 'lane-post-observed', description: `${OBS} secret hunter2` }],
      [{ type: 'lane-post-observed', description: 7 }], [{ type: 'lane-post-observed' }], [{ type: 'lane-post-observed', description: OBS.replace('NO_EXIT_OBSERVED NO_EXIT_OBSERVED', 'ALIVE ALIVE') }]])
      expect(snapOf(e1Report({ ann: [{ type: 'lane-apparmor', description: AA_POST_UNKNOWN }, ...ann] })).postObserved, JSON.stringify(ann)).toBe('INVALID');
    // the same description on the test and on its result (as the reporter writes it) is ONE distinct value
    expect(snapOf(e1Report({ results: [attempt({ annotations: [{ type: 'lane-post-observed', description: OBS }] })] })).postObserved).toBe(OBS);
    // budgets: a full-identity report that exhausts depth or nodes is INVALID / UNKNOWN for everything
    let deep: Obj = {}; for (let i = 0; i < 100; i++) deep = { child: deep };
    const deepR = JSON.parse(e1Report()); deepR.deep = deep;
    const wideR = JSON.parse(e1Report()); wideR.items = Array.from({ length: REPORT_MAX_NODES }, () => ({}));
    for (const r of [deepR, wideR])
      expect(snapOf(JSON.stringify(r))).toEqual({ aaLine: 'LANE E1 APPARMOR INVALID', report: 'INVALID', reportedError: 'UNKNOWN', postObserved: 'INVALID', attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN', browserExit: 'INVALID', browserLog: 'INVALID' });
    expect(reportSnapshot({ status: 'missing' })).toEqual({ aaLine: 'LANE E1 APPARMOR MISSING', report: 'MISSING', reportedError: 'UNKNOWN', postObserved: 'MISSING', attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN', browserExit: 'MISSING', browserLog: 'MISSING' });
    expect(snapOf(`${e1Report()}x`).report).toBe('INVALID');
    expect(reportSnapshot({ status: 'ok', text: 'x'.repeat(REPORT_MAX + 1) }).postObserved).toBe('INVALID');
  });

  it('supervisor: the three lines come from the SAME single read; acceptance, exit content and cleanup are identical; nothing private leaks', async () => {
    const secretRep = JSON.parse(e1Report({ results: [attempt({ steps: [{ title: 'E1_SAVED', error: { message: 'postgresql://postgres:hunter2@127.0.0.1:54322/x' } }],
      stdout: [{ text: 'eyJhbGciOiJIUzI1NiJ9.x.y' }] })], rootErrors: [{ message: 'secret hunter2' }] }));
    const r = await enter({ report: JSON.stringify(secretRep), e1Code: 1 });
    expect(r.lane()).toContain(`LANE E1 REPORTED_ERROR UNKNOWN\nLANE E1 POST_OBSERVED ${OBS}\nLANE E1 ATTEMPT_STATUS FAILED\nLANE E1 FAILED_STEP E1_SAVED\nLANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\nLANE CLEANUP PASS\n`);
    expect(r.lane()).not.toMatch(SECRET);
    expect(r.lane().split('\n').every((l) => l === '' || /^LANE [A-Z0-9_ ]+$/.test(l))).toBe(true);
    expect(parseLaneOut(r.lane())).toMatchObject({ ok: true, interrupted: false, attemptStatus: 'FAILED', failedStep: 'E1_SAVED', postObserved: { state: 'EVIDENCE' } });
    // identical decisions: the same run with and without the r2 data has the same exit, pw-exit content, cleanup call and plan
    const bare = JSON.parse(e1Report({ ann: [{ type: 'lane-apparmor', description: AA_POST_UNKNOWN }], title: 'E1 save', results: [attempt()] }));
    const r0 = await enter({ report: JSON.stringify(bare), e1Code: 1 });
    expect(r0.lane()).toContain(`LANE E1 REPORTED_ERROR UNKNOWN\n${DIAG_TAIL}LANE CLEANUP PASS\n`);
    for (const k of ['code'] as const) expect(r[k]).toBe(r0[k]);
    expect(r.writes.get(3)).toBe(r0.writes.get(3));
    expect(r.runs).toEqual(r0.runs);
    const okPw = { state: 'ok', digits: '1' };
    expect(planSummary({ verdict: OKV, laneText: r.lane(), pwExit: okPw })).toEqual(planSummary({ verdict: OKV, laneText: r0.lane(), pwExit: okPw }));
    expect(planSummary({ verdict: OKV, laneText: r.lane(), pwExit: okPw })).toEqual({ kind: 'refused', code: 'LE_SUM_E_WORKER_APPARMOR' });
    expect(refusalDetail({ verdict: OKV, laneText: r.lane(), pwExit: okPw })).toBe(`LE-E1 DETAIL exit=1 result=CLOSE_WITH_CODE aa=PRE:${ENF},${ENF};POST:${ENF},APPARMOR_E_UNKNOWN report=PARSED error=UNKNOWN post=WR:OK,NOT_TRIED;BR:ENOENT,ENOENT;EXIT:NO_EXIT_OBSERVED,NO_EXIT_OBSERVED attempt_status=FAILED failed_step=E1_SAVED browser_exit=MISSING browser_log=MISSING cleanup=PASS`);
    // a passing, enforced run still accepts exactly as before
    const good = await enter({ report: e1Report({ ann: [{ type: 'lane-apparmor', description: AA_DESC }, { type: 'lane-post-observed', description: 'WORKER_READ OK NOT_TRIED BROWSER_READ OK NOT_TRIED EXIT NO_EXIT_OBSERVED NO_EXIT_OBSERVED' }], results: [attempt({ status: 'passed', error: undefined })] }) });
    expect(good.code).toBe(0);
    expect(planSummary({ verdict: OKV, laneText: good.lane(), pwExit: { state: 'ok', digits: '0' } })).toEqual({ kind: 'summary', pw: '0', setup: 'PASS', cleanup: 'PASS' });
    // the supervisor still reads the report exactly once and writes the three lines from that snapshot
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/lane-entry.mjs'), 'utf8');
    expect(src.match(/d\.readReport\(/g)).toHaveLength(1);
    for (const t of ['say(`LANE E1 POST_OBSERVED ${snap.postObserved}`);', 'say(`LANE E1 ATTEMPT_STATUS ${snap.attemptStatus}`);', 'say(`LANE E1 FAILED_STEP ${snap.failedStep}`);']) expect(src).toContain(t);
  });

  it('grammar: the three r2 lines are required in order with closed, consistent values; decisions ignore them', () => {
    const swap = (from: string, to: string) => LANE_OK.replace(from, to);
    for (const bad of [
      swap('LANE E1 POST_OBSERVED MISSING\n', ''), swap('LANE E1 ATTEMPT_STATUS UNKNOWN\n', ''), swap('LANE E1 FAILED_STEP UNKNOWN\n', ''),
      swap(DIAG_TAIL, 'LANE E1 ATTEMPT_STATUS UNKNOWN\nLANE E1 POST_OBSERVED MISSING\nLANE E1 FAILED_STEP UNKNOWN\n'),
      swap('ATTEMPT_STATUS UNKNOWN', 'ATTEMPT_STATUS failed'), swap('ATTEMPT_STATUS UNKNOWN', 'ATTEMPT_STATUS SUCCESS'), swap('ATTEMPT_STATUS UNKNOWN', 'ATTEMPT_STATUS PASSED'),
      swap('FAILED_STEP UNKNOWN', 'FAILED_STEP E1_OPEN'), swap('FAILED_STEP UNKNOWN', 'FAILED_STEP E1_BOGUS'),
      swap('ATTEMPT_STATUS UNKNOWN\nLANE E1 FAILED_STEP UNKNOWN', 'ATTEMPT_STATUS FAILED\nLANE E1 FAILED_STEP NONE'),
      swap('ATTEMPT_STATUS UNKNOWN\nLANE E1 FAILED_STEP UNKNOWN', 'ATTEMPT_STATUS PASSED\nLANE E1 FAILED_STEP E1_OPEN'),
      swap('POST_OBSERVED MISSING', 'POST_OBSERVED ALIVE'), swap('POST_OBSERVED MISSING', `POST_OBSERVED ${OBS} secret`),
      swap('POST_OBSERVED MISSING', 'POST_OBSERVED WORKER_READ OK OK BROWSER_READ OK NOT_TRIED EXIT UNKNOWN UNKNOWN'),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING').replace('POST_OBSERVED MISSING', `POST_OBSERVED ${OBS}`),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR INVALID\nLANE E1 REPORT INVALID'), // report INVALID needs POST_OBSERVED INVALID
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING').replace('ATTEMPT_STATUS UNKNOWN\nLANE E1 FAILED_STEP UNKNOWN', 'ATTEMPT_STATUS FAILED\nLANE E1 FAILED_STEP UNKNOWN'),
      `LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP FAIL\nLANE E1 NOT RUN\n${DIAG_TAIL}LANE CLEANUP PASS\nLANE END\n`,
    ]) expect(parseLaneOut(bad).ok, bad).toBe(false);
    const goods = [
      swap(DIAG_TAIL, `LANE E1 POST_OBSERVED ${OBS}\nLANE E1 ATTEMPT_STATUS TIMED_OUT\nLANE E1 FAILED_STEP E1_SETTLE\nLANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\n`),
      swap(DIAG_TAIL, 'LANE E1 POST_OBSERVED INVALID\nLANE E1 ATTEMPT_STATUS PASSED\nLANE E1 FAILED_STEP NONE\nLANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\n'),
      swap(DIAG_TAIL, 'LANE E1 POST_OBSERVED MISSING\nLANE E1 ATTEMPT_STATUS INTERRUPTED\nLANE E1 FAILED_STEP UNKNOWN\nLANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\n'),
    ];
    for (const g of goods) {
      expect(parseLaneOut(g).ok, g).toBe(true);
      // the plan and the cleanup-relevant fields are exactly those of LANE_OK: the r2 lines decide nothing
      for (const pw of [{ state: 'ok', digits: '0' }, { state: 'ok', digits: '1' }, { state: 'absent' }, { state: 'bad' }])
        expect(planSummary({ verdict: OKV, laneText: g, pwExit: pw as never })).toEqual(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: pw as never }));
      const { postObserved: _p, attemptStatus: _a, failedStep: _f, ...rest } = parseLaneOut(g) as Obj;
      const { postObserved: _p0, attemptStatus: _a0, failedStep: _f0, ...rest0 } = parseLaneOut(LANE_OK) as Obj;
      expect(rest).toEqual(rest0);
    }
    // no gate, scope, verify or upload code reads the r2 fields
    const contract = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/contract.mjs'), 'utf8');
    const uses = (k: string) => contract.split('\n').filter((l) => l.includes(`o.${k}`) || l.includes(`.${k}.`) || l.includes(`r.${k} =`)).length;
    for (const k of ['attemptStatus', 'failedStep']) expect(uses(k), k).toBeLessThanOrEqual(2);
    for (const f of ['gates.mjs', 'run-lane.mjs', 'image.mjs', 'bridge.mjs'])
      expect(readFileSync(path.join(ROOT, 'scripts/e2e/le-lane', f), 'utf8'), f).not.toMatch(/postObserved|attemptStatus|failedStep|POST_OBSERVED|ATTEMPT_STATUS|FAILED_STEP/);
  });
});

// E1 diagnostics r2.1 (review corrections; fakes only). Malformed exit fields and coerced identities are UNKNOWN.
describe('E1 diagnostics r2.1: strict exit-field types and strict raw identity for the new diagnostics', () => {
  const handle = (exitCode: unknown, signalCode: unknown) => Object.assign(new EventEmitter(), { pid: 10, exitCode, signalCode });
  it('exit observer: without an exit event, only a well-typed, compatible exitCode/signalCode pair counts', () => {
    expect(exitObserver(handle(0, null))()).toBe('EXIT_OBSERVED');
    expect(exitObserver(handle(137, null))()).toBe('EXIT_OBSERVED');
    expect(exitObserver(handle(null, 'SIGKILL'))()).toBe('EXIT_OBSERVED');
    expect(exitObserver(handle(null, null))()).toBe('NO_EXIT_OBSERVED');
    const malformed: [unknown, unknown][] = [['bad', null], ['0', null], [false, null], [true, null], [Number.NaN, null], [1.5, null], [Infinity, null], [-1, null], [256, null],
      [{}, null], [null, {}], [null, 'kill'], [null, 'SIG'], [null, ''], [null, 9], [null, false], [0, 'SIGKILL'], [undefined, null], [null, undefined], [undefined, undefined]];
    for (const [c, s] of malformed) expect(exitObserver(handle(c, s))(), `${String(c)} ${String(s)}`).toBe('UNKNOWN');
    // an observed exit event still wins over malformed fields (the listener is the primary evidence)
    const h = handle('bad', {});
    const obs = exitObserver(h);
    expect(obs()).toBe('UNKNOWN');
    h.emit('exit', 0, null);
    expect(obs()).toBe('EXIT_OBSERVED');
  });

  const ID = E1_IDENTITY;
  const okAttempt = { retry: 0, status: 'passed', steps: [] };
  const rep = (o: { file?: unknown; describe?: unknown; title?: unknown; project?: unknown; specFile?: unknown; results?: unknown; tests?: unknown; specs?: unknown; suites?: unknown; inner?: unknown } = {}) => ({
    suites: o.suites ?? [{ title: o.file ?? ID.file, file: o.file ?? ID.file, specs: [], suites: o.inner ?? [{ title: o.describe ?? ID.describe, file: o.file ?? ID.file,
      specs: o.specs ?? [{ title: o.title ?? ID.title, file: o.specFile ?? ID.file, tests: o.tests ?? [{ projectName: o.project ?? ID.project, results: o.results ?? [okAttempt] }] }] }] }],
  });
  it('selection: the strict raw shape is PASSED/NONE; coercible identities and malformed structure are UNKNOWN', () => {
    expect(e1Attempt(rep())).toEqual({ attemptStatus: 'PASSED', failedStep: 'NONE' });
    const U = { attemptStatus: 'UNKNOWN', failedStep: 'UNKNOWN' };
    const bad: [string, Obj][] = [
      ['projectName array', rep({ project: [ID.project] })], ['projectName boxed', rep({ project: { toString: () => ID.project } })],
      ['describe title array', rep({ describe: [ID.describe] })], ['spec title array', rep({ title: [ID.title] })],
      ['spec file array', rep({ specFile: [ID.file] })], ['suite file array', rep({ file: [ID.file] })], ['describe title number', rep({ describe: 5 })],
      ['suites not an array', rep({ suites: { 0: {} } })], ['inner suites not an array', rep({ inner: 'x' })], ['specs not an array', rep({ specs: {} })],
      ['tests not an array', rep({ tests: {} })], ['results not an array', rep({ results: {} })], ['suite is an array', rep({ inner: [[]] })],
      ['spec is null', rep({ specs: [null] })], ['test is a string', rep({ tests: ['x'] })], ['projectName missing', rep({ tests: [{ results: [okAttempt] }] })],
      ['suite title missing', rep({ inner: [{ file: ID.file, specs: [{ title: ID.title, file: ID.file, tests: [{ projectName: ID.project, results: [okAttempt] }] }] }] })],
    ];
    for (const [name, r] of bad) expect(e1Attempt(r), name).toEqual(U);
    // a malformed SIBLING beside an otherwise valid E1 test makes the whole selection UNKNOWN (no silent skipping)
    const valid = rep().suites[0].suites[0];
    for (const sib of [{ title: 'x', specs: {} }, { title: 'x', suites: 'y' }, { title: 'x', specs: [{ title: 'y', tests: {} }] }, { title: 'x', specs: [{ title: 'y', tests: [{ projectName: 'p', results: 'z' }] }] }])
      expect(e1Attempt(rep({ inner: [valid, sib] })), JSON.stringify(sib)).toEqual(U);
    expect(e1Attempt(rep({ inner: [valid, { title: 'x' }] }))).toEqual({ attemptStatus: 'PASSED', failedStep: 'NONE' }); // absent lists are empty
    // the inherited summary extractor is unchanged (it still coerces; it is not the new diagnostic)
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-e1-summary.mjs'), 'utf8');
    expect(src).toContain("projectName: String(t.projectName ?? ''),");
  });
});

// E1 diagnostics r3 (fakes only; no browser, process, file or listener). The owned browser's closed exit SHAPE, the first
// CHECKPOINT (Node observation order, never an OS exit time) at which it was seen, and the spec page's closed state at the page
// teardown checkpoint, as one DIAGNOSTIC lane line. Nothing decides on any of them.
describe('E1 diagnostics r3: owned-browser exit shape, first-seen checkpoint and page state', () => {
  type Obj = Record<string, unknown>;
  const ENF3 = 'APPARMOR_DOCKER_DEFAULT_ENFORCE';
  const AA_U = `PRE ${ENF3} ${ENF3} POST ${ENF3} APPARMOR_E_UNKNOWN`;
  const OBS3 = 'WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT EXIT_OBSERVED EXIT_OBSERVED';
  const BX = 'SHAPE SIGTRAP FIRST_SEEN PAGE_TEARDOWN_START BODY_END_PAGE CLOSED';
  const handle = (exitCode: unknown = null, signalCode: unknown = null) => Object.assign(new EventEmitter(), { pid: 10, exitCode, signalCode });
  const pg = (closed: unknown) => ({ isClosed: () => closed });
  const report = (ann: Obj[], results: Obj[] = [{ retry: 0, status: 'failed', error: { message: 'x' }, errors: [], annotations: [], steps: [{ title: 'E1_OPEN', duration: 1, error: { message: 'x' } }] }]) => {
    const file = E1_IDENTITY.file;
    return JSON.stringify({ errors: [], suites: [{ title: file, file, specs: [], suites: [{ title: E1_IDENTITY.describe, file, specs: [
      { title: E1_IDENTITY.title, file, tests: [{ projectName: E1_IDENTITY.project, annotations: ann, results }] }] }] }] });
  };
  const base = [{ type: 'lane-apparmor', description: AA_U }, { type: 'lane-post-observed', description: OBS3 }];

  it('closed lists: the contract copies equal their sources; no liveness, body or free-text token exists', () => {
    expect([...BROWSER_EXIT_SIGNALS]).toEqual([...EXIT_SIGNALS]);
    expect([...BODY_END_PAGE_STATES]).toEqual([...BODY_END_PAGES]);
    expect([...BROWSER_EXIT_CHECKPOINTS]).toEqual([...EXIT_CHECKPOINTS]);
    expect([...EXIT_SIGNALS, ...BODY_END_PAGES, ...EXIT_CHECKPOINTS].join(' ')).not.toMatch(/ALIVE|RUNNING|LIVE\b|TEST_BODY|DURING/);
  });

  it('exit shape: exclusive, strictly typed code 0..255 or SIG* name; finite vocabulary, SIG_OTHER, else UNKNOWN', () => {
    expect(exitShape(0, null)).toBe('CODE_0');
    expect(exitShape(255, null)).toBe('CODE_255');
    expect(exitShape(null, 'SIGTRAP')).toBe('SIGTRAP');
    expect(exitShape(null, 'SIGUSR1')).toBe('SIG_OTHER');
    for (const [c, sg] of [[256, null], [-1, null], [1.5, null], ['1', null], [NaN, null], [Infinity, null], [null, null], [undefined, null], [0, undefined],
      [1, 'SIGTERM'], [null, 'sigterm'], [null, 'TERM'], [null, ''], [null, { toString: () => 'SIGTERM' }], [null, 'SIGTERM secret hunter2'], [{}, null]] as [unknown, unknown][])
      expect(exitShape(c, sg), JSON.stringify([c, sg])).toBe('UNKNOWN');
  });

  it('exit recorder: pre-registration exit, event versus already-set fields, delayed event, malformed and conflicting shapes', () => {
    expect(exitRecorder(handle(0, null))()).toBe('CODE_0'); // exited before registration: fields already set, no event needed
    expect(exitRecorder(handle(null, 'SIGTRAP'))()).toBe('SIGTRAP');
    const h = handle();
    const rec = exitRecorder(h);
    expect(rec()).toBe('NONE'); // registered, nothing set yet: NOT a liveness claim
    h.signalCode = 'SIGSEGV'; // fields set before the event is delivered: seen through the fields
    expect(rec()).toBe('SIGSEGV');
    h.emit('exit', null, 'SIGSEGV');
    expect(rec()).toBe('SIGSEGV');
    const e = handle();
    const recE = exitRecorder(e);
    e.emit('exit', 3, null); // event first; later field changes never override it
    e.exitCode = 4;
    expect(recE()).toBe('CODE_3');
    const bad = handle();
    const recB = exitRecorder(bad);
    bad.emit('exit', 1, 'SIGTERM');
    expect(recB()).toBe('UNKNOWN'); // conflicting event pair
    expect(exitRecorder(handle(1, 'SIGTERM'))()).toBe('UNKNOWN'); // conflicting fields
    expect(exitRecorder(handle('0', null))()).toBe('UNKNOWN');
    expect(exitRecorder({ pid: 10, exitCode: null, signalCode: null })()).toBe('UNKNOWN'); // no listener possible
    expect(exitRecorder(null)()).toBe('UNKNOWN');
    const throwing = Object.defineProperty(Object.assign(new EventEmitter(), { pid: 10, signalCode: null }), 'exitCode', { get: () => { throw new Error('secret hunter2'); } });
    expect(exitRecorder(throwing)()).toBe('UNKNOWN');
  });

  it('page state: closed tokens from isClosed and the crash flag; anything odd is UNKNOWN', () => {
    expect(pageEndState(pg(false), false)).toBe('OPEN');
    expect(pageEndState(pg(true), false)).toBe('CLOSED');
    expect(pageEndState(pg(false), true)).toBe('CRASHED');
    expect(pageEndState(pg(true), true)).toBe('CRASHED_CLOSED');
    for (const [p, c] of [[pg('true'), false], [pg(1), false], [pg(false), 'yes'], [{ isClosed: () => { throw new Error('secret'); } }, false], [null, false], [{}, false]] as [unknown, unknown][])
      expect(pageEndState(p, c)).toBe('UNKNOWN');
  });

  it('checkpoints: first seen at PAGE_TEARDOWN_START or GATE_POST in Node observation order; anything unprovable is UNKNOWN', () => {
    // a recorder whose state moves between the two samples, like a real handle
    const at = (h: EventEmitter & { exitCode: unknown; signalCode: unknown }) => ({ exitShape: exitRecorder(h) });
    // 1. exited (event delivered) before the page teardown sample
    const h1 = handle(); const s1 = at(h1); h1.emit('exit', null, 'SIGTRAP');
    expect(browserExitLine(s1, pageTeardownRecord(s1, pg(true), false))).toBe(BX);
    // 2. fields set before the page teardown sample, event delivered later: still first seen at PAGE_TEARDOWN_START
    const h2 = handle(); const s2 = at(h2); h2.exitCode = 0;
    const r2 = pageTeardownRecord(s2, pg(true), false); h2.emit('exit', 0, null);
    expect(browserExitLine(s2, r2)).toBe('SHAPE CODE_0 FIRST_SEEN PAGE_TEARDOWN_START BODY_END_PAGE CLOSED');
    // 3. delayed delivery: nothing observable at the page teardown sample, seen by GATE_POST (the exit itself may be earlier)
    const h3 = handle(); const s3 = at(h3); const r3 = pageTeardownRecord(s3, pg(false), false); h3.emit('exit', null, 'SIGKILL');
    expect(browserExitLine(s3, r3)).toBe('SHAPE SIGKILL FIRST_SEEN GATE_POST BODY_END_PAGE OPEN');
    // 4. no exit observed at either checkpoint
    const s4 = at(handle());
    expect(browserExitLine(s4, pageTeardownRecord(s4, pg(false), false))).toBe('SHAPE NONE FIRST_SEEN NOT_SEEN BODY_END_PAGE OPEN');
    // 5. page checkpoint never recorded (wrapper did not run): an exit at GATE_POST has no provable first checkpoint
    const h5 = handle(); const s5 = at(h5); h5.emit('exit', null, 'SIGSEGV');
    expect(browserExitLine(s5, null)).toBe('SHAPE SIGSEGV FIRST_SEEN UNKNOWN BODY_END_PAGE UNKNOWN');
    // 6. page sample UNKNOWN (bad sampler) then an exit at GATE_POST: first checkpoint UNKNOWN
    expect(browserExitLine({ exitShape: () => 'SIGTERM' }, { exit: 'UNKNOWN', page: 'OPEN' })).toBe('SHAPE SIGTERM FIRST_SEEN UNKNOWN BODY_END_PAGE OPEN');
    // 7. two different exit values: UNKNOWN for both
    expect(browserExitLine({ exitShape: () => 'SIGTERM' }, { exit: 'SIGKILL', page: 'CLOSED' })).toBe('SHAPE UNKNOWN FIRST_SEEN UNKNOWN BODY_END_PAGE CLOSED');
    // 8. out-of-grammar values are never echoed
    for (const v of ['CODE_256', 'secret hunter2', 7, null, 'SIGUSR1', 'EXIT_OBSERVED'])
      expect(browserExitLine({ exitShape: () => v }, { exit: 'NONE', page: 'OPEN' })).toBe('SHAPE UNKNOWN FIRST_SEEN UNKNOWN BODY_END_PAGE OPEN');
    expect(browserExitLine({ exitShape: () => { throw new Error('secret'); } }, { exit: 'secret', page: 'secret' })).toBe('SHAPE UNKNOWN FIRST_SEEN UNKNOWN BODY_END_PAGE UNKNOWN');
    expect(sampleExitShape(null)).toBe('UNKNOWN');
    // the page record samples the exit FIRST, then the page
    const order: string[] = [];
    pageTeardownRecord({ exitShape: () => { order.push('exit'); return 'NONE'; } }, { isClosed: () => { order.push('page'); return false; } }, false);
    expect(order).toEqual(['exit', 'page']);
    // every produced line parses, and every pair the grammar accepts is consistent
    for (const l of [BX, 'SHAPE NONE FIRST_SEEN NOT_SEEN BODY_END_PAGE OPEN', 'SHAPE SIGSEGV FIRST_SEEN UNKNOWN BODY_END_PAGE UNKNOWN', 'SHAPE UNKNOWN FIRST_SEEN UNKNOWN BODY_END_PAGE CLOSED'])
      expect(browserExitEvidence(l), l).not.toBeNull();
    for (const l of ['SHAPE NONE FIRST_SEEN GATE_POST BODY_END_PAGE OPEN', 'SHAPE SIGTRAP FIRST_SEEN NOT_SEEN BODY_END_PAGE OPEN',
      'SHAPE UNKNOWN FIRST_SEEN GATE_POST BODY_END_PAGE OPEN', 'SHAPE NONE FIRST_SEEN UNKNOWN BODY_END_PAGE OPEN', 'SHAPE SIGTRAP FIRST_SEEN TEST_BODY BODY_END_PAGE OPEN'])
      expect(browserExitEvidence(l), l).toBeNull();
  });

  it('AppArmor unchanged: same reads, order, first-success and decision with or without the recorder; cleanup sequence identical', async () => {
    const calls: string[] = [];
    const readLabel = (who: number | 'self', note?: (o: string[]) => void) => readLabelAttempts((p: string) => { calls.push(p); if (p.includes('/10/attr/apparmor')) throw Object.assign(new Error('x'), { code: 'ENOENT' }); return 'docker-default (enforce)\n'; }, who, note);
    const pre = { worker: ENF3, browser: ENF3 };
    const a = postrunAppArmorObserved({ pid: 10, readLabel, exitObservation: () => 'EXIT_OBSERVED', exitShape: () => 'SIGTRAP', pre });
    const callsA = calls.splice(0);
    const b = postrunAppArmorObserved({ pid: 10, readLabel, exitObservation: () => 'EXIT_OBSERVED', pre });
    expect(a).toEqual(b);
    expect(callsA).toEqual(calls);
    const run = async (h: unknown) => {
      const ev: string[] = [];
      const server = { process: () => h, wsEndpoint: () => 'ws://127.0.0.1:1/x', close: () => { ev.push('server.close'); return Promise.resolve(); }, kill: () => Promise.resolve() };
      const chromium = { launchServer: async () => { ev.push('launchServer'); return server; }, connect: async () => { ev.push('connect'); return { close: () => { ev.push('browser.close'); return Promise.resolve(); } }; } };
      const states: Obj[] = [];
      const opts = { launchOptions: { executablePath: SHELL, args: [RESOLVER_ARG] }, defaults: DEFAULTS(), shell: SHELL, outputDir: L.output, proxyUrl: PROXY,
        readCmdline: () => `${SHELL}\0--headless\0`, readLabel: () => 'docker-default (enforce)\n', onAppArmor: (st: Obj) => { states.push(st); } };
      let code = 'ok';
      try { await withSandboxedBrowser(chromium, opts, async () => { ev.push('use'); (h as EventEmitter | null)?.emit?.('exit', null, 'SIGTRAP'); }); } catch (e) { code = (e as SandboxLaunchError).code ?? 'other'; }
      return { ev, states, code };
    };
    const x = await run(handle()), y = await run({ pid: 10 });
    expect(x.ev).toEqual(y.ev);
    expect(x.code).toBe(y.code);
    expect((x.states[0].exitShape as () => string)()).toBe('SIGTRAP');
    expect((y.states[0].exitShape as () => string)()).toBe('UNKNOWN');
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8');
    expect(src).toContain('const exitShapeOf = exitRecorder(child);');
    expect(src.match(/exitRecorder\(/g)).toHaveLength(2); // definition and the one call on the launchServer handle
    expect(src).toContain("if (state && !postrunAppArmor(state).ok) marks.push('LANE_E_APPARMOR_POST');");
  });

  it('wiring: the gate and the page wrapper are passive, ordered and lane-only', () => {
    const eg = readFileSync(path.join(ROOT, 'e2e/lesson-editor/egress-test.ts'), 'utf8');
    const iReset = eg.indexOf('pageTeardown = null;'), iUse = eg.indexOf('await use();'), iObs = eg.indexOf("type: 'lane-post-observed'"),
      iBx = eg.indexOf("type: 'lane-browser-exit', description: browserExitLine(state, pageTeardown)"), iThrow = eg.indexOf("if (!post.ok) throw new Error('LANE_E_APPARMOR_POST');");
    expect([iReset, iUse, iObs, iBx, iThrow].every((i) => i > 0)).toBe(true);
    expect(iReset < iUse && iUse < iObs && iObs < iBx && iBx < iThrow).toBe(true);
    const w = eg.slice(eg.indexOf('async ({ page }, use) => {'), eg.indexOf('boundary: ['));
    expect(w).toContain('if (!authenticLane()) return use(page);');
    expect(w.indexOf('await use(page);')).toBeLessThan(w.indexOf('pageTeardown = pageTeardownRecord(laneAppArmor, page, crashed);'));
    expect(w).not.toMatch(/goto|evaluate|content\(|textContent|close\(|title\(|url\(|throw/);
  });

  it('snapshot: one valid annotation, else MISSING or INVALID; other values are unchanged by it', () => {
    const snap = (ann: Obj[], results?: Obj[]) => reportSnapshot({ status: 'ok', text: report(ann, results) });
    const withBx = snap([...base, { type: 'lane-browser-exit', description: BX }]);
    expect(withBx).toMatchObject({ browserExit: BX, attemptStatus: 'FAILED', failedStep: 'E1_OPEN', postObserved: OBS3 });
    const without = snap(base);
    expect(without.browserExit).toBe('MISSING');
    const { browserExit: _a, ...r1 } = withBx, { browserExit: _b, ...r0 } = without;
    expect(r1).toEqual(r0);
    for (const ann of [[{ type: 'lane-browser-exit', description: BX }, { type: 'lane-browser-exit', description: 'SHAPE NONE FIRST_SEEN NOT_SEEN BODY_END_PAGE OPEN' }],
      [{ type: 'lane-browser-exit', description: `${BX} secret hunter2` }], [{ type: 'lane-browser-exit', description: 7 }], [{ type: 'lane-browser-exit' }],
      [{ type: 'lane-browser-exit', description: 'SHAPE SIGTRAP BODY_END_PAGE CLOSED' }], [{ type: 'lane-browser-exit', description: 'SHAPE NONE FIRST_SEEN GATE_POST BODY_END_PAGE OPEN' }]])
      expect(snap([...base, ...ann]).browserExit, JSON.stringify(ann)).toBe('INVALID');
    // report-global aggregation (a provenance LIMIT, not a binding): the same description on the test and its result is ONE value
    expect(snap(base, [{ retry: 0, status: 'failed', annotations: [{ type: 'lane-browser-exit', description: BX }], steps: [] }]).browserExit).toBe(BX);
    expect(reportSnapshot({ status: 'missing' }).browserExit).toBe('MISSING');
    expect(reportSnapshot({ status: 'ok', text: '{x' }).browserExit).toBe('INVALID');
  });

  it('supervisor and summary: the line comes from the same single read; decisions, exit content and cleanup are identical', async () => {
    const r = await enter({ report: report([...base, { type: 'lane-browser-exit', description: BX }]), e1Code: 1 });
    const r0 = await enter({ report: report(base), e1Code: 1 });
    expect(r.lane()).toContain(`LANE E1 FAILED_STEP E1_OPEN\nLANE E1 BROWSER_EXIT ${BX}\nLANE E1 BROWSER_LOG MISSING\nLANE CLEANUP PASS\n`);
    expect(r0.lane()).toContain('LANE E1 FAILED_STEP E1_OPEN\nLANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\nLANE CLEANUP PASS\n');
    expect(r.code).toBe(r0.code);
    expect(r.writes.get(3)).toBe(r0.writes.get(3));
    expect(r.runs).toEqual(r0.runs);
    const pw = { state: 'ok', digits: '1' };
    expect(planSummary({ verdict: OKV, laneText: r.lane(), pwExit: pw })).toEqual(planSummary({ verdict: OKV, laneText: r0.lane(), pwExit: pw }));
    expect(refusalDetail({ verdict: OKV, laneText: r.lane(), pwExit: pw })).toBe(`LE-E1 DETAIL exit=1 result=CLOSE_WITH_CODE aa=PRE:${ENF3},${ENF3};POST:${ENF3},APPARMOR_E_UNKNOWN report=PARSED error=UNKNOWN post=WR:OK,NOT_TRIED;BR:ENOENT,ENOENT;EXIT:EXIT_OBSERVED,EXIT_OBSERVED attempt_status=FAILED failed_step=E1_OPEN browser_exit=SIGTRAP,PAGE_TEARDOWN_START,CLOSED browser_log=MISSING cleanup=PASS`);
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/lane-entry.mjs'), 'utf8');
    expect(src.match(/d\.readReport\(/g)).toHaveLength(1);
    expect(src).toContain('say(`LANE E1 BROWSER_EXIT ${snap.browserExit}`);');
  });

  it('grammar: the line is required after FAILED_STEP with closed, consistent values; decisions ignore it', () => {
    const swap = (from: string, to: string) => LANE_OK.replace(from, to);
    for (const bad of [
      swap('LANE E1 BROWSER_EXIT MISSING\n', ''), swap('LANE E1 FAILED_STEP UNKNOWN\nLANE E1 BROWSER_EXIT MISSING\n', 'LANE E1 BROWSER_EXIT MISSING\nLANE E1 FAILED_STEP UNKNOWN\n'),
      swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT SHAPE CODE_256 FIRST_SEEN GATE_POST BODY_END_PAGE OPEN'), swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT SHAPE SIGUSR1 FIRST_SEEN GATE_POST BODY_END_PAGE OPEN'),
      swap('BROWSER_EXIT MISSING', `BROWSER_EXIT ${BX} secret`), swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT SHAPE SIGTRAP BODY_END_PAGE CLOSED'),
      swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT SHAPE NONE FIRST_SEEN GATE_POST BODY_END_PAGE OPEN'), swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT UNKNOWN'),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING').replace('BROWSER_EXIT MISSING', `BROWSER_EXIT ${BX}`),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR INVALID\nLANE E1 REPORT INVALID').replace('POST_OBSERVED MISSING', 'POST_OBSERVED INVALID'), // needs BROWSER_EXIT INVALID
    ]) expect(parseLaneOut(bad).ok, bad).toBe(false);
    for (const g of [swap('BROWSER_EXIT MISSING', `BROWSER_EXIT ${BX}`), swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT INVALID'),
      swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT SHAPE NONE FIRST_SEEN NOT_SEEN BODY_END_PAGE OPEN'), swap('BROWSER_EXIT MISSING', 'BROWSER_EXIT SHAPE CODE_0 FIRST_SEEN GATE_POST BODY_END_PAGE UNKNOWN')]) {
      const o = parseLaneOut(g);
      expect(o.ok, g).toBe(true);
      for (const pw of [{ state: 'ok', digits: '0' }, { state: 'ok', digits: '1' }, { state: 'absent' }, { state: 'bad' }])
        expect(planSummary({ verdict: OKV, laneText: g, pwExit: pw as never })).toEqual(planSummary({ verdict: OKV, laneText: LANE_OK, pwExit: pw as never }));
      const { browserExit: _x, ...rest } = o as Obj, { browserExit: _y, ...rest0 } = parseLaneOut(LANE_OK) as Obj;
      expect(rest).toEqual(rest0);
    }
    expect(parseLaneOut(swap('BROWSER_EXIT MISSING', `BROWSER_EXIT ${BX}`)).browserExit).toEqual({ state: 'EVIDENCE', shape: 'SIGTRAP', firstSeen: 'PAGE_TEARDOWN_START', page: 'CLOSED' });
    for (const f of ['gates.mjs', 'run-lane.mjs', 'image.mjs', 'bridge.mjs'])
      expect(readFileSync(path.join(ROOT, 'scripts/e2e/le-lane', f), 'utf8'), f).not.toMatch(/browserExit|BROWSER_EXIT|pageTeardown/);
    const contract = readFileSync(path.join(ROOT, 'scripts/e2e/le-lane/contract.mjs'), 'utf8');
    expect(contract.split('\n').filter((l) => /o\.browserExit|r\.browserExit/.test(l)).length).toBeLessThanOrEqual(4); // parser sets, detail reads
  });
});

describe('E1 browser-log r1: bounded fatal-record classifier on the owned browser stderr (closed codes only)', () => {
  type Obj = Record<string, unknown>;
  const PID = 4242;
  const STAMP = '1104/180140.123456';
  const GPU = `[${STAMP}:FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc(417)] GPU process isn't usable. Goodbye.`;
  const GPU_PID = `[${PID}:${PID + 1}:${STAMP}:FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc(417)] GPU process isn't usable. Goodbye.`;
  const OTHER = `[${STAMP}:FATAL:content/browser/zygote_host/zygote_host_impl_linux.cc(128)] No usable sandbox! token=eyJhbGciOi.secret /tmp/le-private/keys/anon`;
  const SMALL = { MAX_BYTES: 4096, MAX_LINE: 256 };
  const run = (chunks: (Buffer | string)[], limits?: { MAX_BYTES: number; MAX_LINE: number }, pid = PID) => {
    const c = browserLogClassifier(pid, limits);
    for (const x of chunks) c.push(typeof x === 'string' ? Buffer.from(x, 'latin1') : x);
    return c.sample();
  };
  const SECRET = /eyJ|secret|le-private|keys|anon|\/tmp|zygote|gpu_data|417|128|4242/;

  it('codes: closed, equal in source and contract; every sample is one of them and carries nothing from the bytes', () => {
    expect([...SL_LOG_CODES]).toEqual(['GPU_UNUSABLE_REPORTED', 'OTHER_FATAL_REPORTED', 'NO_MATCH', 'UNAVAILABLE', 'TRUNCATED', 'MULTIPLE']);
    expect([...BROWSER_LOG_CODES]).toEqual([...SL_LOG_CODES]);
    expect(BROWSER_LOG_LIMITS).toEqual({ MAX_BYTES: 1_048_576, MAX_LINE: 4096 });
    for (const v of [run([`${GPU}\n`]), run([`${OTHER}\n`]), run([`${GPU}\n${OTHER}\n`]), run(['x\n']), run(['y'.repeat(300)], SMALL)]) {
      expect(SL_LOG_CODES).toContain(v);
      expect(v).not.toMatch(SECRET);
    }
  });

  it('the pinned GPU record, with or without the owned pid; another pid is ignored; startup-free NO_MATCH', () => {
    expect(run([`${GPU}\n`])).toBe('GPU_UNUSABLE_REPORTED');
    expect(run([`${GPU_PID}\n`])).toBe('GPU_UNUSABLE_REPORTED');
    expect(run([`${GPU_PID}\n`], undefined, PID + 7)).toBe('NO_MATCH'); // other-process record
    expect(run([`[7:8:${STAMP}:FATAL:x/y.cc(1)] m\n`])).toBe('NO_MATCH'); // other-process fatal
    expect(run([])).toBe('NO_MATCH');
    expect(run([`[${STAMP}:ERROR:content/browser/gpu/gpu_process_host.cc(1)] GPU process exited unexpectedly\n`])).toBe('NO_MATCH');
  });

  it('chunk splits at every byte and CRLF give the same code for complete records', () => {
    const line = Buffer.from(`noise\n${GPU}\nmore\n`, 'latin1');
    for (let i = 0; i <= line.length; i += 1) expect(run([line.subarray(0, i), line.subarray(i)]), String(i)).toBe('GPU_UNUSABLE_REPORTED');
    expect(run([...Buffer.from(`${GPU}\n`, 'latin1')].map((b) => Buffer.from([b])))).toBe('GPU_UNUSABLE_REPORTED');
    expect(run([`${GPU}\r\n`])).toBe('GPU_UNUSABLE_REPORTED');
    // r1.1: the sample is a checkpoint, not EOF. An exact GPU or fatal prefix without its newline is not a complete record.
    expect(run([`x\n${GPU}`])).toBe('NO_MATCH');
    expect(run([`x\n${OTHER}`])).toBe('NO_MATCH');
    expect(run([`${GPU}\r`])).toBe('NO_MATCH');
  });

  it('near matches of the GPU record are not the GPU record', () => {
    const near = [
      GPU.replace('(417)', '(418)'), GPU.replace('gpu_data_manager_impl_private.cc', 'gpu_data_manager_impl.cc'), GPU.replace('Goodbye.', 'Goodbye'),
      `${GPU} trailing`, GPU.replace(':FATAL:', ':Fatal:'), ` ${GPU}`, GPU.replace('content/browser/gpu/', '../../content/browser/gpu/'),
      GPU.replace(STAMP, '1104/180140.12345'), GPU.replace(`[${STAMP}`, `[1:${STAMP}`),
    ];
    const codes = near.map((l) => run([`${l}\n`]));
    for (const [i, v] of codes.entries()) expect(v, near[i]).not.toBe('GPU_UNUSABLE_REPORTED');
    expect(run([`${GPU.replace(':FATAL:', ':ERROR:')}\n`])).toBe('NO_MATCH');
  });

  it('secret-shaped content is never kept: other fatal records with secret paths and messages are one code only', () => {
    expect(run([`${OTHER}\n`])).toBe('OTHER_FATAL_REPORTED');
    expect(run([`[${STAMP}:FATAL:/home/u/eyJsecret/key.cc(9)] Bearer eyJ.secret\n`])).toBe('OTHER_FATAL_REPORTED');
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8');
    const body = src.slice(src.indexOf('export function browserLogClassifier'), src.indexOf('export function browserLogLine'));
    expect(body).not.toMatch(/console\.|process\.std|writeFile|appendFile|annotations|JSON\.stringify|setEncoding|\.pause\(|\.resume\(|on\('error'|once\('error'/);
  });

  it('conflicting or repeated fatal records are MULTIPLE (and MULTIPLE wins over TRUNCATED)', () => {
    expect(run([`${GPU}\n${OTHER}\n`])).toBe('MULTIPLE');
    expect(run([`${GPU}\n${GPU}\n`])).toBe('MULTIPLE');
    expect(run([`${OTHER}\n${OTHER}\n`])).toBe('MULTIPLE');
    expect(run([`${GPU}\n${OTHER}\n`, 'z'.repeat(5000)], SMALL)).toBe('MULTIPLE');
  });

  it('bounds: oversized unterminated input, a line past MAX_LINE and the total cap are TRUNCATED, including after an early match', () => {
    expect(run(['a'.repeat(300)], SMALL)).toBe('TRUNCATED');
    expect(run(['a'.repeat(200), 'b'.repeat(200)], SMALL)).toBe('TRUNCATED'); // per-line bound across chunks, before buffering
    expect(run([`${'a'.repeat(300)}\n${GPU}\n`], SMALL)).toBe('TRUNCATED'); // a later record does not undo the truncation
    expect(run([`${GPU}\n`, 'c\n'.repeat(3000)], SMALL)).toBe('TRUNCATED'); // cap after an early match
    expect(run(['d\n'.repeat(2000)], SMALL)).toBe('NO_MATCH'); // 4000 bytes: within the cap
    expect(run(['d\n'.repeat(2049)], SMALL)).toBe('TRUNCATED');
    const c = browserLogClassifier(PID, SMALL);
    for (let i = 0; i < 1000; i += 1) c.push(Buffer.from('e'.repeat(1000), 'latin1'));
    expect(c.sample()).toBe('TRUNCATED');
  });

  it('late records after the first sample never change the code; non-Buffer data is UNAVAILABLE', () => {
    const c = browserLogClassifier(PID);
    c.push(Buffer.from('x\n'));
    expect(c.sample()).toBe('NO_MATCH');
    c.push(Buffer.from(`${GPU}\n`, 'latin1'));
    expect(c.sample()).toBe('NO_MATCH');
    const d = browserLogClassifier(PID);
    d.push(`${GPU}\n` as unknown as Buffer);
    expect(d.sample()).toBe('UNAVAILABLE');
  });

  it('recorder: passive on an already-flowing stream; the existing consumer sees identical lines; no error listener is added', async () => {
    const stderr = new PassThrough();
    const seen: string[] = [];
    createInterface({ input: stderr }).on('line', (l) => seen.push(l));
    const before = { data: stderr.listenerCount('data'), error: stderr.listenerCount('error'), flowing: stderr.readableFlowing };
    const sample = browserLogRecorder({ pid: PID, stderr });
    expect({ data: stderr.listenerCount('data'), error: stderr.listenerCount('error'), flowing: stderr.readableFlowing }).toEqual({ ...before, data: before.data + 1 });
    stderr.write(`a\n${GPU.slice(0, 20)}`);
    stderr.write(`${GPU.slice(20)}\nb\n`);
    await new Promise((r) => setImmediate(r));
    expect(seen).toEqual(['a', GPU, 'b']);
    expect(sample()).toBe('GPU_UNUSABLE_REPORTED');
    stderr.write(`${OTHER}\n`);
    await new Promise((r) => setImmediate(r));
    expect(sample()).toBe('GPU_UNUSABLE_REPORTED'); // late
    expect(seen).toHaveLength(4);
  });

  it('recorder: missing, paused, throwing or errored streams are UNAVAILABLE and change nothing', () => {
    expect(browserLogRecorder(null)()).toBe('UNAVAILABLE');
    expect(browserLogRecorder({ pid: PID })()).toBe('UNAVAILABLE');
    const paused = new PassThrough();
    expect(browserLogRecorder({ pid: PID, stderr: paused })()).toBe('UNAVAILABLE');
    expect([paused.listenerCount('data'), paused.readableFlowing]).toEqual([0, null]);
    const throwing = Object.defineProperty({ pid: PID }, 'stderr', { get() { throw new Error('secret'); } });
    expect(browserLogRecorder(throwing)()).toBe('UNAVAILABLE');
    const errored = new PassThrough();
    errored.on('data', () => {});
    errored.on('error', () => {});
    const s = browserLogRecorder({ pid: PID, stderr: errored });
    errored.destroy(new Error('boom'));
    expect(s()).toBe('UNAVAILABLE');
    expect(browserLogLine({ browserLog: () => { throw new Error('secret'); } })).toBe('UNAVAILABLE');
    expect(browserLogLine({ browserLog: () => 'GPU process isn\'t usable' })).toBe('UNAVAILABLE');
    expect(browserLogLine({})).toBe('UNAVAILABLE');
    expect(browserLogLine({ browserLog: () => 'NO_MATCH' })).toBe('NO_MATCH');
  });

  it('wiring: one passive recorder on the launchServer handle, one annotation after BROWSER_EXIT and before the throw; gates unchanged', () => {
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8');
    expect(src.match(/browserLogRecorder\(/g)).toHaveLength(2);
    const iExit = src.indexOf('const exitShapeOf = exitRecorder(child);'), iLog = src.indexOf('const browserLogOf = browserLogRecorder(child);'), iAttest = src.indexOf('const a = attestArgv(pid, readCmdline, shell);');
    expect(iExit > 0 && iExit < iLog && iLog < iAttest).toBe(true);
    expect(src).toContain('exitObservation, exitShape: exitShapeOf, browserLog: browserLogOf, pre:');
    expect(src).toContain("if (state && !postrunAppArmor(state).ok) marks.push('LANE_E_APPARMOR_POST');");
    const eg = readFileSync(path.join(ROOT, 'e2e/lesson-editor/egress-test.ts'), 'utf8');
    const iBx = eg.indexOf("type: 'lane-browser-exit'"), iBl = eg.indexOf("type: 'lane-browser-log', description: browserLogLine(state) }"), iThrow = eg.indexOf("if (!post.ok) throw new Error('LANE_E_APPARMOR_POST');");
    expect(iBx > 0 && iBx < iBl && iBl < iThrow).toBe(true);
    expect(eg.match(/browserLogLine\(/g)).toHaveLength(1);
  });

  it('snapshot, supervisor and grammar: one valid code else MISSING/INVALID; decisions, exit content and cleanup identical', async () => {
    const ENF3 = 'APPARMOR_DOCKER_DEFAULT_ENFORCE';
    const AA_U = `PRE ${ENF3} ${ENF3} POST ${ENF3} APPARMOR_E_UNKNOWN`;
    const OBS3 = 'WORKER_READ OK NOT_TRIED BROWSER_READ ENOENT ENOENT EXIT EXIT_OBSERVED EXIT_OBSERVED';
    const BX = 'SHAPE SIGTRAP FIRST_SEEN PAGE_TEARDOWN_START BODY_END_PAGE CLOSED';
    const report = (ann: Obj[]) => {
      const file = E1_IDENTITY.file;
      const results = [{ retry: 0, status: 'failed', error: { message: 'x' }, errors: [], annotations: [], steps: [{ title: 'E1_OPEN', duration: 1, error: { message: 'x' } }] }];
      return JSON.stringify({ errors: [], suites: [{ title: file, file, specs: [], suites: [{ title: E1_IDENTITY.describe, file, specs: [
        { title: E1_IDENTITY.title, file, tests: [{ projectName: E1_IDENTITY.project, annotations: ann, results }] }] }] }] });
    };
    const base = [{ type: 'lane-apparmor', description: AA_U }, { type: 'lane-post-observed', description: OBS3 }, { type: 'lane-browser-exit', description: BX }];
    const snap = (ann: Obj[]) => reportSnapshot({ status: 'ok', text: report(ann) });
    for (const code of SL_LOG_CODES) expect(snap([...base, { type: 'lane-browser-log', description: code }]).browserLog).toBe(code);
    expect(snap(base).browserLog).toBe('MISSING');
    for (const ann of [[{ type: 'lane-browser-log', description: 'NO_MATCH' }, { type: 'lane-browser-log', description: 'MULTIPLE' }],
      [{ type: 'lane-browser-log', description: 'GPU_UNUSABLE_REPORTED gpu_data_manager_impl_private.cc:417' }], [{ type: 'lane-browser-log', description: 7 }], [{ type: 'lane-browser-log' }]])
      expect(snap([...base, ...ann]).browserLog, JSON.stringify(ann)).toBe('INVALID');
    const { browserLog: _a, ...w } = snap([...base, { type: 'lane-browser-log', description: 'GPU_UNUSABLE_REPORTED' }]), { browserLog: _b, ...w0 } = snap(base);
    expect(w).toEqual(w0);
    const r = await enter({ report: report([...base, { type: 'lane-browser-log', description: 'GPU_UNUSABLE_REPORTED' }]), e1Code: 1 });
    const r0 = await enter({ report: report(base), e1Code: 1 });
    expect(r.lane()).toContain(`LANE E1 BROWSER_EXIT ${BX}\nLANE E1 BROWSER_LOG GPU_UNUSABLE_REPORTED\nLANE CLEANUP PASS\n`);
    expect([r.code, r.writes.get(3), r.runs]).toEqual([r0.code, r0.writes.get(3), r0.runs]);
    const pw = { state: 'ok', digits: '1' };
    expect(planSummary({ verdict: OKV, laneText: r.lane(), pwExit: pw })).toEqual(planSummary({ verdict: OKV, laneText: r0.lane(), pwExit: pw }));
    expect(refusalDetail({ verdict: OKV, laneText: r.lane(), pwExit: pw })).toContain(' browser_exit=SIGTRAP,PAGE_TEARDOWN_START,CLOSED browser_log=GPU_UNUSABLE_REPORTED cleanup=PASS');
    const swap = (from: string, to: string) => LANE_OK.replace(from, to);
    for (const code of SL_LOG_CODES) expect(parseLaneOut(swap('BROWSER_LOG MISSING', `BROWSER_LOG ${code}`)).ok, code).toBe(true);
    for (const bad of [swap('LANE E1 BROWSER_LOG MISSING\n', ''), swap('BROWSER_LOG MISSING', 'BROWSER_LOG GPU'), swap('BROWSER_LOG MISSING', 'BROWSER_LOG NO_MATCH x'),
      swap('BROWSER_LOG MISSING', 'BROWSER_LOG gpu_data_manager_impl_private.cc:417'), swap('LANE E1 BROWSER_EXIT MISSING\nLANE E1 BROWSER_LOG MISSING\n', 'LANE E1 BROWSER_LOG MISSING\nLANE E1 BROWSER_EXIT MISSING\n'),
      swap(`${AA_LINE}\nLANE E1 REPORT PARSED`, 'LANE E1 APPARMOR MISSING\nLANE E1 REPORT MISSING').replace('BROWSER_LOG MISSING', 'BROWSER_LOG NO_MATCH')])
      expect(parseLaneOut(bad).ok, bad).toBe(false);
    const decisionsOf = (t: string) => { const { browserLog: _x, ...rest } = parseLaneOut(t) as Obj; return rest; };
    expect(decisionsOf(swap('BROWSER_LOG MISSING', 'BROWSER_LOG GPU_UNUSABLE_REPORTED'))).toEqual(decisionsOf(LANE_OK));
    for (const f of ['gates.mjs', 'run-lane.mjs', 'bridge.mjs', 'image.mjs'])
      expect(readFileSync(path.join(ROOT, 'scripts/e2e/le-lane', f), 'utf8'), f).not.toMatch(/browserLog|BROWSER_LOG/);
  });
});

describe('E1 browser-log r1.1: sample is a checkpoint, owned bounded storage, no post-sample inspection', () => {
  const STAMP = '1104/180140.123456';
  const GPU = `[${STAMP}:FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc(417)] GPU process isn't usable. Goodbye.`;
  const L = (x: string) => Buffer.from(x, 'latin1');
  const TINY = { MAX_BYTES: 32, MAX_LINE: 16 };

  it('an exact GPU-prefix chunk is not attributed early; a later suffix decides; a later newline completes it', () => {
    const a = browserLogClassifier(1);
    a.push(L(GPU));
    a.push(L(' and more\n'));
    expect(a.sample()).toBe('OTHER_FATAL_REPORTED'); // the suffix made it a different fatal record; no premature GPU attribution
    const b = browserLogClassifier(1);
    b.push(L(GPU));
    b.push(L('\n'));
    expect(b.sample()).toBe('GPU_UNUSABLE_REPORTED');
    const c = browserLogClassifier(1);
    c.push(L(`${GPU}\n${GPU}`));
    expect(c.sample()).toBe('GPU_UNUSABLE_REPORTED'); // the second, unfinished copy is discarded, not MULTIPLE
  });

  it('caller buffers: later mutation cannot change classification, and pushed bytes are never modified', () => {
    const head = L(GPU.slice(0, 40));
    const snapshot = Buffer.from(head);
    const c = browserLogClassifier(1);
    c.push(head);
    expect(head.equals(snapshot)).toBe(true);
    head.fill(0x7a); // caller reuses its buffer
    c.push(L(`${GPU.slice(40)}\n`));
    expect(c.sample()).toBe('GPU_UNUSABLE_REPORTED');
    // the independently reproduced shape: a one-byte pending fragment from an 8 MiB backing buffer under MAX_BYTES 32 / MAX_LINE 16
    const big = Buffer.alloc(8 * 1024 * 1024, 0x61);
    big.write('[1104/1801\nAB', 0, 'latin1');
    const d = browserLogClassifier(1, TINY);
    d.push(big.subarray(0, 12)); // pending 'A'
    big.fill(0x0a, 0, 64); // mutate the backing buffer behind the view
    d.push(L('C\n'));
    expect(d.sample()).toBe('NO_MATCH');
    const e = browserLogClassifier(1, TINY);
    e.push(big.subarray(0, 32));
    expect(e.sample()).toBe('NO_MATCH'); // within the byte cap
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8');
    const body = src.slice(src.indexOf('export function browserLogClassifier'), src.indexOf('export function browserLogRecorder'));
    expect(body).toContain('if (!pend) pend = Buffer.alloc(limits.MAX_LINE); b.copy(pend, lineLen);');
    expect(body).not.toMatch(/line\.push\(|Buffer\.concat\(/);
    expect(body.indexOf('lineLen + b.length > limits.MAX_LINE')).toBeLessThan(body.indexOf('b.copy(pend, lineLen)'));
  });

  it('sample and fail release pending storage; a fragment from before a fail or sample never resurfaces', () => {
    const src = readFileSync(path.join(ROOT, 'e2e/lesson-editor/sandbox-launch.mjs'), 'utf8');
    expect(src).toContain('const release = () => { pend = null; lineLen = 0; skipping = false; };');
    expect(src).toContain('fail() { broken = true; release(); },');
    expect(src).toMatch(/if \(frozen !== null\) return frozen;\n\s*\/\/[^\n]*\n\s*release\(\);\n\s*frozen = result/);
    const f = browserLogClassifier(1);
    f.push(L(GPU));
    f.fail();
    f.push(L('\n'));
    expect(f.sample()).toBe('UNAVAILABLE');
    // r1.2: the non-Buffer branch releases too, then nothing later is inspected
    expect(src).toContain('if (!Buffer.isBuffer(chunk)) { broken = true; release(); return; }');
    const g = browserLogClassifier(1);
    g.push(L(GPU));
    g.push('x' as unknown as Buffer);
    const later = L('\n');
    let touched = 0;
    for (const k of ['indexOf', 'subarray', 'copy', 'toString'] as const)
      Object.defineProperty(later, k, { value: (...args: unknown[]) => { touched += 1; return (Buffer.prototype[k] as (...a: unknown[]) => unknown).apply(later, args); } });
    g.push(later);
    expect([g.sample(), touched]).toEqual(['UNAVAILABLE', 0]);
  });

  it('post-sample: pushed bytes are not inspected, copied or retained (negative control: the same probe before the sample is inspected)', () => {
    const probe = (x: string) => {
      const b = L(x);
      let touched = 0;
      for (const k of ['indexOf', 'subarray', 'copy', 'toString'] as const)
        Object.defineProperty(b, k, { value: (...args: unknown[]) => { touched += 1; return (Buffer.prototype[k] as (...a: unknown[]) => unknown).apply(b, args); } });
      return { b, touched: () => touched };
    };
    const c = browserLogClassifier(1);
    const before = probe('x\n');
    c.push(before.b);
    expect(before.touched()).toBeGreaterThan(0); // the probe sees real inspection
    expect(c.sample()).toBe('NO_MATCH');
    const after = probe(`${GPU}\n`);
    c.push(after.b);
    expect(after.touched()).toBe(0);
    expect(c.sample()).toBe('NO_MATCH');
    const capped = browserLogClassifier(1, TINY);
    capped.sample();
    const big = probe('y'.repeat(4096));
    capped.push(big.b);
    expect(big.touched()).toBe(0);
  });
});
