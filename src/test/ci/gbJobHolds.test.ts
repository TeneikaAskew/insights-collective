// ABOUTME: Fake-backed controls that EXECUTE the gradebook-journey job's actual run blocks (taken from e2e.yml) for the three
// ABOUTME: native holds: private psql routing, the pinned shell bound to every launch, and always-run private-output removal.
//
// The run blocks are executed with `bash --noprofile --norc -eo pipefail` (the job's `shell: bash`). Fakes: a recording
// `psql` and a recording `node` shim on PATH (the shim execs the real node). OLD = the same block from r3p a283f1c, run
// under the same fakes, so every hold has a causal reproduction next to its repair.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { psqlQuote, seedAuthScript } from '../../../scripts/e2e/gb-job-psql.mjs';
import { bindingProblems } from '../../../scripts/e2e/gb-launch-binding';

const ROOT = path.resolve(__dirname, '../../..');
const OLD_REF = 'a283f1c3f8758cbf17ecda647f9588cd5b06038c';
type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string };
const steps = (text: string) => YAML.parse(text).jobs['gradebook-journey'].steps as Step[];
const NEW = steps(fs.readFileSync(path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8'));
const OLD = steps(execFileSync('git', ['show', `${OLD_REF}:.github/workflows/e2e.yml`], { cwd: ROOT, encoding: 'utf8' }));
const byName = (s: Step[], prefix: string) => { const f = s.filter((x) => String(x.name ?? '').startsWith(prefix)); expect(f.length, prefix).toBe(1); return f[0]; };
const idx = (s: Step[], prefix: string) => s.indexOf(byName(s, prefix));

const DSN_PW = 'DSNMARKER7f3';
const SEED_PW = "SEEDMARKER'q\\z";
const DSN = `postgresql://postgres:${DSN_PW}@127.0.0.1:54322/postgres`;
const BOOT = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'scripts/local-stack/bootstrap.sh'))).digest('hex');
const LOCAL_SHELL = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const HAVE_SHELL = fs.existsSync(LOCAL_SHELL);
// The public Supabase CLI demo anon key for a LOCAL stack (not a secret; it only satisfies the config's local-binding check).
const LOCAL_DEMO_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const sandboxes: string[] = [];
afterAll(() => { for (const d of sandboxes) fs.rmSync(d, { recursive: true, force: true }); });

function sandbox() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gbholds-')); sandboxes.push(d);
  const bin = path.join(d, 'bin'); const log = path.join(d, 'log'); const rt = path.join(d, 'rt'); const ev = path.join(d, 'ev');
  for (const x of [bin, log, rt, path.join(ev, 'checks')]) fs.mkdirSync(x, { recursive: true });
  // Recording psql: argv, env, passfile mode and content, stdin; prints a sysid for the sysid query; FAKE_PSQL_EXIT fails it
  // with stderr that echoes the passfile (as a leaky libpq message would).
  fs.writeFileSync(path.join(bin, 'psql'), `#!/usr/bin/env bash
n=$(ls "$FAKE_LOG" | grep -c '^psql-'); c="$FAKE_LOG/psql-$n"; mkdir -p "$c"
printf '%s\\n' "$@" > "$c/argv"; env > "$c/env"; cat > "$c/stdin"
if [ -n "\${PGPASSFILE:-}" ]; then stat -c %a "$PGPASSFILE" > "$c/passmode"; cat "$PGPASSFILE" > "$c/pass"; echo "$PGPASSFILE" > "$c/passpath"; fi
if [ "\${FAKE_PSQL_EXIT:-0}" != 0 ]; then { echo "FATAL: auth failed for $*"; cat "\${PGPASSFILE:-/dev/null}"; echo "pw=\${E2E_TEST_PASSWORD:-}"; } >&2; exit "$FAKE_PSQL_EXIT"; fi
{ cat "$c/stdin"; printf "%s\\n" "$@"; } | grep -q pg_control_system && echo 7350000000000000001
exit 0
`, { mode: 0o755 });
  // Recording node shim: every node argv of the step, one invocation per line, then the real node.
  fs.writeFileSync(path.join(bin, 'node'), `#!/usr/bin/env bash
{ printf '%s\\x1f' "$@"; printf '\\n'; } >> "$FAKE_LOG/node-argv"
exec "${process.execPath}" "$@"
`, { mode: 0o755 });
  // Hold-3 steps run in this empty cwd (their relative rm paths must never touch the checkout); every other step runs in ROOT.
  const cwd = path.join(d, 'cwd'); fs.mkdirSync(cwd);
  const env: Record<string, string> = {
    PATH: `${bin}:${process.env.PATH}`, HOME: d, FAKE_LOG: log, RUNNER_TEMP: rt, GB_EVIDENCE: ev, GITHUB_ENV: path.join(d, 'github-env'),
    SUPABASE_DB_URL: DSN, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_RELAY_TARGET: 'http://127.0.0.1:54321', E2E_BASE_URL: 'http://127.0.0.1:8080',
    GB_D1_BOOTSTRAP_SHA256: BOOT, STACK_OWNERSHIP_FILE: path.join(rt, 'stack-ownership.json'), GITHUB_RUN_ID: '41000000001', GITHUB_RUN_ATTEMPT: '1',
    E2E_TEST_PASSWORD: SEED_PW, GB_SHELL_PATH: LOCAL_SHELL, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: LOCAL_SHELL,
    VITE_SUPABASE_ANON_KEY: LOCAL_DEMO_ANON, VITE_SUPABASE_PUBLISHABLE_KEY: LOCAL_DEMO_ANON,
  };
  fs.writeFileSync(env.GITHUB_ENV, '');
  return { d, bin, log, rt, ev, cwd, env };
}
type Box = ReturnType<typeof sandbox>;
function exec(box: Box, step: Step, extra: Record<string, string | undefined> = {}, inSandboxCwd = false) {
  const env = { ...box.env, ...extra } as Record<string, string>;
  for (const [k, v] of Object.entries(extra)) if (v === undefined) delete env[k];
  // In the sandbox cwd, the only rewrite is repo-relative script paths -> absolute (the run block is otherwise verbatim).
  const run = inSandboxCwd ? String(step.run).replace(/(^|[\s(])scripts\//g, `$1${ROOT}/scripts/`) : String(step.run);
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', run], { cwd: inSandboxCwd ? box.cwd : ROOT, env, encoding: 'utf8', timeout: 120_000 });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const psqlCalls = (box: Box) => fs.readdirSync(box.log).filter((f) => f.startsWith('psql-')).sort().map((f) => {
  const c = path.join(box.log, f); const rd = (n: string) => (fs.existsSync(path.join(c, n)) ? fs.readFileSync(path.join(c, n), 'utf8') : '');
  return { argv: rd('argv').split('\n').filter(Boolean), env: rd('env'), stdin: rd('stdin'), mode: rd('passmode').trim(), pass: rd('pass'), passpath: rd('passpath').trim() };
});
const nodeArgv = (box: Box) => (fs.existsSync(path.join(box.log, 'node-argv')) ? fs.readFileSync(path.join(box.log, 'node-argv'), 'utf8') : '');
const tree = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).sort() : []);

describe('hold 1: the job psql callers go through the qualified private-psql (actual job run blocks, fake psql)', () => {
  it('pins the frozen SQL and the imported qualified modules', () => {
    const blob = (f: string) => execFileSync('git', ['hash-object', f], { cwd: ROOT, encoding: 'utf8' }).trim();
    expect(blob('scripts/gradebook-fixture/journey/private-psql.mjs')).toBe('8077eccfc6f6bc85cd391bc13efff071f3b9f27a');
    expect(blob('scripts/local-db/assert-local-dsn.mjs')).toBe('9632c7b40dc7a7a739f97342592085f975c58913');
    expect(blob('scripts/local-db/local-preseed.sql')).toBe('f0151913221f42f35b16594b8135587980d30137');
    expect(blob('scripts/local-stack/auth-fixtures.sql')).toBe('70f5ae18d9a1f97f09971148cda463552b02d276');
    expect(blob('scripts/local-stack/seed-auth.sh')).toBe('e45f393adfaf40e23c342a3aeee847563fed2b64');   // unchanged; no longer called here
    expect(blob('scripts/local-stack/learner-quiz/owned-proc.mjs')).toBe('347ee166c3448ff872e572a8ce1ba2ffb9e98144');
  });
  it('the job steps never name the DSN or the password as an argument (static)', () => {
    for (const p of ['D1 stack-ownership record', 'Local actors and reference rows', 'Gradebook journey adapter']) {
      const run = String(byName(NEW, p).run);
      expect(run, p).not.toMatch(/psql\s+"\$SUPABASE_DB_URL"|assert-local-dsn\.mjs "\$SUPABASE_DB_URL"|-v e2e_password|seed-auth\.sh/);
      expect(run, p).not.toMatch(/\$E2E_TEST_PASSWORD/);
    }
  });
  it('NEW D1 block: exit 0, record written; every psql call has -w, plain argv, a 0600 private passfile, no secret in argv/env/output', () => {
    const box = sandbox();
    const r = exec(box, byName(NEW, 'D1 stack-ownership record'));
    expect(r.code, r.out).toBe(0);
    expect(fs.existsSync(box.env.STACK_OWNERSHIP_FILE), r.out).toBe(true);
    const calls = psqlCalls(box);
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.argv).toEqual(['-X', '-q', '-At', '-w', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-f', '-']);
      expect(c.mode).toBe('600');
      expect(c.pass).toBe(`127.0.0.1:54322:postgres:postgres:${DSN_PW}\n`);
      expect(path.dirname(c.passpath)).toBe(fs.realpathSync(path.join(box.rt, 'gb-priv')));
      expect(c.env).not.toContain(DSN_PW);
      expect(c.env).not.toMatch(/^SUPABASE_DB_URL=/m);
      expect(c.stdin).toBe('select system_identifier from pg_control_system();\n');
    }
    expect(nodeArgv(box)).not.toContain(DSN_PW);
    expect(r.out).not.toContain(DSN_PW);
    expect(fs.statSync(path.join(box.rt, 'gb-priv')).mode & 0o777).toBe(0o700);
    expect(tree(path.join(box.rt, 'gb-priv')).filter((f) => f.startsWith('pgpass-'))).toEqual([]);   // passfiles removed per call
  });
  it('OLD D1 block (causal): the full DSN, with its password, is on psql argv and node argv', () => {
    const box = sandbox();
    const r = exec(box, byName(OLD, 'D1 stack-ownership record'));
    expect(r.code, r.out).toBe(0);
    const calls = psqlCalls(box);
    expect(calls.length).toBe(2);
    expect(calls.every((c) => c.argv.includes(DSN))).toBe(true);
    expect(nodeArgv(box)).toContain(DSN_PW);
  });
  it('NEW D1 block with a failing psql: nonzero, only a fixed code printed, the leaky stderr stays in the private dir', () => {
    const box = sandbox();
    const r = exec(box, byName(NEW, 'D1 stack-ownership record'), { FAKE_PSQL_EXIT: '2' });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('gb-job-psql refused: GBP_PSQL_E_EXIT');
    expect(r.out).not.toContain(DSN_PW);
    expect(r.out).not.toContain('FATAL');
    expect(fs.existsSync(box.env.STACK_OWNERSHIP_FILE)).toBe(false);
    const err = fs.readFileSync(path.join(box.rt, 'gb-priv', 'psql-stderr.log'), 'utf8');
    expect(err).toContain('pw=');                       // the child never received the seed password either
    expect(err).not.toContain(SEED_PW);
  });
  it('OLD D1 block with a failing psql (causal): raw psql output, including the DSN, reaches the step log', () => {
    const box = sandbox();
    const r = exec(box, byName(OLD, 'D1 stack-ownership record'), { FAKE_PSQL_EXIT: '2' });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain(DSN_PW);
  });
  it('NEW actors block: preseed then seed-auth through private psql; the seed password only on stdin, frozen files by path', () => {
    const box = sandbox();
    fs.mkdirSync(path.join(box.rt, 'gb-priv'), { mode: 0o700 });
    const r = exec(box, byName(NEW, 'Local actors and reference rows'));
    expect(r.code, r.out).toBe(0);
    const calls = psqlCalls(box);
    expect(calls).toHaveLength(2);
    expect(calls[0].stdin).toBe(`\\i ${path.join(ROOT, 'scripts/local-db/local-preseed.sql')}\n`);
    expect(calls[1].stdin).toBe(seedAuthScript(SEED_PW, path.join(ROOT, 'scripts/local-stack/auth-fixtures.sql')));
    expect(calls[1].stdin).toContain("\\set e2e_password 'SEEDMARKER''q\\\\z'\n");
    for (const c of calls) {
      expect(c.argv).toContain('-w'); expect(c.mode).toBe('600');
      expect(c.argv.join(' ')).not.toMatch(/SEEDMARKER|DSNMARKER/);
      expect(c.env).not.toMatch(/SEEDMARKER|DSNMARKER/);
    }
    expect(nodeArgv(box)).not.toMatch(/SEEDMARKER|DSNMARKER/);
    expect(r.out).not.toMatch(/SEEDMARKER|DSNMARKER/);
    expect(fs.readFileSync(path.join(box.ev, 'checks', 'actors.txt'), 'utf8')).toMatch(/^gb-job-psql: applied scripts\/local-db\/local-preseed\.sql sha256 [0-9a-f]{64}/);
  });
  it('OLD actors block (causal): the seed password is on psql -v argv and the DSN on psql argv', () => {
    const box = sandbox();
    const r = exec(box, byName(OLD, 'Local actors'));
    expect(r.code, r.out).toBe(0);
    const argv = psqlCalls(box).map((c) => c.argv.join(' ')).join('\n');
    expect(argv).toContain(`e2e_password=${SEED_PW}`);
    expect(argv).toContain(DSN);
  });
  it('psql quoting: backslash and quote escaped; line breaks, NUL and empty refused', () => {
    expect(psqlQuote("a'b\\c")).toBe("'a''b\\\\c'");
    for (const bad of ['', 'a\nb', 'a\rb', 'a\0b']) expect(() => psqlQuote(bad)).toThrow(/GBP_E_SECRET/);
  });
});

describe('hold 2: the validated headless shell is exported and bound to every launch before any write', () => {
  it('order: install, pin+export, launch-binding receipt all precede D1, actors and the adapter; none is conditional', () => {
    const pin = idx(NEW, 'Pin the headless shell and export it'); const bind = idx(NEW, 'Launch binding receipt');
    expect(idx(NEW, 'Install Chromium headless shell')).toBeLessThan(pin);
    expect(pin).toBeLessThan(bind);
    for (const p of ['D1 stack-ownership record', 'Local actors and reference rows', 'Gradebook journey adapter']) expect(bind, p).toBeLessThan(idx(NEW, p));
    for (const p of ['Pin the headless shell', 'Launch binding receipt', 'D1 stack-ownership record', 'Local actors and reference rows', 'Gradebook journey adapter']) expect(byName(NEW, p).if, p).toBeUndefined();
    expect(String(byName(NEW, 'Pin the headless shell').run)).toMatch(/echo "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=\$SHELL_PATH" >> "\$GITHUB_ENV"/);
    // OLD (causal): the pin came after the actor writes and exported nothing.
    expect(idx(OLD, 'Pin the headless shell')).toBeGreaterThan(idx(OLD, 'Local actors'));
    expect(String(byName(OLD, 'Pin the headless shell').run)).not.toMatch(/GITHUB_ENV/);
  });
  it('bindingProblems: equal everywhere passes; unset, mismatched, or any project/setup elsewhere refuses', () => {
    const P = '/x/chromium_headless_shell-1/chrome-headless-shell-linux64/chrome-headless-shell';
    const proj = (p = P) => [{ name: 'a', use: { launchOptions: { executablePath: p } } }, { name: 'b', use: { launchOptions: { executablePath: P } } }];
    expect(bindingProblems({ GB_SHELL_PATH: P, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: P }, proj(), { executablePath: P })).toEqual([]);
    expect(bindingProblems({ PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: P }, proj(), { executablePath: P }).length).toBeGreaterThan(0);
    expect(bindingProblems({ GB_SHELL_PATH: P }, proj(), { executablePath: P }).length).toBeGreaterThan(0);
    expect(bindingProblems({ GB_SHELL_PATH: P, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: P }, proj('/bin/chromium'), { executablePath: P })).toEqual(['project a would launch another browser']);
    expect(bindingProblems({ GB_SHELL_PATH: P, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: P }, proj(), {})).toEqual(['session-setup would launch another browser']);
    expect(bindingProblems({ GB_SHELL_PATH: P, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: P }, [], { executablePath: P })).toEqual(['the config declares no projects']);
  });
  const bindEnv = (box: Box, extra: Record<string, string | undefined>) => ({ ...box.env, GB_LANE: 'journey', ...extra });
  it.skipIf(!HAVE_SHELL)('real config load: with the exported pin, all 5 journey projects and the setup launch name exactly the shell', { timeout: 60_000 }, () => {
    const box = sandbox();
    const r = exec(box, byName(NEW, 'Launch binding receipt'), bindEnv(box, {}));
    expect(r.code, r.out).toBe(0);
    expect(r.out.match(/^GB-LAUNCH project jr-[0-4]-[a-z-]+ executablePath=(.*)$/gm)?.map((l) => l.split('=').pop())).toEqual(Array(5).fill(LOCAL_SHELL));
    expect(r.out).toContain(`GB-LAUNCH session-setup executablePath=${LOCAL_SHELL}`);
  });
  it.skipIf(!HAVE_SHELL)('real config load: unset or mismatched PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH refuses (no fallback is accepted)', { timeout: 60_000 }, () => {
    const box = sandbox();
    for (const extra of [{ PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: undefined }, { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/sh' }, { GB_SHELL_PATH: undefined }]) {
      const r = exec(box, byName(NEW, 'Launch binding receipt'), bindEnv(box, extra));
      expect(r.code, JSON.stringify(extra)).not.toBe(0);
      expect(r.out).toContain('GB-LAUNCH REFUSED');
    }
  });
  it('pin step: missing shell or a foreign PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH refuses and exports nothing', () => {
    for (const extra of [
      { PLAYWRIGHT_BROWSERS_PATH: '/nonexistent-browsers', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: undefined },
      { PLAYWRIGHT_BROWSERS_PATH: '/opt/pw-browsers', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/sh' },
    ]) {
      const box = sandbox();
      const r = exec(box, byName(NEW, 'Pin the headless shell'), extra);
      expect(r.code, r.out).not.toBe(0);
      expect(r.out).toContain('REFUSED headless shell');
      expect(fs.readFileSync(box.env.GITHUB_ENV, 'utf8')).toBe('');
    }
  });
  it.skipIf(!HAVE_SHELL)('pin step (local, test-only browsers.json override for the container revision): exports exactly the validated path', () => {
    const box = sandbox();
    const bj = path.join(box.d, 'browsers.json');
    fs.writeFileSync(bj, JSON.stringify({ browsers: [{ name: 'chromium-headless-shell', revision: '1243', browserVersion: '153.0.8010.12' }] }));
    const r = exec(box, byName(NEW, 'Pin the headless shell'), { PLAYWRIGHT_BROWSERS_PATH: '/opt/pw-browsers', QLC_TEST_BROWSERS_JSON: bj, CI: undefined, GITHUB_ACTIONS: undefined, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: undefined });
    expect(r.code, r.out).toBe(0);
    expect(fs.readFileSync(box.env.GITHUB_ENV, 'utf8')).toBe(`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=${LOCAL_SHELL}\nGB_SHELL_PATH=${LOCAL_SHELL}\n`);
  });
  it('job sequence with a missing shell: stops at the pin step; zero psql calls, no D1 record, no actor or carrier write', () => {
    const box = sandbox();
    const seq = ['Pin the headless shell', 'Launch binding receipt', 'D1 stack-ownership record', 'Local actors and reference rows'];
    const ran: string[] = [];
    for (const p of seq) { ran.push(p); const r = exec(box, byName(NEW, p), { PLAYWRIGHT_BROWSERS_PATH: '/nonexistent-browsers', PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: undefined, GB_SHELL_PATH: undefined }); if (r.code !== 0) break; }
    expect(ran).toEqual(['Pin the headless shell']);
    expect(psqlCalls(box)).toEqual([]);
    expect(fs.existsSync(box.env.STACK_OWNERSHIP_FILE)).toBe(false);
    expect(fs.existsSync(path.join(box.ev, 'checks', 'actors.txt'))).toBe(false);
  });
  it('actors and adapter blocks refuse on their own when the shell is not bound (before any write)', () => {
    const box = sandbox();
    fs.mkdirSync(path.join(box.rt, 'gb-priv'), { mode: 0o700 });
    const r = exec(box, byName(NEW, 'Local actors and reference rows'), { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/sh' });
    expect(r.code).not.toBe(0); expect(r.out).toContain('actors refused: the pinned headless shell is not bound');
    const a = exec(box, byName(NEW, 'Gradebook journey adapter'), { GB_SHELL_PATH: undefined });
    expect(a.code).not.toBe(0); expect(a.out).toContain('adapter refused: the pinned headless shell is not bound');
    expect(psqlCalls(box)).toEqual([]);
  });
});

describe('hold 3: private outputs are removed and verified even when stop/port fails', () => {
  const plant = (box: Box) => {
    for (const p of ['playwright-report-gradebook-journey/index.html', 'test-results/x/trace.zip']) { fs.mkdirSync(path.dirname(path.join(box.cwd, p)), { recursive: true }); fs.writeFileSync(path.join(box.cwd, p), 'x'); }
    for (const p of ['gb-journey-out/seed.txt', 'gb-priv/psql-stderr.log']) { fs.mkdirSync(path.dirname(path.join(box.rt, p)), { recursive: true, mode: 0o700 }); fs.writeFileSync(path.join(box.rt, p), 'x'); }
    for (const p of ['stack-ownership.json', 'gb-shell-receipt.txt', 'gb-shell-receipt.txt.bound', 'gb-launch-recheck.txt']) fs.writeFileSync(path.join(box.rt, p), 'x');
    fs.mkdirSync(path.join(box.rt, 'gb-owned'));
  };
  const remaining = (box: Box) => ['playwright-report-gradebook-journey', 'test-results'].filter((p) => fs.existsSync(path.join(box.cwd, p)))
    .concat(['gb-journey-out', 'gb-priv', 'stack-ownership.json', 'gb-shell-receipt.txt', 'gb-shell-receipt.txt.bound', 'gb-launch-recheck.txt'].filter((p) => fs.existsSync(path.join(box.rt, p))));
  // A real listener on 8080 makes the real owned-proc port check fail (exit 1), as a stuck preview would.
  const withListener = async <T>(fn: () => T): Promise<T | 'port-busy'> => {
    const srv = net.createServer();
    const ok = await new Promise<boolean>((res) => { srv.once('error', () => res(false)); srv.listen(8080, '127.0.0.1', () => res(true)); });
    if (!ok) return 'port-busy';
    try { return fn(); } finally { srv.close(); }
  };
  it('steps: stop and removal are separate always() steps, removal right after stop and before supabase stop', () => {
    const stop = idx(NEW, 'Stop background servers (preview)'); const rm = idx(NEW, 'Remove private outputs');
    expect(NEW[stop].if).toBe('always()'); expect(NEW[rm].if).toBe('always()');
    expect(rm).toBe(stop + 1);
    expect(rm).toBeLessThan(idx(NEW, 'Stop stack (no backup)'));
    expect(String(NEW[stop].run)).not.toMatch(/rm -/);
  });
  it('NEW: stop fails on a live 8080 listener (nonzero), then the removal step still removes and verifies every private path', async () => {
    const box = sandbox(); plant(box);
    const res = await withListener(() => {
      const s = exec(box, byName(NEW, 'Stop background servers (preview)'), {}, true);
      const r = exec(box, byName(NEW, 'Remove private outputs'), {}, true);
      return { s, r };
    });
    if (res === 'port-busy') return expect.soft(res, 'port 8080 busy locally; control not executed').toBe('port-busy');
    expect(res.s.code).not.toBe(0);
    expect(res.r.code, res.r.out).toBe(0);
    expect(remaining(box)).toEqual([]);
    expect(fs.readFileSync(path.join(box.ev, 'checks', 'private-removed.txt'), 'utf8')).toMatch(/D1 record absent/);
  });
  it('OLD (causal): the same stop failure exits before rm, so every private path including the D1 record is retained', async () => {
    const box = sandbox(); plant(box);
    const res = await withListener(() => exec(box, byName(OLD, 'Stop background servers'), {}, true));
    if (res === 'port-busy') return expect.soft(res, 'port 8080 busy locally; control not executed').toBe('port-busy');
    expect(res.code).not.toBe(0);
    expect(remaining(box)).toEqual(expect.arrayContaining(['playwright-report-gradebook-journey', 'test-results', 'gb-journey-out', 'stack-ownership.json']));
  });
  it('NEW: one removal failure still attempts every other path, reports it, writes no success receipt, exits nonzero', () => {
    const box = sandbox(); plant(box);
    // rm shim that refuses exactly one path (as a busy mount or immutable file would)
    fs.writeFileSync(path.join(box.bin, 'rm'), `#!/usr/bin/env bash\nfor a in "$@"; do case "$a" in */gb-journey-out) echo "rm: cannot remove $a" >&2; exit 1;; esac; done\nexec /bin/rm "$@"\n`, { mode: 0o755 });
    const r = exec(box, byName(NEW, 'Remove private outputs'), {}, true);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/private output still present: .*gb-journey-out/);
    expect(remaining(box)).toEqual(['gb-journey-out']);
    expect(fs.existsSync(path.join(box.ev, 'checks', 'private-removed.txt'))).toBe(false);
  });
  it('the staged manifest names the new receipts exactly once', () => {
    const stage = String(NEW.find((s) => s.id === 'stage')?.run);
    for (const f of ['headless-shell.txt', 'launch-binding.txt', 'private-removed.txt', 'actors.txt', 'd1-write.txt']) expect(stage.split(`/checks/${f}"`).length - 1, f).toBe(1);
  });
});
