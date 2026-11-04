// ABOUTME: Pure and fake-only controls for the sealed E1 lane candidate: exact container contract, inspect gate, lane output
// ABOUTME: grammar, host receipts, bridge seal, orchestrator create states and reaping, supervisor order, sandbox launch, job shape.
//
// Read-only on purpose: nothing here writes a file, starts docker, a listener, a browser or a real child. Fakes live in memory.
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { constants as fsConstants, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import { SECCOMP_PROFILE_REL, createdNeverStarted } from '../../../scripts/e2e/le-iso/expect.mjs';
import {
  ENV_KEYS, GATE_KEYS, IMAGE_PATH_ENV, LANE_LIMITS, LANE_NODE, PRECHECK_CODES, PSQL_REAL, TOOLS, cleanupScope, compareLaneInspect, expectedLaneConfig, imageBuildRecord,
  imageCleanupRecord, imageConfigProblems, laneBinds, laneCreateArgs, laneEnv, lanePaths, lanePorts, laneTmpfsSpec, laneVerdict, parseGates, parseImageBuildRecord,
  parseImageCleanupRecord, parseLaneOut, planSummary, pwExitContent,
} from '../../../scripts/e2e/le-lane/contract.mjs';
import { SEALED_HOLD_MAX_MS, createBridge, parseBridgeFinal } from '../../../scripts/e2e/le-lane/bridge.mjs';
import { inputsOk, runLane } from '../../../scripts/e2e/le-lane/run-lane.mjs';
import { buildLaneImage, cleanupLaneImage, sanitizedEnv } from '../../../scripts/e2e/le-lane/image.mjs';
import { planLine, readVerdict, verifyLines } from '../../../scripts/e2e/le-lane/gates.mjs';
import { REPORT_MAX, REPORT_MAX_DEPTH, REPORT_MAX_NODES, closureProblems, envProblems, laneMain, readReportBounded, sessionParentOk, workerAppArmorFromReport } from '../../../scripts/e2e/le-lane/lane-entry.mjs';
import { NOTRUN_CODES, notRunLines } from '../../../scripts/e2e/le-e1-notrun.mjs';
import {
  FORBIDDEN_FLAGS, LAUNCH_BOUND_MS, RESOLVER_ARG, SandboxLaunchError, attestArgv, defaultsProblem, effectiveOptions, effectiveProblem, incomingProblem, labelCode,
  postrunAppArmor, serverOptions, withSandboxedBrowser,
} from '../../../e2e/lesson-editor/sandbox-launch.mjs';

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
  it('checks the built image exactly (PATH-only Env, no Entrypoint/Cmd/WorkingDir, one layer, amd64)', () => {
    const img = { Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], Entrypoint: null, Cmd: null, WorkingDir: '', Labels: null, OnBuild: null } };
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
});

const ENF = 'APPARMOR_DOCKER_DEFAULT_ENFORCE';
const AA_LINE = `LANE E1 APPARMOR PRE ${ENF} ${ENF} POST ${ENF} ${ENF}`;
const LANE_OK = `LANE START\nLANE APPARMOR ${ENF}\nLANE SETUP PASS\nLANE E1 RAN\n${AA_LINE}\nLANE CLEANUP PASS\nLANE END\n`;
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
  type BF = { lddUnreaped?: string; lddFails?: string; buildOk?: boolean; buildUnreaped?: boolean; iid?: string | null; inspectUnreaped?: boolean; inspectBad?: boolean; ctlExists?: boolean; putFails?: boolean };
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
        const img = { Id: IMG, Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['x'] }, Config: { User: `${UID}:${GID}`, Env: [IMAGE_PATH_ENV], Entrypoint: null, Cmd: null, WorkingDir: '', Labels: null, OnBuild: null } };
        if (o.inspectBad) img.Config.Env.push('X=1');
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
    expect(r.puts.get(`${C}/ctx/Dockerfile`)).toContain(`ENV ${IMAGE_PATH_ENV}\n`);
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
    expect(cleanupScope(base)).toEqual({ effective: true, controls: 'REMOVE', lines: ['LANE_SECRET_SCOPE CLEAN', 'SECRET_CLEANUP_EFFECTIVE', 'CONTROLS REMOVE'] });
    for (const k of ['preview', 'stack', 'producers'])
      for (const v of ['failure', 'cancelled', 'skipped', '', undefined]) {
        const r = cleanupScope({ ...base, outcomes: { ...ok3, [k]: v } });
        expect(r.effective, `${k}=${v}`).toBe(false);
        expect(r.lines).toEqual(['LANE_SECRET_SCOPE CLEAN', `SECRET_CLEANUP_UNRESOLVED ${k}`, 'CONTROLS REMOVE']);
      }
    expect(cleanupScope({ ...base, verdict: badV }).lines).toEqual(['LANE_SECRET_SCOPE UNRESOLVED', 'SECRET_CLEANUP_UNRESOLVED lane', 'CONTROLS KEEP']);
    expect(cleanupScope({ ...base, privateRemoved: false }).lines).toEqual(['LANE_SECRET_SCOPE UNRESOLVED', 'SECRET_CLEANUP_UNRESOLVED private', 'CONTROLS REMOVE']);
    expect(cleanupScope({ ...base, outcomes: {}, verdict: badV, privateRemoved: false }).lines[1]).toBe('SECRET_CLEANUP_UNRESOLVED preview,stack,producers,lane,private');
    for (const over of [{ buildRec: null }, { cleanupRec: null }, { cleanupRec: imageCleanupRecord({ code: 'LANE_E_IMAGE_REMOVE', clientsReaped: true }) },
      { cleanupRec: imageCleanupRecord({ code: 'LANE_IMAGE_REMOVED', clientsReaped: false }) }, { buildRec: imageBuildRecord({ invoked: true, id: IMG, clientsReaped: false, result: 'LANE_IMAGE_OK' }) }]) {
      const r = cleanupScope({ ...base, ...over });
      expect(r.controls, JSON.stringify(over)).toBe('KEEP');
      expect(r.effective).toBe(true); // image/control state is not a secret consumer; it is kept, never deleted, and fails the step separately
    }
    expect(cleanupScope({ ...base, controlsPresent: false, buildRec: null, cleanupRec: null }).controls).toBe('NONE');
  });
  it('le_private: secrets and controls are separate decisions; the control dir is removed ONLY on CONTROLS REMOVE', () => {
    const job = (YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8')) as Obj).jobs['lesson-editor'];
    const st = job.steps.find((x: Obj) => x.id === 'le_private');
    expect(st.env).toEqual({ O_PREVIEW: '${{ steps.le_owned_stop.outcome }}', O_STACK: '${{ steps.le_stop.outcome }}', O_PRODUCERS: '${{ steps.le_producers.outcome }}' });
    const run: string = st.run;
    expect(run).toContain('gates.mjs scope "$C" "$RUNNER_TEMP/le-private" "$GITHUB_WORKSPACE" "$O_PREVIEW" "$O_STACK" "$O_PRODUCERS" "$rc"');
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
  execPath?: string; nodeMissing?: boolean; report?: string | null };
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
      if (args.includes('test')) return { code: o.e1Code === undefined ? 0 : o.e1Code };
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
    expect(ok.lane()).toContain(`LANE E1 RAN\n${AA_LINE}\nLANE CLEANUP PASS`);
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
      expect(r.lane(), line).toContain(`LANE E1 RAN\n${line}\nLANE CLEANUP`);
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
    expect(src).toContain('aaLine = workerAppArmorFromReport(d.readReport(L.report));');
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
    for (const t of ["if (!state) throw new Error('LANE_E_APPARMOR_PRE');", 'await use();', 'const post = postrunAppArmor(state);',
      "test.info().annotations.push({ type: 'lane-apparmor', description: post.line });", "if (!post.ok) throw new Error('LANE_E_APPARMOR_POST');", '{ auto: true }'])
      expect(gate).toContain(t);
    expect(gate.indexOf('annotations.push')).toBeLessThan(gate.indexOf("throw new Error('LANE_E_APPARMOR_POST')"));
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
