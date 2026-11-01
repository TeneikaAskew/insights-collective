// ABOUTME: Controls for the quiz-lifecycle learner auth gate: candidate alignment uses exactly the shared auth-fixtures
// ABOUTME: rule set, probe/diagnostics print only fixed allowlisted fields, and the gate sits between fixture and browser.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
  EXPECTED_LEARNER_UID, loopbackOrigin, probe, Refusal, verdict, versionToken,
} from '../../../scripts/local-stack/quiz-lifecycle/learner-auth-probe.mjs';
import {
  diagnosticLine, isPasswordGrant, matchUiMessages, pathOnly, summarizeTokenResponse,
} from '../../../scripts/local-stack/quiz-lifecycle/login-diagnostics.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const QLC = 'scripts/local-stack/quiz-lifecycle';

/** `col = expr` pairs of the first UPDATE auth.users ... SET ... WHERE block, whitespace-normalised. */
function setClause(sql: string): string[] {
  const m = sql.match(/UPDATE auth\.users\s+SET([\s\S]*?)\n\s*WHERE/);
  expect(m, 'UPDATE auth.users SET block').toBeTruthy();
  return m![1].split(/,\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const fakeRes = (status: number, body: unknown, json = true) => ({
  status, json: async () => { if (!json) throw new Error('not json'); return body; },
});
const fetchOf = (r: unknown) => (async () => r) as unknown as typeof fetch;
const LEAK = /SECRET|BODYTEXT|9c000000|hunter2/;

describe('candidate alignment', () => {
  it('sets exactly the column rules of the shared auth-fixtures builder (no new hand-maintained subset)', () => {
    expect(setClause(read(`${QLC}/learner-auth-align.sql`))).toEqual(setClause(read('scripts/local-stack/auth-fixtures.sql')));
  });
  it('touches exactly one row by id AND email, inserts and deletes nothing, and refuses otherwise', () => {
    const sql = read(`${QLC}/learner-auth-align.sql`);
    expect(sql).toContain("WHERE id = v_learner AND email = v_email;");
    expect(sql).toMatch(/IF v_n <> 1 THEN RAISE EXCEPTION/);
    expect(sql).not.toMatch(/\b(INSERT|DELETE|TRUNCATE|DROP|ALTER|GRANT|REVOKE)\b/);
  });
  it('the original fixture seed is unchanged from the 882 run commit', () => {
    const at882 = execFileSync('git', ['show', '882e76d:scripts/local-stack/quiz-lifecycle/fixture.sql'], { cwd: ROOT, encoding: 'utf8' });
    expect(read(`${QLC}/fixture.sql`)).toBe(at882);
  });
});

describe('null-state inspector', () => {
  it('is read-only and every field it emits is in the shell grammar', () => {
    const sql = read(`${QLC}/learner-auth-state.sql`);
    expect(sql).toMatch(/begin transaction read only;/);
    expect(sql.trim().endsWith('rollback;')).toBe(true);
    const keys = [...sql.matchAll(/'([a-z_]+)=' \|\|/g)].map((m) => m[1]);
    const sh = read(`${QLC}/learner-auth-state.sh`);
    const grammar = [...sh.matchAll(/ ([a-z_]+)=\$B/g)].map((m) => m[1]).concat('identity_rows');
    expect(keys).toEqual(grammar);
    expect(sql).not.toMatch(/select\s+(id|email|encrypted_password)\b/i);
  });
});

describe('sign-in probe', () => {
  it('passes only on 200 with a token and the EXPECTED learner id, printing booleans only', async () => {
    const ok = await probe({ api: 'http://127.0.0.1:1', anonKey: 'k', password: 'hunter2', fetchImpl: fetchOf(fakeRes(200, { access_token: 'SECRET', user: { id: EXPECTED_LEARNER_UID } })) });
    expect(ok).toEqual({ ok: true, line: 'auth-probe method=POST path=/auth/v1/token grant=password status=200 error_code=none uid_present=true uid_match=true' });
    const other = await probe({ api: 'http://127.0.0.1:1', anonKey: 'k', password: 'hunter2', fetchImpl: fetchOf(fakeRes(200, { access_token: 'SECRET', user: { id: '9c000000-0000-4000-8000-0000000000ff' } })) });
    expect(other.ok).toBe(false);
    expect(other.line).toContain('uid_present=true uid_match=false');
    for (const r of [ok, other]) expect(r.line).not.toMatch(LEAK);
  });
  it('classifies failures into fixed tokens', async () => {
    const run = (r: unknown) => probe({ api: 'http://127.0.0.1:1', anonKey: 'k', password: 'hunter2', fetchImpl: fetchOf(r) });
    expect((await run(fakeRes(400, { error_code: 'invalid_credentials', msg: 'BODYTEXT' }))).line).toContain('status=400 error_code=invalid_credentials uid_present=false uid_match=false');
    expect((await run(fakeRes(500, { error_code: 'BODYTEXT-free-form' }))).line).toContain('status=500 error_code=other');
    expect((await run(fakeRes(302, null))).line).toContain('status=302 error_code=redirect');
    expect((await run(fakeRes(200, null, false))).line).toContain('status=200 error_code=non-json');
    const t = await probe({ api: 'http://127.0.0.1:1', anonKey: 'k', password: 'hunter2', fetchImpl: (async () => { throw new Error('SECRET'); }) as unknown as typeof fetch });
    expect(t.line).toContain('status=none error_code=transport');
    expect(verdict(200, { access_token: '', user: { id: EXPECTED_LEARNER_UID } }).ok).toBe(false);
  });
  it('reduces the GoTrue health version to a strict token', () => {
    expect(versionToken({ version: 'v2.177.0' })).toBe('v2.177.0');
    expect(versionToken({ version: 'v2.177.0; SECRET' })).toBe('other');
    expect(versionToken({})).toBe('none');
  });
  it('refuses non-loopback, credentialed or path-bearing origins', () => {
    for (const v of ['https://127.0.0.1:1', 'http://example.com:80', 'http://127.0.0.1', 'http://u:p@127.0.0.1:1', 'http://127.0.0.1:1/x']) {
      expect(() => loopbackOrigin(v, 'X')).toThrow(Refusal);
    }
    expect(loopbackOrigin('http://127.0.0.1:54321', 'X')).toBe('http://127.0.0.1:54321');
  });
  it('as a process: refuses before any request, never echoes env values, and takes no secret from argv', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, `${QLC}/learner-auth-probe.mjs`)], {
      env: { PATH: process.env.PATH, VITE_SUPABASE_URL: 'http://SECRET.example:80', E2E_BASE_URL: 'http://127.0.0.1:2', VITE_SUPABASE_ANON_KEY: 'x'.repeat(30), E2E_TEST_PASSWORD: 'hunter2' }, encoding: 'utf8',
    });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('REFUSED auth-probe: VITE_SUPABASE_URL must be 127.0.0.1 or localhost\n');
    expect(r.stdout + r.stderr).not.toMatch(LEAK);
    const extra = spawnSync(process.execPath, [path.join(ROOT, `${QLC}/learner-auth-probe.mjs`), 'hunter2'], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    expect(extra.status).toBe(2);
    expect(extra.stdout).toBe('REFUSED auth-probe: unexpected argument\n');
  });
});

describe('login failure diagnostics', () => {
  it('recognises only the password grant and keeps no response value', () => {
    expect(isPasswordGrant('POST', 'http://127.0.0.1:54321/auth/v1/token?grant_type=password')).toBe(true);
    expect(isPasswordGrant('POST', 'http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token')).toBe(false);
    expect(isPasswordGrant('GET', 'http://127.0.0.1:54321/auth/v1/token?grant_type=password')).toBe(false);
    const s = summarizeTokenResponse(400, { error_code: 'invalid_credentials', msg: 'BODYTEXT' });
    expect(s).toEqual({ status: 400, errorCode: 'invalid_credentials', uidPresent: false });
  });
  it('emits one fixed line with allowlisted UI messages only', () => {
    const ui = matchUiMessages('Welcome SECRET Invalid login credentials hunter2');
    expect(ui).toEqual(['Invalid login credentials']);
    const line = diagnosticLine({ test: 'F2 resume: same attempt hunter2?', urlPath: pathOnly('http://127.0.0.1:8080/login?next=SECRET'), attempts: 1, transportFailures: 0, last: summarizeTokenResponse(400, { error_code: 'invalid_credentials' }), ui });
    expect(line).toBe('login-setup test=f2-resume-same-attempt-hunter2 url_path=/login token_requests=1 transport_failures=0 method=POST path=/auth/v1/token grant=password last_status=400 error_code=invalid_credentials uid_present=false ui_message=invalid-login-credentials');
  });
});

describe('no-Edge job wiring', () => {
  const JOB = YAML.parse(read('.github/workflows/e2e.yml')).jobs['learner-quiz-noedge'];
  const STEPS = JOB.steps as { name?: string; run?: string; if?: string }[];
  const at = (re: RegExp) => STEPS.findIndex((s) => re.test(String(s.run ?? '')));
  it('runs the gate after the unchanged fixture and before the guard selftest and the browser cases, unconditionally gating them', () => {
    const gate = at(/quiz-lifecycle\/auth-gate\.sh \| tee "\$LQ_EVIDENCE\/qlc\/checks-auth-gate\.txt"/);
    expect(gate).toBeGreaterThan(at(/quiz-lifecycle\/fixture\.sh/));
    expect(gate).toBeLessThan(at(/noedge-selftest\.sh/));
    expect(gate).toBeLessThan(at(/playwright test -c/));
    expect(STEPS[gate].if).toBeUndefined();
    expect(STEPS[gate].run).toContain('set -o pipefail');
    for (const s of STEPS.slice(gate + 1, at(/playwright test -c/) + 1)) expect(s.if).toBeUndefined();
  });
  it('stages the gate receipt and the login diagnostics directory', () => {
    const text = STEPS.map((s) => String(s.run ?? '')).join('\n');
    expect(text).toContain('"$E/qlc/checks-auth-gate.txt"');
    expect(text).toContain('for d in ledger screens playwright login-diagnostics;');
  });
});
