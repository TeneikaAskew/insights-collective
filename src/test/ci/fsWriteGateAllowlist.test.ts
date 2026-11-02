// ABOUTME: Controls for the security.yml "Filesystem writes stay in reviewed locations" allowlist after the exact
// ABOUTME: three-path narrow-reads exception (2026-11-02): each path allowed, every neighbour still blocked, gate green.
import { readFileSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');
const DOC = YAML.parse(readFileSync(path.join(ROOT, '.github/workflows/security.yml'), 'utf8'));
const steps = Object.values(DOC.jobs as Record<string, { steps?: Array<{ name?: string; run?: string }> }>).flatMap((j) => j.steps ?? []);
const GATE = steps.find((s) => s.name === 'Filesystem writes stay in reviewed locations');
const RUN = String(GATE?.run ?? '');
const ALLOWED = /^\s*ALLOWED='([^']+)'$/m.exec(RUN)?.[1] ?? '';
const allowed = (p: string) => new RegExp(ALLOWED).test(p);
const THREE = ['src/test/ci/checkNarrowReadsJob.test.ts', 'src/test/ci/narrowReadsTierFake.test.ts', 'src/test/ci/fixtures/nr-fake-psql/fake-psql.cjs'];
// The gate's own write pattern, read from the step (so this file holds no write-call text of its own).
const WRITE = new RegExp(/xargs -r grep -nE '([^']+)'/.exec(RUN)?.[1] ?? '^$');

describe('fs-write gate: exact narrow-reads exception', () => {
  it('the gate step, its ALLOWED regex and its write pattern are present', () => {
    expect(GATE).toBeTruthy();
    expect(WRITE.source.split('|').length).toBe(6);
    expect(ALLOWED.startsWith('^(') && ALLOWED.endsWith(')')).toBe(true);
  });

  it.each(THREE)('positive: %s is allowed, is tracked, and does write (the exception is needed)', (p) => {
    expect(allowed(p)).toBe(true);
    expect(execFileSync('git', ['ls-files', '--error-unmatch', p], { cwd: ROOT, encoding: 'utf8' }).trim()).toBe(p);
    expect(WRITE.test(readFileSync(path.join(ROOT, p), 'utf8'))).toBe(true);
  });

  it.each([
    'src/test/ci/fixtures/nr-fake-psql/psql',
    'src/test/ci/fixtures/nr-fake-psql/fake-psql.js',
    'src/test/ci/fixtures/nr-fake-psql/fake-psql.mjs',
    'src/test/ci/fixtures/nr-fake-psql/other.cjs',
    'src/test/ci/fixtures/nr-fake-psql/fake-psql.cjs.bak',
    'src/test/ci/fixtures/nr-fake-psql/sub/fake-psql.cjs',
    'src/test/ci/fixtures/other/fake-psql.cjs',
    'src/test/ci/fixtures/nr-fake-psqlx/fake-psql.cjs',
    'src/test/ci/narrowReadsTierFake.test.tsx',
    'src/test/ci/narrowReadsTierFakeX.test.ts',
    'src/test/ci/xnarrowReadsTierFake.test.ts',
    'src/test/ci/sub/narrowReadsTierFake.test.ts',
    'src/test/ci/checkNarrowReadsJob.test.ts.orig',
    'src/test/ci/checkNarrowReadsJob.spec.ts',
    'src/test/ci/narrowReadsMigration.test.ts',
    'src/test/narrowReadsTierFake.test.ts',
    'xsrc/test/ci/checkNarrowReadsJob.test.ts',
    'src/test/ci/fixtures/fake.cjs',
    'src/test/ci/anything.test.ts',
  ])('neighbour negative: %s stays blocked', (p) => {
    expect(allowed(p)).toBe(false);
  });

  it('the gate, run as written on the tracked tree, finds no write outside the reviewed locations', () => {
    const r = spawnSync('bash', ['-e', '-c', RUN], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout).toContain('no filesystem writes outside the reviewed locations');
    expect(r.status).toBe(0);
  });

  it('without the three additions the gate would flag exactly these three files (nothing else is newly covered)', () => {
    const before = ALLOWED.replace('|checkNarrowReadsJob|narrowReadsTierFake)', ')').replace('|src/test/ci/fixtures/nr-fake-psql/fake-psql\\.cjs$', '');
    expect(before).not.toBe(ALLOWED);
    const files = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    const newlyAllowed = files.filter((f) => new RegExp(ALLOWED).test(f) && !new RegExp(before).test(f));
    expect(newlyAllowed.sort()).toEqual([...THREE].sort());
    const flaggedBefore = newlyAllowed.filter((f) => WRITE.test(readFileSync(path.join(ROOT, f), 'utf8')));
    expect(flaggedBefore.sort()).toEqual([...THREE].sort());
  });
});
