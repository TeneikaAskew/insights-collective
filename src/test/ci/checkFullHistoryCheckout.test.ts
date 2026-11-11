// ABOUTME: Contract: every workflow job that runs vitest checks out full history (fetch-depth: 0), because src/test/ci
// ABOUTME: tests read named earlier commits with `git show <sha>:path`, which a default depth-1 checkout does not contain.
//
// Read-only: parses .github/workflows/*.yml and the test sources as text. It never runs git, so it passes or fails the
// same way in a shallow and a full clone. Syntactic scope only: not checkout order/if/target, object presence or npm aliases.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');
const WF = path.join(ROOT, '.github/workflows');
type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { steps?: readonly Step[] };

const RUNS_VITEST = /\bvitest\b|\bnpm (?:run )?test\b/;
// Shell comment lines are ignored: security.yml's fs-write step mentions "vitest fixture" only inside # comments.
const code = (run: string) => run.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const runsVitest = (job: Job) => (job.steps ?? []).some((s) => typeof s.run === 'string' && RUNS_VITEST.test(code(s.run)));
const checkouts = (job: Job) => (job.steps ?? []).filter((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/checkout@'));
// Exactly one checkout, and it asks for full history with the numeric 0 (the action's "all history" value).
const historyProblem = (job: Job): string | null => {
  const c = checkouts(job);
  if (c.length !== 1) return `expected exactly 1 actions/checkout step, found ${c.length}`;
  return c[0].with?.['fetch-depth'] === 0 ? null : `checkout fetch-depth is ${JSON.stringify(c[0].with?.['fetch-depth'])}, not 0`;
};
const load = (f: string) => YAML.parse(fs.readFileSync(path.join(WF, f), 'utf8')) as { jobs?: Record<string, Job> };
const workflows = fs.readdirSync(WF).filter((f) => /\.ya?ml$/.test(f)).sort();
const vitestJobs = workflows.flatMap((f) => Object.entries(load(f).jobs ?? {}).filter(([, j]) => runsVitest(j)).map(([id, j]) => ({ f, id, j })));

describe('full-history checkout for every job that runs vitest', () => {
  it('finds the known suite runners (guards against a silently empty scan)', () => {
    const ids = vitestJobs.map(({ f, id }) => `${f}:${id}`);
    for (const want of ['test.yml:test', 'pr-checks.yml:pr-validation', 'nightly.yml:comprehensive-tests', 'nightly.yml:dependency-check', 'nightly.yml:test-metrics']) {
      expect(ids, want).toContain(want);
    }
  });

  it.each(vitestJobs.map(({ f, id, j }) => [`${f}:${id}`, j] as const))('%s checks out with fetch-depth: 0', (_name, job) => {
    expect(historyProblem(job)).toBeNull();
  });

  it('the src/test/ci tests still read named commits, so the contract is still needed', () => {
    const dir = path.join(ROOT, 'src/test/ci');
    const reads = fs.readdirSync(dir).filter((f) => f.endsWith('.test.ts'))
      .filter((f) => /\['show', `?\$\{OLD_REF\}|'show', '[0-9a-f]{7,40}:/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(reads).toEqual(expect.arrayContaining(['checkLearnerAuthGate.test.ts', 'gbJobHolds.test.ts']));
  });

  // Negative controls (in memory, no git): the shapes the pre-repair nightly.yml had, and near misses.
  it.each([
    ['no with block (pre-repair nightly)', { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm run test -- --run' }] }],
    ['explicit depth 1', { steps: [{ uses: 'actions/checkout@v4', with: { 'fetch-depth': 1 } }, { run: 'npm run test -- --run' }] }],
    ['string "0"', { steps: [{ uses: 'actions/checkout@v4', with: { 'fetch-depth': '0' } }, { run: 'npx vitest run' }] }],
    ['two checkouts', { steps: [{ uses: 'actions/checkout@v4', with: { 'fetch-depth': 0 } }, { uses: 'actions/checkout@v4' }, { run: 'npm test' }] }],
    ['no checkout', { steps: [{ run: 'npm run test:coverage -- --run' }] }],
  ] as const)('refuses: %s', (_n, job) => {
    expect(runsVitest(job)).toBe(true);
    expect(historyProblem(job)).not.toBeNull();
  });

  it('does not treat a job that never runs vitest as a suite runner', () => {
    expect(runsVitest({ steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm run lint' }, { run: 'npm run build' }] })).toBe(false);
    expect(runsVitest({ steps: [{ uses: 'actions/checkout@v4' }, { run: '# vitest fixture: synthetic strings\nnode scripts/ci/x.mjs' }] })).toBe(false);
    expect(runsVitest({ steps: [{ run: '  # note\n  npx --no-install vitest run a.test.ts' }] })).toBe(true);
  });
});
