// ABOUTME: Fake-psql controls for the #159 narrow-reads tier (no database, no service): the real tier.sh and nr-psql.mjs run
// ABOUTME: against a FAKE psql on PATH. Transport (argv/env/HOME/rc/passfile/markers), fixed output, causal failures, cleanup.
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const TIER = 'scripts/local-stack/narrow-reads/tier.sh';
const FAKE = path.join(__dirname, 'fixtures/nr-fake-psql');
const SRC = readFileSync(path.join(ROOT, TIER), 'utf8');
const lit = (name: string) => (new RegExp(`^${name}='([^']*)'$`, 'm').exec(SRC) as RegExpExecArray)[1];
const CASES = (/^CASES="([^"]*)"$/m.exec(SRC) as RegExpExecArray)[1];
const MARK = 'HOSTILE-MARKER';
const LINE = /^(STAGE [A-Z][A-Z0-9_]{0,39} (PASS|FAIL) status=-?[0-9]{1,3} category=[A-Z]{2,12} count=[0-9]{1,4}|TIER (PASS|FAIL) stages=[0-9]+)$/;
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

function run(opts: { scenario?: string; dsn?: string; root?: string; extraEnv?: Record<string, string> } = {}) {
  const t = mkdtempSync(path.join(os.tmpdir(), 'nr-fake-')); temps.push(t);
  const fake = path.join(t, 'fake'), rt = path.join(t, 'runner-temp');
  mkdirSync(fake); mkdirSync(rt);
  const env: Record<string, string> = {
    PATH: `${FAKE}:${process.env.PATH}`, HOME: path.join(t, 'home'), RUNNER_TEMP: rt,
    SUPABASE_DB_URL: opts.dsn ?? `postgresql://postgres:${MARK}-PW@127.0.0.1:54322/postgres`,
    PGPASSWORD: `${MARK}-ENV`, PGOPTIONS: `-c application_name=${MARK}-ENV`, PGPASSFILE: path.join(t, 'ambient-pgpass'),
    E2E_TEST_PASSWORD: `${MARK}-ENV`,
    NR_FAKE_DIR: fake, NR_FAKE_SCENARIO: opts.scenario ?? 'ok', NR_FAKE_CASES: CASES,
    NR_FAKE_OLD_SET: lit('OLD_SET'), NR_FAKE_NEW_SET: lit('NEW_SET'), ...opts.extraEnv,
  };
  mkdirSync(env.HOME); writeFileSync(path.join(env.HOME, '.psqlrc'), `\\echo ${MARK}-rc\n`);
  const r = spawnSync('bash', [path.join(opts.root ?? ROOT, TIER)], { env, encoding: 'utf8' });
  let calls: Array<Record<string, unknown>> = [];
  try { calls = readFileSync(path.join(fake, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* none */ }
  const out = r.stdout + r.stderr;
  return { status: r.status, out, lines: out.trim().split('\n'), calls, leftovers: readdirSync(rt) };
}
const fixedOnly = (lines: string[]) => { for (const l of lines) expect(l, l).toMatch(LINE); };

describe('narrow-reads tier against a fake psql', { timeout: 30000 }, () => {
  it('full sequence passes; every call is password-free, -X -w, stripped env, private HOME and 0600 passfile', () => {
    const r = run();
    expect(r.status, r.out).toBe(0);
    fixedOnly(r.lines);
    expect(r.out).not.toContain(MARK);
    expect(r.lines.map((l) => l.split(' ').slice(0, 3).join(' '))).toEqual([
      ...['PINS', 'TARGET', 'LEDGER_INIT', 'S0_CATALOG', 'S0_POLICYSET', 'BASELINE', 'H0_ROWHASH', 'MATRIX_OLD_1', 'APPLY', 'S1_CATALOG',
        'S1_POLICYSET', 'S1_STABLE', 'H1_ROWHASH', 'H1_SAME', 'MATRIX_NEW_1', 'ROLLBACK', 'S2_CATALOG', 'S2_EQUALS_S0', 'H2_ROWHASH',
        'H2_SAME', 'MATRIX_OLD_2', 'REAPPLY', 'S3_CATALOG', 'S3_EQUALS_S1', 'H3_ROWHASH', 'H3_SAME', 'MATRIX_NEW_2', 'LEDGER_FINAL',
        'CLEANUP'].map((n) => `STAGE ${n} PASS`),
      'TIER PASS stages=28',
    ]);
    expect(r.lines).toContain('STAGE MATRIX_OLD_1 PASS status=3 category=OK count=26');
    expect(r.lines).toContain('STAGE MATRIX_NEW_2 PASS status=0 category=OK count=26');
    expect(r.lines).toContain('STAGE LEDGER_FINAL PASS status=0 category=OK count=0');
    expect(r.lines).toContain('STAGE CLEANUP PASS status=0 category=OK count=0');
    expect(r.calls.map((c) => c.file + (c.apply ? `:${c.step}` : ''))).toEqual([
      'ledger.sql', 'catalog.sql', 'baseline.sql', 'rowhash.sql', 'matrix.sql',
      '20261102000000_narrow_quiz_feedback_blog_settings_reads.sql:apply', 'catalog.sql', 'rowhash.sql', 'matrix.sql',
      'rollback.sql:rollback', 'catalog.sql', 'rowhash.sql', 'matrix.sql',
      '20261102000000_narrow_quiz_feedback_blog_settings_reads.sql:reapply', 'catalog.sql', 'rowhash.sql', 'matrix.sql', 'ledger.sql',
    ]);
    for (const c of r.calls) {
      expect(c.argv).toEqual(['-X', '-q', '-At', '-w', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-f', '-']);
      expect(c.argvMark).toBe(false); expect(c.stdinMark).toBe(false);
      expect(c.envNames).toEqual(['PGPASSFILE']);            // no PGPASSWORD, PGOPTIONS, SUPABASE_DB_URL or E2E_* secret
      expect(c.envMark).toBe(false);
      expect(c.pfMode).toBe('600'); expect(c.pfMark).toBe(true);   // the password reaches psql only through the passfile
      expect(c.home).toBe(c.pfDir);                         // HOME is the private dir; the hostile ~/.psqlrc is not in it
    }
    expect(r.leftovers).toEqual([]);
  });

  it('(6) a producer that prints the expected bytes but exits 19 fails at that stage, not at a comparison', () => {
    const r = run({ scenario: 'rowhash_exit19' });
    expect(r.status).toBe(1); fixedOnly(r.lines);
    expect(r.lines).toContain('STAGE H1_ROWHASH FAIL status=19 category=EXIT count=0');
    expect(r.out).not.toContain('H1_SAME'); expect(r.lines.at(-1)).toMatch(/^TIER FAIL /);
    expect(r.leftovers).toEqual([]);
  });

  it('(4) the r1 matrix behaviour (26 PASS on the snapshot) is refused at MATRIX_OLD_1', () => {
    const r = run({ scenario: 'old_r1' });
    expect(r.status).toBe(1); fixedOnly(r.lines);
    expect(r.lines).toContain('STAGE MATRIX_OLD_1 FAIL status=0 category=EXPECTATION count=0');
    expect(r.calls.some((c) => c.apply)).toBe(false);          // nothing applied after the refusal
  });

  it('(5) one PASS line with a claimed CHECKS 26 is refused by inventory', () => {
    const r = run({ scenario: 'new_one_line' });
    expect(r.status).toBe(1); fixedOnly(r.lines);
    expect(r.lines).toContain('STAGE MATRIX_NEW_1 FAIL status=0 category=INVENTORY count=25');
  });

  it('(3) raw text in producer output never reaches stdout; it fails as GRAMMAR and the private dir is removed', () => {
    for (const [sc, want] of [['catalog_marker', 'STAGE S0_CATALOG FAIL status=0 category=GRAMMAR count=0'], ['matrix_marker', 'STAGE MATRIX_OLD_1 FAIL status=3 category=GRAMMAR count=1']]) {
      const r = run({ scenario: sc });
      expect(r.status).toBe(1); fixedOnly(r.lines); expect(r.out).not.toContain(MARK);
      expect(r.lines).toContain(want); expect(r.leftovers).toEqual([]);
    }
  });

  it('(2) a failed apply stops with EXIT and its raw ERROR stays private', () => {
    const r = run({ scenario: 'apply_fail' });
    expect(r.status).toBe(1); fixedOnly(r.lines); expect(r.out).not.toContain(MARK);
    expect(r.lines).toContain('STAGE APPLY FAIL status=3 category=EXIT count=0');
    expect(r.leftovers).toEqual([]);
  });

  it('target refusal: a non-loopback DSN is TARGET with zero psql calls', () => {
    // Assembled from parts at runtime (noCredentialShapedLiterals): a non-loopback host with a marker password.
    const r = run({ dsn: ['postgresql://postgres', `${MARK}-PW`].join(':') + ['', 'db.example.invalid:5432/postgres'].join('@') });
    expect(r.status).toBe(1); fixedOnly(r.lines); expect(r.out).not.toContain(MARK);
    expect(r.lines).toContain('STAGE TARGET FAIL status=2 category=TARGET count=0');
    expect(r.calls).toEqual([]); expect(r.leftovers).toEqual([]);
  });

  it('a DSN argument is refused (the DSN is never argv)', () => {
    const t = mkdtempSync(path.join(os.tmpdir(), 'nr-arg-')); temps.push(t);
    const r = spawnSync('bash', [path.join(ROOT, TIER), `postgresql://postgres:${MARK}@127.0.0.1:54322/postgres`], { encoding: 'utf8', env: { PATH: `${FAKE}:${process.env.PATH}`, RUNNER_TEMP: t, NR_FAKE_DIR: t } });
    expect(r.status).toBe(1); expect(r.stdout + r.stderr).not.toContain(MARK);
    expect(r.stdout.trim().split('\n')).toEqual(['STAGE USAGE FAIL status=2 category=INTERNAL count=0', 'TIER FAIL stages=0']);
  });

  it('pin refusal: one changed byte in a pinned file stops before any psql call', () => {
    const t = mkdtempSync(path.join(os.tmpdir(), 'nr-pin-')); temps.push(t);
    const pins = [...SRC.matchAll(/^"([^|"]+)\|[0-9a-f]{40}\|[0-9a-f]{64}"$/gm)].map((m) => m[1]);
    for (const p of [...pins, TIER]) { mkdirSync(path.dirname(path.join(t, p)), { recursive: true }); cpSync(path.join(ROOT, p), path.join(t, p)); }
    const led = path.join(t, 'scripts/local-stack/narrow-reads/ledger.sql');
    writeFileSync(led, readFileSync(led, 'utf8') + ' ');
    const r = run({ root: t });
    expect(r.status).toBe(1); fixedOnly(r.lines);
    expect(r.lines[0]).toBe('STAGE PINS FAIL status=0 category=PIN count=1');
    expect(r.calls).toEqual([]); expect(r.leftovers).toEqual([]);
  });
});
