// ABOUTME: Plan v2 section 5 controls for the t09-runtime job in the COMMITTED e2e.yml: the unchanged checker accepts it, and
// ABOUTME: refuses copies that add secrets, vars, write permissions, a widened trigger or a pre-policy step. Checker rules are not changed.
//
// Each negative control edits ONE thing in a parsed copy of the committed workflow, then asserts that the checker refuses it
// AND that every reported problem belongs to the injected class, so an unrelated failure cannot stand in for the refusal.
// The copies are inert strings handed to the checker; none is written to disk or run.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const REF = 'abcdefghijklmnopqrst';
const JOB = 't09-runtime';

/** A parsed, editable copy of the committed workflow; `edit` mutates it and the result is re-serialized. */
function variant(edit: (doc: YAML.Document.Parsed) => void): string {
  const doc = YAML.parseDocument(WF, { uniqueKeys: true });
  edit(doc);
  return String(doc);
}
const steps = (doc: YAML.Document.Parsed) => doc.getIn(['jobs', JOB, 'steps']) as YAML.YAMLSeq;
const policyIndex = (doc: YAML.Document.Parsed) =>
  steps(doc).items.findIndex((s) => /check-isolated-workflow\.mjs --executed/.test(String((s as YAML.YAMLMap).get('run') ?? '')));
const step = (doc: YAML.Document.Parsed, body: Record<string, unknown>) => doc.createNode(body);

async function refused(text: string, cls: RegExp) {
  const problems = await checkWorkflowText(text, REF);
  expect(problems.length, 'the variant must be refused').toBeGreaterThan(0);
  for (const p of problems) expect(p, `unrelated problem reported: ${p}`).toMatch(cls);
  return problems;
}

describe('t09-runtime job under the unchanged isolated-workflow checker', () => {
  it('control: the committed workflow, including the t09-runtime job, is accepted', async () => {
    expect(await checkWorkflowText(WF, REF)).toEqual([]);
  });

  it('control: an unedited parse-and-serialize round trip is still accepted (the variant builder adds no problem)', async () => {
    expect(await checkWorkflowText(variant(() => {}), REF)).toEqual([]);
  });

  it('control: the job is dispatch-only, scoped to its own input, read-only, and the isolated job stays narrowed', () => {
    const doc = YAML.parse(WF);
    expect(Object.keys(doc.on)).toEqual(['workflow_dispatch']);
    expect(doc.on.workflow_dispatch.inputs.specs.options).toEqual(['readonly-courses', 't09-runtime', 'learner-quiz', 'learner-quiz-noedge', 'gradebook-journey', 'builder-authoring', 'builder-authoring-k1']);
    expect(doc.permissions).toEqual({});
    expect(doc.jobs[JOB].if).toBe("inputs.specs == 't09-runtime'");
    expect(doc.jobs[JOB].permissions).toEqual({ contents: 'read' });
    expect(doc.jobs.isolated.if).toBe("inputs.specs == 'readonly-courses'");
    expect(doc.jobs[JOB].secrets).toBeUndefined();
    expect(doc.jobs[JOB].services).toBeUndefined();
    expect(doc.jobs[JOB].container).toBeUndefined();
  });

  it('control: keys and persona tokens are deleted by their own always() step, before and independent of each stack stop', () => {
    const steps = YAML.parse(WF).jobs[JOB].steps as Array<{ name?: string; if?: string; run?: string }>;
    for (const m of ['OLD', 'NEW']) {
      const lower = m.toLowerCase();
      const del = steps.findIndex((s) => s.name?.startsWith(`${m} - delete local keys and persona tokens`));
      const stop = steps.findIndex((s) => s.name?.startsWith(`${m} - stop`));
      expect(del, `${m} deletion step`).toBeGreaterThan(-1);
      expect(steps[del].if).toBe('always()');
      expect(del).toBeLessThan(stop);
      expect(steps[del].run).toContain(`rm -rf "$RUNNER_TEMP/t09-keys-${lower}" "$RUNNER_TEMP/t09-${lower}-personas.json"`);
      expect(steps[del].run).toMatch(/\[ -e "\$RUNNER_TEMP\/t09-keys-[a-z]+" \] \|\| \[ -e .*exit 1/);
      expect(steps[stop].run).not.toContain('t09-keys-');   // the stop step no longer owns deletion
    }
  });

  describe('secrets', () => {
    it('refuses a secrets expression in the job env', async () => {
      const p = await refused(variant((d) => d.setIn(['jobs', JOB, 'env', 'T09_LEAK'], '${{ secrets.SUPABASE_ACCESS_TOKEN }}')), /^secrets:/);
      expect(p.some((x) => x.includes(`jobs.${JOB}.env.T09_LEAK`))).toBe(true);
    });
    it('refuses a bracketed secrets expression inside a step run', async () => {
      await refused(variant((d) => steps(d).add(step(d, { run: "echo \"${{ secrets['SERVICE_ROLE_KEY'] }}\" > /dev/null" }))), /^secrets:/);
    });
    it('refuses secrets wrapped in an allowed function', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'env', 'T09_LEAK'], '${{ toJSON(secrets) }}')), /^secrets:/);
    });
    it('refuses `secrets: inherit` on the job', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'secrets'], 'inherit')), /^secrets: jobs\.t09-runtime passes secrets$/);
    });
  });

  describe('vars', () => {
    it('refuses a vars expression in the job env', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'env', 'T09_VAR'], '${{ vars.PROJECT_REF }}')), /^vars:/);
    });
    it('refuses a vars expression in a step condition', async () => {
      await refused(variant((d) => steps(d).add(step(d, { if: "${{ vars.RUN_PROD == 'yes' }}", run: 'echo ok' }))), /^vars:/);
    });
  });

  describe('write permissions', () => {
    for (const [scope, level] of [['contents', 'write'], ['id-token', 'write'], ['packages', 'write'], ['actions', 'write'], ['pull-requests', 'write']]) {
      it(`refuses ${scope}: ${level} on the t09-runtime job`, async () => {
        await refused(variant((d) => d.setIn(['jobs', JOB, 'permissions', scope], level)), new RegExp(`^write-perm: jobs\\.t09-runtime\\.permissions\\.${scope} `));
      });
    }
    it('refuses `permissions: write-all` on the job', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'permissions'], 'write-all')), /^job-permissions: jobs\.t09-runtime\.permissions must be a map/);
    });
    it('refuses a job with its permissions removed (would inherit, not declare)', async () => {
      await refused(variant((d) => d.deleteIn(['jobs', JOB, 'permissions'])), /^job-permissions: jobs\.t09-runtime\.permissions must declare permissions$/);
    });
    it('refuses a non-empty top-level permissions block', async () => {
      await refused(variant((d) => d.set('permissions', d.createNode({ contents: 'read' }))), /^top-permissions:/);
    });
  });

  describe('widened trigger', () => {
    for (const trigger of ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_run', 'workflow_call', 'repository_dispatch']) {
      it(`refuses adding \`${trigger}\` next to workflow_dispatch`, async () => {
        await refused(variant((d) => d.setIn(['on', trigger], null)), /^triggers: only workflow_dispatch is allowed/);
      });
    }
    it('refuses the list form `on: [workflow_dispatch, push]`', async () => {
      await refused(variant((d) => d.set('on', d.createNode(['workflow_dispatch', 'push']))), /^triggers:/);
    });
  });

  describe('policy-step order and other job-level controls', () => {
    it('refuses the t09-runtime job without its executed-file policy step', async () => {
      await refused(variant((d) => steps(d).delete(policyIndex(d))), /^order: jobs\.t09-runtime has no /);
    });
    it('refuses a stack start placed before the policy step', async () => {
      await refused(variant((d) => steps(d).items.splice(policyIndex(d), 0, step(d, { run: 'npx supabase start' }))), /^order: jobs\.t09-runtime\.steps\[\d+\] runs `npx supabase start` before the policy check$/);
    });
    it('refuses an unbounded curl in the job', async () => {
      await refused(variant((d) => steps(d).add(step(d, { run: 'curl -sS http://127.0.0.1:54321/rest/v1/' }))), /^curl: jobs\.t09-runtime\.steps\[\d+\] has a curl without/);
    });
    it('refuses a hosted Supabase host and `supabase link`', async () => {
      const p = await refused(variant((d) => steps(d).add(step(d, { run: 'npx supabase link --project-ref x && curl --connect-timeout 5 --max-time 9 https://x.supabase.co' }))), /^run: jobs\.t09-runtime\.steps\[\d+\] (targets a hosted Supabase project|names a hosted Supabase host)$/);
      expect(p.length).toBe(2);
    });
    it('refuses a failure masked with `|| true`', async () => {
      await refused(variant((d) => steps(d).add(step(d, { run: 'bash scripts/local-stack/t09/stage-app.sh || true' }))), /^run: jobs\.t09-runtime\.steps\[\d+\] masks a failure/);
    });
    it('refuses a third-party action', async () => {
      await refused(variant((d) => steps(d).add(step(d, { uses: 'supabase/setup-cli@v1' }))), /^action: jobs\.t09-runtime\.steps\[\d+\] uses supabase\/setup-cli@v1$/);
    });
    it('refuses services on the job', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'services'], d.createNode({ pg: { image: 'postgres:15' } }))), /^container: jobs\.t09-runtime declares/);
    });
    it('refuses github.token in an expression', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'env', 'GH'], '${{ github.token }}')), /^expression: github\.token at /);
    });
    it('refuses the production project ref anywhere in the file', async () => {
      await refused(variant((d) => d.setIn(['jobs', JOB, 'env', 'X_REF'], REF)), /^prod-ref:/);
    });
  });
});
