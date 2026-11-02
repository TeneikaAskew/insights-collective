// ABOUTME: Structural controls for the #159 narrow-reads-sql job: dispatch-only, read-only, one disposable loopback stack in
// ABOUTME: the t09-runtime shape (PRE before bootstrap, guards, always-cleanup), the #159 file applied only by the pinned tier.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string };
const NR = DOC.jobs['narrow-reads-sql'];
const T9 = DOC.jobs['t09-runtime'];
const S = NR.steps as Step[];
const runOf = (s: Step) => String(s.run ?? '');
const at = (re: RegExp) => { const i = S.findIndex((s) => re.test(runOf(s))); expect(i, String(re)).toBeGreaterThan(-1); return i; };
const TIER = readFileSync(path.join(ROOT, 'scripts/local-stack/narrow-reads/tier.sh'), 'utf8');
const TIER_CODE = TIER.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
const MIG = 'supabase/migrations/20261102000000_narrow_quiz_feedback_blog_settings_reads.sql';

describe('narrow-reads-sql job', () => {
  it('is dispatch-only on its own input, read-only, no secrets, services or containers; checker passes', async () => {
    expect(NR.if).toBe("inputs.specs == 'narrow-reads-sql'");
    expect(NR.permissions).toEqual({ contents: 'read' });
    expect(NR.secrets).toBeUndefined(); expect(NR.services).toBeUndefined(); expect(NR.container).toBeUndefined();
    expect(Object.keys(DOC.on)).toEqual(['workflow_dispatch']);
    expect(await checkWorkflowText(WF)).toEqual([]);
  });

  it('reuses the t09-runtime stack steps unchanged apart from job-scoped names', () => {
    const norm = (s: string) => s
      .replace(/t09-keys-new/g, 'KEYS').replace(/nr-keys/g, 'KEYS').replace(/IC_WORKDIR_NEW/g, 'WD').replace(/IC_WORKDIR_NR/g, 'WD')
      .replace(/t09-new-(start|stop)\.log/g, 'L-$1').replace(/nr-(start|stop)\.log/g, 'L-$1')
      .replace(/\$T09_EVIDENCE\/new-/g, 'EV/').replace(/\$NR_EVIDENCE\//g, 'EV/')
      .replace(/ic-t09-new-net/g, 'NET').replace(/ic-nr-net/g, 'NET').replace(/-new"/g, '"').replace(/-nr"/g, '"')
      .replace(/ \(NEW\)/g, '').replace(/ok \(NEW\);/g, 'ok;');
    const pick = (job: { steps: Step[] }, re: RegExp) => norm(runOf([...job.steps].reverse().find((s) => re.test(runOf(s))) as Step)); // t09: its NEW stack
    for (const re of [/supabase start --workdir/, /stage-pre\.sh/, /bootstrap\.sh "\$SUPABASE_DB_URL"/, /stack-net\.mjs verify/, /assert-safe-target/, /export-status\.mjs/]) {
      expect(pick(NR, re), String(re)).toBe(pick(T9, re));
    }
  });

  it('orders: policy check first, PRE before bootstrap before the tier; cleanup always() after it', () => {
    const policy = S.findIndex((s) => /check-isolated-workflow\.mjs --executed/.test(runOf(s)));
    const start = at(/supabase start --workdir/), pre = at(/stage-pre\.sh/), boot = at(/bootstrap\.sh "\$SUPABASE_DB_URL"/), tier = at(/narrow-reads\/tier\.sh "\$SUPABASE_DB_URL"/);
    expect(policy).toBeGreaterThan(-1);
    expect(policy < start && start < pre && pre < boot && boot < tier).toBe(true);
    for (const re of [/supabase stop/, /stack-net\.mjs remove/, /stack-checks\.sh leftovers/, /rm -rf "\$RUNNER_TEMP\/nr-keys"/]) {
      const i = at(re); expect(i).toBeGreaterThan(tier); expect(String(S[i].if)).toMatch(/^always\(\)/);
    }
    expect(runOf(S[at(/supabase start/)])).toMatch(/-x [^ ]*edge-runtime/);
  });

  it('never touches a hosted project or the migration ledger tooling', () => {
    const text = S.map(runOf).join('\n');
    for (const bad of [/supabase db push/, /supabase link/, /db-migrate/, /apply_migration/, /supabase\.co/, /SUPABASE_ACCESS_TOKEN/, /migrations\/\*/, /npx playwright|vite preview|npm run build/]) {
      expect(text, String(bad)).not.toMatch(bad);
    }
  });

  it('tier: pins every file it runs, applies only the #159 file by path in one transaction, and never globs migrations', () => {
    expect(TIER).toContain(`MIG="${MIG}"`);
    expect(TIER).toMatch(/--single-transaction -q -f "\$ROOT\/\$2"/);
    expect(TIER_CODE).not.toMatch(/migrations\/\*|db push|db-migrate|apply_migration/);
    expect(TIER).toMatch(/assert-local-dsn\.mjs" "\$DB"/);
    const pins = [...TIER.matchAll(/^"([^|"]+)\|([0-9a-f]{40})\|([0-9a-f]{64})"$/gm)];
    expect(pins.map((m) => m[1]).sort()).toEqual([
      'scripts/local-stack/narrow-reads/baseline.sql', 'scripts/local-stack/narrow-reads/catalog.sql', 'scripts/local-stack/narrow-reads/matrix.sql',
      'scripts/local-stack/narrow-reads/rollback.sql', 'scripts/local-stack/narrow-reads/rowhash.sql', 'scripts/local-stack/t09/sql-tier.sh', MIG,
    ].sort());
    for (const [, p, blob] of pins) expect(execFileSync('git', ['-C', ROOT, 'hash-object', p], { encoding: 'utf8' }).trim(), p).toBe(blob);
  });

  it('tier selftest passes (synthetic outputs; no database)', () => {
    const out = execFileSync('bash', [path.join(ROOT, 'scripts/local-stack/narrow-reads/tier.sh'), '--selftest'], { encoding: 'utf8' });
    expect(out).toMatch(/== narrow-reads tier selftest: ALL PASS/);
  });

  it('matrix: 26 checks, 8 closed; rollback recreates exactly the snapshot policy lines', () => {
    const m = readFileSync(path.join(ROOT, 'scripts/local-stack/narrow-reads/matrix.sql'), 'utf8');
    const checks = [...m.matchAll(/pg_temp\.check_(?:rows|write)\('(closed|kept) +/g)].map((x) => x[1]);
    expect(checks.length).toBe(26); expect(checks.filter((c) => c === 'closed').length).toBe(8);
    expect(TIER).toContain('CHECKS_LINE="CHECKS 26 closed 8"');
    const snap = readFileSync(path.join(ROOT, 'scripts/local-stack/schema/04_rls_policies.sql'), 'utf8').split('\n');
    const rb = readFileSync(path.join(ROOT, 'scripts/local-stack/narrow-reads/rollback.sql'), 'utf8').split('\n').filter((l) => l.startsWith('create policy'));
    expect(rb).toHaveLength(4);
    for (const l of rb) expect(snap).toContain(l);
  });
});
