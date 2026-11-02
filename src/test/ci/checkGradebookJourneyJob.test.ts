// ABOUTME: Structural controls for the PROPOSED gradebook-journey job: its stack, PRE and hermetic steps are the reviewed
// ABOUTME: learner-quiz-noedge steps byte-for-byte (modulo job-scoped names), D1 is written after them and before any write.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string };
const GB = DOC.jobs['gradebook-journey'];
const LQ = DOC.jobs['learner-quiz-noedge'];
const S = GB.steps as Step[];
const runOf = (s: Step) => String(s.run ?? '');
const at = (re: RegExp) => { const i = S.findIndex((s) => re.test(runOf(s))); expect(i, String(re)).toBeGreaterThan(-1); return i; };
const all = (re: RegExp) => S.map((s, i) => (re.test(runOf(s)) ? i : -1)).filter((i) => i >= 0);
// Job-scoped renames only; anything else that differs is not "reused unchanged".
const rename = (t: string) => t.replace(/LQ_EVIDENCE/g, 'GB_EVIDENCE').replace(/IC_WORKDIR_LQ/g, 'IC_WORKDIR_GB').replace(/LQ_SERVED/g, 'GB_SERVED')
  .replace(/-lqn"/g, '-gbj"').replace(/\/lq-/g, '/gb-').replace(/\(learner-quiz-noedge\)/g, '(gradebook-journey)')
  .replace(/supabase stop ok \(learner-quiz\)/g, 'supabase stop ok (gradebook-journey)');
const REUSED = [
  'Create owned loopback-binding network', 'supabase start (local; no studio; edge runtime EXCLUDED', 'Export loopback endpoints',
  'Target guards', 'Published ports loopback-only', 'No Edge runtime container exists (read-only; before any write)', 'STAGE PRE',
  'Bootstrap schema snapshot', 'Verify identities', 'Seven reviewed migrations', 'Build app', 'Derive and verify the TEST-SERVED copy',
  'Serve the TEST-SERVED copy', 'Install Chromium headless shell', 'Stop stack (no backup)', 'Remove owned network', 'Nothing left behind',
];
const byName = (steps: Step[], prefix: string) => { const f = steps.filter((s) => String(s.name ?? '').startsWith(prefix)); expect(f.length, prefix).toBe(1); return f[0]; };

describe('gradebook-journey job (proposal)', () => {
  it('is accepted by the unchanged isolated-workflow checker and is scoped to its own dispatch value', async () => {
    expect(await checkWorkflowText(WF)).toEqual([]);
    expect(GB.if).toBe("inputs.specs == 'gradebook-journey'");
    expect(GB.permissions).toEqual({ contents: 'read' });
  });
  it('reuses every reviewed stack, PRE, hermetic and cleanup step of learner-quiz-noedge unchanged (job-scoped names only)', () => {
    for (const p of REUSED) expect(runOf(byName(S, p)), p).toBe(rename(runOf(byName(LQ.steps, p))));
    // the shared cleanup steps keep their always() conditions (prep id renamed)
    for (const p of ['Stop stack (no backup)', 'Remove owned network', 'Nothing left behind']) expect(byName(S, p).if).toBe("always() && steps.gb_prep.outcome == 'success'");
  });
  it('writes D1 exactly once, after every reviewed check and before any actor, fixture or carrier write', () => {
    const writes = all(/stack-ownership\.mjs write/);
    expect(writes).toHaveLength(1);
    const d1 = writes[0];
    expect(S[d1].id).toBe('gb_d1');
    for (const re of [/stack-net\.mjs create/, /stack-net\.mjs verify/, /stack-checks\.sh ports/, /noedge-probes\.sh absent before/, /stage-pre\.sh/,
      /bootstrap\.sh "\$SUPABASE_DB_URL"/, /verify-identities\.sh/, /apply-reviewed\.sh "\$SUPABASE_DB_URL" NEW/, /hermetic-dist\.mjs verify/, /cmp -s "\$RUNNER_TEMP\/preview-index\.html"/]) {
      expect(at(re), String(re)).toBeLessThan(d1);
    }
    for (const re of [/local-preseed\.sql/, /seed-auth\.sh/, /run-journey\.sh/, /pairing-producer\.mjs/, /seed-journey\.sql/, /fixture\.sh/]) {
      for (const i of all(re)) expect(i, String(re)).toBeGreaterThan(d1);
    }
    expect(at(/seed-auth\.sh/)).toBeLessThan(at(/run-journey\.sh/));
  });
  it('pins the reviewed bootstrap digest as a constant equal to the checked-out bootstrap.sh, and the writer refuses otherwise', () => {
    const want = createHash('sha256').update(readFileSync(path.join(ROOT, 'scripts/local-stack/bootstrap.sh'))).digest('hex');
    expect(GB.env.GB_D1_BOOTSTRAP_SHA256).toBe(want);
    const d1 = runOf(S[all(/stack-ownership\.mjs write/)[0]]);
    expect(d1).toMatch(/\[ "\$have" = "\$GB_D1_BOOTSTRAP_SHA256" \] \|\| \{ echo "D1 refused/);
    expect(d1).toMatch(/stack-ownership\.mjs verify "\$API" "\$APP" "\$GB_D1_BOOTSTRAP_SHA256"/);
    expect(d1).not.toMatch(/bootstrap_sha256|jq|cat "\$STACK_OWNERSHIP_FILE"/);   // never read back from the record
  });
  it('runs every cleanup and staging step under always(), removes the record and private output, and stages after leftovers', () => {
    const stop = byName(S, 'Stop background servers');
    expect(stop.if).toBe('always()');
    expect(runOf(stop)).toMatch(/rm -f "\$RUNNER_TEMP\/stack-ownership\.json"/);
    const stage = S.findIndex((s) => s.id === 'stage');
    expect(S[stage].if).toBe('always()');
    expect(stage).toBeGreaterThan(at(/stack-checks\.sh leftovers/));
    expect(at(/stack-checks\.sh leftovers/)).toBeGreaterThan(at(/stack-net\.mjs remove/));
    expect(at(/stack-net\.mjs remove/)).toBeGreaterThan(at(/supabase stop/));
    expect(at(/supabase stop/)).toBeGreaterThan(S.indexOf(stop));
    expect(S.indexOf(stop)).toBeGreaterThan(at(/run-journey\.sh/));
    expect(S[stage + 1].uses).toMatch(/^actions\/upload-artifact@v4$/);
    expect(S[stage + 1].if).toBe("always() && steps.stage.outcome == 'success'");
  });
  it('serves no Edge runtime and never runs the legacy e2e seed or the base Playwright config', () => {
    expect(runOf(byName(S, 'supabase start'))).toMatch(/-x [^\n]*edge-runtime/);
    for (const re of [/functions serve/, /scripts\/e2e\/seed\.sh/, /playwright test(?! -c)/, /playwright\.config\.ts/]) expect(all(re), String(re)).toEqual([]);
  });
});
