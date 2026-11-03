// ABOUTME: Structural, read-only controls for the PROPOSED roster-reports job (T-15 persona acceptance): its stack, PRE, served-app,
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
import { laneProblems, ROSTER_PROJECTS } from '../../../scripts/e2e/gb-launch-binding';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string; with?: Record<string, unknown> };
const RR = DOC.jobs['roster-reports'];
const GB = DOC.jobs['gradebook-journey'];
const S = RR.steps as Step[];
const runOf = (s: Step) => String(s.run ?? '');
const at = (re: RegExp) => { const i = S.findIndex((s) => re.test(runOf(s))); expect(i, String(re)).toBeGreaterThan(-1); return i; };
const all = (re: RegExp) => S.map((s, i) => (re.test(runOf(s)) ? i : -1)).filter((i) => i >= 0);
const byName = (steps: Step[], prefix: string) => { const f = steps.filter((s) => String(s.name ?? '').startsWith(prefix)); expect(f.length, prefix).toBe(1); return f[0]; };
const idx = (prefix: string) => S.indexOf(byName(S, prefix));
// Job-scoped renames only (gradebook-journey -> roster-reports). GB_SHELL_PATH and GB_LANE are read by the shared launch-binding
// helper and are deliberately NOT renamed; anything else that differs is not "reused unchanged".
const rename = (t: string) => t.replace(/GB_EVIDENCE/g, 'RR_EVIDENCE').replace(/IC_WORKDIR_GB/g, 'IC_WORKDIR_RR')
  .replace(/\bgb_prep\b/g, 'rr_prep').replace(/\bgb_d1\b/g, 'rr_d1').replace(/GB_D1_BOOTSTRAP_SHA256/g, 'RR_D1_BOOTSTRAP_SHA256')
  .replace(/GB_(DIST|HERMETIC|SERVED)\b/g, 'RR_$1').replace(/\$RUNNER_TEMP\/gb-/g, '$RUNNER_TEMP/rr-').replace(/-gbj"/g, '-rrj"').replace(/\/ic-gb"/g, '/ic-rr"')
  .replace(/supabase (start|stop) ok \(gradebook-journey\)/g, 'supabase $1 ok (roster-reports)');
const REUSED = [
  'Prepare workdir', 'Create owned loopback-binding network', 'supabase start (local; no studio; edge runtime EXCLUDED', 'Export loopback endpoints',
  'Target guards', 'Published ports loopback-only', 'No Edge runtime container exists (read-only; before any write)', 'STAGE PRE',
  'Bootstrap schema snapshot', 'Verify identities', 'Seven reviewed migrations', 'Build app', 'Derive and verify the TEST-SERVED copy',
  'Serve the TEST-SERVED copy', 'Served-app gate receipt', 'Avatar-fixture live binding', 'Install Chromium headless shell',
  'Pin the headless shell and export it', 'Local actors and reference rows', 'Stop background servers', 'Stop stack (no backup)',
  'Remove owned network', 'Nothing left behind',
];
const NET = '"ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"';
const OWNER = '"$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-rrj"';

describe('roster-reports job (proposal; unrun)', () => {
  it('is accepted by the unchanged isolated-workflow checker, is its own dispatch value, and binds no environment or secret', async () => {
    expect(await checkWorkflowText(WF)).toEqual([]);
    expect(DOC.on.workflow_dispatch.inputs.specs.options).toContain('roster-reports');
    expect(RR.if).toBe("inputs.specs == 'roster-reports'");
    expect(RR.permissions).toEqual({ contents: 'read' });
    expect(RR.environment).toBeUndefined();
    expect(JSON.stringify(RR)).not.toMatch(/\$\{\{[^}]*secrets|STORAGE_METADATA_JSON|storage-job\.mjs|gb-st-priv/);
  });

  it('uses the accepted stack-net name grammar unchanged (no new name form); one job-unique owner label on create, verify and remove', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/local-stack/t09/stack-net.mjs'), 'utf8');
    const m = src.match(/^const NAMES = \/(.+)\/;/m);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('^ic-t09-(old|new)-net-[0-9]{1,20}-[0-9]{1,4}$');   // the guard itself is not widened
    const NAMES = new RegExp(m![1]);
    expect(NAMES.test(NET.slice(1, -1).replace('$GITHUB_RUN_ID', '41000000001').replace('$GITHUB_RUN_ATTEMPT', '1'))).toBe(true);
    expect(WF).not.toMatch(/ic-(rr|nr)-net-/);                                // the refused custom forms never appear
    const job = S.map(runOf).join('\n');
    expect(runOf(S[at(/stack-net\.mjs create/)])).toBe(`node scripts/local-stack/t09/stack-net.mjs create ${NET} ${OWNER} | tee "$RR_EVIDENCE/checks/net-create.txt"`);
    expect(job).toContain(`supabase start --workdir "$IC_WORKDIR_RR" --network-id ${NET} -x `);
    expect(job).toContain(`stack-net.mjs verify ${NET} ${OWNER}`);
    expect(runOf(S[at(/stack-net\.mjs remove/)])).toBe(`node scripts/local-stack/t09/stack-net.mjs remove ${NET} ${OWNER} | tee "$RR_EVIDENCE/checks/net-remove.txt"`);
    expect(job.match(/--network-id/g)?.length).toBe(1);
    expect(job).not.toMatch(/docker +network/);
    // The owner label is unique among every job of the workflow (each job runs on its own runner; the label still differs).
    const owners = [...WF.matchAll(/stack-net\.mjs create "[^"]+" "\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT-([a-z]+)"/g)].map((x) => x[1]);
    expect(owners.filter((o) => o === 'rrj')).toHaveLength(1);
  });

  it('reuses every reviewed stack, PRE, served-app, shell-pin, actor and cleanup step of gradebook-journey unchanged (job-scoped names only)', () => {
    for (const p of REUSED) expect(runOf(byName(S, p)), p).toBe(rename(runOf(byName(GB.steps, p))));
    for (const p of REUSED) expect(byName(S, p).if, p).toBe(rename(String(byName(GB.steps, p).if ?? '')) || undefined);
    // D1 is the gradebook D1 minus its Storage composition receipt line (this job has no Storage composition).
    const gbD1 = rename(runOf(byName(GB.steps, 'D1 stack-ownership record'))).split('\n').filter((l) => !/d1-composition\.txt/.test(l)).join('\n');
    expect(runOf(byName(S, 'D1 stack-ownership record'))).toBe(gbD1);
    expect(RR.env.RR_D1_BOOTSTRAP_SHA256).toBe(GB.env.GB_D1_BOOTSTRAP_SHA256);
  });

  it('PRE, then D1 exactly once after every reviewed check and the launch binding, and before any actor, fixture or browser write', () => {
    const writes = all(/stack-ownership\.mjs write/);
    expect(writes).toHaveLength(1);
    const d1 = writes[0];
    expect(S[d1].id).toBe('rr_d1');
    expect(S[d1].if).toBeUndefined();
    const before = [/stack-net\.mjs create/, /stack-net\.mjs verify/, /stack-checks\.sh ports/, /noedge-probes\.sh absent before/, /stage-pre\.sh/,
      /bootstrap\.sh "\$SUPABASE_DB_URL"/, /verify-identities\.sh/, /apply-reviewed\.sh "\$SUPABASE_DB_URL" NEW/, /hermetic-dist\.mjs verify/,
      /cmp -s "\$RUNNER_TEMP\/preview-index\.html"/, /served-app-check\.mjs "\$E2E_BASE_URL"/, /avatar-live-check\.mjs/, /headless-shell\.mjs receipt/,
      /GB_LANE=roster-reports .*gb-launch-binding\.ts \| tee/];
    for (const re of before) expect(at(re), String(re)).toBeLessThan(d1);
    expect(at(/stage-pre\.sh/)).toBeLessThan(at(/bootstrap\.sh "\$SUPABASE_DB_URL"/));
    for (const re of [/gb-job-psql\.mjs preseed/, /gb-job-psql\.mjs seed-auth/, /roster-reports-fixture\/run\.sh/]) for (const i of all(re)) expect(i, String(re)).toBeGreaterThan(d1);
    expect(at(/gb-job-psql\.mjs seed-auth/)).toBeLessThan(at(/roster-reports-fixture\/run\.sh/));
    expect(all(/seed-auth\.sh|local-preseed\.sql|seed\.sql/)).toEqual([]);   // writes go through gb-job-psql.mjs and the adapter only
    for (const p of ['Pin the headless shell', 'Launch binding receipt', 'D1 stack-ownership record', 'Local actors and reference rows', 'Roster/reports adapter']) expect(byName(S, p).if, p).toBeUndefined();
  });

  it('binds every roster launch to the pinned shell: receipt before D1, and an immediate recheck before the adapter', () => {
    const recv = runOf(byName(S, 'Launch binding receipt'));
    expect(recv).toBe('set -o pipefail\nGB_LANE=roster-reports RR_SESSION_DIR="$RUNNER_TEMP/rr-launch-binding-unused" npx --no-install tsx scripts/e2e/gb-launch-binding.ts | tee "$RR_EVIDENCE/checks/launch-binding.txt"\n');
    expect(idx('Pin the headless shell')).toBeLessThan(idx('Launch binding receipt'));
    const a = runOf(byName(S, 'Roster/reports adapter')).split('\n').filter(Boolean);
    expect(a[0]).toBe('set -o pipefail');
    const shell = a.findIndex((l) => l.startsWith('[ "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" = "$GB_SHELL_PATH" ] && [ -n "$GB_SHELL_PATH" ] ||'));
    const recheck = a.findIndex((l) => l === 'GB_LANE=roster-reports RR_SESSION_DIR="$RUNNER_TEMP/rr-launch-binding-unused" npx --no-install tsx scripts/e2e/gb-launch-binding.ts > "$RUNNER_TEMP/rr-launch-recheck.txt" || { cat "$RUNNER_TEMP/rr-launch-recheck.txt"; exit 1; }');
    const run = a.findIndex((l) => l.startsWith('scripts/roster-reports-fixture/run.sh "$RUNNER_TEMP/rr-out" 2>&1 | scripts/local-stack/t09/stack-checks.sh redact |'));
    expect([shell >= 0, recheck > shell, run > recheck]).toEqual([true, true, true]);
    // The browser runs only through the adapter's own `-c playwright.roster-reports.config.ts`.
    for (const re of [/playwright test/, /playwright\.config\.ts/, /functions serve/, /scripts\/e2e\/seed\.sh/]) expect(all(re), String(re)).toEqual([]);
    expect(runOf(byName(S, 'supabase start'))).toMatch(/-x [^\n]*edge-runtime/);
  });

  it('keeps the error state PENDING: nothing in the workflow sets RR_ERROR_INJECTION, and the roster lane refuses it', () => {
    expect(WF).not.toMatch(/RR_ERROR_INJECTION/);
    const cfg = readFileSync(path.join(ROOT, 'playwright.roster-reports.config.ts'), 'utf8');
    expect(cfg).toMatch(/if \(process\.env\.RR_ERROR_INJECTION === '1'\) \{\s*projects\.push\(\{ name: 'rr-error-pending'/);
    const P = '/x/chrome-headless-shell';
    const proj = (names: string[]) => names.map((name) => ({ name, use: { launchOptions: { executablePath: P } } }));
    expect(laneProblems('roster-reports', {}, proj(ROSTER_PROJECTS))).toEqual([]);
    expect(laneProblems('roster-reports', { RR_ERROR_INJECTION: '1' }, proj(ROSTER_PROJECTS))[0]).toMatch(/RR_ERROR_INJECTION is set/);
    expect(laneProblems('roster-reports', {}, proj([...ROSTER_PROJECTS, 'rr-error-pending']))[0]).toMatch(/not exactly/);
    expect(laneProblems('roster-reports', {}, proj(['rr-admin', 'rr-instructor', 'rr-learner']))[0]).toMatch(/not exactly/);
    expect(laneProblems('journey', { RR_ERROR_INJECTION: '1' }, [])).toEqual([]);   // the journey lane is unchanged
  });

  it('pins the reviewed bootstrap digest as a constant equal to the checked-out bootstrap.sh; the adapter reads that constant', () => {
    const want = createHash('sha256').update(readFileSync(path.join(ROOT, 'scripts/local-stack/bootstrap.sh'))).digest('hex');
    expect(RR.env.RR_D1_BOOTSTRAP_SHA256).toBe(want);
    const d1 = runOf(byName(S, 'D1 stack-ownership record'));
    expect(d1).toMatch(/\[ "\$have" = "\$RR_D1_BOOTSTRAP_SHA256" \] \|\| \{ echo "D1 refused/);
    expect(d1).not.toMatch(/bootstrap_sha256|jq|cat "\$STACK_OWNERSHIP_FILE"/);
    // The adapter does not trust the caller's env as provenance: it requires the job constant to equal its own committed pin,
    // and the checked-out bootstrap.sh to hash to that pin, then verifies D1 with the committed pin.
    const rs = readFileSync(path.join(ROOT, 'scripts/roster-reports-fixture/run.sh'), 'utf8');
    const pinned = readFileSync(path.join(ROOT, 'scripts/roster-reports-fixture/PINS.txt'), 'utf8').match(/^D1_BOOTSTRAP_SHA256=([0-9a-f]{64})$/m);
    expect(pinned?.[1]).toBe(RR.env.RR_D1_BOOTSTRAP_SHA256);
    expect(rs).toContain('[ -n "$D1C" ] && [ "${RR_D1_BOOTSTRAP_SHA256:-}" = "$D1C" ] || refuse RR_E_D1_CONSTANT');
    expect(rs).toContain('[ "$(pin scripts/local-stack/bootstrap.sh)" = "$D1C" ] || refuse RR_E_D1_CONSTANT');
    expect(rs).toMatch(/stack-ownership\.mjs" verify "\$API" "\$APP" "\$D1C"/);
  });

  it('private raw output stays private: exactly four fixed summary files are copied; private dirs, receipts and the D1 record are removed', () => {
    const copy = byName(S, "Copy the adapter's evidence");
    expect(copy.if).toBe("always() && steps.rr_d1.outcome == 'success'");
    const c = runOf(copy);
    expect(c).toContain('for f in seed.txt playwright-summary.txt witness.txt rr-private.txt; do');
    expect(c).toContain('if [ ! -f "$p" ] || [ -L "$p" ]; then echo "summary absent: $f"; continue; fi');
    expect(c).toContain('[ "$(wc -c < "$p")" -gt 4096 ] || [ "$(wc -l < "$p")" -gt 64 ]');
    expect(c).toMatch(/cp -- "\$p" "\$RR_EVIDENCE\/rr\/\$f"\n {0}done\n/);
    expect(c.trimEnd().endsWith('exit "$rc"')).toBe(true);
    // The fixed-line grammar, taken from the run block itself: fixed tokens and closed key=value pairs pass; free text never does.
    const g = c.match(/grep -qvE '([^']+)' "\$p"/);
    expect(g).not.toBeNull();
    const line = new RegExp(g![1]);
    for (const ok of ['RR_SEED_OK courses=3 modules=4 items=8 users=5 enrollments=8 progressions=12',
      'PLAYWRIGHT exit=0 total=11 expected=11 unexpected=0 flaky=0 skipped=0', 'TEST PASS project=rr-instructor case=R1', 'WITNESS UNCHANGED lines=12', 'CASE PASS project=rr-instructor case=RR-I1', 'WITNESS SEED UNCHANGED lines=45', 'RR_SEED_OK projection=MATCHES lines=45', 'PRIVATE REMOVED scope=raw,session,policy_log,psql verdict=PASS', 'PRIVATE STILL_PRESENT verdict=FAIL']) expect(line.test(ok), ok).toBe(true);
    for (const bad of ["TEST PASS rr-instructor shows 2 learners and the unknown dash", 'WITNESS unchanged lines=12', 'TEST FAIL project=rr-admin msg=Error: boom',
      'PLAYWRIGHT exit=0 note=a b', 'X k=v\u0000', 'lower start=1', 'TEST PASS case=' + 'a'.repeat(65), 'TEST PASS k=v ', '']) expect(line.test(bad), JSON.stringify(bad)).toBe(false);
    const rm = runOf(byName(S, 'Remove private outputs'));
    for (const p of ['playwright-report-roster-reports', 'test-results', '"$RUNNER_TEMP/rr-out"', '"$RUNNER_TEMP/rr-priv"', '"$RUNNER_TEMP/stack-ownership.json"',
      '"$RUNNER_TEMP/rr-shell-receipt.txt"', '"$RUNNER_TEMP/rr-shell-receipt.txt.bound"', '"$RUNNER_TEMP/rr-launch-recheck.txt"']) expect(rm, p).toContain(p);
    expect(rm).toMatch(/if \[ -e "\$p" \] \|\| \[ -L "\$p" \]; then echo "private output still present: \$p"; rc=1; fi/);
    // The adapter's random private parent has an outer always() removal of its exact mktemp name shape, verified absent.
    expect(readFileSync(path.join(ROOT, 'scripts/roster-reports-fixture/run.sh'), 'utf8')).toContain('PARENT="$(mktemp -d "$TMPROOT/rr-run.XXXXXXXXXX")"');
    expect(rm).toContain('for p in "$RUNNER_TEMP"/rr-run.??????????; do\n  [ -e "$p" ] || [ -L "$p" ] || continue\n  rm -rf -- "$p" || rc=1\n  if [ -e "$p" ] || [ -L "$p" ]; then echo "private output still present: adapter private parent"; rc=1; fi\ndone');
    expect(rm.indexOf('rr-run.??????????')).toBeLessThan(rm.indexOf('private-removed.txt'));
    const stage = runOf(S[at(/stack-checks\.sh stage-evidence \$REQ rr-upload/)]);
    for (const f of ['checks/launch-binding.txt', 'checks/d1-write.txt', 'checks/actors.txt', 'checks/roster-reports.txt', 'rr/seed.txt', 'rr/playwright-summary.txt',
      'rr/witness.txt', 'rr/rr-private.txt', 'checks/private-removed.txt', 'checks/net-remove.txt', 'checks/leftovers.txt']) expect(stage.split(`"$E/${f}"`).length - 1, f).toBe(1);
    expect(stage).not.toMatch(/screenshot|\.png|playwright\.json|test-results/);
  });

  it('runs every cleanup and staging step under always(), in order: stop servers, remove private, stop stack, remove network, leftovers, stage, upload', () => {
    const order = ['Stop background servers', 'Remove private outputs', 'Stop stack (no backup)', 'Remove owned network', 'Nothing left behind', 'Stage evidence'].map(idx);
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(order[1]).toBe(order[0] + 1);
    for (const p of ['Stop background servers', 'Remove private outputs', 'Stage evidence']) expect(byName(S, p).if, p).toBe('always()');
    for (const p of ['Stop stack (no backup)', 'Remove owned network', 'Nothing left behind']) expect(byName(S, p).if, p).toBe("always() && steps.rr_prep.outcome == 'success'");
    expect(order[0]).toBeGreaterThan(at(/roster-reports-fixture\/run\.sh/));
    const up = S[order[5] + 1];
    expect(up.uses).toBe('actions/upload-artifact@v4');
    expect(up.if).toBe("always() && steps.stage.outcome == 'success'");
    expect(up.with).toEqual({ name: 'roster-reports-${{ github.run_id }}', 'retention-days': 14, 'if-no-files-found': 'error', path: 'rr-upload/' });
  });

  it('carries no gradebook provenance label of its own: only the shared helpers keep their gb names', () => {
    const own = S.map((s) => `${s.name ?? ''}\n${runOf(s)}`).join('\n')
      .replace(/scripts\/e2e\/gb-(job-psql\.mjs|launch-binding\.ts)/g, '').replace(/\bGB_(SHELL_PATH|LANE)\b/g, '');
    expect(own).not.toMatch(/gradebook|journey|\bgb[-_]|\bGB_|-gbj\b/i);
    expect(JSON.stringify(RR.env)).not.toMatch(/GB_/);
    expect(String(RR.name)).toMatch(/^Roster\/Reports persona acceptance \(T-15;/);
  });

  // Real config load through the helper, read-only (no file is written; RR_SESSION_DIR is never created). Local container only.
  const SHELL = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const LOCAL_DEMO_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  const bind = (extra: Record<string, string | undefined>) => {
    const env: Record<string, string> = {
      PATH: String(process.env.PATH), HOME: String(process.env.HOME), GB_LANE: 'roster-reports', RR_SESSION_DIR: '/nonexistent/rr-launch-binding-unused',
      GB_SHELL_PATH: SHELL, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: SHELL, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_BASE_URL: 'http://127.0.0.1:8080',
      SUPABASE_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', VITE_SUPABASE_ANON_KEY: LOCAL_DEMO_ANON, E2E_ISOLATED_TARGET_REF: '',
    };
    for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete env[k]; else env[k] = v; }
    const r = spawnSync(path.join(ROOT, 'node_modules/.bin/tsx'), ['scripts/e2e/gb-launch-binding.ts'], { cwd: ROOT, env, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  it.skipIf(!existsSync(SHELL))('real roster config load: the three projects and the setup launch name exactly the pinned shell', { timeout: 60_000 }, () => {
    const r = bind({});
    expect(r.code, r.out).toBe(0);
    expect(r.out.match(/^RR-LAUNCH project (rr-[a-z]+) executablePath=(.*)$/gm)).toEqual(ROSTER_PROJECTS.map((n) => `RR-LAUNCH project ${n} executablePath=${SHELL}`));
    expect(r.out).toContain(`RR-LAUNCH session-setup executablePath=${SHELL}`);
    expect(r.out).not.toMatch(/GB-LAUNCH/);
  });
  it.skipIf(!existsSync(SHELL))('real roster config load refuses: error injection, unset or foreign browser pin', { timeout: 60_000 }, () => {
    for (const extra of [{ RR_ERROR_INJECTION: '1' }, { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/sh' }, { GB_SHELL_PATH: undefined }, { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: undefined }]) {
      const r = bind(extra);
      expect(r.code, JSON.stringify(extra)).toBe(1);
      expect(r.out, JSON.stringify(extra)).toMatch(/^RR-LAUNCH REFUSED: /m);
    }
  });
});
