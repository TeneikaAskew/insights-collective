// ABOUTME: Contract controls for the t09-runtime job: the API tier is REQUIRED (T09_TIER=full, stage-app fails before any work
// ABOUTME: when its configuration is missing), and both status-export blocks remove the private status files on every exit path.
//
// Executed controls use only fakes: a fake `psql` / `npx` on PATH that log their invocation, a temp RUNNER_TEMP and GITHUB_ENV,
// and a fixed fake secret. Nothing contacts a database or a network. T09_WF_UNDER_TEST / T09_STAGE_APP_UNDER_TEST let the
// SAME controls run against another revision's files for a causal before/after receipt.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');
const WF_PATH = process.env.T09_WF_UNDER_TEST || path.join(ROOT, '.github/workflows/e2e.yml');
const STAGE_APP = process.env.T09_STAGE_APP_UNDER_TEST || path.join(ROOT, 'scripts/local-stack/t09/stage-app.sh');
const WF = YAML.parse(readFileSync(WF_PATH, 'utf8'));
const JOB = WF.jobs['t09-runtime'];
const STEPS = JOB.steps as Array<{ name?: string; run?: string; env?: Record<string, string> }>;
const SECRET = 'FAKE_STATUS_SECRET_7c1d';

function fakeBin(dir: string, name: string, body: string) {
  const f = path.join(dir, name);
  writeFileSync(f, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(f, 0o700);
}

describe('t09-runtime contract: the API tier is required', () => {
  it('the job pins T09_TIER=full and no step overrides it or unsets the API configuration', () => {
    expect(JOB.env?.T09_TIER).toBe('full');
    for (const s of STEPS) {
      expect(s.env?.T09_TIER, s.name).toBeUndefined();
      expect(s.run ?? '', s.name).not.toMatch(/T09_TIER=|unset +T09_|-u +T09_|sql-only/);
    }
    const stage = STEPS.filter((s) => /STAGE APP/.test(s.name ?? ''));
    expect(stage.map((s) => s.name?.slice(0, 3))).toEqual(['OLD', 'NEW']);
    for (const s of stage) expect(s.run).toMatch(/scripts\/local-stack\/t09\/stage-app\.sh "\$SUPABASE_DB_URL" (OLD|NEW)/);
  });

  // Each case: environment for stage-app, the message it must print. A fake psql logs any call, so "nothing ran" is checked.
  const refused: Array<[string, Record<string, string>, RegExp]> = [
    ['T09_TIER unset', {}, /T09_TIER must be 'full' or 'sql-only'/],
    ['T09_TIER unknown', { T09_TIER: 'api' }, /T09_TIER must be 'full' or 'sql-only'/],
    ['full without T09_API_URL', { T09_TIER: 'full' }, /requires T09_API_URL/],
    ['full without key files', { T09_TIER: 'full', T09_API_URL: 'http://127.0.0.1:54321' }, /requires T09_ANON_KEY_FILE/],
    ['full with a world-readable key file', { T09_TIER: 'full', T09_API_URL: 'http://127.0.0.1:54321', KEYMODE: '644' }, /non-empty mode-600 file/],
    ['sql-only with T09_API_URL set', { T09_TIER: 'sql-only', T09_API_URL: 'http://127.0.0.1:54321' }, /ambiguous/],
  ];
  for (const [label, extra, msg] of refused) {
    it(`stage-app refuses before any database work: ${label}`, () => {
      const dir = mkdtempSync(path.join(tmpdir(), 't09-tier-'));
      const log = path.join(dir, 'psql.log');
      fakeBin(dir, 'psql', `echo "psql $*" >> "${log}"; exit 0`);
      const env: Record<string, string> = { PATH: `${dir}:${process.env.PATH}`, HOME: dir };
      const { KEYMODE, ...rest } = extra;
      Object.assign(env, rest);
      if (extra.T09_API_URL && !label.includes('without key files')) {
        for (const k of ['anon', 'service']) { writeFileSync(path.join(dir, k), 'fake-key'); chmodSync(path.join(dir, k), Number.parseInt(KEYMODE ?? '600', 8)); }
        Object.assign(env, { T09_ANON_KEY_FILE: path.join(dir, 'anon'), T09_SERVICE_KEY_FILE: path.join(dir, 'service'), T09_PERSONA_FILE: path.join(dir, 'personas.json') });
      }
      const r = spawnSync('bash', [STAGE_APP, 'postgresql://postgres@127.0.0.1:1/t09_contract', 'NEW'], { env, encoding: 'utf8' });
      expect(r.status, r.stdout + r.stderr).not.toBe(0);
      expect(r.stdout).toMatch(msg);
      expect(existsSync(log), 'no psql call may happen before the tier is validated').toBe(false);
    });
  }

  it('control (non-vacuous): a valid sql-only invocation does reach psql through the same fake', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 't09-tier-'));
    const log = path.join(dir, 'psql.log');
    fakeBin(dir, 'psql', `echo "psql $*" >> "${log}"; exit 1`);
    const r = spawnSync('bash', [STAGE_APP, 'postgresql://postgres@127.0.0.1:1/t09_contract', 'NEW'], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, T09_TIER: 'sql-only' }, encoding: 'utf8' });
    expect(r.stdout).toMatch(/LOCAL SQL-ONLY MODE: no API tier; this run is NOT full-CI acceptance/);
    expect(existsSync(log)).toBe(true);
    expect(r.status).not.toBe(0);
  });
});

describe('t09-runtime contract: status export removes the private files on every exit path', () => {
  const exportSteps = STEPS.filter((s) => /export loopback endpoints/.test(s.name ?? ''));

  it('both export blocks set the EXIT trap before mktemp and before any command that can fail', () => {
    expect(exportSteps).toHaveLength(2);
    for (const s of exportSteps) {
      const run = s.run ?? '';
      const trap = run.indexOf('trap '), mk = run.indexOf('mktemp'), npx = run.indexOf('npx '), node = run.indexOf('node scripts/local-stack/t09/export-status.mjs');
      expect(trap, s.name).toBeGreaterThan(-1);
      expect(trap).toBeLessThan(mk);
      expect(trap).toBeLessThan(npx);
      expect(trap).toBeLessThan(node);
      expect(run).not.toMatch(/\|\|\s*true/);
    }
  });

  // Runs the committed block itself under GitHub's bash flags, with a fake `npx` and the real export-status.mjs.
  const scenarios: Array<[string, string, number]> = [
    ['exporter fails (status lacks DB_URL)', `printf 'API_URL="http://127.0.0.1:54321"\\nANON_KEY="${SECRET}"\\nSERVICE_ROLE_KEY="${SECRET}"\\n'; exit 0`, 2],
    ['supabase status fails (stderr carries a secret)', `echo "password=${SECRET}" >&2; exit 1`, 1],
    ['success', `printf 'API_URL="http://127.0.0.1:54321"\\nDB_URL="postgresql://postgres:${SECRET}@127.0.0.1:54322/postgres"\\nANON_KEY="${SECRET}"\\nSERVICE_ROLE_KEY="${SECRET}"\\n'; exit 0`, 0],
  ];
  for (const s of exportSteps) {
    for (const [label, npxBody, want] of scenarios) {
      it(`${s.name?.slice(0, 3)}: ${label} -> exit ${want}, no status file left, no raw secret in the log`, () => {
        const dir = mkdtempSync(path.join(tmpdir(), 't09-export-'));
        const runnerTemp = path.join(dir, 'rt');
        spawnSync('mkdir', [runnerTemp]);
        fakeBin(dir, 'npx', npxBody);
        const envFile = path.join(dir, 'github_env');
        writeFileSync(envFile, '');
        const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', s.run ?? ''], {
          cwd: ROOT, encoding: 'utf8',
          env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, RUNNER_TEMP: runnerTemp, GITHUB_ENV: envFile, IC_WORKDIR_OLD: dir, IC_WORKDIR_NEW: dir },
        });
        expect(r.status, r.stdout + r.stderr).toBe(want);
        const left = readdirSync(runnerTemp).filter((f) => f.startsWith('status.'));
        expect(left, 'private status files left behind').toEqual([]);
        const log = (r.stdout + r.stderr).split('\n').filter((l) => !l.startsWith('::add-mask::'));
        expect(log.join('\n')).not.toContain(SECRET);
      });
    }
  }
});
