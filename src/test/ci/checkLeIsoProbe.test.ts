// ABOUTME: Pure controls for the SYNTHETIC lane-isolation feasibility probe: fixed codes, the exact container config, the
// ABOUTME: absence rule, the inner classifier, every host teardown gate (fake docker, /proc and fs), and the job's shape.
//
// Read-only on purpose: nothing here writes a file. Fakes live in memory; no docker, listener or browser is started.
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserServer, BrowserType } from 'playwright-core';
import { describe, expect, expectTypeOf, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';
import { apparmorGate, BROWSER_PATH_RE, BROWSER_PIN, goCompact, hasDuplicateKeys, SECCOMP_COMPACT_SHA256, SECCOMP_PROFILE_REL, SECCOMP_RAW_SHA256, securityOptOk, apparmorLabel, daemonSecurity, HOST_DIAG, HOST_DIAG_ORDER, hostDiagLine, INNER_DIAG, INNER_DIAG_ORDER, sysctlClass, absenceVerdict, classifyInner, CONFIG_FIELDS, configFieldLines, createdNeverStarted, dnsVerdict, compareInspect, exitStateOk, expectedConfig, HOST_CODES, IN, INIT_PATH, INNER_ORDER, INNER_TESTS, launchErrorCode, mountsVerdict, parseLdd, stopOutputCategory, tmpfsSpec } from '../../../scripts/e2e/le-iso/expect.mjs';
import { formatResults, gatedSandbox, innerDiag, sandboxCheck, tmpVerdict } from '../../../scripts/e2e/le-iso/inner-probe.mjs';
import { buildImage, createArgs, hostDiag, makeExec, runProbe } from '../../../scripts/e2e/le-iso/run-probe.mjs';
import { buildProfile, DELTA_SPEC, OUTPUT_SHA256, UPSTREAM_SHA256 } from '../../../scripts/e2e/le-iso/seccomp-profile.mjs';
import { CHECK_ORDER, evaluate, gather, PINS, profileOk } from '../../../scripts/e2e/le-iso/preflight.mjs';
import { createHash } from 'node:crypto';
import { BPIN_ORDER, probeCoreDir, resolvedChain, verdict as bpinVerdict } from '../../../scripts/e2e/le-iso/browser-pin.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
const JOB = DOC.jobs['le-isolation-probe'];

const CIDV = 'c'.repeat(64);
// r10 (REVIEW DIFF): the real committed profile bytes, and what the docker CLI would place in SecurityOpt (Go json.Compact).
const PROFILE_RAW = readFileSync(path.join(ROOT, SECCOMP_PROFILE_REL));
const PROFILE_TEXT = PROFILE_RAW.toString('utf8');
const securityOptArgs = (a: string[]) => a.flatMap((x, i) => (x === '--security-opt' ? [a[i + 1]] : []));
const IMG = `sha256:${'a'.repeat(64)}`;
const REPO = '/w/repo', TEMP = '/rt', NODE = '/n/bin/node', SHELL = '/s/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const SHELL_BYTES = Buffer.from('fake headless shell bytes');
const SECCOMP_PATH = `${REPO}/${SECCOMP_PROFILE_REL}`;
const H = `${TEMP}/le-iso-host`, S = `${TEMP}/le-iso-sock`, O = `${TEMP}/le-iso-out`;
const passLines = () => `${[...INNER_ORDER.map((t) => `LE-ISO ${t} ${INNER_TESTS[t].expected}`), ...INNER_DIAG_ORDER.map((k) => `LE-ISO-DIAG ${k} ${k === 'APPARMOR_LABEL' ? 'DOCKER_DEFAULT_ENFORCE' : 'UNKNOWN'}`)].join('\n')}\nLE-ISO END\n`;
const stat = (start: string) => `9 (node) S 1 1 1 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 ${start} 0 0`;

function goodInspect(over: Record<string, unknown> = {}) {
  const e = expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT });
  const { Image, User, EffectiveMounts, ...hc } = e;
  return { Id: CIDV, Image, Config: { User }, HostConfig: { ...hc, Mounts: [] }, Mounts: [...EffectiveMounts].reverse().map((m) => ({ ...m, Mode: 'ro', Name: '' })),
    State: { Status: 'exited', Running: false, Restarting: false, Pid: 0, Dead: false }, ...over };
}

type Opt = { inner?: string; startOk?: boolean; readyPid?: number; startNow?: string; lsC?: [boolean, string]; final?: string;
  exitCode?: number; ignoreTerm?: boolean; ignoreKill?: boolean; inspectOver?: Record<string, unknown>; images?: string;
  createCid?: string; createOut?: string; hangs?: boolean; stopFails?: boolean; unreapedOn?: string; stopTimeout?: boolean; inspectFails?: boolean; inspectGarbage?: boolean; rmFails?: boolean; imagesOk?: boolean; createdState?: Record<string, unknown>; stopOut?: string; final0?: string; profile?: Buffer; shellBytes?: Buffer };
const RUNNING = { Status: 'running', Running: true, Paused: false, Restarting: false, Pid: 77, Dead: false, StartedAt: '2026-11-03T21:04:40Z' };
const CREATED_STATE = { Status: 'created', Running: false, Paused: false, Restarting: false, Pid: 0, Dead: false, StartedAt: '0001-01-01T00:00:00Z' };
function fake(o: Opt = {}) {
  const files = new Map<string, string | Buffer>([[SECCOMP_PATH, o.profile ?? PROFILE_RAW], [SHELL, o.shellBytes ?? SHELL_BYTES]]);
  const dirs = new Set<string>([REPO, NODE, SHELL, TEMP]);
  const calls: string[][] = [];
  const procs = new Map<string, string>();
  let running = false;
  let started = false;
  let exists = false;
  const die = (code: number | null) => {
    procs.delete('/proc/4242/stat'); dirs.delete('/proc/4242');
    if (code === 0) files.set(`${H}/final`, o.final ?? '2 0\n');
    process.nextTick(() => child.emit('exit', code)); // before any timer: the 5 ms fake sleep must never win the exit race under load
  };
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null as number | null, signalCode: null as string | null, kill: (sig: string) => {
    calls.push(['kill', sig]);
    if (sig === 'SIGTERM' && !o.ignoreTerm) die(o.exitCode ?? 0);
    if (sig === 'SIGKILL' && !o.ignoreKill) die(null);
    return true; } });
  const enoent = () => Object.assign(new Error('x'), { code: 'ENOENT' });
  const fs = {
    existsSync: (p: string) => dirs.has(p) || files.has(p),
    mkdirSync: (p: string) => { dirs.add(p); },
    readFileSync: (p: string) => { const v = procs.get(p) ?? files.get(p); if (v === undefined) throw enoent(); return v; },
    statSync: (p: string) => { if (!dirs.has(p)) throw enoent(); return {}; },
    rmSync: (p: string) => { dirs.delete(p); for (const k of [...files.keys()]) if (k.startsWith(`${p}/`)) files.delete(k); },
  };
  const exec = (bin: string, args: string[]) => {
    calls.push([bin, ...args]);
    const [a0, a1] = args;
    if (o.unreapedOn && a0 === o.unreapedOn) return { ok: false, stdout: '', timedOut: true, unreaped: true };
    if (o.stopTimeout && a0 === 'stop') return { ok: false, stdout: '', timedOut: true };
    if (o.inspectFails && a0 === 'container' && a1 === 'inspect') return { ok: false, stdout: '' };
    if (o.inspectGarbage && a0 === 'container' && a1 === 'inspect') return { ok: true, stdout: 'not json' };
    if (a0 === 'create') {
      const cf = args[args.indexOf('--cidfile') + 1]; const c = o.createCid ?? CIDV; files.set(cf, `${c}\n`); exists = true;
      return { ok: true, stdout: `${o.createOut ?? c}\n` };
    }
    if (a0 === 'container' && a1 === 'inspect') return exists ? { ok: true, stdout: JSON.stringify([goodInspect({ ...o.inspectOver, ...(running ? { State: RUNNING } : started ? {} : { State: o.createdState ?? CREATED_STATE }) })]) } : { ok: false, stdout: '' };
    if (a0 === 'start') { running = true; started = true; if (o.hangs) return { ok: false, stdout: '' }; running = false; return { ok: o.startOk ?? true, stdout: o.inner ?? passLines() }; }
    if (a0 === 'stop') { if (o.stopFails) return { ok: false, stdout: '' }; running = false; return { ok: true, stdout: o.stopOut ?? `${CIDV}\n` }; }
    if (a0 === 'wait') return running ? { ok: false, stdout: '' } : { ok: true, stdout: '0\n' };
    if (a0 === 'rm') { if (running) return { ok: false, stdout: '' }; exists = false; return { ok: true, stdout: `${CIDV}\n` }; }
    if (a0 === 'container' && a1 === 'ls') return { ok: (o.lsC ?? [true, ''])[0], stdout: o.lsC ? o.lsC[1] : exists ? `${CIDV}\n` : '' };
    if (a0 === 'image' && a1 === 'rm') return { ok: !o.rmFails, stdout: '' };
    if (a0 === 'image' && a1 === 'ls') return { ok: o.imagesOk ?? true, stdout: o.images ?? `sha256:${'b'.repeat(64)}\n` };
    return { ok: false, stdout: '' };
  };
  const d = {
    exec, fs, sleep: () => new Promise<void>((r) => setTimeout(r, 5)), uid: () => 1001, gid: () => 118,
    browserSha256: createHash('sha256').update(SHELL_BYTES).digest('hex') as string | undefined,
    buildImage: () => ({ code: 'ISO_IMAGE_OK', id: IMG }),
    spawnEndpoint: () => {
      dirs.add('/proc/4242');
      procs.set('/proc/4242/stat', stat('777'));
      files.set(`${H}/ready`, `${o.readyPid ?? 4242} 777 40000\n`);
      if (o.startNow) procs.set('/proc/4242/stat', stat(o.startNow));
      return child;
    },
  };
  return { d, calls, dirs, files };
}
const run = (o: Opt = {}) => { const f = fake(o); return runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP }).then((r) => ({ ...r, ...f })); };

describe('le-iso pure rules', () => {
  it('classifies only the exact ordered inner shape', () => {
    expect(classifyInner(passLines())).toMatchObject({ ok: true, pass: true });
    const one = passLines().replace('LE-ISO SANDBOX SANDBOX_ON_NONCE_MATCH', 'LE-ISO SANDBOX SANDBOX_E_FLAG');
    expect(classifyInner(one)).toMatchObject({ ok: true, pass: false });
    expect(classifyInner(passLines().replace('LE-ISO END\n', ''))).toEqual({ ok: false });
    expect(classifyInner(passLines().replace('IF_LO_ONLY', 'eth0'))).toEqual({ ok: false });
    expect(classifyInner(`noise\n${passLines()}`)).toEqual({ ok: false });
    const swapped = passLines().split('\n'); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(classifyInner(swapped.join('\n'))).toEqual({ ok: false });
  });
  it('DNS: only an immediate refusal is isolated; a timeout or an answer is never success', () => {
    expect(dnsVerdict('ECONNREFUSED')).toBe('DNS_NONE');
    for (const o of ['timeout', 'ETIMEOUT', 'ENOTFOUND', 'OTHER', 'ESERVFAIL']) expect(dnsVerdict(o)).toBe('DNS_E_UNDECIDED');
    expect(dnsVerdict('resolved')).toBe('DNS_E_RESOLVED');
  });
  it('absence is only a successful empty listing; an error is never not-found', () => {
    expect(absenceVerdict(true, '\n', CIDV)).toBe('absent');
    expect(absenceVerdict(true, `${CIDV}\n`, CIDV)).toBe('present');
    expect(absenceVerdict(false, '', CIDV)).toBe('undecided');
    expect(absenceVerdict(true, 'Error response from daemon', CIDV)).toBe('undecided');
  });
  it('ldd closure fails closed on any unknown line', () => {
    expect(parseLdd('\tlinux-vdso.so.1 (0x00007fff)\n\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f00)\n\t/lib64/ld-linux-x86-64.so.2 (0x00007f01)\n'))
      .toEqual(['/lib/x86_64-linux-gnu/libc.so.6', '/lib64/ld-linux-x86-64.so.2']);
    expect(parseLdd('\tlibfoo.so => not found\n')).toBeNull();
    expect(parseLdd('\tstatically linked\n')).toBeNull();
  });
  it('the create argv and the expected inspect agree, and a drifted inspect names the field only', () => {
    const a = createArgs({ cidfile: `${H}/lane.cid`, imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH });
    for (const f of ['--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--restart', 'no', '--log-driver', '--init'])
      expect(a).toContain(f);
    expect(a).toContain(`${S}:${IN.sock}:ro,rprivate`);
    expect(a).not.toContain('--privileged');
    expect(a.join(' ')).not.toMatch(/--network\s+(host|bridge)|-p\s|--publish|docker\.sock|--pid[ =]|--userns|--cap-add/);
    expect(compareInspect(goodInspect(), expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT }))).toEqual([]);
    const drift = goodInspect(); (drift.HostConfig as Record<string, unknown>).NetworkMode = 'bridge';
    expect(compareInspect(drift, expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT }))).toEqual(['NetworkMode']);
    expect(exitStateOk(goodInspect())).toBe(true);
    expect(exitStateOk({ State: { Status: 'running', Running: true, Restarting: false, Pid: 9, Dead: false } })).toBe(false);
  });
  it('mount verdict refuses an unexpected mount such as a docker socket', () => {
    const mi = (p: string, opts = 'rw') => `1 2 0:1 / ${p} ${opts} - x x rw`;
    const base = [...['/', IN.sock, IN.out, IN.tmp, REPO, '/proc', '/dev'].map((p) => mi(p)), mi(INIT_PATH, 'ro,relatime')].join('\n');
    expect(mountsVerdict(base, { repo: REPO })).toBe('MOUNTS_EXACT');
    expect(mountsVerdict(`${base}\n${mi('/var/run/docker.sock')}`, { repo: REPO })).toBe('MOUNTS_E_UNEXPECTED_OTHER');
    expect(mountsVerdict(['/', IN.sock].map((p) => mi(p)).join('\n'), { repo: REPO })).toBe('MOUNTS_E_MISSING');
  });
  it('the image builder refuses an unresolvable closure before writing anything', async () => {
    const d = { exec: () => ({ ok: true, stdout: '\tlibx.so => not found\n' }), fs: {}, uid: () => 1, gid: () => 1 };
    expect(await buildImage(d as never, { ctl: H, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH })).toBe('ISO_E_IMAGE_CLOSURE');
  });
});

describe('le-iso host orchestrator (fakes only)', () => {
  it('a full pass prints only fixed codes, in order, and tears everything down', async () => {
    const r = await run();
    expect(r.say.filter((l) => l.startsWith('ISO_E_'))).toEqual([]);
    expect(r.ok).toBe(true);
    const fixed = new Set([...HOST_CODES, ...INNER_ORDER.map((t) => `LE-ISO ${t} ${INNER_TESTS[t].expected}`), ...INNER_DIAG_ORDER.map((k) => `LE-ISO-DIAG ${k} ${k === 'APPARMOR_LABEL' ? 'DOCKER_DEFAULT_ENFORCE' : 'UNKNOWN'}`)]);
    for (const l of r.say.filter((x) => !x.startsWith('ISO_DIAG '))) expect(fixed.has(l), l).toBe(true);
    expect(r.say.slice(0, 6)).toEqual(['ISO_INPUT_OK', 'ISO_IMAGE_OK', 'ISO_ENDPOINT_OK', 'ISO_CREATE_OK', 'ISO_CONFIG_OK', 'ISO_RUN_DONE']);
    expect(r.say.slice(-8)).toEqual(['ISO_STOP_OK', 'ISO_EXIT_OK', 'ISO_RM_OK', 'ISO_ABSENT', 'ISO_ENDPOINT_STOPPED', 'ISO_IMAGE_REMOVED', 'ISO_DIRS_REMOVED', 'ISO_INNER_PASS']);
    const order = r.calls.map((c) => c[1]).filter((x) => ['start', 'stop', 'wait', 'rm'].includes(x));
    expect(order).toEqual(['start', 'stop', 'wait', 'rm']);
    for (const p of [H, S, O]) expect(r.dirs.has(p)).toBe(false);
    expect(r.calls.filter((c) => c[1] === 'start')).toHaveLength(1);
    expect(r.calls.flat().join(' ')).not.toMatch(/\bpull\b|--restart (always|on-failure)/);
  });
  it('an existing control dir is refused, never reused', async () => {
    const f = fake(); f.d.fs.mkdirSync(H);
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r).toEqual({ ok: false, say: ['ISO_E_INPUT'] });
    expect(f.calls).toEqual([]);
  });
  it('endpoint identity: the ready pid must be the spawned child, with the same start time', async () => {
    const a = await run({ readyPid: 999 });
    expect(a.say).toContain('ISO_E_ENDPOINT_IDENTITY');
    expect(a.calls.some((c) => c[1] === 'create')).toBe(false);
    const b = await run({ startNow: '778' });
    expect(b.say).toContain('ISO_E_ENDPOINT_IDENTITY');
    expect(b.ok).toBe(false);
  });
  it('termination and connection cleanup gates', async () => {
    expect((await run({ exitCode: 5 })).say).toContain('ISO_E_ENDPOINT_TERMINATION');
    expect((await run({ final: '2 1\n' })).say).toContain('ISO_E_ENDPOINT_CONNS');
    expect((await run({ final: '0 0\n' })).say).toContain('ISO_E_ENDPOINT_CONNS');
  });
  it('an endpoint that ignores SIGTERM gets a bounded SIGKILL on the same verified identity, and still fails', async () => {
    const a = await run({ ignoreTerm: true });
    expect(a.calls.filter((c) => c[0] === 'kill')).toEqual([['kill', 'SIGTERM'], ['kill', 'SIGKILL']]);
    expect(a.say).toEqual(expect.arrayContaining(['ISO_E_ENDPOINT_TERMINATION', 'ISO_ENDPOINT_KILLED', 'ISO_DIRS_REMOVED']));
    expect(a.ok).toBe(false);
    const b = await run({ ignoreTerm: true, ignoreKill: true });
    expect(b.say).toContain('ISO_PRESERVED_DIRS');
    expect(b.dirs.has(H)).toBe(true);
    expect(b.files.get(`${H}/ready`)).toBeDefined();
  });
  it('a changed endpoint start time fails, yet our own unreaped child is still terminated through its handle', async () => {
    const g = fake({ startNow: '778' });
    const r2 = await runProbe(g.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r2.say).toContain('ISO_E_ENDPOINT_IDENTITY');
    expect(g.calls.some((c) => c[1] === 'create')).toBe(false);
    expect(g.calls.filter((c) => c[0] === 'kill')).toEqual([['kill', 'SIGTERM']]);
    expect(r2.say).toContain('ISO_DIRS_REMOVED');
    expect(r2.ok).toBe(false);
  });
  it('a spawn failure is a fixed code, not an uncaught exception', async () => {
    const f = fake();
    f.d.spawnEndpoint = () => { throw new Error('EACCES'); };
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r.say).toEqual(expect.arrayContaining(['ISO_E_ENDPOINT_START', 'ISO_DIRS_REMOVED']));
    const g = fake();
    g.d.spawnEndpoint = () => { const c = Object.assign(new EventEmitter(), { pid: undefined, exitCode: null, signalCode: null, kill: () => false }); setTimeout(() => c.emit('error', new Error('ENOENT')), 0); return c as never; };
    const r2 = await runProbe(g.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r2.say).toEqual(expect.arrayContaining(['ISO_E_ENDPOINT_START', 'ISO_DIRS_REMOVED']));
    expect(r2.ok).toBe(false);
  });
  it('a partial directory setup removes only what this run created', async () => {
    const f = fake();
    const removed: string[] = [];
    const mk = f.d.fs.mkdirSync;
    Object.assign(f.d.fs, {
      mkdirSync: (p: string) => { if (p === O) throw new Error('ENOSPC'); mk(p); },
      rmdirSync: (p: string) => { removed.push(p); f.dirs.delete(p); },
    });
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r).toEqual({ ok: false, say: ['ISO_E_INPUT'] });
    expect(removed).toEqual([S, H]);
    for (const p of [H, S, O]) expect(f.dirs.has(p)).toBe(false);
    const g = fake();
    Object.assign(g.d.fs, { mkdirSync: (p: string) => { if (p === O) throw new Error('x'); g.dirs.add(p); }, rmdirSync: () => { throw new Error('EBUSY'); } });
    expect((await runProbe(g.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP })).say).toEqual(['ISO_E_INPUT', 'ISO_E_INPUT_ROLLBACK']);
  });
  it('drifted mount source, destination, RW, propagation or resource bounds refuse before start', async () => {
    const exp = expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT });
    const base = goodInspect();
    const withMount = (i: number, over: Record<string, unknown>) => ({ ...base, Mounts: base.Mounts.map((m, j) => (j === i ? { ...m, ...over } : m)) });
    for (const over of [{ Source: '/' }, { Destination: '/iso/other' }, { RW: true }, { Propagation: 'rshared' }, { Type: 'volume' }])
      expect(compareInspect(withMount(0, over), exp)).toContain('EffectiveMounts');
    expect(compareInspect({ ...base, Mounts: [...base.Mounts, base.Mounts[0]] }, exp)).toContain('EffectiveMounts');
    for (const k of ['NanoCpus', 'Memory', 'MemorySwap', 'PidsLimit', 'ShmSize'])
      expect(compareInspect({ ...base, HostConfig: { ...base.HostConfig, [k]: 0 } }, exp)).toEqual([k]);
    const r = await run({ inspectOver: { HostConfig: { ...base.HostConfig, PidsLimit: 0 } } });
    expect(r.say).toContain('ISO_E_CONFIG');
    expect(r.calls.some((c) => c[1] === 'start')).toBe(false);
  });
  it('a failed or ambiguous absence listing is undecided, never absent', async () => {
    const a = await run({ lsC: [false, ''] });
    expect(a.say).toContain('ISO_E_ABSENCE_UNDECIDED'); expect(a.ok).toBe(false);
    expect((await run({ lsC: [true, `${CIDV}\n`] })).say).toContain('ISO_E_STILL_PRESENT');
  });
  it('config drift stops before start, and teardown still runs', async () => {
    const r = await run({ inspectOver: { Mounts: [{ Type: 'volume' }, { Type: 'bind' }, { Type: 'bind' }] } });
    expect(r.say).toContain('ISO_E_CONFIG');
    expect(r.calls.some((c) => c[1] === 'start')).toBe(false);
    expect(r.say).toContain('ISO_RM_OK'); expect(r.say).toContain('ISO_DIRS_REMOVED');
  });
  it('a cid mismatch between stdout and the cidfile is refused', async () => {
    const a = await run({ createCid: 'zz' });
    expect(a.say).toContain('ISO_E_CID');
    expect(a.calls.some((c) => c[1] === 'start')).toBe(false);
    // cidfile and stdout both valid but different: identity unknown, nothing removed, everything preserved.
    const b = await run({ createOut: 'd'.repeat(64) });
    expect(b.say).toEqual(expect.arrayContaining(['ISO_E_CID', 'ISO_E_CID_UNKNOWN', 'ISO_PRESERVED_IMAGE', 'ISO_PRESERVED_DIRS']));
    expect(b.calls.some((c) => ['stop', 'rm'].includes(c[1]) || (c[1] === 'image' && c[2] === 'rm'))).toBe(false);
    for (const p of [H, S, O]) expect(b.dirs.has(p)).toBe(true);
  });
  it('raw inner output is never echoed, and one failed test fails the probe', async () => {
    const leak = await run({ inner: 'secret-path /home/runner\nLE-ISO END\n' });
    expect(leak.say.join('\n')).not.toMatch(/secret|home/);
    expect(leak.say).toContain('ISO_E_INNER_OUTPUT');
    const one = await run({ inner: passLines().replace('SANDBOX_ON_NONCE_MATCH', 'SANDBOX_E_LAUNCH') });
    expect(one.ok).toBe(false); expect(one.say).toContain('LE-ISO SANDBOX SANDBOX_E_LAUNCH'); expect(one.say.at(-1)).toBe('ISO_INNER_FAIL');
    const exitBad = await run({ startOk: false });
    expect(exitBad.ok).toBe(false);
  });
  it('the image must be gone from a well-formed listing', async () => {
    expect((await run({ images: `${IMG}\n` })).say).toContain('ISO_E_IMAGE_ABSENCE');
    expect((await run({ images: 'garbage\n' })).say).toContain('ISO_E_IMAGE_ABSENCE');
  });
});

describe('le-iso image identity is preserved until absence is proven (fakes only)', () => {
  it('a build invoked without a confirmed id keeps the control dir', async () => {
    const f = fake();
    f.d.buildImage = (() => ({ code: 'ISO_E_IMAGE_BUILD', id: null })) as never;
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r.say).toEqual(expect.arrayContaining(['ISO_E_IMAGE_BUILD', 'ISO_E_IMAGE_UNKNOWN', 'ISO_PRESERVED_DIRS']));
    expect(r.say).not.toContain('ISO_DIRS_REMOVED');
    expect(f.dirs.has(H)).toBe(true);
  });
  it('a build that never ran (closure refusal) has nothing to preserve', async () => {
    const f = fake();
    f.d.buildImage = (() => 'ISO_E_IMAGE_CLOSURE') as never;
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r.say).toEqual(expect.arrayContaining(['ISO_E_IMAGE_CLOSURE', 'ISO_DIRS_REMOVED']));
  });
  it('a failed image rm or a failed/odd image listing keeps image.id and the control dir', async () => {
    for (const over of [{ rmFails: true }, { imagesOk: false }, { images: 'garbage\n' }, { images: `${IMG}\n` }]) {
      const f = fake(over as Opt);
      f.files.set(`${H}/image.id`, `${IMG}\n`);
      const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
      expect(r.say, JSON.stringify(over)).toContain('ISO_PRESERVED_DIRS');
      expect(r.say).not.toContain('ISO_IMAGE_REMOVED');
      expect(f.files.get(`${H}/image.id`)).toBe(`${IMG}\n`);
    }
  });
});

// A fake ChildProcess for makeExec: emits stdout, then 'close' with a code, or ignores signals as told.
function fakeProc(o: { out?: string; code?: number; ignore?: string[]; never?: boolean; delay?: number }) {
  const stdout = new EventEmitter();
  const p = Object.assign(new EventEmitter(), { stdout, killed: [] as string[], kill: (sig: string) => {
    p.killed.push(sig);
    if (o.never || (o.ignore ?? []).includes(sig)) return true;
    setTimeout(() => p.emit('close', null), 1);
    return true;
  } });
  if (!o.never && o.delay === undefined) setTimeout(() => { if (o.out) stdout.emit('data', Buffer.from(o.out)); p.emit('close', o.code ?? 0); }, 1);
  return p;
}

describe('le-iso bounded client exec (fake ChildProcess; no process is spawned)', () => {
  it('returns stdout on a clean exit', async () => {
    const r = await makeExec(() => fakeProc({ out: 'x\n' }) as never, { grace: 10 })('docker', ['ps'], { timeout: 50 });
    expect(r).toMatchObject({ ok: true, stdout: 'x\n', status: 0, timedOut: false });
  });
  it('escalates SIGTERM then SIGKILL on a client that ignores SIGTERM, and drops its output', async () => {
    const p = fakeProc({ delay: 1e9, ignore: ['SIGTERM'] });
    const r = await makeExec(() => p as never, { grace: 10 })('docker', ['start', '-a', CIDV], { timeout: 20 });
    expect(p.killed).toEqual(['SIGTERM', 'SIGKILL']);
    expect(r).toMatchObject({ ok: false, stdout: '', timedOut: true });
  });
  it('regains control within timeout + 2 * grace even if the client is never reaped', async () => {
    const p = fakeProc({ never: true });
    const t0 = Date.now();
    const r = await makeExec(() => p as never, { grace: 15 })('docker', ['start', '-a', CIDV], { timeout: 20 });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(p.killed).toEqual(['SIGTERM', 'SIGKILL']);
    expect(r).toMatchObject({ ok: false, timedOut: true, unreaped: true });
  });
  it('fails on output over the cap, a spawn throw, or a spawn error', async () => {
    const big = await makeExec(() => fakeProc({ out: 'y'.repeat(100) }) as never, { grace: 10 })('docker', ['x'], { timeout: 50, max: 10 });
    expect(big.ok).toBe(false);
    expect(await makeExec(() => { throw new Error('ENOENT'); }, { grace: 10 })('docker', [], { timeout: 50 })).toMatchObject({ ok: false });
    const e = new EventEmitter();
    setTimeout(() => e.emit('error', new Error('ENOENT')), 1);
    expect(await makeExec(() => Object.assign(e, { stdout: new EventEmitter(), kill: () => true }) as never, { grace: 10 })('docker', [], { timeout: 50 })).toMatchObject({ ok: false });
  });
  it('orchestrator: a docker start client that ignores SIGTERM is killed, the CID is kept, then stop/wait/rm run', async () => {
    const f = fake({ hangs: true }); // the fake daemon marks the container running when start is invoked
    const order: string[] = [];
    const spawnFn = (bin: string, args: string[]) => {
      order.push(args[0]);
      if (args[0] === 'start') { f.d.exec(bin, args); return fakeProc({ delay: 1e9, ignore: ['SIGTERM'] }); }
      const r = f.d.exec(bin, args) as { ok: boolean; stdout: string };
      return fakeProc({ out: r.stdout, code: r.ok ? 0 : 1 });
    };
    const d = { ...f.d, exec: makeExec(spawnFn as never, { grace: 5, clampMs: 30 }) };
    const r = await runProbe(d as never, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r.say).toContain('ISO_E_START_TIMEOUT');
    expect(r.say).toEqual(expect.arrayContaining(['ISO_STOP_OK', 'ISO_EXIT_OK', 'ISO_RM_OK', 'ISO_ABSENT']));
    const after = order.slice(order.indexOf('start'));
    expect(after.slice(0, 4)).toEqual(['start', 'stop', 'wait', 'container']);
    expect(r.ok).toBe(false);
  }, 2000);
});

describe('run 41718226106 follow-up (r4): observed sequence, created-never-started teardown, field names (fakes only)', () => {
  // Observed on the hosted runner at 81ae0073: INPUT_OK, IMAGE_OK, ENDPOINT_OK, CREATE_OK, E_CONFIG, E_STOP, E_EXIT_STATE,
  // E_ENDPOINT_CONNS, PRESERVED_IMAGE, PRESERVED_DIRS, INNER_FAIL. Reproduced here with a config drift on a container left
  // in the created state whose daemon refuses `stop`; r4 must not call stop/wait at all, verify the created state, remove it.
  const tmpfsDrift = () => { const b = goodInspect(); return { HostConfig: { ...b.HostConfig, Tmpfs: { '/tmp': 'rw' } } }; };
  it('reproduces the observed failure path and now tears it down with field-name-only diagnostics', async () => {
    const f = fake({ inspectOver: tmpfsDrift(), stopFails: true, final: '0 0\n' });
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    expect(r.say.filter((l) => !l.startsWith('ISO_DIAG '))).toEqual(['ISO_INPUT_OK', 'ISO_IMAGE_OK', 'ISO_ENDPOINT_OK', 'ISO_CREATE_OK', 'ISO_E_CONFIG', 'ISO_CONFIG_FIELD Tmpfs',
      'ISO_STOP_SKIPPED_NEVER_STARTED', 'ISO_CREATED_NEVER_STARTED', 'ISO_RM_OK', 'ISO_ABSENT', 'ISO_ENDPOINT_STOPPED',
      'ISO_IMAGE_REMOVED', 'ISO_DIRS_REMOVED', 'ISO_INNER_FAIL']);
    expect(r.ok).toBe(false);
    expect(f.calls.some((c) => ['start', 'stop', 'wait'].includes(c[1]))).toBe(false);
    expect(r.say.join('\n')).not.toMatch(/rw|\/tmp|sha256|[0-9a-f]{12}/);
  });
  it('a never-started container that the endpoint saw connections for fails CONNS (must be exactly 0)', async () => {
    const r = await run({ inspectOver: tmpfsDrift(), final: '1 0\n' });
    expect(r.say).toContain('ISO_E_ENDPOINT_CONNS');
    expect(r.say).toContain('ISO_DIRS_REMOVED'); // termination/absence gates still decide cleanup
  });
  it('a started container still needs >= 1 connection and none open', async () => {
    expect((await run({ final: '0 0\n' })).say).toContain('ISO_E_ENDPOINT_CONNS');
    expect((await run({ final: '3 1\n' })).say).toContain('ISO_E_ENDPOINT_CONNS');
    expect((await run({ final: '3 0\n' })).say).toContain('ISO_ENDPOINT_STOPPED');
  });
  it('an unverified created state is never removed: control and image preserved', async () => {
    for (const st of [{ ...CREATED_STATE, StartedAt: '2026-11-03T21:04:40Z' }, { ...CREATED_STATE, Status: 'exited' }, { ...CREATED_STATE, Pid: 5 }, { ...CREATED_STATE, Dead: true }]) {
      const f = fake({ inspectOver: tmpfsDrift(), createdState: st, final: '0 0\n' });
      const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
      expect(r.say, JSON.stringify(st)).toEqual(expect.arrayContaining(['ISO_E_EXIT_STATE', 'ISO_PRESERVED_IMAGE', 'ISO_PRESERVED_DIRS']));
      expect(f.calls.some((c) => c[1] === 'rm')).toBe(false);
      expect(f.files.get(`${H}/lane.cid`)).toBe(`${CIDV}\n`);
    }
  });
  it('createdNeverStarted accepts only the exact never-ran shape', () => {
    expect(createdNeverStarted({ State: CREATED_STATE })).toBe(true);
    for (const k of ['Running', 'Paused', 'Restarting', 'Dead']) expect(createdNeverStarted({ State: { ...CREATED_STATE, [k]: true } })).toBe(false);
    expect(createdNeverStarted({ State: { ...CREATED_STATE, StartedAt: undefined } })).toBe(false);
    expect(createdNeverStarted({})).toBe(false);
  });
  it('field names only: fixed list, de-duplicated, unknown names masked; inspect read failures named', async () => {
    expect(configFieldLines(['Tmpfs', 'Tmpfs', 'EffectiveMounts'])).toEqual(['ISO_CONFIG_FIELD Tmpfs', 'ISO_CONFIG_FIELD EffectiveMounts']);
    expect(configFieldLines(['/home/runner/secret'])).toEqual(['ISO_CONFIG_FIELD UNKNOWN']);
    const exp = expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT });
    const all = compareInspect({ Id: 'x', Mounts: 'bad', HostConfig: { Binds: 'bad', CapAdd: 'bad' }, Config: { Volumes: { a: 1 }, ExposedPorts: { b: 1 } } }, exp);
    for (const n of all) expect(CONFIG_FIELDS).toContain(n);
    expect((await run({ inspectFails: true })).say).toEqual(expect.arrayContaining(['ISO_E_CONFIG', 'ISO_CONFIG_FIELD INSPECT_EXEC']));
    expect((await run({ inspectGarbage: true })).say).toEqual(expect.arrayContaining(['ISO_E_CONFIG', 'ISO_CONFIG_FIELD INSPECT_PARSE']));
  });
  it('the config check itself is unchanged: any drift still refuses before start', async () => {
    const r = await run({ inspectOver: tmpfsDrift(), final: '0 0\n' });
    expect(r.calls.some((c) => c[1] === 'start')).toBe(false);
    expect(r.ok).toBe(false);
  });
  it('stop failures are told apart by fixed code (status, timeout, output)', async () => {
    const t = await run({ hangs: true, stopTimeout: true });
    expect(t.say).toContain('ISO_E_STOP_TIMEOUT');
    const o = await run({ stopOut: 'other\n' });
    expect(o.say).toContain('ISO_E_STOP_OUTPUT');
  });
  it('any unreaped client keeps every record, even when everything else reports clean', async () => {
    for (const on of ['rm', 'image', 'stop', 'create']) {
      const f = fake({ unreapedOn: on, final: on === 'create' ? '0 0\n' : '2 0\n' });
      const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
      expect(r.say, on).toEqual(expect.arrayContaining(['ISO_E_CLIENT_UNREAPED', 'ISO_PRESERVED_DIRS']));
      expect(r.say).not.toContain('ISO_DIRS_REMOVED');
      expect(f.dirs.has(H)).toBe(true);
    }
  });
  it('CodeQL alert 636 (js/useless-assignment-to-local, inner-probe.mjs SANDBOX branch): no dead initial value', () => {
    const inner = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/inner-probe.mjs'), 'utf8');
    expect(inner).not.toMatch(/let code = 'SANDBOX_E_LAUNCH'/);
    // r10 (REVIEW DIFF): the SANDBOX branch moved into gatedSandbox; still no dead initial value on either local.
    expect(inner).toMatch(/let SANDBOX; \/\/ CodeQL alert 636/);
    expect(inner).toMatch(/let label; \/\/ no dead initial value/);
    expect(inner).not.toMatch(/let (label|SANDBOX) = /);
  });
});

describe('le-iso container termination (fakes only)', () => {
  it('a timed-out run is stopped explicitly and bounded, then removed and proven absent', async () => {
    const r = await run({ hangs: true });
    expect(r.say).toContain('ISO_E_START');
    const order = r.calls.map((c) => c[1]).filter((x) => ['start', 'stop', 'wait', 'rm'].includes(x));
    expect(order).toEqual(['start', 'stop', 'wait', 'rm']);
    const stop = r.calls.find((c) => c[1] === 'stop');
    expect(stop).toEqual(['docker', 'stop', '-t', '10', CIDV]);
    expect(r.say).toEqual(expect.arrayContaining(['ISO_STOP_OK', 'ISO_EXIT_OK', 'ISO_RM_OK', 'ISO_ABSENT', 'ISO_DIRS_REMOVED']));
    expect(r.ok).toBe(false);
  });
  it('a container that cannot be stopped is never removed, and its run identity is preserved', async () => {
    const r = await run({ hangs: true, stopFails: true });
    expect(r.say).toEqual(expect.arrayContaining(['ISO_E_STOP_STATUS', 'ISO_E_WAIT', 'ISO_E_EXIT_STATE', 'ISO_PRESERVED_IMAGE', 'ISO_PRESERVED_DIRS']));
    expect(r.calls.some((c) => c[1] === 'rm')).toBe(false);
    expect(r.calls.some((c) => c[1] === 'image' && c[2] === 'rm')).toBe(false);
    for (const p of [H, S, O]) expect(r.dirs.has(p)).toBe(true);
    expect(r.files.get(`${H}/lane.cid`)).toBe(`${CIDV}\n`);
  });
  it('an undecided absence keeps the image and the run identity', async () => {
    const r = await run({ lsC: [false, ''] });
    expect(r.say).toEqual(expect.arrayContaining(['ISO_E_ABSENCE_UNDECIDED', 'ISO_PRESERVED_IMAGE', 'ISO_PRESERVED_DIRS']));
    expect(r.files.get(`${H}/lane.cid`)).toBe(`${CIDV}\n`);
  });
});

describe('le-iso image builder (stub fs: unknown methods are in-memory no-ops; nothing is written)', () => {
  it('builds past the Dockerfile with uid/gid in scope and checks the image user', async () => {
    const base: Record<string, unknown> = {
      existsSync: () => false,
      readdirSync: () => [{ name: 'chrome-headless-shell', isFile: () => true }],
      realpathSync: (p: string) => p,
      statSync: () => ({ mode: 0o755 }),
      readFileSync: (p: string) => (p.endsWith('image.id') ? `${IMG}\n` : Buffer.from('same')),
    };
    const fsStub = new Proxy(base, { get: (t, k: string) => t[k] ?? (() => undefined) });
    const calls: string[][] = [];
    const exec = (bin: string, args: string[]) => {
      calls.push([bin, ...args]);
      if (bin === 'ldd') return { ok: true, stdout: '\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f00)\n' };
      if (args[0] === 'build') return { ok: true, stdout: '' };
      if (args[0] === 'image') return { ok: true, stdout: JSON.stringify([{ Id: IMG, Os: 'linux', Config: { User: '1001:118' }, RootFS: { Layers: ['x'] } }]) };
      return { ok: false, stdout: '' };
    };
    const d = { exec, fs: fsStub, uid: () => 1001, gid: () => 118 };
    expect(await buildImage(d as never, { ctl: H, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH })).toEqual({ code: 'ISO_IMAGE_OK', id: IMG });
    expect(calls.find((c) => c[1] === 'build')).toEqual(expect.arrayContaining(['--pull=false', '--network', 'none']));
    const wrongUser = (bin: string, args: string[]) => (args[0] === 'image' ? { ok: true, stdout: JSON.stringify([{ Id: IMG, Os: 'linux', Config: { User: '0:0' }, RootFS: { Layers: ['x'] } }]) } : exec(bin, args));
    expect(await buildImage({ ...d, exec: wrongUser } as never, { ctl: H, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH })).toEqual({ code: 'ISO_E_IMAGE_CONFIG', id: IMG });
    // build reports failure but wrote a valid iidfile: the id is kept so the image can be removed.
    const buildFails = (bin: string, args: string[]) => (args[0] === 'build' ? { ok: false, stdout: '' } : exec(bin, args));
    expect(await buildImage({ ...d, exec: buildFails } as never, { ctl: H, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH })).toEqual({ code: 'ISO_E_IMAGE_BUILD', id: IMG });
    // build invoked, no readable id: identity unknown (null), never a plain "nothing was built" string.
    const noId = new Proxy({ ...base, readFileSync: (p: string) => { if (p.endsWith('image.id')) throw new Error('ENOENT'); return Buffer.from('same'); } }, { get: (t, k: string) => (t as Record<string, unknown>)[k] ?? (() => undefined) });
    expect(await buildImage({ ...d, fs: noId, exec: buildFails } as never, { ctl: H, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH })).toEqual({ code: 'ISO_E_IMAGE_BUILD', id: null });
  });
});

describe('le-iso sandbox check against the pinned Playwright API (fake chromium; no browser is launched)', () => {
  it('uses only API that playwright-core 1.59.1 types declare: Browser has no process(), BrowserServer does', () => {
    expectTypeOf<Browser>().not.toHaveProperty('process');
    expectTypeOf<BrowserServer>().toHaveProperty('process');
    expectTypeOf<BrowserServer>().toHaveProperty('wsEndpoint');
    expectTypeOf<BrowserType['launchServer']>().parameter(0).toMatchTypeOf<{ chromiumSandbox?: boolean; executablePath?: string; host?: string; port?: number } | undefined>();
    expectTypeOf<BrowserType['connect']>().toBeFunction();
    const ver = JSON.parse(readFileSync(path.join(ROOT, 'node_modules/playwright-core/package.json'), 'utf8')).version;
    expect(ver).toBe('1.59.1');
  });
  // A fake shaped like the real objects: the connected Browser deliberately has NO process().
  const fakeChromium = (o: { launchThrows?: boolean; argv?: string; body?: string } = {}) => {
    const seen: Record<string, unknown>[] = [];
    const closed: string[] = [];
    const chromium = {
      launchServer: async (opts: Record<string, unknown>) => {
        seen.push(opts);
        if (o.launchThrows) throw new Error('No usable sandbox!');
        return { process: () => ({ pid: 4321 }), wsEndpoint: () => 'ws://127.0.0.1:1/x', close: async () => { closed.push('server'); } };
      },
      connect: async (ws: string) => ({
        newPage: async () => ({ goto: async () => null, textContent: async () => `${o.body ?? 'n0nce'}\n` }),
        close: async () => { closed.push('browser'); },
      }),
    };
    const readCmdline = (pid: number) => { expect(pid).toBe(4321); return o.argv ?? '/s/chrome-headless-shell\0--headless\0--remote-debugging-pipe\0'; };
    return { chromium, seen, closed, readCmdline };
  };
  const args = (f: ReturnType<typeof fakeChromium>) => ({ shell: SHELL, url: 'http://127.0.0.1:54321/', nonce: 'n0nce', readCmdline: f.readCmdline });
  it('passes only with the sandbox requested ON, no --no-sandbox in the browser argv, and the nonce read back', async () => {
    const f = fakeChromium();
    expect(await sandboxCheck(f.chromium, args(f))).toBe('SANDBOX_ON_NONCE_MATCH');
    expect(f.seen[0]).toMatchObject({ executablePath: SHELL, chromiumSandbox: true, headless: true, host: '127.0.0.1' });
    expect(f.seen[0]).not.toHaveProperty('args');
    expect(f.seen[0]).not.toHaveProperty('ignoreDefaultArgs');
    expect(f.closed).toEqual(['browser', 'server']);
  });
  it('maps launch refusal, a --no-sandbox argv, an unreadable argv and a wrong body to fixed codes, closing what it opened', async () => {
    const a = fakeChromium({ launchThrows: true });
    expect(await sandboxCheck(a.chromium, args(a))).toBe('SANDBOX_E_LAUNCH_NO_USABLE_SANDBOX');
    const b = fakeChromium({ argv: '/s/chrome-headless-shell\0--no-sandbox\0' });
    expect(await sandboxCheck(b.chromium, args(b))).toBe('SANDBOX_E_FLAG');
    expect(b.closed).toEqual(['server']);
    const c = fakeChromium();
    expect(await sandboxCheck(c.chromium, { ...args(c), readCmdline: () => { throw new Error('EACCES'); } })).toBe('SANDBOX_E_FLAG');
    const e = fakeChromium({ body: 'other' });
    expect(await sandboxCheck(e.chromium, args(e))).toBe('SANDBOX_E_NONCE');
  });
  it('the inner probe output format is exactly what the host classifier accepts', () => {
    const all = Object.fromEntries(INNER_ORDER.map((t) => [t, INNER_TESTS[t].expected]));
    const enforce = { APPARMOR_LABEL: 'DOCKER_DEFAULT_ENFORCE' };
    expect(classifyInner(formatResults(all, enforce))).toMatchObject({ ok: true, pass: true });
    // r10 (REVIEW DIFF): the post-run label diagnostic must agree with the pre-launch APPARMOR gate.
    expect(classifyInner(formatResults(all))).toMatchObject({ ok: true, pass: false });
    const { SANDBOX, ...missing } = all;
    expect(classifyInner(formatResults(missing, enforce))).toMatchObject({ ok: true, pass: false, results: { SANDBOX: 'SANDBOX_E_LAUNCH' } });
  });
});

describe('le-iso r5 corrections for run 41724586201 (fakes only)', () => {
  const mi = (p: string, opts = 'rw') => `1 2 0:1 / ${p} ${opts} - x x rw`;
  const okPoints = ['/', IN.sock, IN.out, IN.tmp, REPO, '/proc', '/proc/kcore', '/sys', '/sys/firmware', '/dev', '/dev/shm', '/etc/hosts'];
  const withInit = (opts = 'ro,nosuid') => [...okPoints.map((p) => mi(p)), mi(INIT_PATH, opts)].join('\n');
  it('TMP: the tmpfs states mode 0700 and the probe uid:gid explicitly, in create AND in the inspect expectation', () => {
    expect(tmpfsSpec(1001, 118)).toBe('rw,nosuid,nodev,size=64m,mode=0700,uid=1001,gid=118');
    expect(() => tmpfsSpec(-1, 118)).toThrow(); expect(() => tmpfsSpec(1001, Number.NaN)).toThrow();
    const a = createArgs({ cidfile: '/c', imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH });
    expect(a[a.indexOf('--tmpfs') + 1]).toBe('/tmp:rw,nosuid,nodev,size=64m,mode=0700,uid=1001,gid=118');
    expect(a.filter((x) => x === '--tmpfs')).toHaveLength(1);
    expect(expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT }).Tmpfs).toEqual({ '/tmp': tmpfsSpec(1001, 118) });
    // every other security flag is still present, unchanged
    for (const f of ['--read-only', '--init']) expect(a).toContain(f);
    expect(a.slice(a.indexOf('--cap-drop'), a.indexOf('--cap-drop') + 2)).toEqual(['--cap-drop', 'ALL']);
    expect(a.slice(a.indexOf('--security-opt'), a.indexOf('--security-opt') + 2)).toEqual(['--security-opt', 'no-new-privileges']);
    expect(a.slice(a.indexOf('--network'), a.indexOf('--network') + 2)).toEqual(['--network', 'none']);
    expect(a).not.toContain('--cap-add'); expect(a).not.toContain('--privileged');
    expect(a.join(' ')).not.toMatch(/apparmor|unconfined|mode=1777/);
    // r10 (REVIEW DIFF): exactly two --security-opt pairs: no-new-privileges and the pinned profile path, nothing else.
    expect(securityOptArgs(a)).toEqual(['no-new-privileges', `seccomp=${SECCOMP_PATH}`]);
  });
  it('TMP: the in-container verdict requires 0700 owned by this uid:gid, then a write; errno is classed', () => {
    const dir = (mode: number, uid = process.getuid!(), gid = process.getgid!(), isDir = true) => ({ lstatSync: () => ({ isDirectory: () => isDir, mode, uid, gid }) });
    expect(tmpVerdict(dir(0o40700), '/tmp', () => 'ok')).toBe('TMP_WRITABLE');
    expect(tmpVerdict(dir(0o40755, 0, 0), '/tmp', () => 'ok')).toBe('TMP_E_MODE'); // the run-2 state: root-owned 0755
    expect(tmpVerdict(dir(0o41777), '/tmp', () => 'ok')).toBe('TMP_E_MODE');
    expect(tmpVerdict(dir(0o40700, process.getuid!() + 1), '/tmp', () => 'ok')).toBe('TMP_E_MODE');
    expect(tmpVerdict(dir(0o40700, undefined, undefined, false), '/tmp', () => 'ok')).toBe('TMP_E_MODE');
    expect(tmpVerdict(dir(0o40700), '/tmp', () => 'EACCES')).toBe('TMP_E_DENIED');
    expect(tmpVerdict(dir(0o40700), '/tmp', () => 'EROFS')).toBe('TMP_E_ROFS');
    expect(tmpVerdict(dir(0o40700), '/tmp', () => 'ENOSPC')).toBe('TMP_E_OTHER');
    expect(tmpVerdict({ lstatSync: () => { throw new Error('x'); } }, '/tmp', () => 'ok')).toBe('TMP_E_OTHER');
  });
  it('MOUNTS: the --init binary is accepted only at exactly /sbin/docker-init, read-only, and is required', () => {
    expect(mountsVerdict(withInit(), { repo: REPO })).toBe('MOUNTS_EXACT');
    expect(mountsVerdict(withInit('rw,nosuid'), { repo: REPO })).toBe('MOUNTS_E_INIT_RW');
    expect(mountsVerdict(okPoints.map((p) => mi(p)).join('\n'), { repo: REPO })).toBe('MOUNTS_E_MISSING');
    // a stray sbin mount beside the allowed init binary is still refused, by category
    expect(mountsVerdict(`${withInit()}\n${mi('/sbin/other-init', 'ro')}`, { repo: REPO })).toBe('MOUNTS_E_UNEXPECTED_SBIN');
  });
  it('MOUNTS: unexpected points are reported by closed category only, never by path, and MULTI when mixed', () => {
    const cat = (extra: string[]) => mountsVerdict(`${withInit()}\n${extra.map((p) => mi(p)).join('\n')}`, { repo: REPO });
    expect(cat(['/etc/passwd'])).toBe('MOUNTS_E_UNEXPECTED_ETC');
    expect(cat(['/dev/kmsg'])).toBe('MOUNTS_E_UNEXPECTED_DEV');
    expect(cat(['/sys/kernel/security'])).toBe('MOUNTS_E_UNEXPECTED_SYS');
    expect(cat([`${REPO}/node_modules`])).toBe('MOUNTS_E_UNEXPECTED_REPO');
    expect(cat(['/iso/other'])).toBe('MOUNTS_E_UNEXPECTED_ISO');
    expect(cat(['/tmp/x'])).toBe('MOUNTS_E_UNEXPECTED_TMP');
    expect(cat(['/usr/sbin/x'])).toBe('MOUNTS_E_UNEXPECTED_SBIN');
    expect(cat(['/var/run/docker.sock'])).toBe('MOUNTS_E_UNEXPECTED_OTHER');
    expect(cat(['/etc/passwd', '/var/run/docker.sock'])).toBe('MOUNTS_E_UNEXPECTED_MULTI');
    for (const c of ['ETC', 'DEV', 'SYS', 'REPO', 'ISO', 'TMP', 'SBIN', 'OTHER', 'MULTI']) expect(INNER_TESTS.MOUNTS.other).toContain(`MOUNTS_E_UNEXPECTED_${c}`);
  });
  it('STOP: uses -t (no deprecated --time), still requires exactly the run id, and classes a mismatch without printing it', async () => {
    const notice = `Flag --time has been deprecated, use --timeout instead\n${CIDV}\n`; // the source-predicted Docker 28 stdout for --time
    expect(stopOutputCategory(notice, CIDV)).toBe('ISO_STOP_OUTPUT_ID_PLUS_LINES');
    expect(stopOutputCategory('', CIDV)).toBe('ISO_STOP_OUTPUT_EMPTY');
    expect(stopOutputCategory('other\n', CIDV)).toBe('ISO_STOP_OUTPUT_OTHER');
    expect(stopOutputCategory(`${CIDV}\nextra\n`, CIDV)).toBe('ISO_STOP_OUTPUT_OTHER');
    const n = await run({ stopOut: notice });
    expect(n.say).toEqual(expect.arrayContaining(['ISO_E_STOP_OUTPUT', 'ISO_STOP_OUTPUT_ID_PLUS_LINES']));
    expect(n.say).not.toContain('ISO_STOP_OK');
    expect(n.say.join('\n')).not.toMatch(/deprecated|[0-9a-f]{64}/);
    expect(n.ok).toBe(false);
    const g = await run({});
    expect(g.calls.find((c) => c[1] === 'stop')).toEqual(['docker', 'stop', '-t', '10', CIDV]);
    expect(g.calls.some((c) => c.includes('--time'))).toBe(false);
    for (const code of ['ISO_STOP_OUTPUT_EMPTY', 'ISO_STOP_OUTPUT_ID_PLUS_LINES', 'ISO_STOP_OUTPUT_OTHER']) expect(HOST_CODES).toContain(code);
  });
  it('SANDBOX: launch errors are classed (tmpdir, no usable sandbox, timeout, other) and the sandbox stays requested ON', async () => {
    expect(launchErrorCode(Object.assign(new Error("EACCES: permission denied, mkdtemp '/tmp/playwright-artifacts-XXXXXX'"), { code: 'EACCES', syscall: 'mkdtemp' }))).toBe('SANDBOX_E_LAUNCH_TMPDIR');
    expect(launchErrorCode(new Error('browserType.launchServer: EACCES: permission denied, mkdtemp'))).toBe('SANDBOX_E_LAUNCH_TMPDIR');
    expect(launchErrorCode(new Error('Browser logs: [FATAL:zygote_host_impl_linux.cc] No usable sandbox! If you are running on Ubuntu'))).toBe('SANDBOX_E_LAUNCH_NO_USABLE_SANDBOX');
    expect(launchErrorCode(Object.assign(new Error('Timeout 30000ms exceeded'), { name: 'TimeoutError' }))).toBe('SANDBOX_E_LAUNCH_TIMEOUT');
    expect(launchErrorCode(new Error('something else'))).toBe('SANDBOX_E_LAUNCH');
    expect(launchErrorCode(undefined)).toBe('SANDBOX_E_LAUNCH');
    const inner = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/inner-probe.mjs'), 'utf8');
    expect(inner).toMatch(/chromiumSandbox: true/);
    expect(inner).not.toMatch(/--no-sandbox'\]|chromiumSandbox: false|--disable-setuid-sandbox|--disable-namespace-sandbox/);
  });
  it('SECCOMP: a new closed inner test sits right after ID, and every inner code stays inside its closed list', () => {
    expect(INNER_ORDER.slice(0, 2)).toEqual(['ID', 'SECCOMP']);
    expect(INNER_TESTS.SECCOMP).toEqual({ expected: 'SECCOMP_FILTER', other: ['SECCOMP_E_NONE', 'SECCOMP_E_READ'] });
    const all = Object.fromEntries(INNER_ORDER.map((t) => [t, INNER_TESTS[t].expected]));
    expect(classifyInner(formatResults({ ...all, TMP: 'TMP_E_MODE', MOUNTS: 'MOUNTS_E_UNEXPECTED_SBIN', SANDBOX: 'SANDBOX_E_LAUNCH_TMPDIR' })))
      .toMatchObject({ ok: true, pass: false });
    expect(classifyInner(formatResults({ ...all, MOUNTS: 'MOUNTS_E_UNEXPECTED' }))).toEqual({ ok: false }); // r4 generic code retired
  });
});

describe('le-iso r6: Binds order from the docker CLI is not significant (fakes only)', () => {
  const exp = () => expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT });
  const withBinds = (b: unknown) => { const g = goodInspect(); return { ...g, HostConfig: { ...g.HostConfig, Binds: b } }; };
  it('every permutation of the exact three binds passes; the run-3 shape (reordered binds) no longer refuses', () => {
    const [a, b, c] = exp().Binds;
    for (const p of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]) expect(compareInspect(withBinds(p), exp())).toEqual([]);
  });
  it('a changed, missing, extra, duplicated or absent bind still refuses as Binds', () => {
    const [a, b, c] = exp().Binds;
    for (const bad of [[a, b, c.replace(':rw,', ':ro,')], [a, b], [a, b, c, `${TEMP}/x:/x:ro,rprivate`], [a, a, c], [a, b, `${c} `], null, 'x'])
      expect(compareInspect(withBinds(bad), exp())).toContain('Binds');
  });
  it('the expectation itself is not mutated by the sorted comparison', () => {
    const e = exp(); const before = [...e.Binds];
    compareInspect(withBinds([...e.Binds].reverse()), e);
    expect(e.Binds).toEqual(before);
  });
});

describe('le-iso r7: sandbox launch-constraint diagnostics (read-only, fixed codes; fakes only)', () => {
  it('host diagnostic lines print only a closed code or a plain version, never other text', () => {
    expect(hostDiagLine('DOCKER_SERVER', '28.0.4')).toBe('ISO_DIAG DOCKER_SERVER 28.0.4');
    expect(hostDiagLine('KERNEL', '6.8')).toBe('ISO_DIAG KERNEL 6.8');
    for (const bad of ['28.0.4-ce', '28.0.4\nX', '/etc/passwd', '', undefined, null, 'v1.2.5'])
      expect(hostDiagLine('RUNC', bad as string)).toBe('ISO_DIAG RUNC UNKNOWN');
    expect(hostDiagLine('DAEMON_SECCOMP', 'BUILTIN')).toBe('ISO_DIAG DAEMON_SECCOMP BUILTIN');
    expect(hostDiagLine('DAEMON_SECCOMP', 'profile=/x')).toBe('ISO_DIAG DAEMON_SECCOMP UNKNOWN');
    expect(hostDiagLine('NOPE', 'ON')).toBe('ISO_DIAG UNKNOWN UNKNOWN');
    expect(HOST_DIAG_ORDER).toEqual(Object.keys(HOST_DIAG));
  });
  it('daemon security options, sysctls and AppArmor labels map to closed codes', () => {
    expect(daemonSecurity(['name=apparmor', 'name=seccomp,profile=builtin', 'name=cgroupns'])).toEqual({ seccomp: 'BUILTIN', apparmor: 'PRESENT' });
    expect(daemonSecurity(['name=seccomp,profile=unconfined'])).toEqual({ seccomp: 'UNCONFINED', apparmor: 'ABSENT' });
    expect(daemonSecurity(['name=seccomp,profile=/etc/x.json'])).toEqual({ seccomp: 'CUSTOM', apparmor: 'ABSENT' });
    expect(daemonSecurity([])).toEqual({ seccomp: 'ABSENT', apparmor: 'ABSENT' });
    expect(daemonSecurity(null)).toEqual({ seccomp: 'UNKNOWN', apparmor: 'UNKNOWN' });
    expect(sysctlClass('0\n', 'count')).toBe('ZERO'); expect(sysctlClass('63229\n', 'count')).toBe('POSITIVE');
    expect(sysctlClass('1\n', 'switch')).toBe('ON'); expect(sysctlClass('0', 'switch')).toBe('OFF');
    expect(sysctlClass('2', 'switch')).toBe('UNKNOWN'); expect(sysctlClass('x', 'count')).toBe('UNKNOWN'); expect(sysctlClass(null as unknown as string, 'count')).toBe('UNKNOWN');
    expect(apparmorLabel('docker-default (enforce)\n')).toBe('DOCKER_DEFAULT_ENFORCE');
    expect(apparmorLabel('docker-default (complain)')).toBe('DOCKER_DEFAULT_OTHER');
    expect(apparmorLabel('unconfined')).toBe('UNCONFINED');
    expect(apparmorLabel('my-profile (enforce)')).toBe('OTHER');
    expect(apparmorLabel(null as unknown as string)).toBe('UNKNOWN');
  });
  it('the in-container diagnostics read only the three files and reduce them to codes', () => {
    const files: Record<string, string> = { '/proc/self/status': 'Seccomp:\t2\nSeccomp_filters:\t1\n', '/proc/self/attr/apparmor/current': 'docker-default (enforce)\n', '/proc/sys/user/max_user_namespaces': '63229\n' };
    const seen: string[] = [];
    const rd = (p: string) => { seen.push(p); if (!(p in files)) throw new Error('ENOENT'); return files[p]; };
    expect(innerDiag(rd)).toEqual({ SECCOMP_FILTERS: 'ONE', APPARMOR_LABEL: 'DOCKER_DEFAULT_ENFORCE', MAX_USERNS: 'POSITIVE' });
    expect(new Set(seen)).toEqual(new Set(Object.keys(files)));
    expect(innerDiag(() => { throw new Error('x'); })).toEqual({ SECCOMP_FILTERS: 'UNKNOWN', APPARMOR_LABEL: 'UNKNOWN', MAX_USERNS: 'UNKNOWN' });
  });
  it('inner diagnostic lines are strictly classified and never change pass, except the r10 APPARMOR_LABEL agreement', () => {
    const all = Object.fromEntries(INNER_ORDER.map((t) => [t, INNER_TESTS[t].expected]));
    const ok = classifyInner(formatResults(all, { SECCOMP_FILTERS: 'MANY', APPARMOR_LABEL: 'DOCKER_DEFAULT_ENFORCE', MAX_USERNS: 'ZERO' }));
    expect(ok).toMatchObject({ ok: true, pass: true, diag: { SECCOMP_FILTERS: 'MANY', APPARMOR_LABEL: 'DOCKER_DEFAULT_ENFORCE', MAX_USERNS: 'ZERO' } });
    // r10 (REVIEW DIFF): an UNCONFINED (or any non-enforce) label no longer passes, even with every test line expected.
    for (const lbl of ['UNCONFINED', 'DOCKER_DEFAULT_OTHER', 'OTHER', 'UNKNOWN'])
      expect(classifyInner(formatResults(all, { APPARMOR_LABEL: lbl })), lbl).toMatchObject({ ok: true, pass: false });
    expect(formatResults(all, { MAX_USERNS: 'lots' })).toContain('LE-ISO-DIAG MAX_USERNS UNKNOWN');
    expect(classifyInner(passLines().replace('LE-ISO-DIAG MAX_USERNS UNKNOWN', 'LE-ISO-DIAG MAX_USERNS 12'))).toEqual({ ok: false });
    expect(classifyInner(passLines().replace('LE-ISO-DIAG MAX_USERNS UNKNOWN\n', ''))).toEqual({ ok: false });
    for (const k of INNER_DIAG_ORDER) expect(INNER_DIAG[k]).toContain('UNKNOWN');
  });
  it('the orchestrator adds only read-only docker queries; create flags and teardown are unchanged', async () => {
    const r = await run();
    const extra = r.calls.filter((c) => c[0] === 'docker' && ['version', 'info'].includes(c[1]));
    expect(extra).toEqual([['docker', 'version', '--format', '{{json .}}'], ['docker', 'info', '--format', '{{json .SecurityOptions}}']]);
    expect(r.say.filter((l) => l.startsWith('ISO_DIAG ')).map((l) => l.split(' ')[1])).toEqual([...HOST_DIAG_ORDER]);
    expect(r.say.filter((l) => l.startsWith('LE-ISO-DIAG ')).map((l) => l.split(' ')[1])).toEqual([...INNER_DIAG_ORDER]);
    expect(r.ok).toBe(true);
    const a = createArgs({ cidfile: '/c', imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, node: NODE, shell: SHELL, seccompPath: SECCOMP_PATH });
    expect(a.join(' ')).not.toMatch(/apparmor|unconfined|--cap-add|--privileged|userns/);
    expect(securityOptArgs(a)).toEqual(['no-new-privileges', `seccomp=${SECCOMP_PATH}`]);
    const inner = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/inner-probe.mjs'), 'utf8');
    expect(inner).toMatch(/chromiumSandbox: true/);
  });

  // r8: direct hostDiag tests. The orchestrator fake answers version/info with ok:false, so parsing is covered here.
  const VERSION_JSON = JSON.stringify({ Client: { Version: '28.0.4', ApiVersion: '1.48', GoVersion: 'go1.23.7', Os: 'linux', Arch: 'amd64' },
    Server: { Platform: { Name: 'Docker Engine - Community' }, Version: '28.0.4', Components: [
      { Name: 'Engine', Version: '28.0.4', Details: { ApiVersion: '1.48' } }, { Name: 'containerd', Version: 'v1.7.27' },
      { Name: 'runc', Version: '1.2.5', Details: { GitCommit: 'v1.2.5-0-g59923ef' } }, { Name: 'docker-init', Version: '0.19.0' }] } });
  const INFO_JSON = JSON.stringify(['name=apparmor', 'name=seccomp,profile=builtin', 'name=cgroupns']);
  const HOST_FILES: Record<string, string> = { '/proc/sys/kernel/osrelease': '6.8.0-1036-azure\n', '/proc/sys/user/max_user_namespaces': '63229\n',
    '/proc/sys/kernel/apparmor_restrict_unprivileged_userns': '1\n' };
  type Ans = { ok: boolean; stdout: unknown; unreaped?: boolean } | Error;
  const hd = (o: { version?: Ans; info?: Ans; files?: Record<string, string>; stat?: string | null; readErr?: string } = {}) => {
    const calls: string[][] = []; const statted: string[] = [];
    const x = async (bin: string, args: string[]) => {
      calls.push([bin, ...args]);
      const a = args[0] === 'version' ? (o.version ?? { ok: true, stdout: VERSION_JSON }) : args[0] === 'info' ? (o.info ?? { ok: true, stdout: INFO_JSON }) : { ok: false, stdout: '' };
      if (a instanceof Error) throw a;
      return a;
    };
    const files = o.files ?? HOST_FILES;
    const err = (code: string) => Object.assign(new Error(code), { code });
    const fsx = {
      readFileSync: (p: string) => { if (o.readErr) throw err(o.readErr); if (!(p in files)) throw err('ENOENT'); return files[p]; },
      statSync: (p: string) => { statted.push(p); if (o.stat === undefined) return {}; throw err(o.stat ?? 'ENOENT'); },
    };
    return hostDiag({}, x, fsx, SHELL).then((r: Record<string, string>) => ({ r, calls, statted, lines: HOST_DIAG_ORDER.map((k) => hostDiagLine(k, r[k])) }));
  };
  it('r8 hostDiag parses real-shaped docker version/info output', async () => {
    const { r, calls, statted, lines } = await hd();
    expect(calls).toEqual([['docker', 'version', '--format', '{{json .}}'], ['docker', 'info', '--format', '{{json .SecurityOptions}}']]);
    expect(r).toMatchObject({ DOCKER_CLIENT: '28.0.4', DOCKER_SERVER: '28.0.4', RUNC: '1.2.5', KERNEL: '6.8', DAEMON_SECCOMP: 'BUILTIN', DAEMON_APPARMOR: 'PRESENT',
      HOST_MAX_USERNS: 'POSITIVE', HOST_AA_RESTRICT_USERNS: 'ON', HOST_USERNS_CLONE: 'ABSENT', CHROME_SANDBOX_FILE: 'EXISTS', CONTAINER_APPARMOR: 'UNKNOWN' });
    expect(statted).toEqual([path.join(path.dirname(SHELL), 'chrome-sandbox')]);
    expect(lines).toContain('ISO_DIAG RUNC 1.2.5');
    const v = JSON.parse(VERSION_JSON); v.Server.Components[2].Version = 'v1.2.5';
    expect((await hd({ version: { ok: true, stdout: JSON.stringify(v) } })).r.RUNC).toBe('1.2.5');
  });
  it('r8 hostDiag maps malformed values to UNKNOWN without throwing', async () => {
    const shapes: unknown[] = [
      { Client: { Version: 28 }, Server: { Version: ['28.0.4'], Components: [{ Name: 'runc', Version: 125 }] } },
      { Client: null, Server: { Components: [{ Name: 'runc', Version: { v: '1.2.5' } }] } },
      { Server: { Components: 'runc' } }, { Server: { Components: [null, 7, { Name: 'runc' }] } }, null, 42, 'x'];
    for (const s of shapes) {
      const { r, lines } = await hd({ version: { ok: true, stdout: JSON.stringify(s) } });
      expect([r.DOCKER_CLIENT, r.DOCKER_SERVER, r.RUNC], JSON.stringify(s)).toEqual(['UNKNOWN', 'UNKNOWN', 'UNKNOWN']);
      expect(lines.filter((l) => / (DOCKER_CLIENT|DOCKER_SERVER|RUNC) /.test(l)).every((l) => l.endsWith(' UNKNOWN'))).toBe(true);
    }
    for (const stdout of ['not json', '', 17, null, undefined])
      expect((await hd({ version: { ok: true, stdout }, info: { ok: true, stdout } })).r).toMatchObject({ DOCKER_CLIENT: 'UNKNOWN', RUNC: 'UNKNOWN', DAEMON_SECCOMP: 'UNKNOWN', DAEMON_APPARMOR: 'UNKNOWN' });
    for (const info of [{}, 'name=seccomp', [7, null]]) expect((await hd({ info: { ok: true, stdout: JSON.stringify(info) } })).r.DAEMON_SECCOMP).not.toBe('BUILTIN');
    const crlf = JSON.parse(VERSION_JSON); crlf.Client.Version = '28.0.4\n'; crlf.Server.Version = '28.0.4\r'; crlf.Server.Components[2].Version = '1.2.5\r\n';
    expect((await hd({ version: { ok: true, stdout: JSON.stringify(crlf) } })).lines.filter((l) => / (DOCKER_CLIENT|DOCKER_SERVER|RUNC) /.test(l)))
      .toEqual(['ISO_DIAG DOCKER_CLIENT UNKNOWN', 'ISO_DIAG DOCKER_SERVER UNKNOWN', 'ISO_DIAG RUNC UNKNOWN']);
    for (const v of ['28.0.4\n', '28.0.4\r', '\n28.0.4', '28.0\r\n.4']) expect(hostDiagLine('DOCKER_CLIENT', v)).toBe('ISO_DIAG DOCKER_CLIENT UNKNOWN');
  });
  it('r8 hostDiag: rejected and failed calls give UNKNOWN and the other keys are still read', async () => {
    for (const a of [new Error('spawn EACCES'), { ok: false, stdout: VERSION_JSON }]) {
      const { r } = await hd({ version: a, info: a });
      expect(r).toMatchObject({ DOCKER_CLIENT: 'UNKNOWN', DOCKER_SERVER: 'UNKNOWN', RUNC: 'UNKNOWN', DAEMON_SECCOMP: 'UNKNOWN', DAEMON_APPARMOR: 'UNKNOWN', KERNEL: '6.8', CHROME_SANDBOX_FILE: 'EXISTS' });
    }
  });
  it('r8 chrome-sandbox: existence only; ENOENT is ABSENT, permission and other errors stay UNKNOWN', async () => {
    expect((await hd({ stat: 'ENOENT' })).r.CHROME_SANDBOX_FILE).toBe('ABSENT');
    for (const e of ['EACCES', 'EPERM', 'ELOOP', 'EIO', null]) expect((await hd({ stat: e })).r.CHROME_SANDBOX_FILE, String(e)).toBe(e === null ? 'ABSENT' : 'UNKNOWN');
    expect((await hd({ readErr: 'EACCES' })).r).toMatchObject({ KERNEL: 'UNKNOWN', HOST_MAX_USERNS: 'UNKNOWN', HOST_AA_RESTRICT_USERNS: 'UNKNOWN', HOST_USERNS_CLONE: 'UNKNOWN' });
    expect(HOST_DIAG).not.toHaveProperty('SUID_HELPER');
    expect(HOST_DIAG.CHROME_SANDBOX_FILE).toEqual(['EXISTS', 'ABSENT', 'UNKNOWN']);
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/run-probe.mjs'), 'utf8');
    expect(src).not.toMatch(/chrome_sandbox/);
  });
  it('r8 an unreaped diagnostic client still marks the run UNRESOLVED and preserves evidence', async () => {
    for (const on of ['version', 'info']) {
      const f = fake({ unreapedOn: on });
      const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
      expect(r.ok, on).toBe(false);
      expect(r.say).toEqual(expect.arrayContaining(['ISO_E_CLIENT_UNREAPED', 'ISO_PRESERVED_DIRS', 'ISO_DIAG DOCKER_CLIENT UNKNOWN']));
      expect(r.say).not.toContain('ISO_DIRS_REMOVED');
      expect(f.dirs.has(H)).toBe(true);
    }
  });
  it('r8 rejected diagnostic calls inside runProbe leave the verdict and full teardown unchanged', async () => {
    const f = fake(); const base = f.d.exec;
    f.d.exec = ((bin: string, args: string[]) => { if (args[0] === 'version' || args[0] === 'info') throw new Error('boom'); return base(bin, args); }) as typeof base;
    const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
    const g = await run();
    expect(r.ok).toBe(true);
    expect(r.say.filter((l) => !l.startsWith('ISO_DIAG '))).toEqual(g.say.filter((l) => !l.startsWith('ISO_DIAG ')));
    expect(r.say).toEqual(expect.arrayContaining(['ISO_DIRS_REMOVED', 'ISO_IMAGE_REMOVED', 'ISO_DIAG RUNC UNKNOWN']));
  });
});

describe('r10 seccomp profile (REVIEW DIFF, unapplied)', () => {
  const DIR = path.join(ROOT, 'scripts/e2e/le-iso/seccomp');
  const UP = readFileSync(path.join(DIR, 'moby-28.0.4-default.json'));
  const DELTA = readFileSync(path.join(DIR, 'chromium147-delta.json'), 'utf8');
  const h = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
  const code = (f: () => unknown) => { try { f(); return 'NO_THROW'; } catch (e) { return (e as { code?: string }).code ?? 'OTHER'; } };
  const withDelta = (mut: (d: Record<string, unknown>[]) => unknown) => { const d = JSON.parse(DELTA); const r = mut(d); return JSON.stringify(r === undefined ? d : r); };

  it('the strict builder reproduces the committed profile byte for byte, and every hash is pinned', () => {
    expect(h(UP)).toBe(UPSTREAM_SHA256);
    expect(buildProfile(UP, DELTA)).toBe(PROFILE_TEXT);
    expect(h(PROFILE_RAW)).toBe(SECCOMP_RAW_SHA256);
    expect(OUTPUT_SHA256).toBe(SECCOMP_RAW_SHA256);
    expect(h(goCompact(PROFILE_TEXT) as string)).toBe(SECCOMP_COMPACT_SHA256);
    expect(SECCOMP_COMPACT_SHA256).toBe('f4c8fb3319aacc114816cabaf1707fb11bf2892907bd092fd4c26d794890a198');
    const out = JSON.parse(PROFILE_TEXT), up = JSON.parse(UP.toString('utf8'));
    expect(out.syscalls.slice(0, up.syscalls.length)).toEqual(up.syscalls);
    expect(out.syscalls).toHaveLength(up.syscalls.length + 5);
    expect({ ...out, syscalls: [] }).toEqual({ ...up, syscalls: [] });
  });
  it('the delta values are Chromium 147 flag constants, and nothing else is opened', () => {
    expect(DELTA_SPEC.map((r) => [r.name, r.value === null ? null : r.value.toString(16), r.exclCap])).toEqual([
      ['clone', '10000011', 'CAP_SYS_ADMIN'], ['clone', '70000011', 'CAP_SYS_ADMIN'], ['clone', '20000011', 'CAP_SYS_ADMIN'],
      ['unshare', '10000000', 'CAP_SYS_ADMIN'], ['chroot', null, 'CAP_SYS_CHROOT']]);
    const names = JSON.parse(DELTA).flatMap((r: { names: string[] }) => r.names);
    for (const n of ['setns', 'clone3', 'mount', 'umount2', 'pivot_root', 'io_uring_setup', 'bpf', 'keyctl', 'ptrace']) expect(names).not.toContain(n);
    expect(DELTA).not.toMatch(/MASKED_EQ|SCMP_CMP_(NE|LT|LE|GT|GE)|SCMP_ACT_(LOG|TRACE|NOTIFY|ERRNO)|unconfined/);
  });
  it('adversarial builder mutations each fail closed with a fixed code', () => {
    const up2 = Buffer.from(UP); up2[up2.length - 2] ^= 1;
    expect(code(() => buildProfile(up2, DELTA))).toBe('PROFILE_E_UPSTREAM');
    const cases: [string, string][] = [
      ['PROFILE_E_DELTA', '[]'], ['PROFILE_E_DELTA', 'not json'], ['PROFILE_E_DELTA', '{}'],
      ['PROFILE_E_DELTA', withDelta((d) => d.slice(0, 4))],
      ['PROFILE_E_DELTA', withDelta((d) => [...d, d[0]])],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => [d[0], d[1], d[2], d[3], d[0]])],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => [d[1], d[0], d[2], d[3], d[4]])],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { (d[0].args as { value: number }[])[0].value = 0x10020011; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { (d[1].args as { op: string }[])[0].op = 'SCMP_CMP_MASKED_EQ'; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { (d[2].args as { valueTwo: number }[])[0].valueTwo = 1; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { (d[3].args as { index: number }[])[0].index = 1; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { (d[0].args as unknown[]).push({ index: 1, value: 0, valueTwo: 0, op: 'SCMP_CMP_EQ' }); })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[4].args = [{ index: 0, value: 0, valueTwo: 0, op: 'SCMP_CMP_EQ' }]; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[0].errnoRet = 1; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { delete d[0].excludes; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[4].excludes = { caps: ['CAP_SYS_ADMIN'] }; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[0].includes = { arches: ['amd64', 's390x'] }; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[0].names = ['clone', 'setns']; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[3].names = ['setns']; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[0].action = 'SCMP_ACT_LOG'; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[0].comment = 'anything'; })],
      ['PROFILE_E_DELTA_RULE', withDelta((d) => { d[2] = null as unknown as Record<string, unknown>; })],
      // A shape-valid change still fails on the pinned output hash.
      ['PROFILE_E_OUTPUT', withDelta((d) => { d[0].comment = `${d[0].comment} (edited)`; })],
    ];
    for (const [want, delta] of cases) expect(code(() => buildProfile(UP, delta)), delta.slice(0, 80)).toBe(want);
  });
  it('goCompact follows Go json.Compact (whitespace outside strings only) and rejects non-JSON', () => {
    expect(goCompact('{ "a" : [1, 2],\n\t"b c": "x \\" y" }\r\n')).toBe('{"a":[1,2],"b c":"x \\" y"}');
    expect(goCompact('{"a":1} {"b":2}')).toBeNull();
    expect(goCompact('')).toBeNull();
    expect(goCompact(null as unknown as string)).toBeNull();
  });
  it('hasDuplicateKeys finds repeats JSON.parse would hide, at any depth and after unescaping', () => {
    expect(hasDuplicateKeys(PROFILE_TEXT)).toBe(false);
    expect(hasDuplicateKeys('{"a":1,"a":2}')).toBe(true);
    expect(hasDuplicateKeys('{"x":[{"a":1,"b":{"c":1,"c":1}}]}')).toBe(true);
    expect(hasDuplicateKeys('{"a":1,"\\u0061":2}')).toBe(true);
    expect(hasDuplicateKeys('{"a":1,')).toBeNull();
    expect(hasDuplicateKeys('[1,2,{"a":"}"}]')).toBe(false);
  });
  it('inspect contract: exactly the compacted profile once plus no-new-privileges, nothing extra, no variant', () => {
    const exp = expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, seccompText: PROFILE_TEXT });
    const C = `seccomp=${goCompact(PROFILE_TEXT)}`;
    const with_ = (so: unknown) => compareInspect(goodInspect({ HostConfig: { ...goodInspect().HostConfig, SecurityOpt: so } }), exp);
    expect(exp.SecurityOpt).toEqual(['no-new-privileges', C]);
    expect(with_(['no-new-privileges', C])).toEqual([]);
    expect(with_([C, 'no-new-privileges'])).toEqual([]);
    const reordered = (() => { const o = JSON.parse(PROFILE_TEXT); return `seccomp=${JSON.stringify({ syscalls: o.syscalls, archMap: o.archMap, defaultErrnoRet: o.defaultErrnoRet, defaultAction: o.defaultAction })}`; })();
    const dupKey = C.replace('"defaultAction":"SCMP_ACT_ERRNO"', '"defaultAction":"SCMP_ACT_ALLOW","defaultAction":"SCMP_ACT_ERRNO"');
    const oneLess = (() => { const o = JSON.parse(PROFILE_TEXT); o.syscalls.pop(); return `seccomp=${JSON.stringify(o)}`; })();
    for (const bad of [
      ['no-new-privileges', `seccomp=${PROFILE_TEXT}`], // not compacted
      ['no-new-privileges', reordered], ['no-new-privileges', dupKey], ['no-new-privileges', oneLess],
      ['no-new-privileges', C, 'label=disable'], ['no-new-privileges', C, C], ['no-new-privileges', 'no-new-privileges', C],
      ['no-new-privileges'], [C], ['no-new-privileges', 'seccomp=unconfined'], ['no-new-privileges', 'seccomp=null'],
      ['no-new-privileges', 7], null, 'no-new-privileges', [],
    ]) expect(with_(bad), JSON.stringify(bad).slice(0, 60)).toEqual(['SecurityOpt']);
    expect(securityOptOk(exp.SecurityOpt, ['no-new-privileges', 'seccomp=null'])).toBe(false);
    expect(securityOptOk(undefined as unknown as string[], exp.SecurityOpt)).toBe(false);
  });
  it('a profile that is not the reviewed bytes stops the run before build or create; owned dirs are cleaned', async () => {
    for (const profile of [Buffer.concat([PROFILE_RAW, Buffer.from(' ')]), Buffer.from('{}')]) {
      let built = false;
      const f = fake({ profile });
      f.d.buildImage = () => { built = true; return { code: 'ISO_IMAGE_OK', id: IMG }; };
      const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
      expect(r.ok).toBe(false);
      expect(r.say).toContain('ISO_E_PROFILE');
      expect(built).toBe(false);
      expect(f.calls.some((c) => c[1] === 'create' || c[1] === 'build')).toBe(false);
      expect(r.say).toEqual(expect.arrayContaining(['ISO_DIRS_REMOVED', 'ISO_INNER_FAIL']));
      expect(f.dirs.has(H)).toBe(false);
    }
    const g = fake(); g.files.delete(SECCOMP_PATH);
    expect((await runProbe(g.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP })).say).toContain('ISO_E_PROFILE');
  });
  it('create passes the pinned path; the run passes only with the compacted profile in inspect', async () => {
    const r = await run();
    const create = r.calls.find((c) => c[1] === 'create') as string[];
    expect(securityOptArgs(create.slice(1))).toEqual(['no-new-privileges', `seccomp=${SECCOMP_PATH}`]);
    expect(r.ok).toBe(true);
    const bad = await run({ inspectOver: { HostConfig: { ...goodInspect().HostConfig, SecurityOpt: ['no-new-privileges'] } } });
    expect(bad.say).toEqual(expect.arrayContaining(['ISO_E_CONFIG', 'ISO_CONFIG_FIELD SecurityOpt']));
  });
});

describe('r10 early runner preflight (REVIEW DIFF, unapplied)', () => {
  const good = () => ({ ...PINS, PROFILE: true } as Record<string, unknown>);
  it('all pins pass; any single drift or unknown fails with that fixed code only', () => {
    expect(evaluate(good())).toEqual({ ok: true, lines: [...CHECK_ORDER.map((k) => `PRE_${k} OK`), 'PRE_OK'] });
    for (const k of CHECK_ORDER) {
      for (const v of k === 'PROFILE' ? [false, undefined, 'true'] : ['drifted', undefined, 'UNKNOWN', `${PINS[k as keyof typeof PINS]}\n`]) {
        const f = good(); f[k] = v;
        const r = evaluate(f);
        expect(r.ok, `${k}=${String(v)}`).toBe(false);
        expect(r.lines.filter((l) => l.startsWith('PRE_E_'))).toEqual([`PRE_E_${k}`]);
        expect(r.lines.at(-1)).toBe('PRE_FAIL');
      }
    }
    expect(Object.values(PINS)).not.toContain('UNKNOWN');
  });
  const SERVER = { Version: '28.0.4', Os: 'linux', Arch: 'amd64', Components: [{ Name: 'Engine', Version: '28.0.4' }, { Name: 'runc', Version: '1.5.2' }] };
  const VERSION = JSON.stringify({ Client: { Version: '28.0.4' }, Server: SERVER });
  const INFO = JSON.stringify(['name=apparmor', 'name=seccomp,profile=builtin', 'name=cgroupns']);
  const LOCK = (o: Record<string, string> = {}) => JSON.stringify({ packages: Object.fromEntries(['@playwright/test', 'playwright', 'playwright-core'].map((n) => [`node_modules/${n}`, { version: o[n] ?? '1.59.1' }])) });
  const fsFor = (over: Record<string, string | Buffer | Error> = {}) => {
    const dir = path.join(ROOT, 'scripts/e2e/le-iso/seccomp');
    const files: Record<string, string | Buffer | Error> = {
      '/proc/sys/kernel/osrelease': '7.0.0-1009-azure\n', '/proc/sys/user/max_user_namespaces': '63229\n',
      '/proc/sys/kernel/apparmor_restrict_unprivileged_userns': '1\n', '/proc/sys/kernel/unprivileged_userns_clone': '1\n',
      [`${REPO}/package-lock.json`]: LOCK(),
      [SECCOMP_PATH]: PROFILE_RAW,
      [`${REPO}/scripts/e2e/le-iso/seccomp/moby-28.0.4-default.json`]: readFileSync(path.join(dir, 'moby-28.0.4-default.json')),
      [`${REPO}/scripts/e2e/le-iso/seccomp/chromium147-delta.json`]: readFileSync(path.join(dir, 'chromium147-delta.json')),
      ...over };
    return { readFileSync: (p: string, enc?: string) => { const v = files[p]; if (v === undefined) throw Object.assign(new Error('x'), { code: 'ENOENT' }); if (v instanceof Error) throw v; return enc && Buffer.isBuffer(v) ? v.toString(enc as BufferEncoding) : v; },
      statSync: () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }); } };
  };
  const exec = (ans: Record<string, unknown> = {}) => async (_b: string, args: string[]) => {
    const server = args[0] === 'version' && args[2] === '{{json .Server}}';
    const a = server ? (ans.server ?? { ok: true, stdout: JSON.stringify(SERVER) }) : (ans[args[0]] ?? { ok: true, stdout: args[0] === 'version' ? VERSION : INFO });
    if (a instanceof Error) throw a;
    return a;
  };
  const env = { ImageOS: 'ubuntu24' };
  it('gather reads real-shaped facts and passes on the reviewed runner', async () => {
    const f = await gather({ exec: exec(), fsx: fsFor(), env, arch: 'x64', repo: REPO });
    expect(evaluate(f)).toMatchObject({ ok: true });
  });
  it('gather fails closed on Docker, runc, kernel, AppArmor, arch, image, browser pin and profile drift', async () => {
    const vj = (m: (v: { Client: { Version: string }; Server: { Version: string; Components: { Name: string; Version: string }[] } }) => void) => { const v = JSON.parse(VERSION); m(v); return { ok: true, stdout: JSON.stringify(v) }; };
    const cases: [string, Parameters<typeof gather>[0]][] = [
      ['DOCKER_SERVER', { exec: exec({ version: vj((v) => { v.Server.Version = '28.0.5'; }) }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['DOCKER_CLIENT', { exec: exec({ version: vj((v) => { v.Client.Version = '29.0.0'; }) }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['RUNC', { exec: exec({ version: vj((v) => { v.Server.Components[1].Version = '1.5.3'; }) }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['KERNEL', { exec: exec(), fsx: fsFor({ '/proc/sys/kernel/osrelease': '7.1.0-1001-azure\n' }), env, arch: 'x64', repo: REPO }],
      ['HOST_AA_RESTRICT_USERNS', { exec: exec(), fsx: fsFor({ '/proc/sys/kernel/apparmor_restrict_unprivileged_userns': '0\n' }), env, arch: 'x64', repo: REPO }],
      ['DAEMON_APPARMOR', { exec: exec({ info: { ok: true, stdout: JSON.stringify(['name=seccomp,profile=builtin']) } }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['DAEMON_SECCOMP', { exec: exec({ info: { ok: true, stdout: JSON.stringify(['name=apparmor', 'name=seccomp,profile=unconfined']) } }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['NODE_ARCH', { exec: exec(), fsx: fsFor(), env, arch: 'arm64', repo: REPO }],
      // The daemon's platform is read from the daemon, never inferred from Node's process.arch.
      ['DAEMON_ARCH', { exec: exec({ server: { ok: true, stdout: JSON.stringify({ ...SERVER, Arch: 'arm64' }) } }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['DAEMON_ARCH', { exec: exec({ server: { ok: true, stdout: JSON.stringify({ ...SERVER, Arch: undefined }) } }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['DAEMON_OS', { exec: exec({ server: { ok: true, stdout: JSON.stringify({ ...SERVER, Os: 'windows' }) } }), fsx: fsFor(), env, arch: 'x64', repo: REPO }],
      ['IMAGE_OS', { exec: exec(), fsx: fsFor(), env: { ImageOS: 'ubuntu26' }, arch: 'x64', repo: REPO }],
      ['LOCK_PLAYWRIGHT_CORE', { exec: exec(), fsx: fsFor({ [`${REPO}/package-lock.json`]: LOCK({ 'playwright-core': '1.60.0' }) }), env, arch: 'x64', repo: REPO }],
      ['LOCK_PLAYWRIGHT', { exec: exec(), fsx: fsFor({ [`${REPO}/package-lock.json`]: LOCK({ playwright: '1.60.0' }) }), env, arch: 'x64', repo: REPO }],
      ['LOCK_PLAYWRIGHT_TEST', { exec: exec(), fsx: fsFor({ [`${REPO}/package-lock.json`]: LOCK({ '@playwright/test': '1.58.0' }) }), env, arch: 'x64', repo: REPO }],
      ['PROFILE', { exec: exec(), fsx: fsFor({ [SECCOMP_PATH]: Buffer.concat([PROFILE_RAW, Buffer.from('\n')]) }), env, arch: 'x64', repo: REPO }],
      ['PROFILE', { exec: exec(), fsx: fsFor({ [`${REPO}/scripts/e2e/le-iso/seccomp/chromium147-delta.json`]: '[]' }), env, arch: 'x64', repo: REPO }],
    ];
    for (const [k, args] of cases) {
      const r = evaluate(await gather(args));
      expect(r.ok, k).toBe(false);
      expect(r.lines.filter((l) => l.startsWith('PRE_E_')), k).toEqual([`PRE_E_${k}`]);
    }
  });
  it('rejected or failed queries and unreadable files fail closed, never pass', async () => {
    const boom = new Error('spawn EACCES');
    const r = evaluate(await gather({ exec: exec({ version: boom, info: boom }), fsx: fsFor({ '/proc/sys/kernel/osrelease': Object.assign(new Error('x'), { code: 'EACCES' }) }), env: {}, arch: 'x64', repo: REPO }));
    expect(r.ok).toBe(false);
    expect(r.lines).toEqual(expect.arrayContaining(['PRE_E_DOCKER_SERVER', 'PRE_E_RUNC', 'PRE_E_KERNEL', 'PRE_E_DAEMON_SECCOMP', 'PRE_E_IMAGE_OS']));
    const rej = evaluate(await gather({ exec: exec({ server: boom }), fsx: fsFor(), env, arch: 'x64', repo: REPO }));
    expect(rej.lines.filter((l) => l.startsWith('PRE_E_'))).toEqual(['PRE_E_DAEMON_OS', 'PRE_E_DAEMON_ARCH']);
    const notJson = evaluate(await gather({ exec: exec({ server: { ok: true, stdout: 'amd64' } }), fsx: fsFor(), env, arch: 'x64', repo: REPO }));
    expect(notJson.lines.filter((l) => l.startsWith('PRE_E_'))).toEqual(['PRE_E_DAEMON_OS', 'PRE_E_DAEMON_ARCH']);
    expect(profileOk({ readFileSync: () => { throw new Error('x'); } }, REPO)).toBe(false);
  });
  it('preflight is metadata only: the probe never imports it, and the sandbox inner result stays the verdict', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/run-probe.mjs'), 'utf8');
    expect(src).not.toMatch(/preflight/);
    expect(INNER_TESTS.SANDBOX.expected).toBe('SANDBOX_ON_NONCE_MATCH');
    const pf = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/preflight.mjs'), 'utf8');
    // Read-only: the only filesystem calls are reads, and nothing asks for privilege or reads audit logs.
    expect(new Set([...pf.matchAll(/\bfsx?\.(\w+)\(/g)].map((m) => m[1]))).toEqual(new Set(['readFileSync']));
    expect(pf).not.toMatch(/sudo|journalctl|dmesg|auditctl|ausearch/);
  });
});

describe('le-isolation-probe job', () => {
  it('passes the shared policy, is its own option, and carries no stack, secret, upload or retry', async () => {
    expect(await checkWorkflowText(WF)).toEqual([]);
    expect(JOB.if).toBe("inputs.specs == 'le-isolation-probe'");
    expect(DOC.on.workflow_dispatch.inputs.specs.options).toContain('le-isolation-probe');
    expect(JOB.permissions).toEqual({ contents: 'read' });
    expect(JOB.environment).toBeUndefined();
    const body = WF.slice(WF.indexOf('\n  le-isolation-probe:'));
    expect(body).not.toMatch(/secrets\.|supabase|psql|upload-artifact|E2E_.*PASSWORD|pairing|lesson-editor\/run\.sh|continue-on-error/);
    const runs = (JOB.steps as { run?: string }[]).map((s) => s.run ?? '').join('\n');
    expect(runs).toMatch(/scripts\/e2e\/le-iso\/run-probe\.mjs "\$GITHUB_WORKSPACE" "\$\(command -v node\)" "\$ISO_SHELL_PATH"/);
    expect(runs).not.toMatch(/docker (pull|run)|--privileged|chromiumSandbox: ?false|--no-sandbox/);
  });
  it('the inner probe asks for the sandbox ON and never weakens it', () => {
    const inner = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/inner-probe.mjs'), 'utf8');
    expect(inner).toMatch(/chromiumSandbox: true/);
    expect(inner).not.toMatch(/chromiumSandbox: false|ignoreDefaultArgs|args: \[/);
  });
});

describe('r10 mandatory browser pin (REVIEW DIFF, unapplied; fakes plus the real local resolution only)', () => {
  const CORE = '/w/repo/node_modules/playwright-core';
  const goodR = () => ({ path: SHELL, revision: '1217', browserVersion: '147.0.7727.15', playwrightCore: '1.59.1', browsersJson: `${CORE}/browsers.json`,
    version: BROWSER_PIN.VERSION_LINE, sha256: BROWSER_PIN.SHA256, testOverride: false } as Record<string, unknown>);
  const goodChain = () => ({ test: '1.59.1', playwright: '1.59.1', core: '1.59.1', coreDir: CORE } as Record<string, unknown>);
  it('the reviewed digest, revision, version and version line are literals in source, not computed', () => {
    expect(BROWSER_PIN).toMatchObject({ PLAYWRIGHT_TEST: '1.59.1', PLAYWRIGHT: '1.59.1', PLAYWRIGHT_CORE: '1.59.1', REVISION: '1217',
      BROWSER_VERSION: '147.0.7727.15', VERSION_LINE: 'Google Chrome for Testing 147.0.7727.15',
      SHA256: '22d72b589f908111fa29ff4e61ead8a0601e925177f59c70e2e851c22e9b1886' });
    expect(Object.isFrozen(BROWSER_PIN)).toBe(true);
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/expect.mjs'), 'utf8');
    expect(src).toContain("'22d72b589f908111fa29ff4e61ead8a0601e925177f59c70e2e851c22e9b1886'");
  });
  it('verdict passes only the exact reviewed browser and chain; each single drift fails with its own code', () => {
    expect(bpinVerdict(goodR(), goodChain(), SHELL, CORE)).toEqual({ ok: true, lines: [...BPIN_ORDER.map((k) => `BPIN_${k} OK`), 'BPIN_OK'] });
    const cases: [string, (r: Record<string, unknown>, c: Record<string, unknown>) => void, string?][] = [
      ['PLAYWRIGHT_TEST', (_r, c) => { c.test = '1.59.2'; }],
      ['PLAYWRIGHT', (_r, c) => { c.playwright = '1.60.0'; }],
      ['PLAYWRIGHT_CORE', (_r, c) => { c.core = '1.60.0'; }],
      ['PLAYWRIGHT_CORE', (r) => { r.playwrightCore = 'test-override'; }],
      ['CORE_SAME', (r) => { r.browsersJson = '/elsewhere/playwright-core/browsers.json'; }],
      ['REVISION', (r) => { r.revision = '1243'; }],
      ['BROWSER_VERSION', (r) => { r.browserVersion = '148.0.0.0'; }],
      ['VERSION_LINE', (r) => { r.version = 'Google Chrome for Testing 148.0.0.0'; }],
      ['VERSION_LINE', (r) => { r.version = `${BROWSER_PIN.VERSION_LINE} `; }],
      ['SHA256', (r) => { r.sha256 = 'f'.repeat(64); }],
      ['SHA256', (r) => { r.sha256 = undefined; }],
      ['TEST_OVERRIDE', (r) => { r.testOverride = true; }],
      ['TEST_OVERRIDE', (r) => { r.testOverride = undefined; }],
    ];
    for (const [k, m] of cases) {
      const r = goodR(), c = goodChain(); m(r, c);
      const v = bpinVerdict(r, c, SHELL, CORE);
      expect(v.ok, k).toBe(false);
      expect(v.lines.filter((l) => l.startsWith('BPIN_E_')), k).toEqual([`BPIN_E_${k}`]);
      expect(v.lines.at(-1)).toBe('BPIN_FAIL');
    }
    // the path must equal the pinned step's path AND have the reviewed revision layout
    for (const [rp, ep] of [[SHELL, '/other/path'], ['/s/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', '/s/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'], ['rel/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell', 'rel/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell']]) {
      const r = goodR(); r.path = rp;
      expect(bpinVerdict(r, goodChain(), ep, CORE).lines.filter((l) => l.startsWith('BPIN_E_'))).toEqual(['BPIN_E_PATH']);
    }
    expect(bpinVerdict(goodR(), goodChain(), undefined as unknown as string, CORE).ok).toBe(false);
    // the core the in-container probe loads must be the same install as the @playwright/test chain
    for (const pd of ['/w/repo/node_modules/other/node_modules/playwright-core', undefined, null])
      expect(bpinVerdict(goodR(), goodChain(), SHELL, pd as unknown as string).lines.filter((l) => l.startsWith('BPIN_E_'))).toEqual(['BPIN_E_PROBE_CORE']);
    // a refused resolution or unresolvable chain fails every dependent check, never passes
    expect(bpinVerdict(null, goodChain(), SHELL, CORE).ok).toBe(false);
    expect(bpinVerdict(goodR(), null, SHELL, CORE).lines).toEqual(expect.arrayContaining(['BPIN_E_RESOLVE', 'BPIN_E_PLAYWRIGHT_TEST', 'BPIN_E_CORE_SAME', 'BPIN_E_PROBE_CORE', 'BPIN_FAIL']));
  });
  it('resolvedChain follows @playwright/test -> playwright -> playwright-core from where each one resolves', () => {
    const map: Record<string, Record<string, string>> = {
      '/w/repo/x.mjs': { '@playwright/test/package.json': '/n/@playwright/test/package.json' },
      '/n/@playwright/test/package.json': { 'playwright/package.json': '/n/@playwright/test/node_modules/playwright/package.json' },
      '/n/@playwright/test/node_modules/playwright/package.json': { 'playwright-core/package.json': '/n/pc-nested/package.json' },
    };
    const mk = (from: string) => ({ resolve: (id: string) => { const v = map[from]?.[id]; if (!v) throw new Error('MODULE_NOT_FOUND'); return v; } });
    const versions: Record<string, string> = { '/n/@playwright/test/package.json': '1.59.1', '/n/@playwright/test/node_modules/playwright/package.json': '1.59.1', '/n/pc-nested/package.json': '1.60.0' };
    const c = resolvedChain('/w/repo/x.mjs', (p: string) => ({ version: versions[p] }), mk as never);
    expect(c).toEqual({ test: '1.59.1', playwright: '1.59.1', core: '1.60.0', coreDir: '/n/pc-nested' });
    expect(bpinVerdict(goodR(), c, SHELL, CORE).ok).toBe(false);
    expect(() => resolvedChain('/nowhere.mjs', () => ({}), mk as never)).toThrow();
    expect(probeCoreDir('/w/repo', ((f: string) => ({ resolve: (id: string) => { expect(f).toBe('/w/repo/package.json'); expect(id).toBe('playwright-core/package.json'); return `${CORE}/package.json`; } })) as never)).toBe(CORE);
  });
  it('the real local install resolves one 1.59.1 chain, and the probe loads that same playwright-core', () => {
    const c = resolvedChain(path.join(ROOT, 'scripts/local-stack/quiz-lifecycle/headless-shell.mjs'));
    expect(c).toMatchObject({ test: '1.59.1', playwright: '1.59.1', core: '1.59.1' });
    expect(probeCoreDir(ROOT)).toBe(c.coreDir);
  });
  it('run-probe refuses an unpinned binary before build or create; owned dirs are cleaned', async () => {
    for (const o of [{ shellBytes: Buffer.from('tampered headless shell bytes') }]) {
      let built = false;
      const f = fake(o);
      f.d.buildImage = () => { built = true; return { code: 'ISO_IMAGE_OK', id: IMG }; };
      const r = await runProbe(f.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP });
      expect(r.ok).toBe(false);
      expect(r.say).toContain('ISO_E_BROWSER_PIN');
      expect(built).toBe(false);
      expect(f.calls.some((c) => c[1] === 'create' || c[1] === 'build' || c[1] === 'start')).toBe(false);
      expect(f.dirs.has(H)).toBe(false);
    }
    // the reviewed digest itself is the default: without the test seam, fake bytes never pass
    const g = fake(); delete (g.d as { browserSha256?: string }).browserSha256;
    expect((await runProbe(g.d, { repo: REPO, node: NODE, shell: SHELL, temp: TEMP })).say).toContain('ISO_E_BROWSER_PIN');
    // a correct digest at an unreviewed path layout is refused too
    const BAD = '/s/chrome-headless-shell';
    const h = fake(); h.files.set(BAD, SHELL_BYTES); h.dirs.add(BAD);
    const rb = await runProbe(h.d, { repo: REPO, node: NODE, shell: BAD, temp: TEMP });
    expect(rb.say).toContain('ISO_E_BROWSER_PIN');
    expect(h.calls.some((c) => c[1] === 'create' || c[1] === 'build')).toBe(false);
  });
  it('the digest test seam is never set by run-probe itself', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/run-probe.mjs'), 'utf8');
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    expect([...code.matchAll(/browserSha256/g)]).toHaveLength(1);
    expect(src).toContain('d.browserSha256 ?? BROWSER_PIN.SHA256');
    expect(BROWSER_PATH_RE.test(SHELL)).toBe(true);
  });
});

describe('r10 mandatory effective AppArmor gate before any browser launch (REVIEW DIFF, unapplied; fakes only)', () => {
  it('only the exact docker-default (enforce) label reaches the launch', async () => {
    for (const label of ['docker-default (enforce)', 'docker-default (enforce)\n', 'docker-default (enforce)\0']) {
      let launched = 0;
      const g = await gatedSandbox(() => label, async () => { launched++; return 'SANDBOX_ON_NONCE_MATCH'; });
      expect(g, JSON.stringify(label)).toEqual({ APPARMOR: 'APPARMOR_DOCKER_DEFAULT_ENFORCE', SANDBOX: 'SANDBOX_ON_NONCE_MATCH' });
      expect(launched).toBe(1);
    }
  });
  it('unknown, unconfined, complain, another mode or another profile never launch', async () => {
    const cases: [unknown, string][] = [
      ['unconfined', 'APPARMOR_E_UNCONFINED'],
      ['docker-default (complain)', 'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE'],
      ['docker-default (kill)', 'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE'],
      ['docker-default', 'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE'],
      ['docker-default-extra (enforce)', 'APPARMOR_E_DOCKER_DEFAULT_NOT_ENFORCE'],
      ['le-iso-custom (enforce)', 'APPARMOR_E_OTHER_PROFILE'],
      ['unconfined (enforce)', 'APPARMOR_E_OTHER_PROFILE'],
      ['', 'APPARMOR_E_UNKNOWN'], [null, 'APPARMOR_E_UNKNOWN'], [undefined, 'APPARMOR_E_UNKNOWN'], [42, 'APPARMOR_E_UNKNOWN'],
    ];
    for (const [label, code] of cases) {
      let launched = 0;
      const g = await gatedSandbox(() => label, async () => { launched++; return 'SANDBOX_ON_NONCE_MATCH'; });
      expect(g, String(label)).toEqual({ APPARMOR: code, SANDBOX: 'SANDBOX_E_APPARMOR_GATE' });
      expect(launched, String(label)).toBe(0);
      expect(INNER_TESTS.APPARMOR.other).toContain(code);
    }
    let launched = 0;
    const thrown = await gatedSandbox(() => { throw Object.assign(new Error('x'), { code: 'EACCES' }); }, async () => { launched++; return 'SANDBOX_ON_NONCE_MATCH'; });
    expect(thrown).toEqual({ APPARMOR: 'APPARMOR_E_UNKNOWN', SANDBOX: 'SANDBOX_E_APPARMOR_GATE' });
    expect(launched).toBe(0);
  });
  it('a launch failure after a passing gate is a launch failure, and the gate code is unchanged', async () => {
    expect(await gatedSandbox(() => 'docker-default (enforce)', async () => { throw new Error('boom'); })).toEqual({ APPARMOR: 'APPARMOR_DOCKER_DEFAULT_ENFORCE', SANDBOX: 'SANDBOX_E_LAUNCH' });
  });
  it('APPARMOR is ordered before SANDBOX, gate codes are closed, and the gate never changes host AppArmor', () => {
    expect(INNER_ORDER.indexOf('APPARMOR')).toBeGreaterThanOrEqual(0);
    expect(INNER_ORDER.indexOf('APPARMOR')).toBeLessThan(INNER_ORDER.indexOf('SANDBOX'));
    expect(INNER_TESTS.SANDBOX.other).toContain('SANDBOX_E_APPARMOR_GATE');
    expect(apparmorGate('docker-default (enforce)')).toBe(INNER_TESTS.APPARMOR.expected);
    const inner = readFileSync(path.join(ROOT, 'scripts/e2e/le-iso/inner-probe.mjs'), 'utf8');
    // playwright-core is loaded only inside the gated launch callback
    const req = inner.indexOf("('playwright-core')"), gate = inner.indexOf('await gatedSandbox(readLabel, async () => {');
    expect(gate).toBeGreaterThan(0); expect(req).toBeGreaterThan(gate);
    expect([...inner.matchAll(/'playwright-core'/g)]).toHaveLength(1);
    const all = ['run-probe.mjs', 'inner-probe.mjs', 'expect.mjs', 'preflight.mjs', 'browser-pin.mjs'].map((f) => readFileSync(path.join(ROOT, 'scripts/e2e/le-iso', f), 'utf8')).join('\n');
    expect(all).not.toMatch(/apparmor_parser|aa-complain|aa-disable|aa-enforce|apparmor=unconfined|apparmor:unconfined/);
  });
  it('the classifier fails when the gate passed but the post-run label disagrees, and when the gate failed', () => {
    const all = Object.fromEntries(INNER_ORDER.map((t) => [t, INNER_TESTS[t].expected]));
    expect(classifyInner(formatResults(all, { APPARMOR_LABEL: 'DOCKER_DEFAULT_ENFORCE' }))).toMatchObject({ ok: true, pass: true });
    expect(classifyInner(formatResults(all, { APPARMOR_LABEL: 'UNCONFINED' }))).toMatchObject({ ok: true, pass: false });
    const gated = { ...all, APPARMOR: 'APPARMOR_E_UNCONFINED', SANDBOX: 'SANDBOX_E_APPARMOR_GATE' };
    expect(classifyInner(formatResults(gated, { APPARMOR_LABEL: 'UNCONFINED' }))).toMatchObject({ ok: true, pass: false, results: { APPARMOR: 'APPARMOR_E_UNCONFINED', SANDBOX: 'SANDBOX_E_APPARMOR_GATE' } });
    expect(classifyInner(formatResults({ ...all, APPARMOR: 'APPARMOR_E_UNCONFINED' }, { APPARMOR_LABEL: 'DOCKER_DEFAULT_ENFORCE' }))).toMatchObject({ ok: true, pass: false });
  });
});

describe('r10 mandatory le-iso workflow order (REVIEW DIFF, unapplied)', () => {
  type Step = { name?: string; run?: string; uses?: string; 'continue-on-error'?: unknown; if?: unknown };
  const PRE = 'scripts/e2e/le-iso/preflight.mjs "$GITHUB_WORKSPACE"';
  const BPIN = 'scripts/e2e/le-iso/browser-pin.mjs "$SHELL_PATH" "$GITHUB_WORKSPACE"';
  /** Fixed-code order check over the job's steps; [] means the mandatory gates are present, unconditional and in order. */
  const orderErrors = (steps: Step[]): string[] => {
    const e: string[] = [];
    const idx = (p: (s: Step) => boolean) => { const all = steps.map((s, i) => (p(s) ? i : -1)).filter((i) => i >= 0); return all.length === 1 ? all[0] : -1; };
    const runs = (s: Step) => (typeof s.run === 'string' ? s.run : '');
    const npmci = idx((s) => /^npm ci --ignore-scripts\b/.test(runs(s).trim()));
    const policy = idx((s) => runs(s).includes('check-isolated-workflow.mjs --executed'));
    const modes = idx((s) => runs(s).includes('check-invoked-modes.mjs'));
    const pre = idx((s) => runs(s).includes('le-iso/preflight.mjs'));
    const install = idx((s) => runs(s).includes('playwright install'));
    const pin = idx((s) => runs(s).includes('le-iso/browser-pin.mjs'));
    const probe = idx((s) => runs(s).includes('le-iso/run-probe.mjs'));
    for (const [k, v] of Object.entries({ npmci, policy, modes, pre, install, pin, probe })) if (v < 0) e.push(`MISSING_OR_DUPLICATE_${k}`);
    if (e.length) return e;
    if (!(npmci < policy && policy < modes && modes < pre)) e.push('PRE_BEFORE_CHECKS');
    if (!(pre < install)) e.push('PRE_AFTER_INSTALL');
    if (!(install < pin && pin < probe)) e.push('PIN_ORDER');
    if (runs(steps[pre]).trim() !== PRE) e.push('PRE_RUN_ALTERED');
    const pinLines = runs(steps[pin]).split('\n').map((l) => l.trim());
    const b = pinLines.indexOf(BPIN), exp = pinLines.findIndex((l) => l.startsWith('echo "ISO_SHELL_PATH='));
    if (b < 0 || exp < 0 || b > exp) e.push('PIN_NOT_BEFORE_EXPORT');
    for (const i of [pre, pin, probe]) if (steps[i]['continue-on-error'] !== undefined || steps[i].if !== undefined) e.push(`CONDITIONAL_${i}`);
    for (const s of steps.slice(0, pre)) if (/le-iso\/|docker |playwright install/.test(runs(s))) e.push('PROBE_WORK_BEFORE_PRE');
    return e;
  };
  const steps = (): Step[] => structuredClone(JOB.steps as Step[]);
  const find = (st: Step[], needle: string) => st.findIndex((s) => typeof s.run === 'string' && s.run.includes(needle));
  const move = (st: Step[], from: number, to: number) => { const [x] = st.splice(from, 1); st.splice(to, 0, x); return st; };
  it('the committed job has the preflight, then the browser install, then the enforced pin, then the probe', () => {
    expect(orderErrors(steps())).toEqual([]);
  });
  it('removing, moving, duplicating, softening or conditioning a gate is rejected', () => {
    const muts: [string, (st: Step[]) => Step[]][] = [
      ['remove preflight', (st) => { st.splice(find(st, 'preflight.mjs'), 1); return st; }],
      ['preflight after install', (st) => move(st, find(st, 'preflight.mjs'), find(st, 'playwright install'))],
      ['preflight after probe', (st) => move(st, find(st, 'preflight.mjs'), st.length - 1)],
      ['preflight before policy', (st) => move(st, find(st, 'preflight.mjs'), find(st, 'check-isolated-workflow'))],
      ['preflight duplicated', (st) => { st.push({ ...st[find(st, 'preflight.mjs')] }); return st; }],
      ['preflight softened', (st) => { st[find(st, 'preflight.mjs')].run = `${PRE} || true`; return st; }],
      ['preflight continue-on-error', (st) => { st[find(st, 'preflight.mjs')]['continue-on-error'] = true; return st; }],
      ['preflight conditional', (st) => { st[find(st, 'preflight.mjs')].if = 'false'; return st; }],
      ['remove browser pin line', (st) => { const i = find(st, 'browser-pin.mjs'); st[i].run = st[i].run!.split('\n').filter((l) => !l.includes('browser-pin.mjs')).join('\n'); return st; }],
      ['browser pin after export', (st) => { const i = find(st, 'browser-pin.mjs'); const l = st[i].run!.split('\n'); const b = l.findIndex((x) => x.includes('browser-pin.mjs')); const [x] = l.splice(b, 1); l.push(x); st[i].run = l.join('\n'); return st; }],
      ['browser pin softened', (st) => { const i = find(st, 'browser-pin.mjs'); st[i].run = st[i].run!.replace(BPIN, `${BPIN} || true`); return st; }],
      ['pin step after probe', (st) => move(st, find(st, 'browser-pin.mjs'), st.length - 1)],
      ['pin step continue-on-error', (st) => { st[find(st, 'browser-pin.mjs')]['continue-on-error'] = true; return st; }],
      ['probe before install', (st) => move(st, find(st, 'le-iso/run-probe.mjs'), find(st, 'playwright install'))],
    ];
    for (const [name, m] of muts) expect(orderErrors(m(steps())).length, name).toBeGreaterThan(0);
  });
});
