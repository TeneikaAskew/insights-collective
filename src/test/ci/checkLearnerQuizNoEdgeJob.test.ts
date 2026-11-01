// ABOUTME: Structural controls for the learner-quiz-noedge job: no Edge service boots, exactly 7 named cases are selected and
// ABOUTME: none of them submits or calls score-quiz, the no-Edge browser guard is on, and revoke-access.txt is required evidence.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
const JOB = DOC.jobs['learner-quiz-noedge'];
type Step = { name?: string; if?: string; run?: string; env?: Record<string, string> };
const STEPS = JOB.steps as Step[];
const TEXT = STEPS.map((s) => String(s.run ?? '')).join('\n');
const at = (re: RegExp) => { const i = STEPS.findIndex((s) => re.test(String(s.run ?? ''))); expect(i, String(re)).toBeGreaterThan(-1); return i; };
const SPEC = readFileSync(path.join(ROOT, 'e2e/quiz-lifecycle/lifecycle.isolated.ts'), 'utf8');

/** The body of the test whose title starts with `prefix` (template titles expanded for T62), from its line to the next test( line. */
function bodyOf(prefix: string): string {
  const lines = SPEC.split('\n');
  const i = lines.findIndex((l) => /\btest\(/.test(l) && l.includes(prefix));
  expect(i, `test ${prefix}`).toBeGreaterThan(-1);
  let j = i + 1;
  while (j < lines.length && !/^\s*test\(|^\s*test\.describe\(|^\s*for \(const/.test(lines[j])) j += 1;
  return lines.slice(i, j).join('\n');
}

describe('learner-quiz-noedge job', () => {
  it('is accepted by the unchanged isolated-workflow checker and is scoped to its own dispatch value', async () => {
    expect(await checkWorkflowText(WF, 'abcdefghijklmnopqrst')).toEqual([]);
    expect(JOB.if).toBe("inputs.specs == 'learner-quiz-noedge'");
    expect(JOB.permissions).toEqual({ contents: 'read' });
    expect(JOB.secrets).toBeUndefined();
  });

  it('boots no Edge service: the exact T09 start line, no serve, no closure, no function probe, absence asserted twice', () => {
    const start = STEPS[at(/supabase start/)].run!;
    expect(start).toContain('-x studio,imgproxy,logflare,vector,supavisor,edge-runtime >');
    expect(TEXT).not.toMatch(/functions serve|closure-install|edge-runtime-check|functions-subset|\/functions\/v1/);
    expect(STEPS[at(/preflight\.mjs/)].run).toContain('--no-edge');
    const checks = STEPS.filter((s) => /supabase_edge_runtime_/.test(String(s.run ?? '')));
    expect(checks).toHaveLength(2);
    expect(at(/no-edge-start\.txt/)).toBeLessThan(at(/stage-pre\.sh/));
    expect(at(/no-edge-end\.txt/)).toBeGreaterThan(at(/playwright test -c/));
  });

  it('uses the supported owned network name with its own owner label', () => {
    const calls = [...TEXT.matchAll(/stack-net\.mjs (create|verify|remove) (\S+) (\S+)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const c of calls) expect([c[2], c[3]]).toEqual(['"ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"', '"$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-lqn"']);
  });

  it('selects exactly the 7 no-Edge cases, and none of their bodies submits, retakes or routes score-quiz', () => {
    const pw = STEPS[at(/playwright test -c playwright\.quiz-lifecycle\.config\.ts --grep "\$QLC_NOEDGE_GREP"/)];
    expect(pw.env?.QLC_NO_EDGE).toBe('1');
    const grep = new RegExp(pw.env!.QLC_NOEDGE_GREP);
    expect(pw.run).toContain('[ "$n" = 7 ]');
    const titles = [...SPEC.matchAll(/\btest\(\s*[`'"]([^`'"]+)[`'"]/g)].map((m) => m[1]);
    const expanded = titles.flatMap((t) => t.includes('${c.viewport.width}') ? ['1440', '768', '390'].map((w) => t.replace('${c.viewport.width}', w)) : t.includes('${label}') ? ['NULL', '0'].map((l) => t.replace('${label}', l)) : [t]);
    const chosen = expanded.filter((t) => grep.test(t));
    expect(chosen).toHaveLength(7);
    for (const p of ['F2 resume', 'F5 A to B to A', 'R3 slow start', 'T62 ${c.viewport.width}: denied', 'T62 allowed control']) {
      const b = bodyOf(p);
      expect(b, p).not.toMatch(/\bsubmit\(|\btake\(|retake|score-quiz|expectFinalized|expectProgressRead|forwardApproved/);
    }
  });

  it('requires the T-62 revoke receipt and the no-Edge receipts in the scanned upload inventory', () => {
    const stage = STEPS[at(/stage-evidence/)].run!;
    for (const r of ['qlc/checks/revoke-access.txt', 'no-edge-start.txt', 'no-edge-end.txt', 'qlc/egress.txt', 'owned-stop.txt']) expect(stage).toContain(r);
    expect(stage).not.toMatch(/edge-runtime|closure|functions-subset/);
  });
});
