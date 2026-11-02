// ABOUTME: Controls for scripts/e2e/stack-ownership.mjs (schema v1): exact keys, loopback-only origins, mode/size limits,
// ABOUTME: run and live-cluster binding, no overwrite, fixed CLI lines. The fake fixture is the consumer contract.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildRecord, readRecord, verifyRecord, writeRecord, schemaProblem, KEYS, CODES,
} from '../../../scripts/e2e/stack-ownership.mjs';
import { scratchFile, appendGrowth } from '../../../scripts/e2e/tests/scratch-files.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const MOD = path.join(ROOT, 'scripts/e2e/stack-ownership.mjs');
const FAKE = path.join(ROOT, 'scripts/e2e/fixtures/stack-ownership.fake.json');
const fake = () => JSON.parse(fs.readFileSync(FAKE, 'utf8'));
const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'so-')); dirs.push(d); return d; };
afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true }); });
const put = (obj: unknown, mode = 0o600) => scratchFile(tmp(), 'so.json', JSON.stringify(obj), mode);
const BOOT = '0'.repeat(64); // the fake's bootstrap_sha256
const ctx = { runId: '1000000001', runAttempt: '1', liveSystemIdentifier: '7400000000000000001', apiOrigin: 'http://127.0.0.1:54321', appOrigin: 'http://127.0.0.1:4173', expectedBootstrapSha256: BOOT };

describe('schema v1', () => {
  it('the committed fake is a valid record with exactly the schema keys', () => {
    expect(schemaProblem(fake())).toBeNull();
    expect(Object.keys(fake()).sort()).toEqual([...KEYS].sort());
  });
  it.each([
    ['extra key (e.g. a DSN)', { dsn: 'postgresql://x' }, 'keys'],
    ['non-loopback api origin', { api_origin: 'https://abc.supabase.co' }, 'api_origin'],
    ['origin with a path', { app_origin: 'http://127.0.0.1:4173/x' }, 'app_origin'],
    ['port 0', { api_origin: 'http://127.0.0.1:00' }, 'api_origin'],
    ['run id not digits', { run_id: 'abc' }, 'run_id'],
    ['system identifier as number', { pg_system_identifier: 7400000001 }, 'pg_system_identifier'],
    ['disposable false', { disposable: false }, 'disposable'],
    ['disposable "true" string', { disposable: 'true' }, 'disposable'],
    ['bad sha', { bootstrap_sha256: 'xyz' }, 'bootstrap_sha256'],
    ['schema 2', { schema: 2 }, 'schema'],
    ['bad date', { created_at: 'yesterday' }, 'created_at'],
  ])('refuses %s', (_n, patch, reason) => {
    expect(schemaProblem({ ...fake(), ...patch })).toBe(reason);
  });
  it('a missing key is refused', () => { const r = fake(); delete r.run_attempt; expect(schemaProblem(r)).toBe('keys'); });
});

describe('verifyRecord (consumer side)', () => {
  it('passes for the same run and the same live cluster', () => {
    expect(verifyRecord(put(fake()), ctx)).toMatchObject({ ok: true, code: 'SO_OK' });
  });
  it('absent file or unset path refuses with SO_ABSENT', () => {
    expect(verifyRecord(path.join(tmp(), 'nope.json'), ctx).code).toBe('SO_ABSENT');
    expect(verifyRecord(undefined as any, ctx).code).toBe('SO_ABSENT');
  });
  it('a FIFO (0600, no writer) is refused at once, never blocks', () => {
    const d = tmp(); const f = path.join(d, 'so.json');
    execFileSync('mkfifo', ['-m', '600', f]);
    const t0 = Date.now();
    expect(verifyRecord(f, ctx)).toMatchObject({ code: 'SO_ABSENT', reason: 'not_regular_file' });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it('a FIFO in a child process returns within 2 s (hang control, real module)', () => {
    const d = tmp(); const f = path.join(d, 'so.json');
    execFileSync('mkfifo', ['-m', '600', f]);
    let res: { out: string; status: number | null; signal: string | null };
    try {
      res = { out: execFileSync('node', [MOD, 'verify', ctx.apiOrigin, ctx.appOrigin, BOOT], {
        env: { PATH: process.env.PATH!, STACK_OWNERSHIP_FILE: f, GITHUB_RUN_ID: '1000000001', GITHUB_RUN_ATTEMPT: '1' },
        input: ctx.liveSystemIdentifier, encoding: 'utf8', timeout: 2000,
      }), status: 0, signal: null };
    } catch (e: any) { res = { out: String(e.stdout), status: e.status, signal: e.signal }; }
    expect(res.signal).toBeNull(); // not killed by the 2 s timeout
    expect(res).toMatchObject({ out: 'stack-ownership SO_ABSENT reason=not_regular_file\n', status: 3 });
  });
  it('a directory is refused (not a regular file)', () => {
    const d = tmp(); const sub = path.join(d, 'so.json'); fs.mkdirSync(sub, { mode: 0o700 });
    expect(verifyRecord(sub, ctx).code).toBe('SO_ABSENT');
  });
  it('a broken symlink is refused', () => {
    const d = tmp(); const link = path.join(d, 'so.json'); fs.symlinkSync(path.join(d, 'nowhere.json'), link);
    expect(verifyRecord(link, ctx)).toMatchObject({ code: 'SO_ABSENT', reason: 'not_regular_file' });
  });
  it('a read error on the opened descriptor is a fixed SO_PARSE read, and the descriptor is closed', () => {
    const f = put(fake());
    const realRead = fs.readSync; const realClose = fs.closeSync; let closed = 0;
    (fs as any).readSync = () => { throw Object.assign(new Error('EIO'), { code: 'EIO' }); };
    (fs as any).closeSync = (fd: number) => { closed += 1; return realClose(fd); };
    try { expect(verifyRecord(f, ctx)).toMatchObject({ code: 'SO_PARSE', reason: 'read' }); }
    finally { (fs as any).readSync = realRead; (fs as any).closeSync = realClose; }
    expect(closed).toBe(1);
  });
  it('growth after fstat beyond the limit is SO_SIZE (bounded read)', () => {
    const f = put(fake());
    const realFstat = fs.fstatSync;
    (fs as any).fstatSync = (fd: number) => { const st = realFstat(fd); appendGrowth(f); return st; };
    try { expect(verifyRecord(f, ctx)).toMatchObject({ code: 'SO_SIZE', reason: 'too_large' }); }
    finally { (fs as any).fstatSync = realFstat; }
  });
  it('a symlink is not accepted as the record', () => {
    const d = tmp(); const real = put(fake()); const link = path.join(d, 'link.json'); fs.symlinkSync(real, link);
    expect(verifyRecord(link, ctx).code).toBe('SO_ABSENT');
  });
  it.each([0o644, 0o400, 0o700, 0o640])('mode %o is not exactly 0600: SO_MODE', (m) => {
    expect(verifyRecord(put(fake(), m), ctx)).toMatchObject({ code: 'SO_MODE', reason: 'not_0600' });
  });
  it('the reviewer-raised gaps are closed: attempt and origins are required and compared', () => {
    expect(verifyRecord(put(fake()), { ...ctx, runAttempt: '' })).toMatchObject({ code: 'SO_INPUT', reason: 'run_attempt_env' });
    expect(verifyRecord(put(fake()), { ...ctx, apiOrigin: undefined as any })).toMatchObject({ code: 'SO_INPUT', reason: 'expected_origins' });
    expect(verifyRecord(put(fake()), { ...ctx, apiOrigin: 'http://127.0.0.1:54322' })).toMatchObject({ code: 'SO_ORIGIN_MISMATCH', reason: 'api_origin' });
    expect(verifyRecord(put(fake()), { ...ctx, appOrigin: 'http://localhost:4173' })).toMatchObject({ code: 'SO_ORIGIN_MISMATCH', reason: 'app_origin' });
  });
  it('oversize refuses with SO_SIZE; non-JSON with SO_PARSE; bad shape with SO_SCHEMA', () => {
    const big = scratchFile(tmp(), 'big.json', 'x'.repeat(5000));
    expect(verifyRecord(big, ctx).code).toBe('SO_SIZE');
    const bad = scratchFile(tmp(), 'bad.json', '{');
    expect(verifyRecord(bad, ctx).code).toBe('SO_PARSE');
    expect(verifyRecord(put({ ...fake(), disposable: false }), ctx)).toMatchObject({ code: 'SO_SCHEMA', reason: 'disposable' });
  });
  it('another run or attempt refuses with SO_RUN_MISMATCH', () => {
    expect(verifyRecord(put(fake()), { ...ctx, runId: '1000000002' })).toMatchObject({ code: 'SO_RUN_MISMATCH', reason: 'run_id' });
    expect(verifyRecord(put(fake()), { ...ctx, runAttempt: '2' })).toMatchObject({ code: 'SO_RUN_MISMATCH', reason: 'run_attempt' });
  });
  it('a different live cluster refuses with SO_SYSID_MISMATCH; a missing live read is SO_INPUT, never a pass', () => {
    expect(verifyRecord(put(fake()), { ...ctx, liveSystemIdentifier: '7400000000000000002' }).code).toBe('SO_SYSID_MISMATCH');
    expect(verifyRecord(put(fake()), { ...ctx, liveSystemIdentifier: '' }).code).toBe('SO_INPUT');
    expect(verifyRecord(put(fake()), { ...ctx, runId: '' }).code).toBe('SO_INPUT');
  });
  it('the bootstrap identity is PINNED by the consumer: a well-formed but different digest refuses', () => {
    expect(verifyRecord(put(fake()), { ...ctx, expectedBootstrapSha256: 'a'.repeat(64) }))
      .toMatchObject({ code: 'SO_BOOTSTRAP_MISMATCH', reason: 'bootstrap_sha256' });
    expect(verifyRecord(put(fake()), { ...ctx, expectedBootstrapSha256: undefined as any }))
      .toMatchObject({ code: 'SO_INPUT', reason: 'expected_bootstrap_sha256' });
  });
  it('every code is from the fixed list', () => { expect(CODES).toContain('SO_SYSID_MISMATCH'); });
});

describe('writer', () => {
  it('builds, writes 0600, and refuses to overwrite', () => {
    const f = path.join(tmp(), 'so.json');
    const rec = buildRecord({ runId: '5', runAttempt: '1', systemIdentifier: '42\n', apiOrigin: 'http://127.0.0.1:54321',
      appOrigin: 'http://localhost:4173', bootstrapSha256: 'a'.repeat(64), createdAt: '2026-11-02T00:00:00Z' });
    writeRecord(f, rec);
    expect(fs.statSync(f).mode & 0o777).toBe(0o600);
    expect(readRecord(f)).toMatchObject({ ok: true });
    expect(() => writeRecord(f, rec)).toThrow();
  });
  it('refuses to build with a non-loopback origin', () => {
    expect(() => buildRecord({ runId: '5', runAttempt: '1', systemIdentifier: '42', apiOrigin: 'https://x.supabase.co',
      appOrigin: 'http://127.0.0.1:4173', bootstrapSha256: 'a'.repeat(64) })).toThrow(/api_origin/);
  });
});

describe('CLI: one fixed line, exit 0 or 3', () => {
  const BOOT_CLI = createHash('sha256').update('echo bootstrap\n').digest('hex');
  const O = ['http://127.0.0.1:54321', 'http://127.0.0.1:4173', BOOT_CLI];
  const cli = (args: string[], env: Record<string, string>, input: string) => {
    try { return { out: execFileSync('node', [MOD, ...args], { env: { PATH: process.env.PATH!, ...env }, input, encoding: 'utf8' }), code: 0 }; }
    catch (e: any) { return { out: String(e.stdout), code: e.status }; }
  };
  it('write then verify round trip; mismatch is exit 3 with a fixed reason', () => {
    const d = tmp(); const f = path.join(d, 'so.json'); const boot = scratchFile(d, 'boot.sh', 'echo bootstrap\n');
    const env = { STACK_OWNERSHIP_FILE: f, GITHUB_RUN_ID: '77', GITHUB_RUN_ATTEMPT: '1' };
    expect(cli(['write', 'http://127.0.0.1:54321', 'http://127.0.0.1:4173', boot], env, '7400000000000000009\n'))
      .toEqual({ out: 'stack-ownership SO_OK reason=written\n', code: 0 });
    expect(cli(['verify', ...O], env, '7400000000000000009')).toEqual({ out: 'stack-ownership SO_OK reason=verified\n', code: 0 });
    expect(cli(['verify', ...O], { ...env, GITHUB_RUN_ID: '78' }, '7400000000000000009'))
      .toEqual({ out: 'stack-ownership SO_RUN_MISMATCH reason=run_id\n', code: 3 });
    expect(cli(['verify', ...O], env, '1')).toEqual({ out: 'stack-ownership SO_SYSID_MISMATCH reason=pg_system_identifier\n', code: 3 });
    expect(cli(['write', 'http://127.0.0.1:54321', 'http://127.0.0.1:4173', boot], env, '7400000000000000009').code).toBe(3); // no overwrite
  });
  it('output never echoes the system identifier, origins or file path', () => {
    const d = tmp(); const f = path.join(d, 'so.json');
    const r = cli(['verify', ...O], { STACK_OWNERSHIP_FILE: f, GITHUB_RUN_ID: '77', GITHUB_RUN_ATTEMPT: '1' }, '7400000000000000009');
    expect(r).toEqual({ out: 'stack-ownership SO_ABSENT reason=missing\n', code: 3 });
    expect(r.out).not.toContain(d);
  });
});
