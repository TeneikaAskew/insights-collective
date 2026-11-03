// ABOUTME: Structural, read-only controls for the PROPOSED builder-authoring job (WP-08 acceptance): its stack, PRE, served-app,
// ABOUTME: shell-pin and cleanup steps are the reviewed gradebook-journey steps byte-for-byte (job-scoped names only), D1 precedes every write.
//
// Read-only on purpose: nothing here writes a file (the security.yml fs-write gate admits no new test file without approval).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';
import { laneProblems, BUILDER_PROJECTS } from '../../../scripts/e2e/gb-launch-binding';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string; with?: Record<string, unknown> };
const BA = DOC.jobs['builder-authoring'];
const GB = DOC.jobs['gradebook-journey'];
const S = BA.steps as Step[];
const runOf = (s: Step) => String(s.run ?? '');
const at = (re: RegExp) => { const i = S.findIndex((s) => re.test(runOf(s))); expect(i, String(re)).toBeGreaterThan(-1); return i; };
const all = (re: RegExp) => S.map((s, i) => (re.test(runOf(s)) ? i : -1)).filter((i) => i >= 0);
const byName = (steps: Step[], prefix: string) => { const f = steps.filter((s) => String(s.name ?? '').startsWith(prefix)); expect(f.length, prefix).toBe(1); return f[0]; };
const idx = (prefix: string) => S.indexOf(byName(S, prefix));
// Job-scoped renames only (gradebook-journey -> builder-authoring). GB_SHELL_PATH and GB_LANE are read by the shared launch-binding
// helper and are deliberately NOT renamed; anything else that differs is not "reused unchanged".
const rename = (t: string) => t.replace(/GB_EVIDENCE/g, 'BA_EVIDENCE').replace(/IC_WORKDIR_GB/g, 'IC_WORKDIR_BA')
  .replace(/\bgb_prep\b/g, 'ba_prep').replace(/\bgb_d1\b/g, 'ba_d1').replace(/GB_D1_BOOTSTRAP_SHA256/g, 'BA_D1_BOOTSTRAP_SHA256')
  .replace(/GB_(DIST|HERMETIC|SERVED)\b/g, 'BA_$1').replace(/\$RUNNER_TEMP\/gb-/g, '$RUNNER_TEMP/ba-').replace(/-gbj"/g, '-baj"').replace(/\/ic-gb"/g, '/ic-ba"')
  .replace(/supabase (start|stop) ok \(gradebook-journey\)/g, 'supabase $1 ok (builder-authoring)');
const REUSED = [
  'Prepare workdir', 'Create owned loopback-binding network', 'supabase start (local; no studio; edge runtime EXCLUDED', 'Export loopback endpoints',
  'Target guards', 'Published ports loopback-only', 'No Edge runtime container exists (read-only; before any write)', 'STAGE PRE',
  'Bootstrap schema snapshot', 'Verify identities', 'Seven reviewed migrations', 'Build app', 'Derive and verify the TEST-SERVED copy',
  'Serve the TEST-SERVED copy', 'Served-app gate receipt', 'Avatar-fixture live binding', 'Install Chromium headless shell',
  'Pin the headless shell and export it', 'Local actors and reference rows', 'Stop background servers', 'Stop stack (no backup)',
  'Remove owned network', 'Nothing left behind',
];
const NET = '"ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"';
const OWNER = '"$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-baj"';

describe('builder-authoring job (proposal; unrun)', () => {
  it('is accepted by the unchanged isolated-workflow checker, is its own dispatch value, and binds no environment or secret', async () => {
    expect(await checkWorkflowText(WF)).toEqual([]);
    expect(DOC.on.workflow_dispatch.inputs.specs.options).toContain('builder-authoring');
    expect(BA.if).toBe("inputs.specs == 'builder-authoring'");
    expect(BA.permissions).toEqual({ contents: 'read' });
    expect(BA.environment).toBeUndefined();
    expect(JSON.stringify(BA)).not.toMatch(/\$\{\{[^}]*secrets|STORAGE_METADATA_JSON|storage-job\.mjs|gb-st-priv/);
  });

  it('uses the accepted stack-net name grammar unchanged (no new name form); one job-unique owner label on create, verify and remove', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/local-stack/t09/stack-net.mjs'), 'utf8');
    const m = src.match(/^const NAMES = \/(.+)\/;/m);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('^ic-t09-(old|new)-net-[0-9]{1,20}-[0-9]{1,4}$');   // the guard itself is not widened
    const NAMES = new RegExp(m![1]);
    expect(NAMES.test(NET.slice(1, -1).replace('$GITHUB_RUN_ID', '41000000001').replace('$GITHUB_RUN_ATTEMPT', '1'))).toBe(true);
    expect(WF).not.toMatch(/ic-(rr|nr|ba)-net-/);                                // the refused custom forms never appear
    const job = S.map(runOf).join('\n');
    expect(runOf(S[at(/stack-net\.mjs create/)])).toBe(`node scripts/local-stack/t09/stack-net.mjs create ${NET} ${OWNER} | tee "$BA_EVIDENCE/checks/net-create.txt"`);
    expect(job).toContain(`supabase start --workdir "$IC_WORKDIR_BA" --network-id ${NET} -x `);
    expect(job).toContain(`stack-net.mjs verify ${NET} ${OWNER}`);
    expect(runOf(S[at(/stack-net\.mjs remove/)])).toBe(`node scripts/local-stack/t09/stack-net.mjs remove ${NET} ${OWNER} | tee "$BA_EVIDENCE/checks/net-remove.txt"`);
    expect(job.match(/--network-id/g)?.length).toBe(1);
    expect(job).not.toMatch(/docker +network/);
    // The owner label is unique among every job of the workflow (each job runs on its own runner; the label still differs).
    const owners = [...WF.matchAll(/stack-net\.mjs create "[^"]+" "\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT-([a-z]+)"/g)].map((x) => x[1]);
    expect(owners.filter((o) => o === 'baj')).toHaveLength(1);
  });

  it('reuses every reviewed stack, PRE, served-app, shell-pin, actor and cleanup step of gradebook-journey unchanged (job-scoped names only)', () => {
    for (const p of REUSED) expect(runOf(byName(S, p)), p).toBe(rename(runOf(byName(GB.steps, p))));
    for (const p of REUSED) expect(byName(S, p).if, p).toBe(rename(String(byName(GB.steps, p).if ?? '')) || undefined);
    // D1 is the gradebook D1 minus its Storage composition receipt line (this job has no Storage composition).
    const gbD1 = rename(runOf(byName(GB.steps, 'D1 stack-ownership record'))).split('\n').filter((l) => !/d1-composition\.txt/.test(l)).join('\n');
    expect(runOf(byName(S, 'D1 stack-ownership record'))).toBe(gbD1);
    expect(BA.env.BA_D1_BOOTSTRAP_SHA256).toBe(GB.env.GB_D1_BOOTSTRAP_SHA256);
  });

  it('PRE, then D1 exactly once after every reviewed check and the launch binding, and before any actor, fixture or browser write', () => {
    const writes = all(/stack-ownership\.mjs write/);
    expect(writes).toHaveLength(1);
    const d1 = writes[0];
    expect(S[d1].id).toBe('ba_d1');
    expect(S[d1].if).toBeUndefined();
    const before = [/stack-net\.mjs create/, /stack-net\.mjs verify/, /stack-checks\.sh ports/, /noedge-probes\.sh absent before/, /stage-pre\.sh/,
      /bootstrap\.sh "\$SUPABASE_DB_URL"/, /verify-identities\.sh/, /apply-reviewed\.sh "\$SUPABASE_DB_URL" NEW/, /hermetic-dist\.mjs verify/,
      /cmp -s "\$RUNNER_TEMP\/preview-index\.html"/, /served-app-check\.mjs "\$E2E_BASE_URL"/, /avatar-live-check\.mjs/, /headless-shell\.mjs receipt/,
      /GB_LANE=builder-authoring .*gb-launch-binding\.ts \| tee/];
    for (const re of before) expect(at(re), String(re)).toBeLessThan(d1);
    expect(at(/stage-pre\.sh/)).toBeLessThan(at(/bootstrap\.sh "\$SUPABASE_DB_URL"/));
    for (const re of [/gb-job-psql\.mjs preseed/, /gb-job-psql\.mjs seed-auth/, /builder-authoring-fixture\/run\.sh/]) for (const i of all(re)) expect(i, String(re)).toBeGreaterThan(d1);
    expect(at(/gb-job-psql\.mjs seed-auth/)).toBeLessThan(at(/builder-authoring-fixture\/run\.sh/));
    expect(all(/seed-auth\.sh|local-preseed\.sql|seed\.sql/)).toEqual([]);   // writes go through gb-job-psql.mjs and the adapter only
    for (const p of ['Pin the headless shell', 'Launch binding receipt', 'D1 stack-ownership record', 'Local actors and reference rows', 'Builder authoring adapter']) expect(byName(S, p).if, p).toBeUndefined();
  });

  it('binds every builder launch to the pinned shell: receipt before D1, and an immediate recheck before the adapter', () => {
    const recv = runOf(byName(S, 'Launch binding receipt'));
    expect(recv).toBe('set -o pipefail\nGB_LANE=builder-authoring BA_SESSION_DIR="$RUNNER_TEMP/ba-launch-binding-unused" BA_RUN_DIR="$RUNNER_TEMP/ba-launch-binding-unused" BA_NONCE=0000000000000000 npx --no-install tsx scripts/e2e/gb-launch-binding.ts | tee "$BA_EVIDENCE/checks/launch-binding.txt"\n');
    expect(idx('Pin the headless shell')).toBeLessThan(idx('Launch binding receipt'));
    const a = runOf(byName(S, 'Builder authoring adapter')).split('\n').filter(Boolean);
    expect(a[0]).toBe('set -o pipefail');
    const shell = a.findIndex((l) => l.startsWith('[ "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" = "$GB_SHELL_PATH" ] && [ -n "$GB_SHELL_PATH" ] ||'));
    const recheck = a.findIndex((l) => l === 'GB_LANE=builder-authoring BA_SESSION_DIR="$RUNNER_TEMP/ba-launch-binding-unused" BA_RUN_DIR="$RUNNER_TEMP/ba-launch-binding-unused" BA_NONCE=0000000000000000 npx --no-install tsx scripts/e2e/gb-launch-binding.ts > "$RUNNER_TEMP/ba-launch-recheck.txt" || { cat "$RUNNER_TEMP/ba-launch-recheck.txt"; exit 1; }');
    const run = a.findIndex((l) => l.startsWith('scripts/builder-authoring-fixture/run.sh "$RUNNER_TEMP/ba-out" 2>&1 | scripts/local-stack/t09/stack-checks.sh redact |'));
    expect([shell >= 0, recheck > shell, run > recheck]).toEqual([true, true, true]);
    // The browser runs only through the adapter's own `-c playwright.builder-authoring.config.ts`.
    for (const re of [/playwright test/, /playwright\.config\.ts/, /functions serve/, /scripts\/e2e\/seed\.sh/]) expect(all(re), String(re)).toEqual([]);
    expect(runOf(byName(S, 'supabase start'))).toMatch(/-x [^\n]*edge-runtime/);
  });

  it('adds no failure injection: the builder lane pins exactly its three viewport projects, other lanes are unchanged', () => {
    expect(WF).not.toMatch(/BA_[A-Z_]*INJECT|route\.fulfill|setOffline/);
    const P = '/x/chrome-headless-shell';
    const proj = (names: string[]) => names.map((name) => ({ name, use: { launchOptions: { executablePath: P } } }));
    expect(laneProblems('builder-authoring', {}, proj(BUILDER_PROJECTS))).toEqual([]);
    expect(laneProblems('builder-authoring', {}, proj([...BUILDER_PROJECTS, 'ba-extra']))[0]).toMatch(/not exactly/);
    expect(laneProblems('builder-authoring', {}, proj(['ba-768', 'ba-1440', 'ba-390']))[0]).toMatch(/not exactly/);
    expect(laneProblems('journey', {}, [])).toEqual([]);
  });

  it('pins the reviewed bootstrap digest as a constant equal to the checked-out bootstrap.sh; the adapter reads that constant', () => {
    const want = createHash('sha256').update(readFileSync(path.join(ROOT, 'scripts/local-stack/bootstrap.sh'))).digest('hex');
    expect(BA.env.BA_D1_BOOTSTRAP_SHA256).toBe(want);
    const d1 = runOf(byName(S, 'D1 stack-ownership record'));
    expect(d1).toMatch(/\[ "\$have" = "\$BA_D1_BOOTSTRAP_SHA256" \] \|\| \{ echo "D1 refused/);
    expect(d1).not.toMatch(/bootstrap_sha256|jq|cat "\$STACK_OWNERSHIP_FILE"/);
    // The builder adapter verifies D1 through the gradebook pairing producer, whose pinned EXPECTED_BOOTSTRAP_SHA256 equals this constant.
    expect(readFileSync(path.join(ROOT, 'scripts/builder-authoring-fixture/run.sh'), 'utf8')).toMatch(/pairing-producer\.mjs" ownership "\$RAW"/);
    expect(readFileSync(path.join(ROOT, 'scripts/gradebook-fixture/journey/pairing-producer.mjs'), 'utf8')).toContain(`export const EXPECTED_BOOTSTRAP_SHA256 = '${want}';`);
  });

  it('private raw output stays private: six fixed summaries plus manifest-equal PNGs are copied; the adapter parent shape is removed', () => {
    const copy = byName(S, "Copy the adapter's evidence");
    expect(copy.if).toBe("always() && steps.ba_d1.outcome == 'success'");
    expect(runOf(copy)).toContain('for f in manifest.txt pairing.txt playwright-summary.txt screenshots.txt seed.txt witness.txt; do [ -f "$O/$f" ] && [ ! -L "$O/$f" ] && cp "$O/$f" "$BA_EVIDENCE/ba/$f"; done');
    expect(runOf(copy)).toContain("want=$(sed -n 's/^SHOT name=\\([a-z0-9_]*\\) .*/\\1.png/p' \"$O/screenshots.txt\" | LC_ALL=C sort | tr '\\n' ' ')");
    expect(runOf(copy)).toContain('[ "$want" = "$have" ] || { echo "screenshots refused: the dir does not equal its manifest"; exit 1; }');
    const rm = runOf(byName(S, 'Remove private outputs'));
    for (const p of ['test-results', '"$RUNNER_TEMP/ba-out"', '"$RUNNER_TEMP/ba-priv"', '"$RUNNER_TEMP"/ba-run.??????????', '"$RUNNER_TEMP/stack-ownership.json"',
      '"$RUNNER_TEMP/ba-shell-receipt.txt"', '"$RUNNER_TEMP/ba-shell-receipt.txt.bound"', '"$RUNNER_TEMP/ba-launch-recheck.txt"']) expect(rm, p).toContain(p);
    expect(rm).toContain('for d in "$RUNNER_TEMP"/ba-run.*; do');
    // The adapter's mktemp template is exactly the shape the job removes.
    expect(readFileSync(path.join(ROOT, 'scripts/builder-authoring-fixture/run.sh'), 'utf8')).toContain('mktemp -d "$TMPROOT/ba-run.XXXXXXXXXX"');
    const stage = runOf(S[at(/stack-checks\.sh stage-evidence \$REQ ba-upload/)]);
    for (const f of ['checks/launch-binding.txt', 'checks/d1-write.txt', 'checks/actors.txt', 'checks/builder-authoring.txt', 'ba/manifest.txt', 'ba/pairing.txt',
      'ba/playwright-summary.txt', 'ba/screenshots.txt', 'ba/seed.txt', 'ba/witness.txt', 'checks/private-removed.txt', 'checks/net-remove.txt', 'checks/leftovers.txt']) expect(stage.split(`"$E/${f}"`).length - 1, f).toBe(1);
    expect(stage).not.toMatch(/\.png|playwright\.json|report\.json|test-results/);
  });

  it('runs every cleanup and staging step under always(), in order: stop servers, remove private, stop stack, remove network, leftovers, stage, upload', () => {
    const order = ['Stop background servers', 'Remove private outputs', 'Stop stack (no backup)', 'Remove owned network', 'Nothing left behind', 'Stage evidence'].map(idx);
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(order[1]).toBe(order[0] + 1);
    for (const p of ['Stop background servers', 'Remove private outputs', 'Stage evidence']) expect(byName(S, p).if, p).toBe('always()');
    for (const p of ['Stop stack (no backup)', 'Remove owned network', 'Nothing left behind']) expect(byName(S, p).if, p).toBe("always() && steps.ba_prep.outcome == 'success'");
    expect(order[0]).toBeGreaterThan(at(/builder-authoring-fixture\/run\.sh/));
    const up = S[order[5] + 1];
    expect(up.uses).toBe('actions/upload-artifact@v4');
    expect(up.if).toBe("always() && steps.stage.outcome == 'success'");
    expect(up.with).toEqual({ name: 'builder-authoring-${{ github.run_id }}', 'retention-days': 14, 'if-no-files-found': 'error', path: 'ba-upload/' });
  });

  it('carries no gradebook provenance label of its own: only the shared helpers keep their gb names', () => {
    const own = S.map((s) => `${s.name ?? ''}\n${runOf(s)}`).join('\n')
      .replace(/scripts\/e2e\/gb-(job-psql\.mjs|launch-binding\.ts)/g, '').replace(/\bGB_(SHELL_PATH|LANE)\b/g, '')
      // the four reused #162 files the pin step names by exact path (and only those)
      .replace(/ (e2e\/gradebook-roles\/journey\/(shot-core|private-dir)|scripts\/gradebook-fixture\/journey\/(shot-export|private-psql))\.mjs$/gm, '');
    expect(own).not.toMatch(/gradebook|journey|\bgb[-_]|\bGB_|-gbj\b/i);
    expect(JSON.stringify(BA.env)).not.toMatch(/GB_/);
    expect(String(BA.name)).toMatch(/^Builder authoring acceptance \(WP-08 /);
  });

  // Real config load through the helper, read-only (no file is written; BA_SESSION_DIR is never created). Local container only.
  const SHELL = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const LOCAL_DEMO_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  const bind = (extra: Record<string, string | undefined>) => {
    const env: Record<string, string> = {
      PATH: String(process.env.PATH), HOME: String(process.env.HOME), GB_LANE: 'builder-authoring', BA_SESSION_DIR: '/nonexistent/ba-launch-binding-unused', BA_RUN_DIR: '/nonexistent/ba-launch-binding-unused', BA_NONCE: '0000000000000000',
      GB_SHELL_PATH: SHELL, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: SHELL, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_BASE_URL: 'http://127.0.0.1:8080',
      SUPABASE_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', VITE_SUPABASE_ANON_KEY: LOCAL_DEMO_ANON, E2E_ISOLATED_TARGET_REF: '',
    };
    for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete env[k]; else env[k] = v; }
    const r = spawnSync(path.join(ROOT, 'node_modules/.bin/tsx'), ['scripts/e2e/gb-launch-binding.ts'], { cwd: ROOT, env, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  it.skipIf(!existsSync(SHELL))('real builder config load: the three projects and the setup launch name exactly the pinned shell', { timeout: 60_000 }, () => {
    const r = bind({});
    expect(r.code, r.out).toBe(0);
    expect(r.out.match(/^BA-LAUNCH project (ba-[0-9]+) executablePath=(.*)$/gm)).toEqual(BUILDER_PROJECTS.map((n) => `BA-LAUNCH project ${n} executablePath=${SHELL}`));
    expect(r.out).toContain(`BA-LAUNCH session-setup executablePath=${SHELL}`);
    expect(r.out).not.toMatch(/GB-LAUNCH/);
  });
  it.skipIf(!existsSync(SHELL))('real builder config load refuses: unset or foreign browser pin, bad nonce', { timeout: 60_000 }, () => {
    for (const extra of [{ BA_NONCE: 'x' }, { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/sh' }, { GB_SHELL_PATH: undefined }, { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: undefined }]) {
      const r = bind(extra);
      expect(r.code, JSON.stringify(extra)).toBe(1);
      expect(r.out, JSON.stringify(extra)).toMatch(/^BA-LAUNCH REFUSED: /m);
    }
  });

  // Capture, export, private and launch pins: exact pairs, before any write, equal to the tested tree (git hash-object reads only).
  const PINS: [string, string][] = [
    ['e2e/gradebook-roles/journey/shot-core.mjs', '527d4c0eaf9190efc25c57cbe81ff2af0c37795d'],
    ['scripts/builder-authoring-fixture/shot-plan.mjs', '20730c158d0e63e9ed43d55045c8dbb9b6d6b300'],
    ['scripts/gradebook-fixture/journey/shot-export.mjs', '3ecad8e4d3f62a3fff7b6f195fd6dc4554249196'],
    ['scripts/builder-authoring-fixture/ba-shots.mjs', '837dbc0ad772a01647a52ebc3ed3fe57d78f0827'],
    ['e2e/gradebook-roles/journey/private-dir.mjs', '030a386937b431c2af44209e070164750cdb7751'],
    ['scripts/gradebook-fixture/journey/private-psql.mjs', '8077eccfc6f6bc85cd391bc13efff071f3b9f27a'],
    ['scripts/e2e/gb-launch-binding.ts', '318ba727816dea1a8f12caf55056309333a09c75'],
    ['playwright.builder-authoring.config.ts', 'b7653ec1986ed68c6e2f7a4bb96ea084e913d764'],
  ];
  it('pins exactly the capture, export, private and launch files by blob id, before the stack and every write, and stages the receipt', () => {
    const i = idx('Capture, export, private and launch files pinned');
    const run = runOf(S[i]);
    const listed = [...run.matchAll(/^([0-9a-f]{40}) (\S+)$/gm)].map((m) => [m[2], m[1]]);
    expect(listed).toEqual(PINS);
    expect(run).toMatch(/git hash-object -- "\$rel"/);
    expect(run).toMatch(/exit "\$rc"/);
    expect(S[i].if).toBeUndefined();
    for (const later of ['Create owned loopback-binding network', 'D1 stack-ownership record', 'Local actors and reference rows', 'Builder authoring adapter']) expect(idx(later)).toBeGreaterThan(i);
    for (const [rel, want] of PINS) {
      const r = spawnSync('git', ['hash-object', '--', rel], { cwd: ROOT, encoding: 'utf8' });
      expect(r.stdout.trim(), rel).toBe(want);
    }
    expect(runOf(byName(S, 'Stage evidence'))).toContain('"$E/checks/reused-pins.txt"');
  });
  it('removes the adapter parent independently of its trap (always), counts it before and after, and always writes the absence receipt', () => {
    const st = byName(S, 'Remove private outputs');
    const run = runOf(st);
    expect(st.if).toBe('always()');
    expect(run).toContain('before=0; for d in "$RUNNER_TEMP"/ba-run.??????????; do');
    expect(run).toContain('"$RUNNER_TEMP"/ba-run.??????????');
    expect(run).toContain('after=0; for d in "$RUNNER_TEMP"/ba-run.*; do');
    // its own unconditional line: written on success and on failure
    expect(run).toMatch(/^echo "PRIVATE \$res adapter_parents_before=\$before adapter_parents_after=\$after paths=8" \| tee "\$BA_EVIDENCE\/checks\/private-removed\.txt"$/m);
    expect(run.indexOf('PRIVATE $res')).toBeLessThan(run.indexOf('exit "$rc"'));
    expect(run).not.toMatch(/if \[ "\$rc" -eq 0 \]; then echo .*private-removed/);
    expect(idx('Remove private outputs')).toBeGreaterThan(idx('Builder authoring adapter'));
    expect(idx('Remove private outputs')).toBeLessThan(idx('Stop stack (no backup)'));
    expect(runOf(byName(S, 'Stage evidence'))).toContain('"$E/checks/private-removed.txt"');
    // the mktemp shape it removes is exactly the adapter's
    const adapter = readFileSync(path.join(ROOT, 'scripts/builder-authoring-fixture/run.sh'), 'utf8');
    expect(adapter).toContain('PARENT="$(mktemp -d "$TMPROOT/ba-run.XXXXXXXXXX")"');
  });
});
