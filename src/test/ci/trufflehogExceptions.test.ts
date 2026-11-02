// ABOUTME: Strict TruffleHog gate and producer wrapper: typed finding/log schema, PENDING exceptions inactive, fixed
// ABOUTME: diagnostics, and the actual security.yml step run against a fake docker (no scanner download, no real scan).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { loadExceptions, evaluate, report, MAX_LISTED } from '../../../scripts/ci/trufflehog-exceptions.mjs';
import { compare, PINNED_SHA256, UPSTREAM_URL } from '../../../scripts/ci/check-trufflehog-action.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const EX_TEXT = fs.readFileSync(path.join(ROOT, 'scripts/ci/trufflehog-exceptions.json'), 'utf8');
const EX = loadExceptions(EX_TEXT);
const BENIGN = { commit: 'b2aadfcd1bf001a6afbaa2544de465fa7dd23f3f', file: 'scripts/local-stack/t09/api-http.mjs', line: 7 };
// The committed entry carries the actual approval record (user 2026-11-02T12:08:50Z, relayed by T 13:01:47Z).
// PENDING_FIXTURE keeps the inactive state under test; APPROVED_FIXTURE is a test-only record for the mechanism.
const PENDING_FIXTURE = { ...JSON.parse(EX_TEXT), exceptions: [{ ...JSON.parse(EX_TEXT).exceptions[0], reviewed: 'PENDING' }] };
const EX_PENDING = loadExceptions(JSON.stringify(PENDING_FIXTURE));
const APPROVED_FIXTURE = { ...JSON.parse(EX_TEXT), exceptions: [{ ...JSON.parse(EX_TEXT).exceptions[0],
  reviewed: { approvedBy: 'TEST-FIXTURE', approvedAt: '2000-01-01T00:00:00Z', approvalRef: 'TEST-FIXTURE-NOT-AN-APPROVAL' } }] };
const EX_APPROVED = loadExceptions(JSON.stringify(APPROVED_FIXTURE));
const SENTINEL = 'SYNTHETIC-RAW-SENTINEL';

type F = Partial<{ commit: string; file: string; line: unknown; detector: string; verified: unknown; decoder: string; sourceType: unknown; extra: object; data: object }>;
const findingObj = (o: F = {}) => ({
  SourceMetadata: { Data: o.data ?? { Git: { commit: o.commit ?? BENIGN.commit, file: o.file ?? BENIGN.file, line: 'line' in o ? o.line : BENIGN.line, email: SENTINEL, repository: SENTINEL, timestamp: SENTINEL } } },
  SourceID: 1, SourceType: 'sourceType' in o ? o.sourceType : 16, SourceName: SENTINEL, DetectorType: 17, DetectorName: o.detector ?? 'URI',
  DetectorDescription: SENTINEL, DecoderName: o.decoder ?? 'PLAIN', Verified: 'verified' in o ? o.verified : false,
  VerificationFromCache: false, Raw: SENTINEL, RawV2: SENTINEL, Redacted: SENTINEL, ExtraData: { k: SENTINEL }, StructuredData: null, SecretParts: { p: SENTINEL },
  ...(o.extra ?? {}),
});
const finding = (o: F = {}) => JSON.stringify(findingObj(o));
const log = (level: string, msg: string) => JSON.stringify({ level, ts: '2026-11-02T00:00:00Z', logger: 'trufflehog', msg, detail: SENTINEL });
const FINISHED = log('info-0', 'finished scanning');
const okLogs = [log('info-0', 'running source'), FINISHED];
const ev = (stdout: string[], o: { stderr?: string[]; exit?: number; ex?: unknown } = {}) =>
  evaluate({ stdoutLines: stdout, stderrLines: o.stderr ?? okLogs, exitCode: o.exit ?? (stdout.some((l) => l.trim()) ? 183 : 0), exceptions: o.ex ?? EX });

describe('exceptions file and approval provenance', () => {
  it('holds exactly one exact unverified identity, carrying the actual approval record', () => {
    expect(EX).toHaveLength(1);
    expect(EX[0]).toMatchObject({ ...BENIGN, detector: 'URI', verified: false, state: 'approved' });
    expect(EX[0].reviewed.approvedAt).toBe('2026-11-02T12:08:50Z');
    expect(EX[0].reviewed.approvalRef).toContain('c1059c5 and a040281');
  });
  it('the committed approval excepts only that exact unverified identity', () => {
    expect(ev([finding()]).code).toBe(0);
    expect(ev([finding({ line: 8 })]).code).toBe(1);
    expect(ev([finding({ verified: true })]).code).toBe(1);
  });
  it('PENDING does not except: the benign finding still FAILS the gate', () => {
    const r = ev([finding()], { ex: EX_PENDING });
    expect(r.code).toBe(1);
    expect(r.pending).toEqual(['T09-API-HTTP-REFUSED-USERINFO-EXAMPLE']);
    expect(report(r).join('\n')).toContain('NOT approved (PENDING)');
  });
  it('only a complete approval record activates the exact identity (test fixture, not a real approval)', () => {
    expect(ev([finding(), finding({ decoder: 'BASE64' })], { ex: EX_APPROVED }).code).toBe(0);
  });
  const base = JSON.parse(EX_TEXT).exceptions[0];
  const bad: Array<[string, object]> = [
    ['reviewed: "APPROVED" string', { reviewed: 'APPROVED' }],
    ['partial approval record', { reviewed: { approvedBy: 'x', approvedAt: '2026-11-02T00:00:00Z' } }],
    ['approval record with extra key', { reviewed: { approvedBy: 'x', approvedAt: '2026-11-02T00:00:00Z', approvalRef: 'y', scope: 'all' } }],
    ['non-ISO approvedAt', { reviewed: { approvedBy: 'x', approvedAt: 'today', approvalRef: 'y' } }],
    ['glob path', { file: 'scripts/*' }],
    ['parent segment', { file: 'scripts/../x.mjs' }],
    ['absolute path', { file: '/scripts/x.mjs' }],
    ['verified true', { verified: true }],
    ['line missing', { line: undefined }],
    ['short commit', { commit: 'b2aadfc' }],
    ['path-wide key', { path: 'scripts/' }],
    ['range key', { range: 'a..b' }],
    ['only-verified key', { onlyVerified: true }],
  ];
  for (const [name, patch] of bad) {
    it(`refuses a broadened or unproven entry: ${name}`, () => {
      expect(() => loadExceptions(JSON.stringify({ exceptions: [{ ...base, ...patch }] }))).toThrow();
    });
  }
});

describe('strict finding and log schema', () => {
  it('valid empty scan (exit 0, one finished log): PASS', () => { expect(ev([]).code).toBe(0); });
  const refused: Array<[string, string[], { stderr?: string[]; exit?: number }]> = [
    ['error-level log', [], { stderr: [log('error', 'error running scan'), FINISHED] }],
    ['fatal-level log', [], { stderr: [log('fatal', 'x'), FINISHED] }],
    ['warn-level log', [], { stderr: [log('warn', 'x'), FINISHED] }],
    ['non-JSON log line', [], { stderr: ['plain text', FINISHED] }],
    ['log line without msg', [], { stderr: [JSON.stringify({ level: 'info-0' }), FINISHED] }],
    ['log line carrying finding keys', [], { stderr: [JSON.stringify({ level: 'info-0', msg: 'x', Raw: SENTINEL }), FINISHED] }],
    ['missing "finished scanning" (producer did not finish)', [], { stderr: [log('info-0', 'running source')] }],
    ['empty stderr (producer missing)', [], { stderr: [] }],
    ['two "finished scanning" records', [], { stderr: [FINISHED, FINISHED] }],
    ['producer exit 1', [], { exit: 1 }],
    ['exit 0 with findings', [finding({ detector: 'AWS' })], { exit: 0 }],
    ['exit 183 without findings', [], { exit: 183 }],
    ['non-JSON stdout', ['not json'], {}],
    ['finding without git metadata', [JSON.stringify({ DetectorName: 'URI', Verified: false })], {}],
    ['non-git source (Filesystem)', [finding({ data: { Filesystem: { file: 'x', line: 1 } } })], {}],
    ['two metadata kinds', [finding({ data: { Git: { commit: BENIGN.commit, file: BENIGN.file, line: 7 }, Filesystem: {} } })], {}],
    ['SourceType not git', [finding({ sourceType: 15 })], {}],
    ['short commit', [finding({ commit: 'b2aadfc' })], {}],
    ['line 0', [finding({ line: 0 })], {}],
    ['line as string', [finding({ line: '7' })], {}],
    ['line missing', [finding({ line: undefined })], {}],
    ['Verified missing', [finding({ verified: undefined })], {}],
    ['Verified as string', [finding({ verified: 'false' })], {}],
    ['malformed finding carrying level', [JSON.stringify({ level: 'info-0', msg: 'x', Verified: true, DetectorName: 'AWS' })], {}],
  ];
  for (const [name, out, o] of refused) {
    it(`REFUSED (exit 2): ${name}`, () => { expect(ev(out, o).code).toBe(2); });
  }
  it('a `level` property never lets a VERIFIED finding bypass the gate', () => {
    const r = ev([finding({ verified: true, extra: { level: 'info-0', msg: 'x' } })], { ex: EX_APPROVED });
    expect(r.code).toBe(1);
    expect(r.verified).toHaveLength(1);
  });
  const fails: Array<[string, F]> = [
    ['POSITIVE CONTROL: distinct synthetic finding (other detector, file, commit)', { detector: 'AWS', file: 'src/synthetic/control.ts', line: 3, commit: 'f'.repeat(40) }],
    ['excepted identity but VERIFIED', { verified: true }],
    ['other line', { line: 8 }],
    ['other commit', { commit: 'a'.repeat(40) }],
    ['other file', { file: 'scripts/local-stack/t09/api-http.mjs.bak' }],
    ['other detector', { detector: 'Postgres' }],
  ];
  for (const [name, o] of fails) {
    it(`FAILS (exit 1) even with the approved fixture: ${name}`, () => {
      const r = ev([finding(), finding(o)], { ex: EX_APPROVED });
      expect(r.code).toBe(1);
      expect(r.excepted).toHaveLength(1);
    });
  }
  it('diagnostics are fixed text, counts and digests: no scanner field, message or Raw value', () => {
    const many = Array.from({ length: MAX_LISTED + 15 }, (_, i) => finding({ detector: 'AWS', line: i + 1, file: `src/${SENTINEL}.ts` }));
    const r = ev([...many, finding({ verified: true })], { stderr: [log('info-0', SENTINEL), FINISHED] });
    const text = report(r).join('\n');
    expect(r.code).toBe(1);
    for (const s of [SENTINEL, BENIGN.commit, BENIGN.commit.slice(0, 12), 'api-http', 'AWS', 'URI']) expect(text).not.toContain(s);
    expect(text.split('\n').length).toBeLessThanOrEqual(2 * MAX_LISTED + 8);
    expect(text).toContain(`findings=${MAX_LISTED + 16} excepted=0 pending=0 unexpected=${MAX_LISTED + 15} verified=1`);
  });
});

describe('official action equality guard', () => {
  const vendored = fs.readFileSync(path.join(ROOT, 'scripts/ci/vendor/trufflehog-action.yml'));
  it('vendored copy matches the pinned digest of the official action.yml', () => {
    expect(crypto.createHash('sha256').update(vendored).digest('hex')).toBe(PINNED_SHA256);
    expect(UPSTREAM_URL).toBe('https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/action.yml');
  });
  it('equal upstream passes; any upstream change fails', () => {
    expect(compare(vendored, vendored).equal).toBe(true);
    expect(compare(vendored, Buffer.concat([vendored, Buffer.from('\n')])).equal).toBe(false);
  });
  it('the wrapper mirrors the official refusal text, image, range flags and --fail/--no-update', () => {
    const sh = fs.readFileSync(path.join(ROOT, 'scripts/ci/trufflehog-scan.sh'), 'utf8');
    const refusal = vendored.toString().match(/echo "(::error::BASE and HEAD commits are the same\.[^"]*)"/)![1];
    expect(sh).toContain(refusal);
    expect(vendored.toString()).toContain('default: "ghcr.io/trufflesecurity/trufflehog"');
    expect(sh).toContain('ghcr.io/trufflesecurity/trufflehog}');
    for (const flag of ['git file:///tmp/', '--since-commit', '--branch', '--fail', '--no-update']) {
      expect(vendored.toString()).toContain(flag); expect(sh).toContain(flag);
    }
    expect(sh).not.toMatch(/--only-verified|--results=verified|--exclude-paths|--exclude-detectors/);
  });
});

describe('actual security.yml step with a fake docker (no download, no real scan)', () => {
  const wf = YAML.parse(fs.readFileSync(path.join(ROOT, '.github/workflows/security.yml'), 'utf8'));
  const steps = Object.values<any>(wf.jobs).flatMap((j) => j.steps ?? []);
  const scan = steps.find((s) => /TruffleHog Secret Scan/.test(s.name ?? ''));
  const guardIdx = steps.findIndex((s) => /equality guard/.test(s.name ?? ''));
  // This test writes no file contents itself (it is not a write site for the security.yml gate): git creates the
  // repo, the fake docker is a static fixture, canned scanner output travels in env vars, and the approved-fixture
  // exceptions reach the wrapper through bash process substitution.
  let tmp: string; let repo: string; let bin: string; let c1: string; let c2: string;
  const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'th-wrap-'));
    repo = path.join(tmp, 'repo'); bin = path.join(tmp, 'bin');
    fs.mkdirSync(repo); fs.mkdirSync(bin);
    const g = (...a: string[]) => spawnSync('git', a, { cwd: repo, encoding: 'utf8', env: gitEnv });
    g('init', '-q'); g('commit', '-q', '--allow-empty', '-m', 'one'); c1 = g('rev-parse', 'HEAD').stdout.trim();
    g('commit', '-q', '--allow-empty', '-m', 'two'); c2 = g('rev-parse', 'HEAD').stdout.trim();
    fs.symlinkSync(path.join(ROOT, 'scripts'), path.join(repo, 'scripts'));
    for (const t of ['bash', 'node', 'git', 'mktemp', 'chmod', 'stat', 'rm', 'dirname', 'cat', 'readlink', 'printf', 'tail']) {
      const p = spawnSync('bash', ['-c', `command -v ${t}`], { encoding: 'utf8' }).stdout.trim();
      if (p.startsWith('/')) fs.symlinkSync(p, path.join(bin, t));
    }
  });
  afterAll(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

  const MODES: Record<string, [string[], string[], number]> = {
    'valid-empty': [[], okLogs, 0],
    'other': [[finding({ detector: 'AWS', file: 'src/x.ts' })], okLogs, 183],
    'verified': [[finding({ verified: true })], okLogs, 183],
    'benign': [[finding()], okLogs, 183],
    'error-log': [[], [log('error', 'error running scan'), FINISHED], 0],
    'fatal-log': [[], [log('fatal', SENTINEL)], 1],
    'malformed': [['{"DetectorName":"URI"}'], okLogs, 183],
    'missing-output': [[], [], 0],
    'docker-fail': [[], ['docker: Error response from daemon'], 125],
    'pull-fail': [[], [], 0],
  };
  let n = 0;
  const runStep = (mode: string, o: { base?: string; head?: string; docker?: boolean; approved?: boolean; pending?: boolean; shallow?: boolean; silentGate?: boolean } = {}) => {
    n += 1;
    const rt = fs.mkdtempSync(path.join(tmp, 'rt-'));
    const logf = path.join(tmp, `log-${n}`);
    const pathDir = fs.mkdtempSync(path.join(tmp, 'path-'));
    for (const f of fs.readdirSync(bin)) {
      const target = f === 'node' && o.silentGate ? path.join(ROOT, 'src/test/ci/fixtures/silent-node.sh') : fs.readlinkSync(path.join(bin, f));
      fs.symlinkSync(target, path.join(pathDir, f));
    }
    if (o.docker !== false) fs.symlinkSync(path.join(ROOT, 'src/test/ci/fixtures/fake-docker.sh'), path.join(pathDir, 'docker'));
    let cwd = repo;
    if (o.shallow) {
      cwd = path.join(tmp, `shallow-${n}`);
      spawnSync('git', ['clone', '-q', '--depth', '1', `file://${repo}`, cwd], { env: gitEnv });
      fs.symlinkSync(path.join(ROOT, 'scripts'), path.join(cwd, 'scripts'));
    }
    const [out, err, rc] = MODES[mode];
    const script = o.approved ? `export TH_EXCEPTIONS=<(printf '%s' "$APPROVED_JSON")\n${scan.run}`
      : o.pending ? `export TH_EXCEPTIONS=<(printf '%s' "$PENDING_JSON")\n${scan.run}` : scan.run;
    const r = spawnSync('bash', ['-c', script], {
      cwd, encoding: 'utf8',
      env: { PATH: pathDir, HOME: tmp, RUNNER_TEMP: rt, BASE: o.base ?? '', HEAD: o.head ?? '', FAKE_LOG: logf,
        FAKE_OUT: out.join('\n'), FAKE_ERR: err.join('\n'), FAKE_RC: String(rc), FAKE_PULL_FAIL: mode === 'pull-fail' ? '1' : '',
        APPROVED_JSON: JSON.stringify(APPROVED_FIXTURE), PENDING_JSON: JSON.stringify(PENDING_FIXTURE) },
    });
    const calls = fs.existsSync(logf) ? fs.readFileSync(logf, 'utf8') : '';
    return { status: r.status, out: r.stdout + r.stderr, calls, leftover: fs.readdirSync(rt) };
  };

  it('the workflow runs the wrapper after the equality guard, with the unchanged range expressions', () => {
    expect(scan.run.trim()).toBe('bash scripts/ci/trufflehog-scan.sh');
    expect(scan.uses).toBeUndefined();
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(steps.indexOf(scan)).toBe(guardIdx + 1);
    expect(scan.env.BASE).toBe("${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || (github.event_name == 'push' && github.event.before != '0000000000000000000000000000000000000000') && github.event.before || '' }}");
    expect(scan.env.HEAD).toBe("${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.event_name == 'push' && github.sha || '' }}");
    const job = Object.values<any>(wf.jobs).find((j) => (j.steps ?? []).includes(scan));
    expect(job.steps.some((s: any) => /upload-artifact/.test(s.uses ?? ''))).toBe(false);
  });

  const cases: Array<[string, string, object, number]> = [
    ['valid empty scan (schedule: full history)', 'valid-empty', {}, 0],
    ['other finding', 'other', { base: c1, head: c2 }, 1],
    ['verified finding', 'verified', { base: c1, head: c2 }, 1],
    ['benign finding with the PENDING exception', 'benign', { base: c1, head: c2, pending: true }, 1],
    ['benign finding with the committed approved exception', 'benign', { base: c1, head: c2 }, 0],
    ['benign finding with an approved fixture', 'benign', { base: c1, head: c2, approved: true }, 0],
    ['error log', 'error-log', {}, 2],
    ['fatal log, exit 1', 'fatal-log', {}, 2],
    ['malformed finding', 'malformed', {}, 2],
    ['missing output (no finished log)', 'missing-output', {}, 2],
    ['docker run nonzero', 'docker-fail', {}, 2],
    ['image pull failure', 'pull-fail', {}, 8],
  ];
  for (const [name, mode, o, code] of cases) {
    it(`${name}: exit ${code}, private 0700/0600 output removed, nothing raw printed`, () => {
      const r = runStep(mode, o);
      expect(r.status).toBe(code);
      expect(r.leftover).toEqual([]);
      expect(r.out).not.toContain(SENTINEL);
      expect(r.out).not.toContain('docker: Error');
      if (mode !== 'pull-fail') {
        expect(r.calls).toMatch(/^modes 700 600 600$/m);
        expect(r.calls).toMatch(/run --rm --pull never -v \S+ -w \/tmp ghcr\.io\/trufflesecurity\/trufflehog:latest git file:\/\/\/tmp\/ --since-commit \S* ?--branch \S* ?--fail --no-update --json/);
        expect(r.out).toContain('private output removed');
      }
    });
  }
  it('passes the resolved PR range; full history when both are empty; push with HEAD only', () => {
    expect(runStep('valid-empty', { base: c1, head: c2 }).calls).toContain(`--since-commit ${c1} --branch ${c2} --fail`);
    expect(runStep('valid-empty', { base: 'HEAD~1', head: 'HEAD' }).calls).toContain(`--since-commit ${c1} --branch ${c2} --fail`);
    expect(runStep('valid-empty').calls).toContain('--since-commit  --branch  --fail');
    expect(runStep('valid-empty', { head: c2 }).calls).toContain(`--since-commit  --branch ${c2} --fail`);
  });
  it('BASE == HEAD: the official refusal, exit 1, docker never called', () => {
    const r = runStep('valid-empty', { base: c2, head: 'HEAD' });
    expect(r.status).toBe(1);
    expect(r.out).toContain("::error::BASE and HEAD commits are the same. TruffleHog won't scan anything.");
    expect(r.calls).toBe('');
  });
  it('the scripts are reached through a symlinked path (regression: the CLI entry check must not skip and exit 0)', () => {
    expect(fs.lstatSync(path.join(repo, 'scripts')).isSymbolicLink()).toBe(true);
    const r = runStep('other');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/trufflehog gate: findings=1 .* result=FAIL/);
  });
  it('a gate that exits 0 without its PASS summary is refused', () => {
    const r = runStep('valid-empty', { silentGate: true });
    expect(r.status).toBe(10);
    expect(r.out).toContain('gate exited 0 without a PASS summary');
    expect(r.leftover).toEqual([]);
  });
  it('invalid ref, missing docker, shallow clone: refused before any scan', () => {
    const bad = runStep('valid-empty', { base: 'no-such-ref', head: c2 });
    expect(bad.status).toBe(6); expect(bad.calls).toBe('');
    const nod = runStep('valid-empty', { docker: false });
    expect(nod.status).toBe(4); expect(nod.out).toContain('producer missing');
    const sh = runStep('valid-empty', { shallow: true });
    expect(sh.status).not.toBe(0); expect(sh.calls).toBe('');
  });
});
