// ABOUTME: Structural controls for the #159 narrow-reads-sql job: dispatch-only, read-only, one disposable loopback stack in
// ABOUTME: the t09-runtime shape (PRE before bootstrap, guards, always-cleanup), the #159 file applied only by the pinned tier.
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import os from 'node:os';
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
const MATRIX = readFileSync(path.join(ROOT, 'scripts/local-stack/narrow-reads/matrix.sql'), 'utf8');
type Case = { id: string; kind: string; oldLit: string; newLit: string };
// Every case call in the matrix source: id, kind, and its two LAST literals (OLD, NEW expectation).
const CASES_SRC: Case[] = [...MATRIX.matchAll(/^select pg_temp\.check_(?:rows|write)\('([QFB]\d\d)', '(closed|kept)',[\s\S]*?, '([^']*)', '([^']*)'\);$/gm)]
  .map((m) => ({ id: m[1], kind: m[2], oldLit: m[3], newLit: m[4] }));
const TIER_CASES = ((/^CASES="([^"]*)"$/m.exec(TIER) as RegExpExecArray)[1]).split(' ').sort();
// The tier's own matrix_check, sourced from tier.sh's definitions (everything before the selftest/main branches).
const DEFS = TIER.slice(0, TIER.indexOf('if [ "${1:-}" = "--selftest" ]'));
function check(mode: string, st: number, out: string, err: string) {
  const t = mkdtempSync(path.join(os.tmpdir(), 'nr-mc-'));
  try {
    writeFileSync(path.join(t, 'defs.sh'), DEFS); writeFileSync(path.join(t, 'o'), out); writeFileSync(path.join(t, 'e'), err ? err + '\n' : '');
    return spawnSync('bash', ['-c', `source "$1/defs.sh"; matrix_check "$2" "$3" "$1/o" "$1/e" "$1/log"`, 'x', t, mode, String(st)], { encoding: 'utf8' }).stdout.trim();
  } finally { rmSync(t, { recursive: true, force: true }); }
}

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
      .replace(/-new"/g, '"').replace(/-nr"/g, '"')
      .replace(/ \(NEW\)/g, '').replace(/ok \(NEW\);/g, 'ok;');
    const pick = (job: { steps: Step[] }, re: RegExp) => norm(runOf([...job.steps].reverse().find((s) => re.test(runOf(s))) as Step)); // t09: its NEW stack
    for (const re of [/supabase start --workdir/, /stage-pre\.sh/, /bootstrap\.sh "\$SUPABASE_DB_URL"/, /stack-net\.mjs verify/, /assert-safe-target/, /export-status\.mjs/]) {
      expect(pick(NR, re), String(re)).toBe(pick(T9, re));
    }
  });

  it('orders: policy check first, PRE before bootstrap before the tier; cleanup always() after it', () => {
    const policy = S.findIndex((s) => /check-isolated-workflow\.mjs --executed/.test(runOf(s)));
    const start = at(/supabase start --workdir/), pre = at(/stage-pre\.sh/), boot = at(/bootstrap\.sh "\$SUPABASE_DB_URL"/), tier = at(/narrow-reads\/tier\.sh 2>&1/);
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

  it('tier: DSN from the env only, every psql call through nr-psql on the qualified planPsql, atomic apply+ledger, pins', () => {
    expect(runOf(S[at(/narrow-reads\/tier\.sh 2>&1/)])).toMatch(/^scripts\/local-stack\/narrow-reads\/tier\.sh 2>&1 \| /);
    expect(S.map(runOf).join('\n')).not.toMatch(/tier\.sh "\$SUPABASE_DB_URL"/);
    expect(TIER_CODE).not.toMatch(/\bpsql\s+["$-]|\bpsql\(\)/);                     // no direct psql anywhere in the tier
    expect(TIER_CODE).not.toMatch(/SUPABASE_DB_URL|\$DB\b|assert-local-dsn\.mjs"/);  // the tier never touches the DSN itself
    expect(TIER).toMatch(/\[ \$# -eq 0 \] \|\|/);                            // a DSN argument is refused
    expect(TIER).toContain(`MIG="${MIG}"`);
    expect(TIER_CODE).not.toMatch(/migrations\/\*|db push|db-migrate|apply_migration/);
    const NRP = readFileSync(path.join(ROOT, 'scripts/local-stack/narrow-reads/nr-psql.mjs'), 'utf8');
    expect(NRP).toMatch(/import \{ includeScript, planPsql \} from '\.\.\/\.\.\/gradebook-fixture\/journey\/private-psql\.mjs';/);
    expect(NRP).toMatch(/spawn\('psql', plan\.argv,/);
    expect(NRP).toContain("`${s.slice(0, i)}begin;\\n${s.slice(i)}`");
    expect(NRP).toMatch(/insert into local_evidence\.narrow_reads_applied \(step, version, sha256\) values \(:'nr_step', :'nr_version', :'nr_sha'\);\\n"\n\s*\+ 'commit;\\n'/);
    const pins = [...TIER.matchAll(/^"([^|"]+)\|([0-9a-f]{40})\|([0-9a-f]{64})"$/gm)];
    expect(pins.map((m) => m[1]).sort()).toEqual([
      'scripts/gradebook-fixture/journey/private-psql.mjs', 'scripts/local-db/assert-local-dsn.mjs',
      'scripts/local-stack/narrow-reads/baseline.sql', 'scripts/local-stack/narrow-reads/catalog.sql', 'scripts/local-stack/narrow-reads/ledger.sql',
      'scripts/local-stack/narrow-reads/matrix.sql', 'scripts/local-stack/narrow-reads/nr-psql.mjs',
      'scripts/local-stack/narrow-reads/rollback.sql', 'scripts/local-stack/narrow-reads/rowhash.sql', 'scripts/local-stack/t09/sql-tier.sh', MIG,
    ].sort());
    for (const [, p, blob] of pins) expect(execFileSync('git', ['-C', ROOT, 'hash-object', p], { encoding: 'utf8' }).trim(), p).toBe(blob);
  });

  it('nr-psql apply script: begin, the file by absolute path, one ledger row, commit (pure, no psql)', async () => {
    const { scriptFor } = await import('../../../scripts/local-stack/narrow-reads/nr-psql.mjs');
    const f = path.join(ROOT, 'scripts/local-stack/narrow-reads/rollback.sql');
    const sh = execFileSync('sha256sum', [f], { encoding: 'utf8' }).split(' ')[0];
    expect(scriptFor('apply', f, 'rollback')).toBe(`\\set nr_step 'rollback'\n\\set nr_version '20261102000000'\n\\set nr_sha '${sh}'\nbegin;\n\\i ${f}\n`
      + "insert into local_evidence.narrow_reads_applied (step, version, sha256) values (:'nr_step', :'nr_version', :'nr_sha');\ncommit;\n");
    expect(scriptFor('run', f)).toBe(`\\i ${f}\n`);
    expect(() => scriptFor('apply', f, 'drop')).toThrow();
  });

  it('tier selftest passes (synthetic outputs; no database)', () => {
    const out = execFileSync('bash', [path.join(ROOT, 'scripts/local-stack/narrow-reads/tier.sh'), '--selftest'], { encoding: 'utf8' });
    expect(out).toMatch(/== narrow-reads tier selftest: ALL PASS/);
  });

  it('matrix: 26 cases, 8 closed; rollback recreates exactly the snapshot policy lines', () => {
    expect(CASES_SRC.length).toBe(26); expect(CASES_SRC.filter((c) => c.kind === 'closed').length).toBe(8);
    expect(TIER).toContain('CHECKS_LINE="CHECKS 26 closed 8"');
    const snap = readFileSync(path.join(ROOT, 'scripts/local-stack/schema/04_rls_policies.sql'), 'utf8').split('\n');
    const rb = readFileSync(path.join(ROOT, 'scripts/local-stack/narrow-reads/rollback.sql'), 'utf8').split('\n').filter((l) => l.startsWith('create policy'));
    expect(rb).toHaveLength(4);
    for (const l of rb) expect(snap).toContain(l);
  });

  it('(4) contract, from the literal matrix source: closed iff OLD and NEW literals differ; judged against both; no mode', () => {
    for (const c of CASES_SRC) expect(c.kind === 'closed', c.id).toBe(c.oldLit !== c.newLit);
    expect(new Set(CASES_SRC.map((c) => c.id)).size).toBe(26);
    expect(TIER_CASES).toEqual(CASES_SRC.map((c) => `${c.id}:${c.kind}`).sort());
    expect(MATRIX).toContain('insert into results values (p_id, p_kind, p_got = p_new, p_got = p_old)');
    expect(MATRIX).not.toMatch(/pg_temp\.want|nr\.mode|:'mode'/);
    expect(MATRIX).toMatch(/raise exception '% narrow-read check\(s\) failed', f;/);
  });

  it('(4) causal: matrix lines derived from the literals pass the driver under r2 and fail under the r1 want(OLD)=p_old rule', () => {
    // Snapshot policies observe the OLD literal; #159 policies observe the NEW one.
    const render = (got: (c: Case) => string, passOf: (c: Case, g: string) => boolean) => CASES_SRC.map((c) => {
      const g = got(c); return `${passOf(c, g) ? 'PASS' : 'FAIL'} ${c.id} ${c.kind} old=${g === c.oldLit ? 'MATCH' : 'DIFF'}`;
    }).join('\n') + '\nCHECKS 26 closed 8\n';
    const r2 = (c: Case, g: string) => g === c.newLit;
    const r1Old = (c: Case, g: string) => g === c.oldLit;          // the r1 matrix in OLD mode compared against p_old
    const assertion = (o: string) => { const n = (o.match(/^FAIL /gm) || []).length; return n ? `psql:<stdin>:1: ERROR:  ${n} narrow-read check(s) failed` : ''; };
    const status = (o: string) => (/^FAIL /m.test(o) ? 3 : 0);
    const oldR2 = render((c) => c.oldLit, r2), newR2 = render((c) => c.newLit, r2), oldR1 = render((c) => c.oldLit, r1Old);
    expect(check('OLD', status(oldR2), oldR2, assertion(oldR2))).toBe('OK 26');
    expect(check('NEW', status(newR2), newR2, assertion(newR2))).toBe('OK 26');
    expect(check('OLD', status(oldR1), oldR1, assertion(oldR1))).toBe('EXPECTATION 0');
    // And a literal edited so a closed case no longer differs breaks the inventory (the driver's kinds are fixed).
    const edited = oldR2.replace(/^FAIL Q02 closed old=MATCH$/m, 'PASS Q02 kept old=MATCH');
    expect(check('OLD', 3, edited, 'psql:<stdin>:1: ERROR:  7 narrow-read check(s) failed')).toBe('INVENTORY 1');
  });

  it('(1) the job network names pass stack-net\'s own unchanged rule; the r1 name is refused by stack-net itself', () => {
    const STACKNET = readFileSync(path.join(ROOT, 'scripts/local-stack/t09/stack-net.mjs'), 'utf8');
    const names = new RegExp((/^const NAMES = \/(.*)\/;/m.exec(STACKNET) as RegExpExecArray)[1]);
    const calls = S.map(runOf).flatMap((r) => [...r.matchAll(/stack-net\.mjs (create|verify|remove) "([^"]+)" "([^"]+)"/g)]);
    expect(calls.map((m) => m[1]).sort()).toEqual(['create', 'remove', 'verify']);
    const sup = runOf(S[at(/supabase start --workdir/)]).match(/--network-id "([^"]+)"/) as RegExpMatchArray;
    for (const n of [...calls.map((m) => m[2]), sup[1]]) {
      const concrete = n.replace('$GITHUB_RUN_ID', '19055443215').replace('$GITHUB_RUN_ATTEMPT', '2');
      expect(concrete, n).toMatch(names); expect(n).toBe('ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT');
    }
    for (const m of calls) expect(m[3]).toBe('$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-nr');
    expect(T9.steps.map(runOf).join('\n')).not.toContain('-nr"');         // the owner label is this job's own
    // Real stack-net, fake docker that records any call: the r1 name is refused before docker; the r2 name gets past the rule.
    const t = mkdtempSync(path.join(os.tmpdir(), 'nr-net-'));
    try {
      writeFileSync(path.join(t, 'docker'), `#!/usr/bin/env bash\necho called >> "${t}/docker-calls"; exit 1\n`); chmodSync(path.join(t, 'docker'), 0o755);
      const sn = (name: string) => spawnSync('node', [path.join(ROOT, 'scripts/local-stack/t09/stack-net.mjs'), 'verify', name, '1-2-nr'], { encoding: 'utf8', env: { ...process.env, PATH: `${t}:${process.env.PATH}` } });
      const r1 = sn('ic-nr-net-1-2');
      expect(r1.status).not.toBe(0); expect(r1.stdout + r1.stderr).toMatch(/is not ic-t09-<old\|new>-net-<run id>-<attempt>/);
      expect(() => readFileSync(path.join(t, 'docker-calls'))).toThrow();
      const r2 = sn('ic-t09-new-net-1-2');
      expect(r2.stdout + r2.stderr).not.toMatch(/is not ic-t09-/);
    } finally { rmSync(t, { recursive: true, force: true }); }
  });
});
