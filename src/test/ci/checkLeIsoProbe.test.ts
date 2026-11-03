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
import { absenceVerdict, classifyInner, dnsVerdict, compareInspect, exitStateOk, expectedConfig, HOST_CODES, IN, INNER_ORDER, INNER_TESTS, mountsVerdict, parseLdd } from '../../../scripts/e2e/le-iso/expect.mjs';
import { formatResults, sandboxCheck } from '../../../scripts/e2e/le-iso/inner-probe.mjs';
import { buildImage, createArgs, runProbe } from '../../../scripts/e2e/le-iso/run-probe.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
const JOB = DOC.jobs['le-isolation-probe'];

const CIDV = 'c'.repeat(64);
const IMG = `sha256:${'a'.repeat(64)}`;
const REPO = '/w/repo', TEMP = '/rt', NODE = '/n/bin/node', SHELL = '/s/chrome-headless-shell';
const H = `${TEMP}/le-iso-host`, S = `${TEMP}/le-iso-sock`, O = `${TEMP}/le-iso-out`;
const passLines = () => `${INNER_ORDER.map((t) => `LE-ISO ${t} ${INNER_TESTS[t].expected}`).join('\n')}\nLE-ISO END\n`;
const stat = (start: string) => `9 (node) S 1 1 1 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 ${start} 0 0`;

function goodInspect(over: Record<string, unknown> = {}) {
  const e = expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O });
  const { Image, User, EffectiveMounts, ...hc } = e;
  return { Id: CIDV, Image, Config: { User }, HostConfig: { ...hc, Mounts: [] }, Mounts: [...EffectiveMounts].reverse().map((m) => ({ ...m, Mode: 'ro', Name: '' })),
    State: { Status: 'exited', Running: false, Restarting: false, Pid: 0, Dead: false }, ...over };
}

type Opt = { inner?: string; startOk?: boolean; readyPid?: number; startNow?: string; lsC?: [boolean, string]; final?: string;
  exitCode?: number; ignoreTerm?: boolean; ignoreKill?: boolean; inspectOver?: Record<string, unknown>; images?: string;
  createCid?: string; createOut?: string; hangs?: boolean; stopFails?: boolean };
const RUNNING = { Status: 'running', Running: true, Restarting: false, Pid: 77, Dead: false };
function fake(o: Opt = {}) {
  const files = new Map<string, string>();
  const dirs = new Set<string>([REPO, NODE, SHELL, TEMP]);
  const calls: string[][] = [];
  const procs = new Map<string, string>();
  let running = false;
  let exists = false;
  const die = (code: number | null) => {
    procs.delete('/proc/4242/stat'); dirs.delete('/proc/4242');
    if (code === 0) files.set(`${H}/final`, o.final ?? '2 0\n');
    setTimeout(() => child.emit('exit', code), 0);
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
    if (a0 === 'create') {
      const cf = args[args.indexOf('--cidfile') + 1]; const c = o.createCid ?? CIDV; files.set(cf, `${c}\n`); exists = true;
      return { ok: true, stdout: `${o.createOut ?? c}\n` };
    }
    if (a0 === 'container' && a1 === 'inspect') return exists ? { ok: true, stdout: JSON.stringify([goodInspect({ ...o.inspectOver, ...(running ? { State: RUNNING } : {}) })]) } : { ok: false, stdout: '' };
    if (a0 === 'start') { running = true; if (o.hangs) return { ok: false, stdout: '' }; running = false; return { ok: o.startOk ?? true, stdout: o.inner ?? passLines() }; }
    if (a0 === 'stop') { if (o.stopFails) return { ok: false, stdout: '' }; running = false; return { ok: true, stdout: `${CIDV}\n` }; }
    if (a0 === 'wait') return running ? { ok: false, stdout: '' } : { ok: true, stdout: '0\n' };
    if (a0 === 'rm') { if (running) return { ok: false, stdout: '' }; exists = false; return { ok: true, stdout: `${CIDV}\n` }; }
    if (a0 === 'container' && a1 === 'ls') return { ok: (o.lsC ?? [true, ''])[0], stdout: o.lsC ? o.lsC[1] : exists ? `${CIDV}\n` : '' };
    if (a0 === 'image' && a1 === 'rm') return { ok: true, stdout: '' };
    if (a0 === 'image' && a1 === 'ls') return { ok: true, stdout: o.images ?? `sha256:${'b'.repeat(64)}\n` };
    return { ok: false, stdout: '' };
  };
  const d = {
    exec, fs, sleep: () => new Promise<void>((r) => setTimeout(r, 5)), uid: () => 1001, gid: () => 118,
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
    const a = createArgs({ cidfile: `${H}/lane.cid`, imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O, node: NODE, shell: SHELL });
    for (const f of ['--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--restart', 'no', '--log-driver', '--init'])
      expect(a).toContain(f);
    expect(a).toContain(`${S}:${IN.sock}:ro,rprivate`);
    expect(a).not.toContain('--privileged');
    expect(a.join(' ')).not.toMatch(/--network\s+(host|bridge)|-p\s|--publish|docker\.sock|--pid[ =]|--userns|--cap-add/);
    expect(compareInspect(goodInspect(), expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O }))).toEqual([]);
    const drift = goodInspect(); (drift.HostConfig as Record<string, unknown>).NetworkMode = 'bridge';
    expect(compareInspect(drift, expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O }))).toEqual(['NetworkMode']);
    expect(exitStateOk(goodInspect())).toBe(true);
    expect(exitStateOk({ State: { Status: 'running', Running: true, Restarting: false, Pid: 9, Dead: false } })).toBe(false);
  });
  it('mount verdict refuses an unexpected mount such as a docker socket', () => {
    const mi = (p: string) => `1 2 0:1 / ${p} rw - x x rw`;
    const base = ['/', IN.sock, IN.out, IN.tmp, REPO, '/proc', '/dev'].map(mi).join('\n');
    expect(mountsVerdict(base, { repo: REPO })).toBe('MOUNTS_EXACT');
    expect(mountsVerdict(`${base}\n${mi('/var/run/docker.sock')}`, { repo: REPO })).toBe('MOUNTS_E_UNEXPECTED');
    expect(mountsVerdict(['/', IN.sock].map(mi).join('\n'), { repo: REPO })).toBe('MOUNTS_E_MISSING');
  });
  it('the image builder refuses an unresolvable closure before writing anything', () => {
    const d = { exec: () => ({ ok: true, stdout: '\tlibx.so => not found\n' }), fs: {}, uid: () => 1, gid: () => 1 };
    expect(buildImage(d as never, { ctl: H, node: NODE, shell: SHELL })).toBe('ISO_E_IMAGE_CLOSURE');
  });
});

describe('le-iso host orchestrator (fakes only)', () => {
  it('a full pass prints only fixed codes, in order, and tears everything down', async () => {
    const r = await run();
    expect(r.say.filter((l) => l.startsWith('ISO_E_'))).toEqual([]);
    expect(r.ok).toBe(true);
    const fixed = new Set([...HOST_CODES, ...INNER_ORDER.map((t) => `LE-ISO ${t} ${INNER_TESTS[t].expected}`)]);
    for (const l of r.say) expect(fixed.has(l), l).toBe(true);
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
    const exp = expectedConfig({ imageId: IMG, uid: 1001, gid: 118, repo: REPO, sock: S, out: O });
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

describe('le-iso container termination (fakes only)', () => {
  it('a timed-out run is stopped explicitly and bounded, then removed and proven absent', async () => {
    const r = await run({ hangs: true });
    expect(r.say).toContain('ISO_E_START');
    const order = r.calls.map((c) => c[1]).filter((x) => ['start', 'stop', 'wait', 'rm'].includes(x));
    expect(order).toEqual(['start', 'stop', 'wait', 'rm']);
    const stop = r.calls.find((c) => c[1] === 'stop');
    expect(stop).toEqual(['docker', 'stop', '--time', '10', CIDV]);
    expect(r.say).toEqual(expect.arrayContaining(['ISO_STOP_OK', 'ISO_EXIT_OK', 'ISO_RM_OK', 'ISO_ABSENT', 'ISO_DIRS_REMOVED']));
    expect(r.ok).toBe(false);
  });
  it('a container that cannot be stopped is never removed, and its run identity is preserved', async () => {
    const r = await run({ hangs: true, stopFails: true });
    expect(r.say).toEqual(expect.arrayContaining(['ISO_E_STOP', 'ISO_E_WAIT', 'ISO_PRESERVED_IMAGE', 'ISO_PRESERVED_DIRS']));
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
  it('builds past the Dockerfile with uid/gid in scope and checks the image user', () => {
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
    expect(buildImage(d as never, { ctl: H, node: NODE, shell: SHELL })).toEqual({ code: 'ISO_IMAGE_OK', id: IMG });
    expect(calls.find((c) => c[1] === 'build')).toEqual(expect.arrayContaining(['--pull=false', '--network', 'none']));
    const wrongUser = (bin: string, args: string[]) => (args[0] === 'image' ? { ok: true, stdout: JSON.stringify([{ Id: IMG, Os: 'linux', Config: { User: '0:0' }, RootFS: { Layers: ['x'] } }]) } : exec(bin, args));
    expect(buildImage({ ...d, exec: wrongUser } as never, { ctl: H, node: NODE, shell: SHELL })).toEqual({ code: 'ISO_E_IMAGE_CONFIG', id: IMG });
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
    expect(await sandboxCheck(a.chromium, args(a))).toBe('SANDBOX_E_LAUNCH');
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
    expect(classifyInner(formatResults(all))).toMatchObject({ ok: true, pass: true });
    const { SANDBOX, ...missing } = all;
    expect(classifyInner(formatResults(missing))).toMatchObject({ ok: true, pass: false, results: { SANDBOX: 'SANDBOX_E_LAUNCH' } });
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
