// ABOUTME: Structural controls for the learner-quiz job in the COMMITTED e2e.yml: the unchanged checker accepts it, the order of
// ABOUTME: guards, edge-runtime delta, hermetic served copy, preflight, fixture and spec is fixed, and evidence excludes private output.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
const JOB = DOC.jobs['learner-quiz'];
type Step = { name?: string; if?: string; run?: string; uses?: string; env?: Record<string, string> };
const STEPS = JOB.steps as Step[];
const at = (re: RegExp) => {
  const i = STEPS.findIndex((s) => re.test(String(s.run ?? '')));
  expect(i, `step matching ${re}`).toBeGreaterThan(-1);
  return i;
};
const REF = 'abcdefghijklmnopqrst';

describe('learner-quiz job', () => {
  it('is accepted by the unchanged isolated-workflow checker', async () => {
    expect(await checkWorkflowText(WF, REF)).toEqual([]);
  });

  it('is dispatch-only, scoped to its own input, read-only, with no secrets, services or containers', () => {
    expect(DOC.on.workflow_dispatch.inputs.specs.options).toEqual(['readonly-courses', 't09-runtime', 'learner-quiz']);
    expect(JOB.if).toBe("inputs.specs == 'learner-quiz'");
    expect(JOB.permissions).toEqual({ contents: 'read' });
    expect(JOB.secrets).toBeUndefined();
    expect(JOB.services).toBeUndefined();
    expect(JOB.container).toBeUndefined();
    expect(DOC.jobs['t09-runtime'].if).toBe("inputs.specs == 't09-runtime'");
    expect(DOC.jobs.isolated.if).toBe("inputs.specs == 'readonly-courses'");
  });

  it('includes the edge runtime only here: the T09 starts still exclude it, and this start differs only by that', () => {
    const t09Starts = (DOC.jobs['t09-runtime'].steps as Step[]).filter((s) => /supabase start/.test(String(s.run ?? '')));
    expect(t09Starts).toHaveLength(2);
    for (const s of t09Starts) expect(s.run).toContain('-x studio,imgproxy,logflare,vector,supavisor,edge-runtime');
    const start = STEPS[at(/supabase start/)].run!;
    expect(start).toContain('-x studio,imgproxy,logflare,vector,supavisor >');
    expect(start).not.toContain('edge-runtime');
    expect(start).toContain('--network-id "ic-lq-net-');
  });

  it('orders: subset before start; guards and STAGE PRE before writes; migrations before serve; edge check after readiness', () => {
    const subset = at(/learner-quiz\/functions-subset\.sh/);
    const create = at(/stack-net\.mjs create "ic-lq-net-/);
    const start = at(/supabase start/);
    const guards = at(/assert-safe-target\.mjs --mutating/);
    const ports = at(/stack-checks\.sh ports \| tee "\$LQ_EVIDENCE\/checks\/ports-start/);
    const pre = at(/stage-pre\.sh/);
    const boot = at(/bootstrap\.sh/);
    const mig = at(/apply-reviewed\.sh "\$SUPABASE_DB_URL" NEW/);
    const serve = at(/supabase functions serve/);
    const ready = at(/functions\/v1\/score-quiz/);
    const edge = at(/edge-runtime-check\.sh/);
    expect([subset, create, start, guards, ports, pre, boot, mig, serve, ready, edge]).toEqual(
      [subset, create, start, guards, ports, pre, boot, mig, serve, ready, edge].slice().sort((a, b) => a - b));
    expect(STEPS[edge].run).toMatch(/stack-net\.mjs verify[\s\S]*stack-net\.mjs listeners[\s\S]*stack-checks\.sh ports/);
  });

  it('serves only the verified TEST-SERVED copy, and preflight checks that copy before any fixture write', () => {
    const build = at(/npm run build/);
    const make = at(/hermetic-dist\.mjs make dist "\$SERVED"/);
    expect(STEPS[make].run).toMatch(/hermetic-dist\.mjs verify dist "\$SERVED"/);
    expect(STEPS[make].run).toMatch(/check-local-target\.mjs dist "\$SERVED"/);
    const preview = at(/vite preview --outDir "\$LQ_SERVED"/);
    expect(STEPS[preview].run).toContain('cmp -s "$RUNNER_TEMP/preview-index.html" "$LQ_SERVED/index.html"');
    const pre = at(/preflight\.mjs --dist "\$LQ_SERVED"/);
    const fix = at(/quiz-lifecycle\/fixture\.sh/);
    const pw = at(/playwright test -c playwright\.quiz-lifecycle\.config\.ts/);
    expect(build < make && make < preview && preview < pre && pre < fix && fix < pw).toBe(true);
    expect(WF).not.toMatch(/vite preview --host 127\.0\.0\.1 --port 8080 --strictPort > "\$RUNNER_TEMP\/lq-preview/);
  });

  it('preserves the spec exit status and never stages private Playwright output or raw logs', () => {
    const pw = STEPS[at(/playwright test -c playwright\.quiz-lifecycle\.config\.ts/)];
    expect(pw.run).toContain('|| rc=$?');
    expect(pw.run).toContain('exit $rc');
    expect(pw.env?.QLC_EVIDENCE_DIR).toBe('${{ runner.temp }}/qlc');
    const stage = STEPS[at(/stage-evidence/)].run!;
    expect(stage).not.toMatch(/playwright-output|lq-start\.log|lq-functions\.log|lq-preview\.log|RUNNER_TEMP/);
    expect(stage).toContain('-- tested-ids.txt "$E"');
    for (const r of ['edge-runtime.txt', 'functions-subset.txt', 'hermetic.txt', 'HERMETIC-PROVENANCE.json', 'checks-preflight.txt', 'checks-fixture.txt', 'leftovers.txt']) {
      expect(stage).toContain(r);
    }
  });

  it('cleans up on every exit once the stack was prepared, and stops background servers', () => {
    const stop = STEPS.find((s) => /supabase stop/.test(String(s.run ?? '')))!;
    expect(stop.if).toBe("always() && steps.lq_prep.outcome == 'success'");
    const bg = STEPS.find((s) => /Stop background servers/.test(s.name ?? ''))!;
    expect(bg.if).toBe('always()');
    expect(bg.run).toContain('private playwright output still present');
  });
});
