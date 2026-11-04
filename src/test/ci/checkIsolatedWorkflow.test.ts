import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkWorkflowText, expressionRoots, resolveExecutedWorkflow } from '../../../scripts/ci/check-isolated-workflow.mjs';
import YAML from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const REF = 'abcdefghijklmnopqrst';
const check = (text: string) => checkWorkflowText(text, REF);
const some = (problems: string[], re: RegExp) => problems.some((p) => re.test(p));

// Inert fixtures: each is a minimal workflow that is NEVER run; it only feeds the checker.
const minimal = (jobPermissions: string, run = 'echo ok', env = '') => `
name: t
on:
  workflow_dispatch:
permissions: {}
jobs:
  j:
    runs-on: ubuntu-24.04
    permissions:
${jobPermissions}
    env:
      X: ok
${env}
    steps:
      - run: node scripts/ci/check-isolated-workflow.mjs --executed
      - run: ${run}
`;
// Same, with arbitrary steps placed BEFORE the policy step (each entry is one YAML step body).
const withPre = (pre: string[], after = 'echo ok') => `
name: t
on:
  workflow_dispatch:
permissions: {}
jobs:
  j:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    steps:
${pre.map((p) => `      - ${p}`).join('\n')}
      - run: node scripts/ci/check-isolated-workflow.mjs --executed
      - run: ${after}
`;
const READ = '      contents: read';

describe('check-isolated-workflow (parsed YAML)', () => {
  it('accepts the committed isolated workflow', async () => {
    expect(await check(WF)).toEqual([]);
  });

  it('accepts the minimal fixture (control)', async () => {
    expect(await check(minimal(READ))).toEqual([]);
  });

  const refused: Array<[string, string, RegExp]> = [
    ['bracket secrets', minimal(READ, '"${{ secrets[\'TOKEN\'] }}"'), /^secrets:/],
    ['dotted secrets', minimal(READ, '"${{ secrets.TOKEN }}"'), /^secrets:/],
    ['format() nesting secrets', minimal(READ, '"${{ format(\'{0}\', secrets.TOKEN) }}"'), /^secrets:/],
    ['toJSON(secrets)', minimal(READ, '"${{ toJSON(secrets) }}"'), /^secrets:/],
    ['vars in env', minimal(READ, 'echo ok', "      Y: ${{ vars.Y }}"), /^vars:/],
    ['bracket vars', minimal(READ, '"${{ vars[\'Y\'] }}"'), /^vars:/],
    ['github.token', minimal(READ, '"${{ github.token }}"'), /github\.token/],
    ['github bracket access', minimal(READ, '"${{ github[\'token\'] }}"'), /github\.\[\]/],
    ['quoted write', minimal("      contents: 'write'"), /^write-perm:/],
    ['double-quoted write', minimal('      contents: "write"'), /^write-perm:/],
    ['flow-map write', minimal('      { contents: write }').replace('    permissions:\n      { contents: write }', '    permissions: { "contents": "write" }'), /^write-perm:/],
    ['write-all string', minimal(READ).replace('    permissions:\n      contents: read', '    permissions: write-all'), /^job-permissions:/],
    ['missing job permissions', minimal(READ).replace('    permissions:\n      contents: read\n', ''), /^job-permissions:/],
    ['non-empty top permissions', minimal(READ).replace('permissions: {}', 'permissions:\n  contents: read'), /^top-permissions:/],
    ['push trigger', minimal(READ).replace('on:\n  workflow_dispatch:', 'on:\n  workflow_dispatch:\n  push:'), /^triggers:/],
    ['pull_request_target', minimal(READ).replace('on:\n  workflow_dispatch:', 'on: [pull_request_target]'), /^triggers:/],
    ['schedule', minimal(READ).replace('on:\n  workflow_dispatch:', "on:\n  schedule:\n    - cron: '0 3 * * *'"), /^triggers:/],
    ['third-party action', minimal(READ).replace('      - run: echo ok', '      - uses: someone/action@v1'), /^action:/],
    ['job-level secrets: inherit', minimal(READ).replace('    runs-on: ubuntu-24.04', '    runs-on: ubuntu-24.04\n    secrets: inherit'), /^secrets:/],
    ['duplicate key', minimal(READ).replace('    permissions:\n      contents: read', '    permissions:\n      contents: read\n    permissions:\n      contents: write'), /^parse:/],
    ['git push', minimal(READ, 'git push origin HEAD'), /^run:.*pushes/],
    ['supabase link', minimal(READ, 'npx supabase link --project-ref x'), /^run:.*hosted Supabase/],
    ['|| true fallback', minimal(READ, 'scripts/e2e/seed.sh || true'), /^run:.*fallback/],
    ['hosted host in a command', minimal(READ, 'curl https://x.supabase.co'), /^run:.*hosted Supabase host/],
    ['unknown context', minimal(READ, '"${{ needs.a.outputs.b }}"'), /context needs/],
    ['production ref anywhere', minimal(READ, `echo ${REF}`), /^prod-ref:/],
  ];

  it.each(refused)('refuses %s', async (_name, text, expected) => {
    const problems = await check(text);
    expect(some(problems, expected), problems.join('\n')).toBe(true);
  });

  // Final delta review (1): a cold checkout has no node_modules, so the checker (which imports `yaml`) used to
  // exit 2 when it ran first. Dependencies now install first WITHOUT lifecycle scripts, and the checker refuses
  // anything else ahead of itself.
  describe('ordering before the policy check', () => {
    it('accepts checkout, setup-node, recording ids and a script-free npm ci ahead of it (control)', async () => {
      const text = withPre([
        'uses: actions/checkout@v4', 'uses: actions/setup-node@v4',
        "run: |\n          git rev-parse HEAD HEAD^{tree} | tee tested-ids.txt\n          git log -1 --format='%H %P' >> tested-ids.txt",
        'run: npm ci --ignore-scripts --no-audit --no-fund',
      ]);
      expect(await check(text)).toEqual([]);
    });
    const early: Array<[string, string[], string]> = [
      ['npm ci WITH lifecycle scripts', ['run: npm ci --no-audit --no-fund'], ''],
      ['npm rebuild', ['run: npm ci --ignore-scripts', 'run: npm rebuild'], ''],
      ['npm install', ['run: npm install --ignore-scripts'], ''],
      ['supabase start', ['run: npx --no-install supabase start'], ''],
      ['psql', ['run: psql "$SUPABASE_DB_URL" -f x.sql'], ''],
      ['a seed script', ['run: scripts/e2e/seed.sh'], ''],
      ['a chained command on an allowed line', ['run: npm ci --ignore-scripts && npm rebuild'], ''],
      ['upload-artifact', ['uses: actions/upload-artifact@v4'], ''],
      ['a step with neither run nor uses', ['name: odd'], ''],
    ];
    it.each(early)('refuses %s before the policy check', async (_n, pre) => {
      const problems = await check(withPre(pre));
      expect(some(problems, /^order:/), problems.join('\n')).toBe(true);
    });
    it('refuses a job with no `--executed` policy step at all', async () => {
      const text = minimal(READ).replace('      - run: node scripts/ci/check-isolated-workflow.mjs --executed\n', '');
      expect(some(await check(text), /^order:.*no `node scripts\/ci\/check-isolated-workflow\.mjs --executed`/)).toBe(true);
    });
    it('refuses a policy step that checks a fixed path instead of the executed file', async () => {
      const text = minimal(READ).replace('check-isolated-workflow.mjs --executed', 'check-isolated-workflow.mjs .github/workflows/e2e.yml');
      expect(some(await check(text), /^order:/)).toBe(true);
    });
    it('the committed workflow: script-free npm ci, then the executed-file check, then rebuild and every backend step', () => {
      const steps = YAML.parse(WF).jobs.isolated.steps as Array<{ run?: string; uses?: string }>;
      const idx = (re: RegExp) => steps.findIndex((s) => typeof s.run === 'string' && re.test(s.run));
      const ci = idx(/^npm ci --ignore-scripts/), policy = idx(/check-isolated-workflow\.mjs --executed/), rebuild = idx(/^npm rebuild$/);
      const firstBackend = idx(/supabase start|psql|seed\.sh|seed-auth\.sh|bootstrap\.sh/);
      expect(ci).toBeGreaterThan(-1);
      expect(ci).toBeLessThan(policy);
      expect(policy).toBeLessThan(rebuild);
      expect(rebuild).toBeLessThan(firstBackend);
      expect(steps.filter((s) => typeof s.run === 'string' && /\bnpm (ci|install)\b/.test(s.run))).toHaveLength(1);
    });
  });

  // Final delta review (3): every curl needs its own connect and total bounds, so one hung request cannot
  // outlive a readiness deadline.
  describe('bounded curl', () => {
    it('refuses curl without --connect-timeout and --max-time', async () => {
      expect(some(await check(minimal(READ, 'curl -sS http://127.0.0.1:1/')), /^curl:/)).toBe(true);
      expect(some(await check(minimal(READ, 'curl --max-time 5 -sS http://127.0.0.1:1/')), /^curl:/)).toBe(true);
      expect(some(await check(minimal(READ, 'curl --connect-timeout 5 -sS http://127.0.0.1:1/')), /^curl:/)).toBe(true);
    });
    it('accepts bounded curl, including across a backslash continuation (control)', async () => {
      expect(await check(minimal(READ, 'curl --connect-timeout 5 --max-time 10 -sS http://127.0.0.1:1/'))).toEqual([]);
      expect(await check(minimal(READ, '|\n          curl --connect-timeout 5 \\\n            --max-time "$left" http://127.0.0.1:1/'))).toEqual([]);
    });
    it('every curl in the committed workflow is bounded', () => {
      const runs = (YAML.parse(WF).jobs.isolated.steps as Array<{ run?: string }>).map((s) => s.run ?? '').join('\n');
      const calls = runs.replace(/\\\n/g, ' ').split('\n').filter((l) => /(^|[^\w-])curl\s/.test(l));
      expect(calls.length).toBeGreaterThanOrEqual(2);
      for (const c of calls) { expect(c).toMatch(/--connect-timeout\s+\S+/); expect(c).toMatch(/--max-time\s+\S+/); }
    });
  });

  // The policy checks the file GitHub executes, not a hard-coded path.
  describe('resolveExecutedWorkflow (--executed)', () => {
    const SHA = 'a'.repeat(40);
    const env = (over: Record<string, string | undefined> = {}) => ({
      GITHUB_REPOSITORY: 'owner/repo', GITHUB_WORKFLOW_SHA: SHA,
      GITHUB_WORKFLOW_REF: 'owner/repo/.github/workflows/e2e.yml@refs/heads/some-branch', ...over,
    });
    const yes = () => true, no = () => false;
    it('resolves the executed path, whatever its file name (control)', () => {
      expect(resolveExecutedWorkflow(env(), SHA, yes, no)).toEqual({ file: '.github/workflows/e2e.yml' });
      expect(resolveExecutedWorkflow(env({ GITHUB_WORKFLOW_REF: 'owner/repo/.github/workflows/e2e-isolated.yml@refs/heads/x' }), SHA, yes, no))
        .toEqual({ file: '.github/workflows/e2e-isolated.yml' });
    });
    it.each([
      ['missing GITHUB_WORKFLOW_REF', env({ GITHUB_WORKFLOW_REF: undefined }), SHA, yes, no, /must all be set/],
      ['missing GITHUB_WORKFLOW_SHA', env({ GITHUB_WORKFLOW_SHA: undefined }), SHA, yes, no, /must all be set/],
      ['another repository', env({ GITHUB_WORKFLOW_REF: 'other/repo/.github/workflows/e2e.yml@refs/heads/x' }), SHA, yes, no, /not <repo>/],
      ['a reusable workflow elsewhere', env({ GITHUB_WORKFLOW_REF: 'owner/repo/scripts/x.yml@refs/heads/x' }), SHA, yes, no, /unexpected workflow path/],
      ['traversal', env({ GITHUB_WORKFLOW_REF: 'owner/repo/.github/workflows/../../x.yml@refs/heads/x' }), SHA, yes, no, /unexpected workflow path/],
      ['HEAD is not the executed commit', env(), 'b'.repeat(40), yes, no, /is not the executed workflow commit/],
      ['empty HEAD (git failed)', env(), '', yes, no, /is not the executed workflow commit/],
      ['file absent from the checkout', env(), SHA, no, no, /not in the checkout/],
      ['file is a symlink', env(), SHA, yes, yes, /symlink/],
    ] as const)('refuses %s', (_n, e, head, ex, link, re) => {
      const r = resolveExecutedWorkflow(e, head, ex, link);
      expect(r.error).toMatch(re);
    });
  });

  it('reduces expressions to their context roots, ignoring string literal contents', () => {
    expect(expressionRoots(" format('secrets.{0}', inputs.specs) ").map((r: any) => r.name)).toEqual(['format', 'inputs']);
    expect(expressionRoots(' secrets[\'X\'] ')[0]).toMatchObject({ kind: 'ctx', name: 'secrets' });
    expect(expressionRoots(' github.run_id ')[0]).toMatchObject({ name: 'github', prop: 'run_id' });
  });
});
