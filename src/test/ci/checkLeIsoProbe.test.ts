// ABOUTME: Pure controls for the SYNTHETIC lane-isolation feasibility probe: fixed codes, the exact container config, the
// ABOUTME: absence rule, the inner classifier, every host teardown gate (fake docker, /proc and fs), and the job's shape.
//
// Read-only on purpose: nothing here writes a file. Fakes live in memory; no docker, listener or browser is started.
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';
import { absenceVerdict, classifyInner, compareInspect, exitStateOk, expectedConfig, HOST_CODES, IN, INNER_ORDER, INNER_TESTS, mountsVerdict, parseLdd } from '../../../scripts/e2e/le-iso/expect.mjs';
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
  const { Image, User, ...hc } = e;
  return { Id: CIDV, Image, Config: { User }, HostConfig: { ...hc, Mounts: [] }, Mounts: [{ Type: 'bind' }, { Type: 'bind' }, { Type: 'bind' }],
    State: { Status: 'exited', Running: false, Restarting: false, Pid: 0, Dead: false }, ...over };
}

type Opt = { inner?: string; startOk?: boolean; readyPid?: number; startNow?: string; lsC?: [boolean, string]; final?: string;
  exitCode?: number; stays?: boolean; inspectOver?: Record<string, unknown>; images?: string; createCid?: string };
function fake(o: Opt = {}) {
  const files = new Map<string, string>();
  const dirs = new Set<string>([REPO, NODE, SHELL, TEMP]);
  const calls: string[][] = [];
  const procs = new Map<string, string>();
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null as number | null, kill: (sig: string) => {
    calls.push(['kill', sig]);
    if (!o.stays) { procs.delete('/proc/4242/stat'); dirs.delete('/proc/4242'); files.set(`${H}/final`, o.final ?? '2 0\n'); }
    setTimeout(() => child.emit('exit', o.exitCode ?? 0), 0);
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
    if (a0 === 'create') { const cf = args[args.indexOf('--cidfile') + 1]; const c = o.createCid ?? CIDV; files.set(cf, `${c}\n`); return { ok: true, stdout: `${c}\n` }; }
    if (a0 === 'container' && a1 === 'inspect') return { ok: true, stdout: JSON.stringify([goodInspect(o.inspectOver)]) };
    if (a0 === 'start') return { ok: o.startOk ?? true, stdout: o.inner ?? passLines() };
    if (a0 === 'wait') return { ok: true, stdout: '0\n' };
    if (a0 === 'rm') return { ok: true, stdout: `${CIDV}\n` };
    if (a0 === 'container' && a1 === 'ls') return { ok: (o.lsC ?? [true, ''])[0], stdout: (o.lsC ?? [true, ''])[1] };
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
  return { d, calls, dirs };
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
    expect(a.join(' ')).not.toMatch(/--network\s+(host|bridge)|-p\s|--publish|docker\.sock|--pid|--userns|--cap-add/);
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
    expect(r.say.slice(-7)).toEqual(['ISO_EXIT_OK', 'ISO_RM_OK', 'ISO_ABSENT', 'ISO_ENDPOINT_STOPPED', 'ISO_IMAGE_REMOVED', 'ISO_DIRS_REMOVED', 'ISO_INNER_PASS']);
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
    expect((await run({ stays: true })).say).toContain('ISO_E_ENDPOINT_TERMINATION');
    expect((await run({ exitCode: 5 })).say).toContain('ISO_E_ENDPOINT_TERMINATION');
    expect((await run({ final: '2 1\n' })).say).toContain('ISO_E_ENDPOINT_CONNS');
    expect((await run({ final: '0 0\n' })).say).toContain('ISO_E_ENDPOINT_CONNS');
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
    expect((await run({ createCid: 'zz' })).say).toContain('ISO_E_CID');
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
