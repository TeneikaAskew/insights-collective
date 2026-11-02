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
  'Bootstrap schema snapshot', 'Verify identities', 'Seven reviewed migrations', 'Build app',
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
    for (const re of [/gb-job-psql\.mjs preseed/, /gb-job-psql\.mjs seed-auth/, /run-journey\.sh/, /pairing-producer\.mjs/, /seed-journey\.sql/, /fixture\.sh/]) {
      for (const i of all(re)) expect(i, String(re)).toBeGreaterThan(d1);
    }
    expect(all(/seed-auth\.sh|local-preseed\.sql/)).toEqual([]);   // the job's own callers go through gb-job-psql.mjs only
    expect(at(/gb-job-psql\.mjs seed-auth/)).toBeLessThan(at(/run-journey\.sh/));
  });
  it("gives the adapter's served-app gate the verified copy and records it live before D1; copies exactly the 7-entry inventory", () => {
    const gate = at(/served-app-check\.mjs "\$E2E_BASE_URL"/);
    expect(gate).toBeGreaterThan(at(/cmp -s "\$RUNNER_TEMP\/preview-index\.html"/));
    expect(gate).toBeLessThan(all(/stack-ownership\.mjs write/)[0]);
    // The adapter's unchanged gate checks the HERMETIC layer (the avatar fixture never changes index.html); the avatar layer
    // is bound live by avatar-live-check.mjs right after it, still before D1.
    expect(runOf(S[gate])).toMatch(/echo "HERMETIC_SERVED_DIR=\$GB_HERMETIC" >> "\$GITHUB_ENV"/);
    expect(runOf(S[gate])).toMatch(/HERMETIC_SERVED_DIR="\$GB_HERMETIC" node scripts\/served-app\/served-app-check\.mjs "\$E2E_BASE_URL"/);
    const live = at(/avatar-live-check\.mjs "\$E2E_BASE_URL" "\$GB_DIST" "\$GB_HERMETIC" "\$GB_SERVED"/);
    expect(live).toBe(gate + 1);
    expect(live).toBeLessThan(all(/stack-ownership\.mjs write/)[0]);
    expect(S.map(runOf).join('\n')).not.toMatch(/HERMETIC_SERVED_DIR=\$GB_SERVED|HERMETIC_SERVED_DIR="\$GB_SERVED"/);
    expect(runOf(S[at(/served-app-check-selftest\.mjs/)])).toMatch(/served-app-check-selftest/);
    const copy = runOf(byName(S, "Copy the adapter's inventoried evidence"));
    expect(copy).toMatch(/for f in compare\.txt composition\.txt pairing\.txt playwright-summary\.txt screenshots\.txt seed\.txt; do/);
    expect(copy).toMatch(/\[ "\$want" = "\$have" \] \|\| \{ echo "screenshots refused: the dir does not equal its manifest"; exit 1; \}/);
    expect(copy).toMatch(/\[ "\$\(stat -c %a "\$S\/\$p"\)" = 600 \]/);
    expect(runOf(byName(S, 'Stage evidence'))).toContain('"$E/journey/screenshots.txt"');
    const adapter = readFileSync(path.join(ROOT, 'scripts/gradebook-fixture/journey/run-journey.sh'), 'utf8');
    expect(adapter).toContain('= "compare.txt composition.txt pairing.txt playwright-summary.txt screenshots screenshots.txt seed.txt " ]');
  });
  it('derives the served copy as the pinned avatar fixture of the verified hermetic copy (the LQ hermetic lines on the hermetic dir)', () => {
    const d = runOf(byName(S, 'Derive and verify the TEST-SERVED copy and its avatar-fixture copy'));
    const lq = rename(runOf(byName(LQ.steps, 'Derive and verify the TEST-SERVED copy'))).split('\n').filter(Boolean);
    // The three reviewed hermetic lines and the provenance copy, unchanged apart from the directory variable.
    for (const l of lq.filter((x) => /hermetic-dist\.mjs (make|verify)|check-local-target\.mjs dist|HERMETIC-PROVENANCE/.test(x))) {
      expect(d.split('\n')).toContain(l.replace(/\$SERVED/g, '$HERM'));
    }
    const lines = d.split('\n');
    const idx = (re: RegExp) => { const i = lines.findIndex((l) => re.test(l)); expect(i, String(re)).toBeGreaterThan(-1); return i; };
    expect(lines[0]).toBe('set -o pipefail');
    expect(idx(/^HERM="\$RUNNER_TEMP\/gb-hermetic"$/)).toBeLessThan(idx(/^SERVED="\$RUNNER_TEMP\/gb-served"$/));
    expect(idx(/hermetic-dist\.mjs verify dist "\$HERM"/)).toBeLessThan(idx(/avatar-fixture\.mjs make "\$PWD\/dist" "\$HERM" "\$SERVED"/));
    expect(idx(/avatar-fixture\.mjs make /)).toBeLessThan(idx(/avatar-fixture\.mjs verify "\$PWD\/dist" "\$HERM" "\$SERVED"/));
    idx(/check-local-target\.mjs dist "\$SERVED"/); idx(/AVATAR-PROVENANCE\.json/);
    idx(/realpath -e -- "\$d"/);
    expect(d).toContain('{ echo "GB_DIST=$PWD/dist"; echo "GB_HERMETIC=$HERM"; echo "GB_SERVED=$SERVED"; } >> "$GITHUB_ENV"');
    // The served directory is still the one preview serves and the index it is compared against.
    expect(runOf(byName(S, 'Serve the TEST-SERVED copy'))).toBe(rename(runOf(byName(LQ.steps, 'Serve the TEST-SERVED copy'))));
    // Pinned avatar fixture files are byte-identical to the reviewed #157 composition (89bd3c5 blobs).
    const blob = (p: string) => { const b = readFileSync(path.join(ROOT, p)); return createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
    expect(blob('scripts/served-app/avatar-fixture.mjs')).toBe('b8486aacf4d1c69998606aabad9358e0532568e5');
    expect(blob('scripts/served-app/avatars/avatar-fixture-11.svg')).toBe('f2716c1b401ce5a7271905a64cf7542ed0619ccf');
    expect(blob('scripts/served-app/avatars/avatar-fixture-13.svg')).toBe('baa1804a0666ac315393dcba3a682294fb341fcc');
    expect(blob('scripts/served-app/avatars/avatar-fixture-20.svg')).toBe('99165ac6ba81ee7cccdb2aea0a1737e2bdba7d84');
    expect(blob('scripts/served-app/tests/avatar-fixture-selftest.mjs')).toBe('554f2af31b49a168583194a292ba3cc5f680a327');
    expect(blob('scripts/served-app/hermetic-dist.mjs')).toBe('9db9bf1b8502681d73fcd63d7d653816ebbad0d2');
    const stage = runOf(byName(S, 'Stage evidence'));
    for (const f of ['avatar-fixture.txt', 'AVATAR-PROVENANCE.json', 'avatar-live.txt']) expect(stage).toContain(`"$E/checks/${f}"`);
    const st = runOf(S[at(/served-app-check-selftest\.mjs/)]);
    expect(st).toMatch(/node scripts\/served-app\/tests\/avatar-fixture-selftest\.mjs 2>&1 \| tail -3 \|/);
    expect(st).toMatch(/node scripts\/served-app\/tests\/avatar-live-check-selftest\.mjs \|/);
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
    const removal = byName(S, 'Remove private outputs');
    expect(removal.if).toBe('always()');
    expect(S.indexOf(removal)).toBe(S.indexOf(stop) + 1);
    expect(runOf(removal)).toMatch(/"\$RUNNER_TEMP\/stack-ownership\.json"/);
    expect(runOf(removal)).toMatch(/"\$RUNNER_TEMP\/gb-priv"/);
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
