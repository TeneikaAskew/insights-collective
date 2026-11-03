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
type Step = { id?: string; name?: string; if?: string; run?: string; uses?: string; env?: Record<string, string> };
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
    expect(DOC.on.workflow_dispatch.inputs.specs.options).toEqual(['readonly-courses', 't09-runtime', 'learner-quiz', 'learner-quiz-noedge', 'gradebook-journey', 'builder-authoring', 'builder-authoring-k1']);
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
    expect(start).toContain('--network-id "ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"');
  });

  it('orders: subset and pinned closure before start; edge checks at start, after serve (before any worker), after readiness', () => {
    const subset = at(/learner-quiz\/functions-subset\.sh/);
    const closure = at(/learner-quiz\/closure-install\.sh "\$W" "\$LQ_CLOSURE_DIR" "\$LQ_CLOSURE_PINS_SHA256"/);
    const create = at(/stack-net\.mjs create "ic-t09-new-net-/);
    const start = at(/supabase start/);
    const guards = at(/assert-safe-target\.mjs --mutating/);
    const ports = at(/stack-checks\.sh ports \| tee "\$LQ_EVIDENCE\/checks\/ports-start/);
    const edgeStart = at(/edge-runtime-check\.sh [^\n]*edge-runtime-start\.txt/);
    const pre = at(/stage-pre\.sh/);
    const boot = at(/bootstrap\.sh/);
    const mig = at(/apply-reviewed\.sh "\$SUPABASE_DB_URL" NEW/);
    const serve = at(/supabase functions serve/);
    const edgeServe = at(/edge-runtime-check\.sh [^\n]*edge-runtime-serve\.txt/);
    const ready = at(/functions\/v1\/score-quiz/);
    const edge = at(/edge-runtime-check\.sh [^\n]*checks\/edge-runtime\.txt/);
    const order = [subset, closure, create, start, guards, ports, edgeStart, pre, boot, mig, serve, edgeServe, ready, edge];
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
    expect(closure).toBe(subset);
    expect(STEPS[closure].id).toBe('lq_prep');
    // The membership check after serve never invokes a function: no curl, no /functions/v1 in that step.
    expect(STEPS[edgeServe].run).not.toMatch(/curl|functions\/v1/);
    expect(STEPS[edgeServe].run).toMatch(/stack-net\.mjs verify[\s\S]*stack-checks\.sh ports/);
    expect(STEPS[edge].run).toMatch(/stack-net\.mjs verify[\s\S]*stack-net\.mjs listeners[\s\S]*stack-checks\.sh ports/);
    // Generation binding: start id recorded; pre-readiness accepts only a different, stable container; post-readiness requires it.
    expect(STEPS[edgeStart].run).toContain('--record-id "$RUNNER_TEMP/lq-edge-id/start.id"');
    expect(STEPS[edgeServe].run).toContain('--exclude-id "$D/start.id" --record-id "$D/poll.id"');
    expect(STEPS[edgeServe].run).toContain('mv "$D/poll.id" "$D/serve.id"');
    expect(STEPS[edge].run).toContain('--expect-id "$RUNNER_TEMP/lq-edge-id/serve.id"');
  });

  it('uses only the network name the unchanged stack-net guard accepts, with the lq owner label, and no new name pattern', () => {
    const NET = '"ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"';
    const OWNER = '"$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-lq"';
    const lqText = STEPS.map((s) => String(s.run ?? '')).join('\n');
    const calls = [...lqText.matchAll(/stack-net\.mjs (create|verify|remove) (\S+) (\S+)/g)];
    expect(calls.map((c) => c[1]).sort()).toEqual(['create', 'remove', 'verify', 'verify', 'verify']);
    for (const c of calls) expect([c[2], c[3]]).toEqual([NET, OWNER]);
    for (const m of lqText.matchAll(/(?:--network-id|edge-runtime-check\.sh) (\S+)/g)) expect(m[1]).toBe(NET);
    expect(WF).not.toMatch(/ic-lq-net/);
    // The guard itself is not widened: its name pattern is exactly the T09 one, which rejects any other prefix.
    const net = readFileSync(path.join(ROOT, 'scripts/local-stack/t09/stack-net.mjs'), 'utf8');
    const NAMES = /const NAMES = (\/.*\/);/.exec(net)![1];
    expect(NAMES).toBe('/^ic-t09-(old|new)-net-[0-9]{1,20}-[0-9]{1,4}$/');
    const re = new RegExp(NAMES.slice(1, -1));
    expect(re.test('ic-t09-new-net-123-1')).toBe(true);
    expect(re.test('ic-lq-net-123-1')).toBe(false);
    // Same name as t09-runtime's NEW stack, so the two jobs must never run together: each is gated on a distinct dispatch value.
    expect(JOB.if).toBe("inputs.specs == 'learner-quiz'");
    expect(DOC.jobs['t09-runtime'].if).toBe("inputs.specs == 't09-runtime'");
    expect(DOC.on.workflow_dispatch.inputs.specs.type).toBe('choice');
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

  it('launches background servers only as owned process groups and stops only those, then proves 8080 has no listener', () => {
    const lqText = STEPS.map((s) => String(s.run ?? '')).join('\n');
    expect(lqText).not.toMatch(/\bpkill\b|\bpgrep\b|killall|nohup|FUNCTIONS_PID/);
    expect(STEPS[at(/supabase functions serve/)].run).toMatch(/owned-proc\.mjs start "\$RUNNER_TEMP\/lq-owned" functions /);
    expect(STEPS[at(/vite preview --outDir/)].run).toMatch(/owned-proc\.mjs start "\$RUNNER_TEMP\/lq-owned" preview /);
    const bg = STEPS.find((s) => /Stop background servers/.test(s.name ?? ''))!;
    expect(bg.run).toContain('owned-proc.mjs stop "$RUNNER_TEMP/lq-owned" 8080');
    expect(bg.run).toMatch(/ss -Hltn 'sport = :8080'\) \|\| \{ echo "ss failed"; exit 1; \}/);
    expect(STEPS[at(/stage-evidence/)].run).toContain('owned-stop.txt');
  });

  it('installs the pinned closure before any stack starts and refuses while no reviewed closure exists', () => {
    expect(JOB.env.LQ_CLOSURE_PINS_SHA256).toBe('');
    expect(JOB.env.LQ_CLOSURE_DIR).toBe('supabase/functions-closure/score-quiz');
    const stage = STEPS[at(/stage-evidence/)].run!;
    for (const r of ['closure-install.txt', 'edge-runtime-start.txt', 'edge-runtime-serve.txt']) expect(stage).toContain(r);
    expect(WF).not.toMatch(/DECLARED, NOT HERMETIC/);
  });
});
