// ABOUTME: Static contract of the public-catalog job in e2e.yml (order, lane inputs, evidence allowlist, cleanup, staging)
// ABOUTME: and unit controls for its two helpers (pc-job-dsn planning/passfile, launch binding reuse). No stack, no network.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { planDsn, writePassfile, JobDsnError } from '../../../scripts/e2e/pc-job-dsn.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const WF = YAML.parse(fs.readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8'));
const JOB = WF.jobs['public-catalog'];
const S: Array<{ name?: string; id?: string; run?: string; if?: string; uses?: string }> = JOB.steps;
const at = (re: RegExp) => { const i = S.findIndex((s) => re.test(s.name ?? '')); expect(i, String(re)).toBeGreaterThanOrEqual(0); return i; };
const run = (re: RegExp) => S[at(re)].run ?? '';
const LANE_EVIDENCE = ['STEPS.txt', 'pre-stack-inventory.txt', 'W0.txt', 'W1.txt', 'W2.txt', 'W3.txt', 'MANIFEST.json', 'playwright.exit',
  'playwright-summary.txt', 'anon-probe.exit', 'anon-probe-summary.txt', 'screenshots.txt', 'screenshots.exit'];
const SHOT_NAMES = ['PC-catalog-desktop-1440x900', 'PC-catalog-tablet-834x1112', 'PC-catalog-mobile-390x844', 'PC-rail-desktop-1180x757'];

describe('public-catalog job (static)', () => {
  it('is dispatch-only, read-only token, and offered as a specs choice', () => {
    expect(JOB.if).toBe("inputs.specs == 'public-catalog'");
    expect(JOB.permissions).toEqual({ contents: 'read' });
    expect(WF.on.workflow_dispatch.inputs.specs.options).toContain('public-catalog');
    expect(JSON.stringify(JOB)).not.toMatch(/secrets\.|E2E_[A-Z]*PASSWORD|PUBLIC_ACCEPT_STACK_PROOF=|PUBLIC_ACCEPT_TIER/);
  });
  it('orders every check and the D1 record before the lane, and the lane before the evidence copy and teardown', () => {
    const order = [/STAGE PRE/, /Bootstrap schema snapshot/, /Seven reviewed migrations/, /Derive and verify the TEST-SERVED copy and its avatar/,
      /Serve the TEST-SERVED copy/, /Avatar-fixture gate receipt/, /Pin the headless shell/, /Launch binding receipt/, /D1 stack-ownership record/,
      /Public lane inputs/, /Public catalog lane/, /Copy the lane's evidence/, /Stop background servers/, /Remove private outputs/, /Stop stack/,
      /Remove owned network/, /Nothing left behind/, /Stage evidence/, /Upload evidence/];
    const idx = order.map(at);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(S.filter((s) => /run\.sh/.test(s.run ?? '')).length).toBe(1);
    expect(S.some((s) => /gb-job-psql\.mjs (preseed|seed-auth)|run-journey/.test(s.run ?? ''))).toBe(false); // no actor or gradebook writes
  });
  it('the D1 step keeps the reviewed bootstrap constant and self-verifies through the consumer', () => {
    expect(JOB.env.PC_D1_BOOTSTRAP_SHA256).toBe('b41a9ed8d7b3207cb2ad4faf71ec8b7fd703a816d02ec0eb92c99a18af452715');
    const d1 = run(/D1 stack-ownership record/);
    expect(d1).toMatch(/\[ "\$have" = "\$PC_D1_BOOTSTRAP_SHA256" \] \|\| \{ echo "D1 refused/);
    expect(d1).toMatch(/stack-ownership\.mjs verify "\$API" "\$APP" "\$PC_D1_BOOTSTRAP_SHA256"/);
  });
  it('gives the lane exactly its contract: canonical served paths, private pgpass, D1 origins, fresh run id, no preset proof', () => {
    const inp = run(/Public lane inputs/);
    for (const k of ['PUBLIC_ACCEPT_DB_URL', 'PUBLIC_ACCEPT_DB_PASSFILE', 'PUBLIC_ACCEPT_API_URL', 'PUBLIC_ACCEPT_BASE_URL', 'LE_API_ORIGIN', 'LE_APP_ORIGIN', 'PUBLIC_ACCEPT_RUN_ID', 'PUBLIC_ACCEPT_OUT']) expect(inp).toContain(`echo "${k}=`);
    expect(inp).toMatch(/API=\$\(node -e .*\$VITE_SUPABASE_URL"\)/);   // the same derivation as the D1 writer's API/APP
    expect(run(/D1 stack-ownership record/)).toMatch(/API=\$\(node -e .*\$VITE_SUPABASE_URL"\)/);
    const lane = run(/Public catalog lane/);
    expect(lane).toMatch(/env -u SUPABASE_DB_URL -u PGPASSWORD -u PGPASSFILE TMPDIR="\$RUNNER_TEMP\/pc-tmp"/);
    for (const k of ['PUBLIC_ACCEPT_ANON_KEY', 'PUBLIC_ACCEPT_PRODUCT_DIST="$PC_DIST"', 'PUBLIC_ACCEPT_HERMETIC_DIR="$PC_HERMETIC"', 'PUBLIC_ACCEPT_SERVED_DIR="$PC_SERVED"', 'PUBLIC_ACCEPT_AVATAR_FIXTURE=1']) expect(lane).toContain(k);
    expect(lane).not.toMatch(/PUBLIC_ACCEPT_STACK_PROOF|PUBLIC_ACCEPT_LIST_ONLY=1 bash/);
  });
  it('copies only the 13 allowlisted lane evidence files, refusing any other entry, and stages them as receipts', () => {
    const copy = run(/Copy the lane's evidence/);
    expect(copy).toContain(`ALLOW="${LANE_EVIDENCE.join(' ')}"`);
    expect(copy).toMatch(/\*\) echo "lane evidence refused: unexpected entry"; exit 1/);
    const stage = run(/Stage evidence/);
    for (const f of LANE_EVIDENCE.filter((f) => f !== 'pre-stack-inventory.txt')) expect(stage).toContain(`"$E/lane/${f}"`);
    expect(S[at(/Upload evidence/)]).toMatchObject({ uses: 'actions/upload-artifact@v4' });
  });
  it('copies screenshots only as the hash manifest names them: four fixed names, 0600 PNGs, exact sha256, nothing else', () => {
    const copy = run(/Copy the lane's evidence/);
    expect(copy).toContain(`NAMES="${SHOT_NAMES.join(' ')}"`);
    expect(copy).toContain('echo "screenshots refused: name not in the fixed list"; exit 1');
    expect(copy).toContain('echo "screenshots refused: the dir does not equal its manifest"; exit 1');
    expect(copy).toContain('is not a regular 0600 file"; exit 1');
    expect(copy).toContain('= 89504e470d0a1a0a ]');
    expect(copy).toContain('grep -qx "SHOT ${p%.png} $(sha256sum < "$S/$p" | cut -d\' \' -f1)" "$O/screenshots.txt"');
    expect(copy).toContain('echo "screenshots refused: duplicate name"; exit 1');
    expect(copy).not.toMatch(/tablet-768|768x/);
  });
  it('removes every private output, including the lane OUT, TMPDIR, pgpass dir and served copies, under always()', () => {
    const rm = run(/Remove private outputs/);
    expect(S[at(/Remove private outputs/)].if).toBe('always()');
    for (const p of ['pc-out', 'pc-tmp', 'pc-lane-priv', 'pc-priv', 'stack-ownership.json', 'pc-hermetic', 'pc-served']) expect(rm).toContain(`"$RUNNER_TEMP/${p}"`);
  });
});

describe('pc-job-dsn helper', () => {
  it('canonical password-free DSN and an escaped one-line pgpass', () => {
    const r = planDsn(['postgresql://postgres', ':pa:ss', '@127.0.0.1:54322/postgres'].join(''), {});
    expect(r.dsn).toBe('postgresql://postgres@127.0.0.1:54322/postgres');
    expect(r.passLine).toBe('127.0.0.1:54322:postgres:postgres:pa\\:ss\n');
  });
  for (const [name, dsn] of [['remote host', ['postgresql://postgres', ':x', '@db.example.com:5432/postgres'].join('')], ['no password', 'postgresql://postgres@127.0.0.1:54322/postgres'], ['garbage', 'not a dsn'], ['undefined', undefined]] as const) {
    it(`refuses: ${name}`, () => { expect(() => planDsn(dsn as string, {})).toThrow(JobDsnError); });
  }
  it('passfile: 0600, exclusive, only in a private 0700 dir', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pcdsn-'));
    try {
      fs.chmodSync(d, 0o755);
      expect(() => writePassfile(d, 'a:1:b:c:d\n')).toThrow(JobDsnError);
      fs.chmodSync(d, 0o700);
      const f = writePassfile(d, 'a:1:b:c:d\n');
      expect(fs.statSync(f).mode & 0o777).toBe(0o600);
      expect(() => writePassfile(d, 'a:1:b:c:d\n')).toThrow(JobDsnError);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
});
