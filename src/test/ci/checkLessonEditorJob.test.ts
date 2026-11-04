// ABOUTME: Structural, read-only controls for the PROPOSED lesson-editor job (#152 lane E1 on #142): overrides refused first, every
// ABOUTME: shared stack/PRE/served-app/shell-pin/D1 step before the lane's setup, private-only raw output, independent teardown gate.
//
// Read-only on purpose: nothing here writes a file (the security.yml fs-write gate admits no new test file without approval).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkWorkflowText } from '../../../scripts/ci/check-isolated-workflow.mjs';
import { laneProblems, LE_PROJECTS } from '../../../scripts/e2e/gb-launch-binding';
import { E1_IDENTITY, e1Result, lines, readPrivateBounded, SETUP_CODES, setupFacts, SETUP_STAGES } from '../../../scripts/e2e/le-e1-summary.mjs';
import { capsWhen, classifyEacces, REASONS, scanOwned } from '../../../scripts/e2e/le-owned-procs.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8');
const DOC = YAML.parse(WF);
type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string };
const LE = DOC.jobs['lesson-editor'];
const S = LE.steps as Step[];
const runOf = (s: Step) => String(s.run ?? '');
const at = (re: RegExp) => { const i = S.findIndex((s) => re.test(runOf(s))); expect(i, String(re)).toBeGreaterThan(-1); return i; };
const id = (x: string) => { const i = S.findIndex((s) => s.id === x); expect(i, x).toBeGreaterThan(-1); return i; };
// One explicit order: lane receipts verified (seal, absence and bridge reap were done by the orchestrator), image cleanup, the
// summary, THEN the retained stack stop and absence gates, private removal (two-part) and the network.
const TEARDOWN = ['le_lane_gates', 'le_image_cleanup', 'le_summary', 'le_owned_stop', 'le_stop', 'le_producers', 'le_private', 'le_net', 'le_left'];

describe('lesson-editor job (proposal; sealed lane container candidate)', () => {
  it('passes the shared workflow policy and is its own dispatch option', async () => {
    expect(await checkWorkflowText(WF)).toEqual([]);
    expect(LE.if).toBe("inputs.specs == 'lesson-editor'");
    expect(DOC.on.workflow_dispatch.inputs.specs.options).toContain('lesson-editor');
    expect(LE.permissions).toEqual({ contents: 'read' });
    expect(LE.environment).toBeUndefined();
    expect(WF.slice(WF.indexOf('\n  lesson-editor:'))).not.toMatch(/secrets\./);
  });
  it('refuses the lane self-test switches, PGPASSWORD and the target switches FIRST, before any stack step', () => {
    const r = at(/for v in LE_ALLOW_SHIM LE_ALLOWED_ORIGINS LE_EGRESS_CONTROL PGPASSWORD E2E_ALLOW_PRODUCTION_TARGET; do/);
    expect(runOf(S[r])).toContain('if [ -n "${!v+x}" ]; then echo "lesson-editor refused: $v is set"; exit 1; fi');
    expect(runOf(S[r])).toContain('[ -z "$E2E_ISOLATED_TARGET_REF" ] ||');
    expect(r).toBeLessThan(at(/scripts\/local-stack\/workdir\.sh/));
    expect(S[r].if).toBeUndefined();
  });
  it('orders the pre-stack shell pin, BPIN, launch binding and lane image, then PRE, migrations, served app and D1 before any lane input', () => {
    const order = [at(/le-iso\/preflight\.mjs/), at(/headless-shell\.mjs receipt >/), at(/le-iso\/browser-pin\.mjs "\$SHELL_PATH"/),
      at(/GB_LANE=lesson-editor npx --no-install tsx scripts\/e2e\/gb-launch-binding\.ts \| tee/), id('le_image'), at(/npx --no-install supabase start/),
      at(/export-status\.mjs "\$S" "\$GITHUB_ENV"/), at(/stage-pre\.sh/), at(/bootstrap\.sh "\$SUPABASE_DB_URL"/), at(/apply-reviewed\.sh "\$SUPABASE_DB_URL" NEW/),
      at(/served-app-check\.mjs "\$E2E_BASE_URL"/), at(/stack-ownership\.mjs write/), id('le_inputs'),
      at(/stack-ownership\.mjs verify "\$API" "\$APP" "\$LE_D1_BOOTSTRAP_SHA256" \| tee "\$LE_EVIDENCE\/checks\/d1-reverify\.txt"/), id('le_actors'), id('le_run')];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // the launch binding runs exactly once, pre-stack; the post-inputs recheck is gone
    expect(S.filter((x) => /gb-launch-binding\.ts/.test(runOf(x)))).toHaveLength(1);
  });
  it('keeps every lane input in the one private parent and runs no lane code on the host', () => {
    const inputs = runOf(S[id('le_inputs')]);
    expect(inputs).toContain('P="$RUNNER_TEMP/le-private"');
    expect(inputs).toContain('export-status.mjs "$S" /dev/null "$P/keys"');
    expect(inputs).toMatch(/flag: "wx"/);
    // password-free DSN rebuilt from its parts; never an assigned empty password (CodeQL empty-password rule on #170)
    expect(inputs).toContain('process.stdout.write(`LE_DB_URL=${u.protocol}//${u.username}@${u.host}${u.pathname}${u.search}\\n`);');
    expect(inputs).not.toMatch(/password\s*=\s*["']{2}/);
    expect(inputs).toContain('mkdir -m 700 "$P" "$P/proof" "$P/pair-raw" "$P/sock" "$P/lane" "$P/out"');
    expect(inputs).not.toMatch(/run-token|LE_OWNED_RUN/);
    for (const x of S) expect(runOf(x), String(x.name)).not.toMatch(/run\.sh (setup|cleanup)|playwright test|LE_OWNED_RUN|le-owned-procs/);
    for (const gone of ['le_setup', 'le_e1', 'le_lane_cleanup', 'le_procs']) expect(S.findIndex((x) => x.id === gone), gone).toBe(-1);
    expect(runOf(S[id('le_private')])).toMatch(/for root in \/tmp "\$RUNNER_TEMP"; do\n\s+if compgen -G "\$root\/le-pf-\*"/);
  });
  it('A: proves API<->DB identity with the shared pairing producer ONCE, then the one orchestrator in the SAME step', () => {
    expect(id('le_d1')).toBeLessThan(id('le_actors'));
    expect(String(S[at(/stack-ownership\.mjs verify "\$API" "\$APP" "\$LE_D1_BOOTSTRAP_SHA256" \| tee "\$LE_EVIDENCE\/checks\/d1-reverify\.txt"/)].name)).toContain('ownership and consistency only, not API<->DB identity');
    expect(id('le_actors') + 1).toBe(id('le_run'));
    expect(runOf(S[id('le_actors')])).toMatch(/gb-job-psql\.mjs preseed[^\n]*\n[^\n]*gb-job-psql\.mjs seed-auth/);
    const run = runOf(S[id('le_run')]);
    const order = ['pairing-producer.mjs" "$c"', 'pairing-producer.mjs" ownership', 'pairing-producer.mjs" appverify', 'pairing-producer.mjs" pair "$LE_PRIV/proof"', 'le-pairing.txt', 'le-lane/run-lane.mjs'];
    const at2 = order.map((x) => run.indexOf(x));
    expect(at2.every((v) => v >= 0)).toBe(true);
    expect([...at2].sort((a, b) => a - b)).toEqual(at2);
    expect(run).toContain('for c in pins dsn; do');
    // the carrier is written exactly once in the whole job
    expect(WF.slice(WF.indexOf('\n  lesson-editor:'), WF.indexOf('\n  le-isolation-probe:')).match(/pairing-producer\.mjs" pair /g)).toHaveLength(1);
    const between = run.slice(run.indexOf('le-pairing.txt'), run.indexOf('le-lane/run-lane.mjs'));
    expect(between).not.toMatch(/curl|psql|personas|supabase |service/);
  });
  it('stages fixed lines only: no lane private dir, report, list or PNG reaches the manifest', () => {
    const st = runOf(S[id('stage')]);
    expect(st).toContain('"$E/checks/le-e1.txt"');
    expect(st).not.toMatch(/LE_PRIV|report\.json|pw-list|pw-output|\.png|backend-contract|pair-raw|run-token|le-procs/);
    for (const f of ['actors.txt', 'le-pairing.txt', 'le-lane.txt', 'le-lane-gates.txt', 'le-image.txt', 'le-image-cleanup.txt', 'browser-pin.txt', 'lane-preflight.txt']) expect(st).toContain(`"$E/checks/${f}"`);
  });
  it('tears down in one explicit order and releases only after every teardown step succeeded', () => {
    for (const x of TEARDOWN) expect(S[id(x)].if, x).toMatch(/^always\(\)/);
    const order = TEARDOWN.map(id);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(id('le_run')).toBeLessThan(id('le_lane_gates'));
    expect(runOf(S[id('le_private')])).toContain('"$RUNNER_TEMP/le-private"');
    expect(runOf(S[id('le_producers')])).toMatch(/pgrep -u "\$\(id -u\)" -x psql/);
    const up = S.find((s) => String(s.uses ?? '').startsWith('actions/upload-artifact@'))!;
    for (const x of ['stage', ...TEARDOWN.filter((t) => t !== 'le_summary')]) expect(up.if).toContain(`steps.${x}.outcome == 'success'`);
    expect(S.indexOf(up)).toBe(id('stage') + 1);
  });
  it('binds the lane config to the pinned shell (exactly one project)', () => {
    expect(LE_PROJECTS).toEqual(['lesson-editor-chromium']);
    expect(laneProblems('lesson-editor', [{ name: 'lesson-editor-chromium' }])).toEqual([]);
    expect(laneProblems('lesson-editor', [{ name: 'lesson-editor-chromium' }, { name: 'x' }])).not.toEqual([]);
    expect(laneProblems('journey', [{ name: 'x' }])).toEqual([]);
  });
  it('derives the nine LE-E1 lines from exactly one E1 test status, copying nothing else', () => {
    type Opt = { status?: string; results?: unknown[]; project?: string; expectedStatus?: string; tStatus?: string; stats?: Record<string, number>; errors?: unknown[]; file?: string; describe?: string };
    const rep = (titles: string[], o: Opt = {}) => {
      const status = o.status ?? 'passed';
      const pass = status === 'passed';
      return {
        errors: o.errors ?? [],
        stats: o.stats ?? { expected: pass ? 1 : 0, unexpected: pass ? 0 : 1, flaky: 0, skipped: 0 },
        // Playwright JSON shape: a file suite (title = file) holding the describe suite that holds the specs.
        suites: [{ title: o.file ?? E1_IDENTITY.file, file: o.file ?? E1_IDENTITY.file, specs: [], suites: [{
          title: o.describe ?? E1_IDENTITY.describe, file: o.file ?? E1_IDENTITY.file,
          specs: titles.map((t) => ({ title: t, file: o.file ?? E1_IDENTITY.file, tests: [{
            projectName: o.project ?? 'lesson-editor-chromium', expectedStatus: o.expectedStatus ?? 'passed',
            status: o.tStatus ?? (pass ? 'expected' : 'unexpected'),
            results: o.results ?? [{ retry: 0, status, errors: pass ? [] : [{ message: 'SECRET body' }] }],
          }] })) }] }],
      };
    };
    const E1 = [E1_IDENTITY.title];
    expect(e1Result(rep(E1))).toMatchObject({ result: 'passed' });
    expect(e1Result(rep(E1, { status: 'failed' }))).toMatchObject({ result: 'failed' });
    // selection: exactly one test; a zero-case (setup-only) report refuses
    expect(e1Result(rep([E1_IDENTITY.title, 'E2 other'])).code).toBe('LE_SUM_E_SELECTION');
    expect(e1Result(rep([])).code).toBe('LE_SUM_E_SELECTION');
    expect(e1Result({ errors: [], stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, suites: [] }).code).toBe('LE_SUM_E_SELECTION');
    expect(e1Result(rep(['E2 other'])).code).toBe('LE_SUM_E_NOT_E1');
    // exact identity, never a substring: a different spec titled "E1 save", another file or describe path all refuse
    expect(e1Result(rep(['E1 save'])).code).toBe('LE_SUM_E_NOT_E1');
    expect(e1Result(rep([`${E1_IDENTITY.title} (copy)`])).code).toBe('LE_SUM_E_NOT_E1');
    expect(e1Result(rep(E1, { file: 'other.spec.ts' })).code).toBe('LE_SUM_E_NOT_E1');
    expect(e1Result(rep(E1, { describe: 'another describe' })).code).toBe('LE_SUM_E_NOT_E1');
    expect(e1Result(rep(E1, { project: 'chromium' })).code).toBe('LE_SUM_E_PROJECT');
    expect(e1Result(rep(E1, { status: 'weird' })).code).toBe('LE_SUM_E_STATUS');
    expect(e1Result({ ...rep(E1), stats: undefined }).code).toBe('LE_SUM_E_STATS');
    expect(e1Result({ ...rep(E1), errors: 'x' }).code).toBe('LE_SUM_E_REPORT');
    // attempted and non-skipped
    expect(e1Result(rep(E1, { results: [] }))).toMatchObject({ result: 'unattempted' });
    expect(e1Result(rep(E1, { results: [{ status: 'skipped' }], expectedStatus: 'skipped', tStatus: 'skipped', stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 1 } }))).toMatchObject({ result: 'unattempted' });
    // global / beforeAll / afterAll errors fail a passed test
    expect(e1Result(rep(E1, { errors: [{ message: 'globalSetup' }] }))).toMatchObject({ result: 'failed' });
    expect(e1Result(rep(E1, { results: [{ retry: 0, status: 'passed', errors: [{ message: 'afterAll' }] }] }))).toMatchObject({ result: 'failed' });
    expect(e1Result(rep(E1, { results: [{ retry: 0, status: 'passed', errors: [], error: { message: 'hook' } }] }))).toMatchObject({ result: 'failed' });
    // the single attempt must be retry 0: a sole retry:1 (or a missing retry) result is not a first-attempt pass
    expect(e1Result(rep(E1, { results: [{ retry: 1, status: 'passed', errors: [] }] }))).toMatchObject({ result: 'failed' });
    expect(e1Result(rep(E1, { results: [{ status: 'passed', errors: [] }] }))).toMatchObject({ result: 'failed' });
    // retries and flaky never pass; stats must agree
    expect(e1Result(rep(E1, { results: [{ retry: 0, status: 'failed', errors: [{}] }, { retry: 1, status: 'passed', errors: [] }], tStatus: 'flaky', stats: { expected: 0, unexpected: 0, flaky: 1, skipped: 0 } }))).toMatchObject({ result: 'failed' });
    // a second attempt fails even when the report's own test status and stats claim a clean pass
    expect(e1Result(rep(E1, { results: [{ retry: 0, status: 'passed', errors: [] }, { retry: 1, status: 'passed', errors: [] }] }))).toMatchObject({ result: 'failed' });
    expect(e1Result(rep(E1, { stats: { expected: 1, unexpected: 1, flaky: 0, skipped: 0 } }))).toMatchObject({ result: 'failed' });
    expect(e1Result(rep(E1, { stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 0 } }))).toMatchObject({ result: 'failed' });
    expect(e1Result(rep(E1, { expectedStatus: 'failed' }))).toMatchObject({ result: 'failed' });
    const out = lines({ commit: 'a'.repeat(40), setup: 'PASS', stage: 'none', contract: 'PASS', result: 'passed', cleanup: 'PASS' });
    expect(out).toHaveLength(9);
    expect(out).toContain('LE-E1 setup code: none');
    expect(out).toContain('LE-E1 failed step: none');
    // r3: a single non-clean attempt reports Playwright's own status word and ONE fixed step code, never a message
    const step = (status: string, steps: unknown[]) => e1Result(rep(E1, { status: status === 'passed' ? 'passed' : 'failed', results: [{ retry: 0, status, errors: [{ message: 'SECRET message' }], steps }] }));
    expect(step('timedOut', [{ title: 'E1_OPEN', steps: [] }, { title: 'E1_EDIT_BODY', steps: [] }])).toEqual({ result: 'timedOut', step: 'E1_EDIT_BODY' });
    expect(step('failed', [{ title: 'E1_OPEN' }, { title: 'E1_RELOAD', steps: [{ title: 'E1_RELOAD_BODY', error: { message: 'SECRET' } }] }])).toEqual({ result: 'failed', step: 'E1_RELOAD_BODY' });
    expect(step('failed', [{ title: 'SECRET step', error: { message: 'x' } }])).toEqual({ result: 'failed', step: 'unknown' });
    expect(step('interrupted', [])).toEqual({ result: 'interrupted', step: 'unknown' });
    expect(e1Result(rep(E1))).toEqual({ result: 'passed', step: 'none' });
    expect(JSON.stringify(step('failed', [{ title: 'E1_ROW', error: { message: 'SECRET row' } }]))).not.toMatch(/SECRET/);
    const bad = lines({ commit: 'a'.repeat(40), setup: 'PASS', stage: 'none', contract: 'PASS', result: 'timedOut', step: 'E1_EDIT_BODY', cleanup: 'PASS' });
    for (const l of bad.filter((x) => x.startsWith('LE-E1 failed step: '))) expect(l).toMatch(/^LE-E1 failed step: (none|unknown|E1_(OPEN|BASELINE|EDIT_TITLE|EDIT_BODY|SAVED|SETTLE|ROW|BODY|RELOAD|RELOAD_BODY|EVIDENCE))$/);
    expect(out.join('\n')).not.toMatch(/SECRET|returned row/);
  });
});

describe('setupFacts: stage and contract verdict from the private setup output (fixed vocabulary only)', () => {
  const OK = 'PASS le-contract: 9 checks on the LOCAL isolated stack (says nothing about the deployed backend)';
  it('reads the contract verdict from its own lines, not from the setup outcome', () => {
    expect(setupFacts(`x\n${OK}\n`)).toEqual({ stage: 'none', contract: 'PASS', code: 'none' });
    expect(setupFacts('FAIL le-contract: 2 check(s) failed\nFAIL le-run: backend contract exited 1 (child stderr withheld: 0 bytes)\n')).toEqual({ stage: 'backend contract', contract: 'FAIL', code: 'none' });
    // the run 41676587739 shape: refused before the contract ran, so the contract is "unattempted", never FAIL
    expect(setupFacts('FAIL le-run: preflight exited 1 (child stderr withheld: 120 bytes)\nFAIL le-run: preflight (read-only; nothing was written)\n')).toEqual({ stage: 'preflight', contract: 'unattempted', code: 'none' });
    expect(setupFacts(`${OK}\n${OK}\n`).contract).toBe('FAIL');
    expect(setupFacts(`${OK} extra\n`).contract).toBe('unattempted');
    expect(setupFacts(`  ${OK}\n`).contract).toBe('unattempted');
  });
  it('maps the first refusal onto the closed stage list and copies no other text', () => {
    for (const st of SETUP_STAGES) expect(setupFacts(`FAIL le-run: ${st} exited 1 (child stderr withheld: 3 bytes)\n`).stage).toBe(st);
    expect(setupFacts('FAIL le-run: personas file unreadable\n').stage).toBe('unclassified');
    expect(setupFacts('FAIL le-run: private dir exists (never reused)\n').stage).toBe('unclassified');
    expect(setupFacts('FAIL le-run: SECRET-TEXT\n').stage).toBe('unclassified');
    expect(setupFacts('FAIL le-run: fixture exited 1\nFAIL le-run: preflight exited 1\n').stage).toBe('fixture');
  });
  it('reads one exact allowlisted setup code line; anything else is unclassified, never copied', () => {
    for (const c of SETUP_CODES) expect(setupFacts(`LE-SETUP-CODE: ${c}\nFAIL le-run: preflight exited 23\n`).code).toBe(c);
    expect(setupFacts('LE-SETUP-CODE: LE_PRE_E_P3_HTTP extra\n').code).toBe('unclassified');
    expect(setupFacts('LE-SETUP-CODE: SECRET\n').code).toBe('unclassified');
    expect(setupFacts('LE-SETUP-CODE: LE_PRE_E_P1\nLE-SETUP-CODE: LE_PRE_E_P2\n').code).toBe('unclassified');
    expect(setupFacts(' LE-SETUP-CODE: LE_PRE_E_P1\n').code).toBe('none');
  });
});

describe('le_producers maps every pgrep status explicitly (shell stand-in, no real process probe)', () => {
  // Shell stand-in for the producer probe: the step body runs under bash -e with pgrep, seq, id, sleep and tee as shell
  // functions and PATH pointing nowhere, so nothing real is probed and nothing is written. SEQ lists pgrep statuses per
  // call (the last one repeats); "none" leaves pgrep undefined so bash itself answers 127.
  const probeRun = (body: string, seqs: string, noSeq = false) => {
    const prelude = [
      'N=0',
      "tee() { while IFS= read -r l; do printf '%s\\n' \"$l\"; done; }",
      'sleep() { :; }',
      'id() { echo 1001; }',
      noSeq ? 'seq() { :; }' : 'seq() { i=$1; while [ "$i" -le "$2" ]; do echo "$i"; i=$((i+1)); done; }',
      seqs === 'none' ? '' : `pgrep() { N=$((N+1)); set -- ${seqs}; [ "$N" -le $# ] && k=$N || k=$#; eval "v=\\\${$k}"; echo RAW-PGREP-OUT; echo RAW-PGREP-ERR >&2; return "$v"; }`,
      "trap 'echo CALLS=$N >&2' EXIT",
    ].join('\n');
    const r = spawnSync('/bin/bash', ['-e', '-c', `${prelude}\n${body}`], { encoding: 'utf8', env: { PATH: '/nonexistent', EVID: '/nonexistent-evidence' } });
    return { status: r.status, out: r.stdout, err: r.stderr, calls: Number(/CALLS=(\d+)/.exec(r.stderr)?.[1] ?? -1) };
  };
  const BODY = String((S.find((s) => s.id === 'le_producers') ?? {}).run ?? '');
  const ABSENT = 'no psql process remains after the stack stop\n';
  const ALIVE = 'psql UNRESOLVED: a psql process is still alive after the stack stop\n';
  const NOANSWER = 'psql UNRESOLVED: the psql process probe did not answer present or absent\n';
  const noRaw = (r: { out: string; err: string }) => expect(`${r.out}${r.err}`).not.toMatch(/RAW-PGREP/);
  it('1 = absent and 0 then 1 = absent after one wait (exit 0, fixed line)', () => {
    for (const [seq, calls] of [['1', 1], ['0 1', 2], ['0 0 0 1', 4]] as const) {
      const r = probeRun(BODY, seq);
      expect([r.status, r.out, r.calls], seq).toEqual([0, ABSENT, calls]); noRaw(r);
    }
  });
  it('persistent 0 = present after the full bounded wait: UNRESOLVED, exit 1', () => {
    const r = probeRun(BODY, '0');
    expect([r.status, r.out, r.calls]).toEqual([1, ALIVE, 10]); noRaw(r);
  });
  it('2, 3, 127, a late error and a missing tool are UNRESOLVED, never absence', () => {
    for (const seq of ['2', '3', '127', '0 2', '0 0 3']) {
      const r = probeRun(BODY, seq);
      expect([r.status, r.out], seq).toEqual([1, NOANSWER]); noRaw(r);
    }
    const missing = probeRun(BODY, 'none');
    expect([missing.status, missing.out]).toEqual([1, NOANSWER]);
    const noProbe = probeRun(BODY, '1', true);
    expect([noProbe.status, noProbe.out, noProbe.calls]).toEqual([1, NOANSWER, 0]);
  });
});

describe('le-e1-summary private report reader (same descriptor; fakes and real non-files only, nothing is written)', () => {
  type St = { file?: boolean; uid?: number; mode?: number; nlink?: number; size?: number };
  const fake = (st: St, chunks: (string | Error)[] = ['{}'], o: { openErr?: boolean; statErr?: boolean; closeErr?: boolean } = {}) => {
    const calls: string[] = [];
    let i = 0;
    return { calls, fsImpl: {
      openSync: () => { calls.push('open'); if (o.openErr) throw Object.assign(new Error('x'), { code: 'ELOOP' }); return 7; },
      fstatSync: (fd: number) => { calls.push(`fstat:${fd}`); if (o.statErr) throw new Error('x'); return { isFile: () => st.file ?? true, uid: st.uid ?? 1000, mode: st.mode ?? 0o100600, nlink: st.nlink ?? 1, size: st.size ?? 2 }; },
      readSync: (fd: number, buf: Buffer, off: number) => { calls.push(`read:${fd}`); const c = chunks[i++]; if (c === undefined) return 0; if (c instanceof Error) throw c; return Buffer.from(c).copy(buf, off); },
      closeSync: (fd: number) => { calls.push(`close:${fd}`); if (o.closeErr) throw new Error('x'); },
    } as unknown as typeof import('node:fs') };
  };
  const R = (st: St, chunks?: (string | Error)[], o?: { openErr?: boolean; statErr?: boolean; closeErr?: boolean }, max = 16) => {
    const f = fake(st, chunks, o);
    return { r: readPrivateBounded('/x', { fsImpl: f.fsImpl, uid: 1000, max }), calls: f.calls };
  };
  it('reads a 0600, owned, single-link regular file through one descriptor and always closes it', () => {
    const { r, calls } = R({});
    expect(r).toEqual({ ok: true, text: '{}' });
    expect(calls.every((c) => c === 'open' || c.endsWith(':7'))).toBe(true);
    expect(calls.at(-1)).toBe('close:7');
  });
  it('refuses symlink/missing, FIFO or device, foreign owner, other modes, hard links, oversize, growth, IO, close and UTF-8 faults with fixed codes', () => {
    expect(R({}, undefined, { openErr: true }).r).toEqual({ ok: false, code: 'LE_READ_E_OPEN' });
    expect(R({ file: false }).r).toEqual({ ok: false, code: 'LE_READ_E_TYPE' });
    expect(R({ uid: 0 }).r).toEqual({ ok: false, code: 'LE_READ_E_OWNER' });
    for (const mode of [0o100644, 0o100640, 0o100700, 0o104600]) expect(R({ mode }).r).toEqual({ ok: false, code: 'LE_READ_E_MODE' });
    expect(R({ nlink: 2 }).r).toEqual({ ok: false, code: 'LE_READ_E_LINKS' });
    expect(R({ size: 17 }).r).toEqual({ ok: false, code: 'LE_READ_E_SIZE' });
    expect(R({ size: 2 }, ['{"a":', '1234567890123']).r).toEqual({ ok: false, code: 'LE_READ_E_SIZE' }); // grew past max after fstat
    expect(R({}, [new Error('EIO')]).r).toEqual({ ok: false, code: 'LE_READ_E_IO' });
    expect(R({}, undefined, { statErr: true }).r).toEqual({ ok: false, code: 'LE_READ_E_IO' });
    expect(R({}, undefined, { closeErr: true }).r).toEqual({ ok: false, code: 'LE_READ_E_IO' });
    const bad = fake({}, []); let n = 0;
    (bad.fsImpl as unknown as { readSync: unknown }).readSync = (_fd: number, buf: Buffer, off: number) => (n++ ? 0 : Buffer.from([0xc3, 0x28]).copy(buf, off));
    expect(readPrivateBounded('/x', { fsImpl: bad.fsImpl, uid: 1000, max: 16 })).toEqual({ ok: false, code: 'LE_READ_E_UTF8' });
  });
  it('real non-files: a missing path and a final symlink refuse at open; a character device refuses on type', () => {
    expect(readPrivateBounded('/nonexistent/le-report.json')).toEqual({ ok: false, code: 'LE_READ_E_OPEN' });
    expect(readPrivateBounded('/proc/self/exe')).toEqual({ ok: false, code: 'LE_READ_E_OPEN' });
    expect(readPrivateBounded('/dev/null')).toEqual({ ok: false, code: 'LE_READ_E_TYPE' });
  });
});

// le_procs (the host marker scan) is retired from the job: lane processes now live only in the sealed container, whose
// lifetime is bounded structurally (checkLeLane.test.ts). The scanner module stays in the tree and keeps its unit tests below.
describe('le-owned-procs scanner (fake /proc; nothing is written or probed)', () => {
  const TOK = '0123456789abcdef0123456789abcdef';
  const env = (...kv: string[]) => Buffer.from(kv.join('\0') + '\0');
  type P = { uid?: number; env?: Buffer | Error; stat?: Error };
  const fakeProc = (procs: Record<string, P>, readdirErr = false) => ({
    readdirSync: () => { if (readdirErr) throw new Error('EACCES'); return [...Object.keys(procs), 'self', 'sys']; },
    statSync: (p: string) => { const q = procs[p.split('/')[2]]; if (q.stat) throw q.stat; return { uid: q.uid ?? 1000 }; },
    readFileSync: (p: string) => { const q = procs[p.split('/')[2]]; if (q.env instanceof Error) throw q.env; return q.env ?? Buffer.alloc(0); },
  } as unknown as typeof import('node:fs'));
  const scan = (procs: Record<string, P>, o: { readdirErr?: boolean; token?: string } = {}) =>
    scanOwned(o.token ?? TOK, { fsImpl: fakeProc(procs, o.readdirErr), uid: 1000, self: 1 });
  const gone = Object.assign(new Error('x'), { code: 'ENOENT' });
  const denied = Object.assign(new Error('x'), { code: 'EACCES' });
  it('counts only this uid, the exact marker entry, and skips itself and vanished processes', () => {
    expect(scan({ 10: { env: env('PATH=/x', `LE_OWNED_RUN=${TOK}`) } })).toEqual({ count: 1 });
    expect(scan({ 10: { env: env(`LE_OWNED_RUN=${TOK}`) }, 11: { env: env(`LE_OWNED_RUN=${TOK}`) } })).toEqual({ count: 2 });
    expect(scan({ 10: { uid: 0, env: env(`LE_OWNED_RUN=${TOK}`) } })).toEqual({ count: 0 });
    expect(scan({ 1: { env: env(`LE_OWNED_RUN=${TOK}`) } })).toEqual({ count: 0 });
    for (const e of [env(`LE_OWNED_RUN=${TOK}x`), env(`XLE_OWNED_RUN=${TOK}`), env(`LE_OWNED_RUN=${TOK.slice(1)}`), env(`A=LE_OWNED_RUN=${TOK}`)]) expect(scan({ 10: { env: e } })).toEqual({ count: 0 });
    expect(scan({ 10: { stat: gone } , 11: { env: gone } })).toEqual({ count: 0 });
  });
  it('fails closed on an unreadable /proc, an own process it cannot read, a stat error or a malformed token', () => {
    expect(scan({}, { readdirErr: true })).toEqual({ error: true, code: 'LE_PROCS_E_PROCDIR' });
    expect(scan({ 10: { env: denied } })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_EACCES' });
    expect(scan({ 10: { env: Object.assign(new Error('x'), { code: 'EPERM' }) } })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_EPERM' });
    expect(scan({ 10: { env: Object.assign(new Error('x'), { code: 'EIO' }) } })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_OTHER' });
    expect(scan({ 10: { stat: denied } })).toEqual({ error: true, code: 'LE_PROCS_E_STAT' });
    // an unreadable process of ANOTHER uid is not read at all, so it never decides anything
    expect(scan({ 10: { uid: 0, env: denied } })).toEqual({ count: 0 });
    for (const token of ['', 'abc', TOK.toUpperCase(), `${TOK}\n`]) expect(scan({}, { token })).toEqual({ error: true, code: 'LE_PROCS_E_TOKEN' });
    for (const c of ['LE_PROCS_E_PROCDIR', 'LE_PROCS_E_ENVIRON_EACCES', 'LE_PROCS_E_STAT', 'LE_PROCS_E_TOKEN']) expect(REASONS).toContain(c);
  });
  it('classifies an own-uid EACCES from the status fields only, and the scan still fails closed', () => {
    const st = (u: string, cap: string, ns = '10') => `Name:\tSECRET-NAME\nUid:\t${u}\nCapPrm:\t${cap}\nNSpid:\t${ns}\n`;
    const me = st('1000\t1000\t1000\t1000', '0000000000000000');
    expect(classifyEacces(st('0\t1000\t1000\t1000', '0'), me, 1000)).toBe('LE_PROCS_E_ENVIRON_EACCES_UIDMIX');
    expect(classifyEacces(st('1000\t1000\t1000\t1000', '0000000000000400'), me, 1000)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS');
    expect(classifyEacces(st('1000\t1000\t1000\t1000', '0', '10\t1'), me, 1000)).toBe('LE_PROCS_E_ENVIRON_EACCES_NSPID');
    expect(classifyEacces(st('1000\t1000\t1000\t1000', '0'), me, 1000)).toBe('LE_PROCS_E_ENVIRON_EACCES_PLAIN');
    expect(classifyEacces('garbage', me, 1000)).toBe('LE_PROCS_E_ENVIRON_EACCES');
    for (const c of ['UIDMIX', 'CAPS', 'NSPID', 'PLAIN']) expect(REASONS).toContain(`LE_PROCS_E_ENVIRON_EACCES_${c}`);
    const fsImpl = {
      readdirSync: () => ['10'],
      statSync: () => ({ uid: 1000 }),
      readFileSync: (p: string) => {
        if (p.endsWith('/environ')) throw Object.assign(new Error('x'), { code: 'EACCES' });
        if (p.includes('/self/')) return me;
        return st('1000\t1000\t1000\t1000', '00000000000000ff');
      },
    } as unknown as typeof import('node:fs');
    expect(scanOwned('0123456789abcdef0123456789abcdef', { fsImpl, uid: 1000, self: 1 })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_EACCES_CAPS' });
    const noStatus = { ...fsImpl, readFileSync: (p: string) => { throw Object.assign(new Error('x'), { code: p.endsWith('/environ') ? 'EACCES' : 'EACCES' }); } } as unknown as typeof import('node:fs');
    expect(scanOwned('0123456789abcdef0123456789abcdef', { fsImpl: noStatus, uid: 1000, self: 1 })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_EACCES' });
  });
  it('refines CAPS by start time against the token mtime only, never changing the fail-closed answer', () => {
    const stat = (ticks: string) => `42 (SECRET name) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 ${ticks} 0 0`;
    const procStat = 'cpu 1 2 3\nbtime 1000\n';
    // btime 1000 s; ticks/100 s after boot
    expect(capsWhen(stat('100'), procStat, 1_005_000)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS_PRE'); // 1001 s vs 1005 s
    expect(capsWhen(stat('450'), procStat, 1_005_000)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS_DURING'); // 1004.5 s, inside the 1 s margin
    expect(capsWhen(stat('900'), procStat, 1_005_000)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS_DURING');
    expect(capsWhen(stat('x'), procStat, 1_005_000)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS');
    expect(capsWhen(stat('100'), 'no btime', 1_005_000)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS');
    expect(capsWhen(stat('100'), procStat, undefined as unknown as number)).toBe('LE_PROCS_E_ENVIRON_EACCES_CAPS');
    for (const c of ['CAPS_PRE', 'CAPS_DURING']) expect(REASONS).toContain(`LE_PROCS_E_ENVIRON_EACCES_${c}`);
    const me = 'Uid:\t1000\t1000\t1000\t1000\nCapPrm:\t0000000000000000\n';
    const fsImpl = {
      readdirSync: () => ['10'],
      statSync: () => ({ uid: 1000 }),
      readFileSync: (p: string) => {
        if (p.endsWith('/environ')) throw Object.assign(new Error('x'), { code: 'EACCES' });
        if (p.includes('/self/')) return me;
        if (p.endsWith('/10/status')) return 'Uid:\t1000\t1000\t1000\t1000\nCapPrm:\t0000000000002000\nNSpid:\t10\n';
        if (p.endsWith('/10/stat')) return stat('100');
        if (p.endsWith('/stat')) return procStat;
        throw new Error('unexpected');
      },
    } as unknown as typeof import('node:fs');
    const T = '0123456789abcdef0123456789abcdef';
    expect(scanOwned(T, { fsImpl, uid: 1000, self: 1, sinceMs: 1_005_000 })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_EACCES_CAPS_PRE' });
    expect(scanOwned(T, { fsImpl, uid: 1000, self: 1 })).toEqual({ error: true, code: 'LE_PROCS_E_ENVIRON_EACCES_CAPS' });
  });
});
