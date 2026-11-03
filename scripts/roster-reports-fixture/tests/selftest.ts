// ABOUTME: Static FAKE selftest (no stack, no DB, no browser) for the T-15 acceptance fixture: manifest exactness, id
// ABOUTME: containment, cleanup counts, an independent recomputation of the oracle from seed.sql, and source hygiene.
// Run: npx --no-install tsx scripts/roster-reports-fixture/tests/selftest.ts
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as X from '../../../e2e/roster-reports/expected';
import { classifyRequest, installRequestPolicy } from '../../../e2e/roster-reports/request-policy.mjs';
import * as ActorsModule from '../../../e2e/roster-reports/actors.mjs';
import os from 'node:os';
import crypto from 'node:crypto';
import { summarizePlaywright, compareWitness as compareWitnessRaw, LINE, readBounded } from '../summary.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failures = 0; let checks = 0;
const ok = (cond: boolean, what: string) => { checks += 1; if (!cond) { failures += 1; console.log(`FAIL ${what}`); } };
// Missing exports or a throwing consumer count as failed checks (behaviour), not a crash of the whole selftest.
const AM = ActorsModule as Record<string, any>;
const appendTelemetry = (r: object, env: object) => (typeof AM.appendTelemetry === 'function' ? AM.appendTelemetry(r, env) : (() => { throw new Error('NO_EXPORT'); })());
const sinkPath = (env: object) => (typeof AM.sinkPath === 'function' ? AM.sinkPath(env) : 'NO_EXPORT');
const actorOf = (id: string) => (typeof AM.actorOf === 'function' ? AM.actorOf(id) : 'NO_EXPORT');
const MAX_BYTES: number = typeof AM.MAX_BYTES === 'number' ? AM.MAX_BYTES : 256 * 1024;
const compareWitness = (...a: Parameters<typeof compareWitnessRaw>) => { try { return compareWitnessRaw(...a); } catch { return { ok: false, lines: ['WITNESS THREW'] }; } };

// 1. Manifest: unique, well-formed, run-owned namespace.
const manifest = read('scripts/roster-reports-fixture/MANIFEST.tsv').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));
const ids = manifest.map((m) => m[1]);
ok(ids.length === 40, `manifest has exactly 40 ids (${ids.length})`);
ok(new Set(ids).size === ids.length, 'manifest ids unique');
ok(ids.every((i) => /^7150a000-0000-4000-8000-[0-9a-f]{12}$/.test(i)), 'manifest ids in the 7150a000 namespace');
const byTable = (t: string) => manifest.filter((m) => m[0] === t).map((m) => m[1]);

// 2. Containment: every fixture-namespace id in seed/cleanup/expected is in the manifest, and the seed writes every one.
const NS = /7150a000-0000-4000-8000-[0-9a-f]{12}/g;
const seed = process.env.RR_SELFTEST_SEED ? fs.readFileSync(process.env.RR_SELFTEST_SEED, 'utf8') : read('scripts/roster-reports-fixture/seed.sql');
const carrier = read('scripts/roster-reports-fixture/carrier.sql.in');
const cleanup = read('scripts/roster-reports-fixture/cleanup.sql');
for (const [name, text] of [['seed.sql', seed], ['carrier.sql.in', carrier], ['cleanup.sql', cleanup], ['expected.ts', read('e2e/roster-reports/expected.ts')]] as const) {
  const extra = [...new Set(text.match(NS) ?? [])].filter((i) => !ids.includes(i));
  ok(extra.length === 0, `${name}: no id outside the manifest (${extra.join(',')})`);
}
ok(ids.every((i) => seed.includes(i) || carrier.includes(i)), 'carrier.sql.in + seed.sql write every manifest id');
// Carrier: exactly one insert, the RR course only, nonce placeholder; seed no longer inserts that course and requires it.
const carrierIds = [...new Set(carrier.match(NS) ?? [])];
ok(carrierIds.length === 1 && carrierIds[0] === X.RR.course, 'carrier.sql.in touches only the RR course id');
ok((carrier.match(/insert into/gi) ?? []).length === 1 && /'rr-association:__NONCE__'/.test(carrier) && /RR_CARRIER_E_EXISTS/.test(carrier), 'carrier: one insert, nonce placeholder, refuses if present');
ok(!/insert into public\.courses[^;]*'7150a000-0000-4000-8000-000000000001'/is.test(seed), 'seed.sql does not insert the RR course (the carrier does)');
ok(/\^rr-association:\[0-9a-f\]\{32\}\$/.test(seed) && /select 'RR_SEED_OK'/.test(seed), 'seed.sql requires the carrier nonce and prints RR_SEED_OK');
// Committed exact projection equals its derivation from carrier.sql.in + seed.sql.
if (!process.env.RR_SELFTEST_SEED) {
  const derived = execFileSync('python3', ['-I', path.join(ROOT, 'scripts/roster-reports-fixture/tests/gen-expected-seed.py')], { encoding: 'utf8' });
  ok(derived === read('scripts/roster-reports-fixture/expected-seed.txt'), 'expected-seed.txt equals the derivation from carrier + seed');
  ok(derived.split('\n').filter(Boolean).length === 45, 'expected-seed.txt has 45 SEED lines');
}
ok(!/delete from public\.certificates/i.test(cleanup) && /RR_CLEAN_E_CERTIFICATES/.test(cleanup), 'cleanup.sql never deletes certificates; it refuses instead');
ok(ids.every((i) => cleanup.includes(i)), 'cleanup.sql names every manifest id explicitly');
ok(!/\blike\b/i.test(cleanup), 'cleanup.sql uses explicit id lists, no LIKE');
for (const [table, code] of [['progressions', 'PROGRESSIONS'], ['enrollments', 'ENROLLMENTS'], ['content_items', 'ITEMS'], ['modules', 'MODULES'], ['courses', 'COURSES'], ['users', 'USERS']]) {
  ok(new RegExp(`if n <> ${byTable(table).length} then raise exception 'RR_CLEAN_E_${code}`).test(cleanup), `cleanup count check for ${table} = ${byTable(table).length}`);
}

// 3. Independent recomputation from the seed rows (not from product code).
const tuples = (re: RegExp) => [...seed.matchAll(re)];
const modules = new Map(tuples(/\('(7150a000-[^']+)', '(7150a000-[^']+)', '[^']*', \d+, (true|false)\)/g).map((m) => [m[1], { course: m[2], published: m[3] === 'true' }]));
const items = tuples(/\('(7150a000-[^']+)', '(7150a000-[^']+)', '(7150a000-[^']+)', 'page', '[^']*', \d+, (true|false)\)/g)
  .map((m) => ({ id: m[1], course: m[2], module: m[3], published: m[4] === 'true' }));
const enrolls = tuples(/\('(7150a000-0000-4000-8000-0000000003\d\d)', '([^']+)', '(7150a000-[^']+)', now\(\) - interval '(\d+) days'\)/g)
  .map((m) => ({ id: m[1], user: m[2], course: m[3], days: Number(m[4]) }));
const progs = tuples(/\('(7150a000-0000-4000-8000-0000000004\d\d)', '([^']+)', '(7150a000-[^']+)', '(\w+)'\)/g)
  .map((m) => ({ id: m[1], user: m[2], item: m[3], state: m[4] }));
const legacy = new Map(tuples(/\('(7150a000-[^']+)'::uuid, (\d+)\)/g).map((m) => [m[1], Number(m[2])]));
ok(modules.size === 4 && items.length === 8 && enrolls.length === 8 && progs.length === 12 && legacy.size === 8, 'seed parsed: 4 modules, 8 items, 8 enrollments, 12 progressions, 8 legacy values');

const DONE = new Set(['read', 'completed', 'graded']);
function course(courseId: string) {
  const denom = items.filter((i) => i.course === courseId && i.published && modules.get(i.module)?.published).map((i) => i.id);
  const learners = enrolls.filter((e) => e.course === courseId).map((e) => {
    const done = new Set(progs.filter((p) => p.user === e.user && denom.includes(p.item) && DONE.has(p.state)).map((p) => p.item)).size;
    return { ...e, done, total: denom.length, share: denom.length ? done / denom.length : null, legacy: legacy.get(e.id) ?? 0 };
  });
  const known = learners.filter((l) => l.share !== null);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return {
    denom: denom.length, learners,
    enrolled: String(learners.length),
    avg: known.length ? pct(known.reduce((s, l) => s + (l.share as number), 0) / known.length) : '—',
    completed: learners.filter((l) => l.total > 0 && l.done >= l.total).length,
    rate: known.length ? pct(learners.filter((l) => l.total > 0 && l.done >= l.total).length / known.length) : '—',
    notStarted: String(learners.filter((l) => l.total > 0 && l.done === 0 && l.days >= 7).length),
    legacyRate: pct(learners.filter((l) => l.legacy >= 100).length / learners.length),
    legacyAvg: pct(learners.reduce((s, l) => s + l.legacy, 0) / learners.length / 100),
    legacyNotStarted: String(learners.filter((l) => l.legacy === 0 && l.days >= 7).length),
  };
}
const rr = course(X.RR.course);
ok(rr.denom === 4, 'RR denominator is 4 (I5 unpublished and I6 in a draft module excluded)');
ok(rr.enrolled === X.STUDENTS.enrolled && rr.enrolled === X.REPORTS.enrolled, `RR enrolled ${rr.enrolled}`);
ok(rr.avg === X.STUDENTS.avg && rr.avg === X.REPORTS.avg, `RR average ${rr.avg}`);
ok(rr.rate === X.REPORTS.completionRate, `RR completion rate ${rr.rate}`);
ok(X.REPORTS.completionCopy === `${rr.completed} of ${rr.learners.length} learners finished every published lesson.`, 'RR completion copy');
ok(rr.notStarted === X.STUDENTS.notStarted && rr.notStarted === X.REPORTS.notStarted, `RR not started ${rr.notStarted}`);
const name: Record<string, string> = { '7150a000-0000-4000-8000-000000000201': 'Ada Fixture', '7150a000-0000-4000-8000-000000000202': 'Grace Fixture', '7150a000-0000-4000-8000-000000000203': 'Alan Fixture', '7150a000-0000-4000-8000-000000000204': 'Edsger Fixture' };
for (const l of rr.learners) {
  const want = l.user === X.RR.memberId ? X.MEMBER_ROW : X.FIXTURE_LEARNERS.find((f) => f.name === name[l.user]);
  ok(!!want && want.pct === `${Math.round((l.share as number) * 100)}%` && want.title === `${l.done} of ${l.total} lessons finished`, `row oracle for ${name[l.user] ?? 'member'}`);
  if (want && 'notStarted' in want) ok(want.notStarted === (l.done === 0 && l.days >= 7), `not-started flag for ${name[l.user]}`);
}
// Contradiction: every legacy headline differs from the evidence headline.
ok(rr.legacyRate === X.LEGACY.completionRate && rr.legacyRate !== rr.rate, `legacy rate ${rr.legacyRate} differs from ${rr.rate}`);
ok(rr.legacyAvg === X.LEGACY.avg && rr.legacyAvg !== rr.avg, `legacy average ${rr.legacyAvg} differs from ${rr.avg}`);
ok(rr.legacyNotStarted === X.LEGACY.notStarted && rr.legacyNotStarted !== rr.notStarted, `legacy not-started ${rr.legacyNotStarted} differs`);
const empty = course(X.RR.empty);
ok(empty.denom === 0 && empty.avg === '—' && empty.rate === '—' && empty.notStarted === X.EMPTY.notStarted && empty.enrolled === X.EMPTY.enrolled, 'RR_EMPTY is unknown, not 0');
const memberProgs = progs.filter((p) => p.user === X.RR.memberId).map((p) => p.id).sort();
ok(JSON.stringify(memberProgs) === JSON.stringify([...X.RR.memberProgressions]), 'learner oracle: own progression ids');
ok(enrolls.find((e) => e.id === X.RR.memberEnrollment)?.user === X.RR.memberId, 'learner oracle: own enrollment id');
ok(progs.some((p) => p.item === X.RR.item.I8), 'RR_OTHER has a progression row, so a leak to e2e-instructor would be visible');

// 4. Hygiene: no production ref, no password, no DSN on argv; the error spec is not in any default project.
const files = ['scripts/roster-reports-fixture/seed.sql', 'scripts/roster-reports-fixture/run.sh', 'playwright.roster-reports.config.ts',
  ...fs.readdirSync(path.join(ROOT, 'e2e/roster-reports')).map((f) => `e2e/roster-reports/${f}`)];
for (const f of files) {
  const t = read(f);
  ok(!/siuqvhscuiycvdrtiqsh|supabase\.co\b/.test(t), `${f}: no hosted project reference`);
  ok(!/local-only-e2e-password/.test(t), `${f}: no password literal`);
}
const run = read('scripts/roster-reports-fixture/run.sh');
ok(!/psql\s+"\$/.test(run) && !/SUPABASE_DB_URL"/.test(run.replace(/^#.*$/gm, '')), 'run.sh: no DSN on a psql argv');
const cfg = read('playwright.roster-reports.config.ts');
ok(/RR_ERROR_INJECTION === '1'/.test(cfg) && !/testMatch: \[[^\]]*error/.test(cfg.split('// PENDING')[0]), 'error spec only behind RR_ERROR_INJECTION');
ok(!/globalTeardown|webServer:/.test(cfg.replace(/^\/\/.*$/gm, '')), 'config has no teardown and no webServer');

// 5. cases.json: exactly the 11 default (project, case) pairs, each a real spec title prefix; one pending extra.
const cases = JSON.parse(read('scripts/roster-reports-fixture/cases.json'));
const specText = ['instructor.spec.ts', 'admin.spec.ts', 'learner.spec.ts', 'mobile-keyboard.spec.ts', 'error.pending.ts'].map((f) => read(`e2e/roster-reports/${f}`)).join('\n');
const titled = new Set([...specText.matchAll(/(?:test\(['`]|\[')(RR-[A-Z]\d)[ ']/g)].map((m) => m[1]));
ok(cases.default.length === 11 && new Set(cases.default.map((c: string[]) => c.join(' '))).size === 11, 'cases.json: 11 unique default cases');
ok(cases.pendingExtra.length === 1 && cases.pendingExtra[0].join(' ') === 'rr-error-pending RR-P1', 'cases.json: one pending extra');
ok([...cases.default, ...cases.pendingExtra].every((c: string[]) => titled.has(c[1])), `cases.json ids are spec titles (${[...titled].sort().join(',')})`);
ok(titled.size === 12, 'specs carry exactly 12 case ids');

// 6. Request policy: exact allowlist, everything else forbidden before send.
const A = 'http://127.0.0.1:54321';
const cls = (m: string, u: string) => classifyRequest(m, u, A).verdict;
ok(cls('GET', `${A}/rest/v1/courses?select=*`) === 'allow' && cls('HEAD', `${A}/rest/v1/enrollments`) === 'allow', 'policy: GET/HEAD allowed');
ok(cls('POST', `${A}/auth/v1/token?grant_type=password`) === 'allow' && cls('POST', `${A}/auth/v1/token?grant_type=refresh_token`) === 'allow', 'policy: token grants allowed');
ok(cls('POST', `${A}/auth/v1/token?grant_type=pkce`) === 'forbid' && cls('POST', `${A}/auth/v1/logout`) === 'forbid', 'policy: other auth POSTs forbidden');
ok(['has_admin_access', 'is_course_instructor', 'get_user_roles'].every((r) => cls('POST', `${A}/rest/v1/rpc/${r}`) === 'allow'), 'policy: exactly the 3 read RPCs allowed');
ok(cls('POST', `${A}/rest/v1/rpc/log_security_event`) === 'telemetry', 'policy: log_security_event is telemetry');
ok(cls('POST', `${A}/rest/v1/rpc/course_roster_stats`) === 'forbid' && cls('POST', `${A}/rest/v1/rpc/has_admin_access?x=1`) === 'forbid', 'policy: unknown RPC or RPC with a query forbidden');
ok(['POST', 'PATCH', 'PUT', 'DELETE'].every((m) => cls(m, `${A}/rest/v1/enrollments`) === 'forbid'), 'policy: table writes forbidden');
ok(cls('POST', `${A}/storage/v1/object/x`) === 'forbid' && cls('POST', 'not a url') === 'forbid', 'policy: storage write and unparseable forbidden');
ok(cls('POST', 'http://127.0.0.1:8080/x') === 'pass' && cls('POST', 'http://127.0.0.1:54322/rest/v1/x') === 'pass', 'policy: other origins left to the origin guard');

// 7. summarizePlaywright fakes.
const rep = (pairs: string[][], status = 'expected', extra: object = {}) => ({ suites: [{ specs: pairs.map(([p, c]) => ({ title: `${c} title`, tests: [{ projectName: p, status, results: status === 'expected' ? [] : [{ errors: [{ message: 'expect(locator).toHaveText' }] }] }] })) }], ...extra });
const sp = (r: object, exit: number | string, v = 'default') => summarizePlaywright(r, exit, v, cases);
ok(sp(rep(cases.default), 0).ok, 'summary: exact passing inventory passes');
ok(!sp(rep(cases.default.slice(1)), 0).ok, 'summary: omission fails');
ok(sp(rep(cases.default.slice(1)), 0).lines.includes(`MISSING project=${cases.default[0][0]} case=${cases.default[0][1]}`), 'summary: omission is named');
ok(!sp(rep([...cases.default, cases.default[0]]), 0).ok, 'summary: duplicate fails');
ok(!sp(rep([...cases.default, ['rr-admin', 'RR-Z9']]), 0).ok, 'summary: extra fails');
ok(!sp(rep(cases.default.slice(0, 5)), 0).ok, 'summary: all-pass subset fails');
const oneFail = rep(cases.default); (oneFail.suites[0].specs[2].tests[0] as any).status = 'unexpected'; (oneFail.suites[0].specs[2].tests[0] as any).results = [{ errors: [{ message: 'forbidden API requests: POST' }] }];
const of = sp(oneFail, 1);
ok(!of.ok && of.lines.some((l) => /^CASE FAIL project=rr-[a-z-]+ case=RR-[A-Z]\d category=POLICY file=NONE?[a-z.-]* ?line=(NONE|\d+)$|^CASE FAIL project=rr-[a-z-]+ case=RR-[A-Z]\d category=POLICY file=[A-Za-z.-]+ line=(NONE|\d+)$/.test(l)), 'summary: failing case fails with its category');
ok(!sp(rep(cases.default), 1).ok, 'summary: nonzero Playwright exit fails');
ok(!sp(rep(cases.default, 'expected', { errors: [{ message: 'x' }] }), 0).ok, 'summary: global error fails');
ok(!sp(rep(cases.default), 0, 'pending').ok && sp(rep([...cases.default, ...cases.pendingExtra]), 0, 'pending').ok, 'summary: pending variant needs RR-P1');
ok(!sp(rep([...cases.default, ...cases.pendingExtra]), 0).ok, 'summary: RR-P1 in the default variant is an extra');
// Staging grammar (the job stages a file only if every line matches it, at most 64 lines and 4096 bytes).
const STAGE = /^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$/;
ok(String(LINE) === String(STAGE), 'summary.mjs LINE equals the job staging grammar');
const stageable = (ls: string[]) => ls.length <= 64 && Buffer.byteLength(ls.join('\n') + '\n') <= 4096 && ls.every((l) => STAGE.test(l));
const weird = rep([...cases.default.slice(0, 3), ['Evil Project <x>', 'RR-I1']], 'unexpected', { errors: [{ message: 'Error: "quoted" title with spaces' }] });
for (const [what, r] of [['pass', sp(rep(cases.default), 0)], ['omission', sp(rep(cases.default.slice(1)), 0)], ['fail', of],
  ['hostile names', sp(weird, 1)], ['pending', sp(rep([...cases.default, ...cases.pendingExtra]), 0, 'pending')], ['empty', sp({}, 'x')]] as const) {
  ok(stageable(r.lines), `summary lines stageable (${what})`);
}

// 7b. Output-field audit: hostile names never reach output, even names a regex would accept or a plain object would
// resolve ('constructor' -> Object function). Every field comes from a fixed Map or is a computed integer.
const hostile = ['private-marker-abc', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];
for (const h of hostile) {
  const r1 = sp({ suites: [{ specs: [{ title: `${h} title`, tests: [{ projectName: h, status: h, results: [{ errors: [{ message: h, location: { file: `/x/${h}`, line: h } }] }] }] },
    { title: `RR-I1 ${h}`, tests: [{ projectName: 'rr-instructor', status: 'unexpected', results: [{ errors: [{ message: h, location: { file: `/x/${h}.spec.ts`, line: 1e9 } }] }] }] }] }],
    errors: [{ message: h, location: { file: h, line: -1 } }] }, h, h);
  const out = r1.lines.join('\n');
  ok(!r1.ok && !out.includes(h) && !/function|Object|\[object/.test(out) && stageable(r1.lines), `summary audit: '${h}' as project/status/title/file/line/exit/variant never printed`);
}
const loc = sp({ suites: [{ specs: [{ title: 'RR-I1 x', tests: [{ projectName: 'rr-instructor', status: 'unexpected', results: [{ errors: [{ message: 'expect(x).toHaveText', location: { file: '/w/e2e/roster-reports/instructor.spec.ts', line: 42 } }] }] }] }] }] }, 1);
ok(loc.lines.includes('CASE FAIL project=rr-instructor case=RR-I1 category=ASSERTION file=instructor.spec.ts line=42'), 'summary: first error carries a pinned spec file and integer line (privacy-safe stage diagnostic)');
ok(JSON.stringify([...new Set([...cases.default, ...cases.pendingExtra].map((c: string[]) => c[0]))].sort()) === JSON.stringify(['rr-admin', 'rr-error-pending', 'rr-instructor', 'rr-learner'])
  && [...cases.default, ...cases.pendingExtra].every((c: string[]) => sp(rep([c]), 0).lines.some((l) => l === `CASE PASS project=${c[0]} case=${c[1]}`)), 'summary enums: every cases.json project and case is in the fixed maps');
const sumSrc = read('scripts/roster-reports-fixture/summary.mjs').replace(/^\s*\/\/.*$/gm, '');
ok(!/\$\{(t\.projectName|spec\.title|e\.message|variant|pwExit|loc\.file)\}/.test(sumSrc) && !/STATUS\[|PROJECTS\[|CASES\[/.test(sumSrc), 'summary source: no input string interpolated, no bracket lookup on an enum');

// 7c. Reader controls (same-handle bounded reader): FIFO, symlink, mode, nlink, directory, oversize, missing.
{
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rr-reader-'));
  try {
    const f = (n: string, body = 'x\n', mode = 0o600) => { const p = path.join(dir, n); fs.writeFileSync(p, body, { mode }); fs.chmodSync(p, mode); return p; };
    const rc = (fn: () => unknown) => { try { fn(); return 'OK'; } catch (e) { return String((e as Error).message); } };
    const good = f('good');
    ok(rc(() => readBounded(good, 64, { privateFile: true })) === 'OK' && readBounded(good, 64, { privateFile: true }) === 'x\n', 'reader: private 0600 regular file reads');
    const fifo = path.join(dir, 'fifo'); execFileSync('mkfifo', ['-m', '600', fifo]);
    ok(rc(() => readBounded(fifo, 64)) === 'SUMMARY_E_NOT_FILE', 'reader: FIFO refused without blocking (O_NONBLOCK)');
    const link = path.join(dir, 'link'); fs.symlinkSync(good, link);
    ok(rc(() => readBounded(link, 64)) === 'SUMMARY_E_NOT_FILE', 'reader: symlink refused at open (O_NOFOLLOW)');
    ok(rc(() => readBounded(f('open', 'x\n', 0o644), 64, { privateFile: true })) === 'SUMMARY_E_PRIVATE_FILE', 'reader: private input with mode 0644 refused');
    const hl = f('hl'); fs.linkSync(hl, path.join(dir, 'hl2'));
    ok(rc(() => readBounded(hl, 64, { privateFile: true })) === 'SUMMARY_E_PRIVATE_FILE', 'reader: private input with nlink 2 refused');
    ok(rc(() => readBounded(dir, 64)) === 'SUMMARY_E_NOT_FILE', 'reader: directory refused');
    ok(rc(() => readBounded(f('big', 'y'.repeat(65)), 64)) === 'SUMMARY_E_TOO_LARGE', 'reader: oversize refused');
    ok(rc(() => readBounded(path.join(dir, 'missing'), 64)) === 'SUMMARY_E_OPEN', 'reader: missing file refused with a fixed code');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  ok(!fs.existsSync(dir), 'reader scratch dir removed');
}
const runSrc = read('scripts/roster-reports-fixture/run.sh');
ok(/summary\.mjs" witness "\$HERE\/expected-seed\.txt" "\$PRE" "\$PSQ\/witness-post\.txt" "\$POLICY_LOG"/.test(runSrc) && /summary\.mjs" playwright "\$RAW\/playwright\.json"/.test(runSrc), 'run.sh: summary inputs are the private files');
ok(/psql_run\(\) \{ node "\$ROOT\/scripts\/gradebook-fixture\/journey\/private-psql\.mjs" run "\$PSQ" "\$1" "\$PSQ\/\$2"/.test(runSrc) && !/psql_run "[^"]*" "\$RAW/.test(runSrc), 'run.sh: every psql output is inside the private psql dir (private-psql refuses others)');

// 8. compareWitness fakes.
const expSeed = read('scripts/roster-reports-fixture/expected-seed.txt');
const tel = (a: number, i: number, m: number) => `TELEMETRY actor=admin security_events=${a}\nTELEMETRY actor=instructor security_events=${i}\nTELEMETRY actor=member security_events=${m}`;
const W = (seedText: string, cert: string, t: string) => `${seedText}${cert}\n${t}\n`;
const pre = W(expSeed, 'CERT none', tel(0, 0, 0));
const rec = (actor: string, status: string) => ({ rpc: 'log_security_event', actor, status });
const log = (rows: object[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join('');
const L2 = log([rec('instructor', 'success'), rec('member', 'success')]);
ok(compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 1, 1)), L2).ok, 'witness: identical seed and reconciled telemetry pass');
ok(!compareWitness(expSeed, W(expSeed.replace('age_days=30', 'age_days=31'), 'CERT none', tel(0, 0, 0)), W(expSeed.replace('age_days=30', 'age_days=31'), 'CERT none', tel(0, 0, 0)), '').ok, 'witness: seed projection differing from committed fails');
ok(!compareWitness(expSeed, pre, W(expSeed.replace(/ read$/m, ' started'), 'CERT none', tel(0, 0, 0)), '').ok, 'witness: seed changed pre->post fails');
ok(!compareWitness(expSeed, pre, W(expSeed, 'CERT course=x', tel(0, 0, 0)), '').ok, 'witness: certificate change fails');
ok(!compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 2, 1)), L2).ok, 'witness: telemetry delta mismatch fails');
const post11 = W(expSeed, 'CERT none', tel(0, 1, 1));
for (const [what, extra] of [['failed', rec('admin', 'failed')], ['pending', rec('member', 'pending')], ['unknown actor', rec('unknown', 'success')],
  ['unknown actor failed', rec('unknown', 'failed')], ['unknown actor pending', rec('unknown', 'pending')]] as const) {
  const r = compareWitness(expSeed, pre, post11, L2 + log([extra])) as { ok: boolean; verdict?: string; lines: string[] };
  const want = what.startsWith('unknown actor') ? 'FAIL' : 'INCOMPLETE';
  ok(!r.ok && r.verdict === want && r.lines.includes(`WITNESS verdict=${want}`), `witness: a ${what} telemetry record is ${want}, never PASS, even when deltas match`);
  if (want === 'INCOMPLETE') ok(r.lines.some((l) => /^WITNESS TELEMETRY_NONFATAL (FAILED|PENDING) count=1$/.test(l)), `witness: ${what} telemetry reported separately as non-fatal`);
}
ok(!compareWitness(expSeed, pre, post11, `${L2}{"rpc":"log_security_event","actor":"constructor","status":"success"}\n`).ok, 'witness: non-enum actor line is malformed and fails');
ok(!compareWitness(expSeed, pre, post11, `${L2}{"rpc":"log_security_event","actor":"admin","status":"success","x":1}\n`).ok, 'witness: extra field is malformed and fails');
ok(!compareWitness(expSeed, pre, post11, L2.slice(0, -1)).ok, 'witness: a sink without its final newline fails');
ok(!compareWitness(expSeed, pre, post11, log([rec('instructor', 'success')])).ok, 'witness: a delta with no observation (missing) fails');
ok(!compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 1, 0)), L2).ok, 'witness: an observation with no delta fails');
ok(compareWitness(expSeed, pre, pre, '').ok, 'witness: no telemetry and no delta passes (empty sink)');
{
  const inc = compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 2, 1)), L2 + log([rec('instructor', 'failed')])) as { verdict?: string };
  ok(inc.verdict === 'FAIL', 'witness: a failed call that still wrote a row (delta > successes) is a MISMATCH -> FAIL, not explained');
  ok(compareWitness(expSeed, pre, post11, L2).lines.includes('WITNESS TELEMETRY_PROOF scope=counts_per_actor identity=NOT_PROVEN'), 'witness: discloses counts are not event-identity proof');
}
const sumCli = (args: string[]) => { try { execFileSync('node', [path.join(ROOT, 'scripts/roster-reports-fixture/summary.mjs'), ...args], { stdio: 'pipe' }); return 0; } catch (e) { return (e as { status: number }).status; } };
{
  const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rr-cli-'));
  try {
    const w = (n: string, t: string) => { const p = path.join(d, n); fs.writeFileSync(p, t, { mode: 0o600 }); fs.chmodSync(p, 0o600); return p; };
    const e = path.join(ROOT, 'scripts/roster-reports-fixture/expected-seed.txt');
    ok(sumCli(['witness', e, w('pre', pre), w('post', post11), w('sink', L2)]) === 0, 'witness CLI: PASS exits 0');
    ok(sumCli(['witness', e, w('pre2', pre), w('post2', post11), w('sink2', L2 + log([rec('admin', 'pending')]))]) === 4, 'witness CLI: INCOMPLETE exits 4');
    ok(sumCli(['witness', e, w('pre3', pre), w('post3', post11), w('sink3', L2 + log([rec('unknown', 'success')]))]) === 1, 'witness CLI: FAIL exits 1');
    const loose = w('sink4', L2); fs.chmodSync(loose, 0o644);
    ok(sumCli(['witness', e, w('pre4', pre), w('post4', post11), loose]) === 3, 'witness CLI: a non-private sink is an input error (exit 3)');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
ok(!compareWitness('', pre, pre, '').ok, 'witness: empty committed projection fails');
for (const [what, r] of [['pass', compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 1, 1)), L2)],
  ['all failures', compareWitness('', pre, W(expSeed.replace(/ read$/m, ' started'), 'CERT x', tel(3, 0, 0)), L2 + log([rec('unknown', 'success'), rec('admin', 'pending'), rec('admin', 'failed')]) + 'junk\n')],
  ['missing actor', compareWitness(expSeed, W(expSeed, 'CERT none', ''), pre, '')]] as const) ok(stageable(r.lines), `witness lines stageable (${what})`);
// Every fixed line run.sh itself writes into the evidence dir is stageable too.
const echoed = [...read('scripts/roster-reports-fixture/run.sh').matchAll(/echo "(.*)" > "\$OUT\//g)].map((m) => m[1].replace(/\$\([^)]*\)|\$[A-Z_]+/g, '0'));
ok(echoed.length === 7 && echoed.every((l) => STAGE.test(l)), `run.sh evidence lines stageable (${echoed.length})`);
ok(/mktemp -d "\$TMPROOT\/rr-run\.XXXXXXXXXX"/.test(read('scripts/roster-reports-fixture/run.sh')), 'run.sh private parent shape is rr-run.XXXXXXXXXX (the job always() removes it)');

// 8b. Wiring (static): the policy is on every test context and on the session-setup context; the witness emits every
// projection kind the committed file holds, plus CERT and per-actor TELEMETRY, in bytewise order.
const guarded = read('e2e/roster-reports/guarded-test.ts').replace(/^\s*\/\/.*$/gm, '');
ok(/installRequestPolicy\(context, BINDING\.api\.origin/.test(guarded) && /requestPolicy: \[async \(\{ context, originGuard \}/.test(guarded)
  && /expect\(policy\.forbidden, '[^']*'\)\.toEqual\(\[\]\)/.test(guarded) && (guarded.match(/\{ auto: true \}/g) ?? []).length === 2, 'guarded-test: auto request policy after the origin guard, forbidden must be empty');
ok(!/readOnly|page\.on\('request'/.test(guarded), 'guarded-test: no after-the-fact read-only observer');
const setup = read('e2e/roster-reports/session-setup.ts').replace(/^\s*\/\/.*$/gm, '');
ok(/installRequestPolicy\(context, api\.origin/.test(setup) && /if \(policy\.forbidden\.length\) throw/.test(setup), 'session-setup: policy on the setup context, throws on any forbidden request');
ok(/^\s*sinkPath\(\);/m.test(setup) && /lstatSync/.test(setup) && /0o700/.test(setup) && /getuid/.test(setup) && !/RR_POLICY_LOG/.test(setup), 'session-setup: sink path checked before any browser, 0700 own real session dir');
ok(/await policy\.finalize\(\);[^\n]*\n\s*(\/\/[^\n]*\n\s*)*const state = await context\.storageState/.test(setup), 'setup: telemetry finalized before the session state is taken');
const wsql = read('scripts/roster-reports-fixture/witness.sql');
const kinds = [...new Set(read('scripts/roster-reports-fixture/expected-seed.txt').split('\n').filter(Boolean).map((l) => l.split(' ')[1]))].sort();
ok(kinds.join(',') === 'course,enrollment,item,module,profile,progression,user' && kinds.every((k) => wsql.includes(`'SEED ${k} '`)), `witness.sql emits every committed SEED kind (${kinds.join(',')})`);
ok(/'CERT '/.test(wsql) && /'TELEMETRY actor='/.test(wsql) && /order by line collate "C"/.test(wsql) && !/\b(insert|update|delete)\b/i.test(wsql.replace(/^--.*$/gm, '')), 'witness.sql: CERT, TELEMETRY, bytewise order, read-only');
ok(/when description ~ '\^rr-association:\[0-9a-f\]\{32\}\$' then 'ASSOC'/.test(wsql), 'witness.sql: the nonce is projected as ASSOC, never printed');
const helpers = read('e2e/roster-reports/helpers.ts');
ok(/export async function assertRrStudents/.test(helpers) && /export async function assertRrReports/.test(helpers)
  && ['instructor.spec.ts', 'admin.spec.ts'].every((f) => /assertRrStudents\(/.test(read(`e2e/roster-reports/${f}`)) && /assertRrReports\(/.test(read(`e2e/roster-reports/${f}`))), 'instructor and admin share the same Students/Reports assertions');

const A_ORIGIN = 'http://127.0.0.1:54321';
// 8c. The telemetry sink (e2e/roster-reports/actors.mjs), exercised on a scratch private tree that has run.sh's shape.
const sinkCode = (f: () => void) => { try { f(); return 'OK'; } catch (e) { return String((e as Error).message); } };
const mkRun = () => {
  const parent = path.join(fs.realpathSync(os.tmpdir()), `rr-run.${crypto.randomBytes(8).toString('hex').slice(0, 10)}`);
  fs.mkdirSync(parent, { mode: 0o700 }); fs.mkdirSync(path.join(parent, 'session'), { mode: 0o700 });
  const file = path.join(parent, 'session', 'policy.jsonl');
  fs.closeSync(fs.openSync(file, 'wx', 0o600)); fs.chmodSync(file, 0o600);
  return { parent, session: path.join(parent, 'session'), file, env: { RR_SESSION_DIR: path.join(parent, 'session') } };
};
const runs: string[] = [];
const fresh = () => { const r = mkRun(); runs.push(r.parent); return r; };
try {
  const good = fresh();
  ok(sinkPath(good.env) === good.file, 'sink: path is exactly <RR_SESSION_DIR>/policy.jsonl');
  ok(sinkCode(() => appendTelemetry({ rpc: 'log_security_event', actor: 'member', status: 'success', extra: 'dropped' }, good.env)) === 'OK'
    && fs.readFileSync(good.file, 'utf8') === '{"rpc":"log_security_event","actor":"member","status":"success"}\n', 'sink: one canonical line, extra fields dropped');
  ok((fs.statSync(good.file).mode & 0o777) === 0o600 && fs.statSync(good.file).nlink === 1, 'sink: file stays 0600, nlink 1');
  for (const [field, v] of [['actor', 'constructor'], ['actor', 'toString'], ['actor', '__proto__'], ['actor', 'hasOwnProperty'], ['actor', 'other'], ['actor', 'Admin'],
    ['rpc', 'constructor'], ['rpc', 'get_user_roles'], ['status', 'ok'], ['status', '204'], ['status', 'valueOf']] as const) {
    const r = { rpc: 'log_security_event', actor: 'admin', status: 'success', [field]: v };
    ok(sinkCode(() => appendTelemetry(r, good.env)) === 'RR_SINK_E_RECORD', `sink: ${field}=${v} refused (own-key enum)`);
  }
  ok(sinkCode(() => appendTelemetry({ rpc: 'log_security_event', actor: 'admin', status: 204 as unknown as string }, good.env)) === 'RR_SINK_E_RECORD', 'sink: numeric status refused');
  ok(actorOf('constructor') === 'unknown' && actorOf('__proto__') === 'unknown' && actorOf('e2e00000-0000-4000-8000-000000000003') === 'member', 'actorOf: own-key lookup only');
  const R = { rpc: 'log_security_event', actor: 'admin', status: 'success' };
  const neg = (what: string, code: string, setup: (r: ReturnType<typeof mkRun>) => Record<string, string> | void) => {
    const r = fresh(); const env = setup(r) ?? r.env;
    ok(sinkCode(() => appendTelemetry(R, env)) === code, `sink: ${what} -> ${code}`);
  };
  neg('relative root', 'RR_SINK_E_ROOT', () => ({ RR_SESSION_DIR: 'rr-run.abcdefghij/session' }));
  neg('unset root', 'RR_SINK_E_ROOT', () => ({}));
  neg('root not named session', 'RR_SINK_E_ROOT', (r) => { const d = path.join(r.parent, 'other'); fs.mkdirSync(d, { mode: 0o700 }); return { RR_SESSION_DIR: d }; });
  neg('parent not rr-run.XXXXXXXXXX', 'RR_SINK_E_ROOT', (r) => { const p2 = `${r.parent}x`; fs.mkdirSync(p2, { mode: 0o700 }); fs.mkdirSync(path.join(p2, 'session'), { mode: 0o700 }); runs.push(p2); return { RR_SESSION_DIR: path.join(p2, 'session') }; });
  neg('session dir 0755', 'RR_SINK_E_ROOT', (r) => { fs.chmodSync(r.session, 0o755); });
  neg('rr-run parent 0755', 'RR_SINK_E_ROOT', (r) => { fs.chmodSync(r.parent, 0o755); });
  neg('session dir is a symlink', 'RR_SINK_E_ROOT', (r) => { const real = path.join(r.parent, 'real'); fs.renameSync(r.session, real); fs.symlinkSync(real, r.session); });
  neg('non-physical root (trailing slash)', 'RR_SINK_E_ROOT', (r) => ({ RR_SESSION_DIR: `${r.session}/` }));
  neg('file missing (sink never creates)', 'RR_SINK_E_OPEN', (r) => { fs.rmSync(r.file); });
  neg('file is a symlink', 'RR_SINK_E_OPEN', (r) => { const t = path.join(r.session, 't'); fs.renameSync(r.file, t); fs.symlinkSync(t, r.file); });
  neg('file is a FIFO (O_NONBLOCK, no reader)', 'RR_SINK_E_OPEN', (r) => { fs.rmSync(r.file); execFileSync('mkfifo', ['-m', '600', r.file]); });
  neg('file is a directory', 'RR_SINK_E_OPEN', (r) => { fs.rmSync(r.file); fs.mkdirSync(r.file, { mode: 0o700 }); });
  neg('file mode 0644', 'RR_SINK_E_FILE', (r) => { fs.chmodSync(r.file, 0o644); });
  neg('file hard-linked (nlink 2)', 'RR_SINK_E_FILE', (r) => { fs.linkSync(r.file, path.join(r.session, 'hl')); });
  neg('file over the size bound', 'RR_SINK_E_SIZE', (r) => { fs.truncateSync(r.file, MAX_BYTES); });
  const big = fresh(); fs.truncateSync(big.file, MAX_BYTES);
  ok(fs.statSync(big.file).size === MAX_BYTES, 'sink: a refused append leaves the file unchanged');
  const miss = fresh(); fs.rmSync(miss.file); sinkCode(() => appendTelemetry(R, miss.env));
  ok(!fs.existsSync(miss.file), 'sink: a refused append on a missing file creates nothing');
} finally {
  for (const d of runs) fs.rmSync(d, { recursive: true, force: true });
}
ok(runs.every((d) => !fs.existsSync(d)), `sink scratch trees removed and verified absent (${runs.length})`);

// 8c2. Telemetry lifecycle on a fake context: every started request is reported exactly once (success, failed or
// pending) by finalize(); after finalize nothing more is emitted (late completions and late starts are only counted).
{
  const mkPolicy = async (onT?: (r: any) => void) => {
    const handlers: Record<string, Array<(x: any) => any>> = {};
    const ctx = { route: async () => {}, on: (ev: string, f: (x: any) => any) => { (handlers[ev] ??= []).push(f); } };
    const fire = (ev: string, x: any) => Promise.all((handlers[ev] ?? []).map((f) => f(x)));
    const seen: Array<{ rpc: string; actor: string; status: string }> = [];
    const pol: any = await installRequestPolicy(ctx as any, A_ORIGIN, { actorOf, onTelemetry: onT ?? ((r: any) => seen.push(r)) });
    return { fire, seen, pol };
  };
  const mk = (uid: string, status?: number, delayMs = 0) => ({ method: () => 'POST', url: () => `${A_ORIGIN}/rest/v1/rpc/log_security_event`,
    postData: () => JSON.stringify({ p_user_id: uid }),
    response: () => new Promise((r) => setTimeout(() => r(status === undefined ? null : { status: () => status }), delayMs)) });
  const ADMIN = 'e2e00000-0000-4000-8000-000000000001'; const INSTR = 'e2e00000-0000-4000-8000-000000000002'; const MEMBER = 'e2e00000-0000-4000-8000-000000000003';
  const L = await mkPolicy();
  ok(typeof L.pol.finalize === 'function' && typeof L.pol.late === 'object', 'lifecycle: policy exposes finalize() and late counters');
  const ok1 = mk(INSTR, 204); const bad1 = mk(MEMBER, 500); const lost = mk(ADMIN); const open1 = mk(MEMBER); const stranger = mk('nobody', 204);
  const slow = mk(ADMIN, 204, 150); const failMid = mk(INSTR, 204, 150);
  for (const r of [ok1, bad1, lost, open1, stranger, slow, failMid]) await L.fire('request', r);
  await L.fire('requestfinished', ok1); await L.fire('requestfinished', bad1); await L.fire('requestfailed', lost); await L.fire('requestfinished', stranger);
  await L.fire('requestfinished', ok1); // duplicate completion: already settled, ignored
  const slowDone = L.fire('requestfinished', slow); // response still resolving when the deadline hits
  const midDone = L.fire('requestfinished', failMid); await L.fire('requestfailed', failMid); // fails while its response resolves
  if (typeof L.pol.finalize === 'function') await L.pol.finalize(20);
  await L.fire('requestfinished', open1); // late completion of a request already emitted as pending
  await slowDone; await midDone; // the delayed response lands after the freeze
  await L.fire('request', mk(INSTR, 204)); // a new start after the freeze
  if (typeof L.pol.finalize === 'function') await L.pol.finalize(20); // idempotent
  const got = L.seen.map((r) => `${r.actor}:${r.status}`).join(',');
  ok(got === 'instructor:success,member:failed,admin:failed,unknown:success,instructor:failed,member:pending,admin:pending,instructor:failed', `lifecycle: exactly once each; in-flight at deadline -> pending; new start after cutoff -> failed (${got})`);
  ok(L.pol.late?.completions === 3 && L.pol.late?.starts === 1, `lifecycle: frozen after finalize, late events (open1, slow, failMid's late response) only counted (${JSON.stringify(L.pol.late)})`);
  const E2 = await mkPolicy(() => { throw new Error('RR_SINK_E_OPEN'); });
  let leaked = false; // a sink error escaping an event handler (it would be lost as an unhandled rejection)
  const r2 = mk(MEMBER, 204);
  try { await E2.fire('request', r2); await E2.fire('requestfinished', r2); } catch { leaked = true; }
  ok(!leaked, 'lifecycle: a sink error never escapes an event handler');
  let thrown = '';
  try { await E2.pol.finalize?.(20); } catch (e) { thrown = String((e as Error).message); }
  ok(thrown === 'RR_SINK_E_OPEN', 'lifecycle: a sink error is collected and rethrown by finalize (never lost)');
}
// Observation boundary (T 01:09 residual): finalize(empty) -> a NEW telemetry request -> 500 with NO row written.
{
  const handlers: Record<string, Array<(x: any) => any>> = {};
  const routes: Array<(r: any) => any> = [];
  const ctx = { route: async (_p: string, f: (r: any) => any) => { routes.push(f); }, on: (ev: string, f: (x: any) => any) => { (handlers[ev] ??= []).push(f); } };
  const fire = (ev: string, x: any) => Promise.all((handlers[ev] ?? []).map((f) => f(x)));
  const sink: string[] = [];
  const pol: any = await installRequestPolicy(ctx as any, A_ORIGIN, { actorOf, onTelemetry: (r: any) => sink.push(`${JSON.stringify({ rpc: r.rpc, actor: r.actor, status: r.status })}\n`) });
  await pol.finalize(10); // nothing in flight
  const lateReq = { method: () => 'POST', url: () => `${A_ORIGIN}/rest/v1/rpc/log_security_event`, postData: () => JSON.stringify({ p_user_id: 'e2e00000-0000-4000-8000-000000000003' }), response: async () => ({ status: () => 500 }) };
  await fire('request', lateReq);
  let routed = '';
  await routes[0]?.({ request: () => lateReq, abort: async (why: string) => { routed = `abort:${why}`; }, fallback: async () => { routed = 'fallback'; } });
  await fire('requestfinished', lateReq);
  ok(routed === 'abort:blockedbyclient', `boundary: a NEW telemetry call after the cutoff is aborted before send (${routed})`);
  ok(sink.join('') === '{"rpc":"log_security_event","actor":"member","status":"failed"}\n', `boundary: it is written once as failed (${JSON.stringify(sink)})`);
  const v = compareWitness(expSeed, pre, pre, sink.join('')) as { verdict?: string };
  ok(v.verdict === 'INCOMPLETE', `boundary: with the DB unchanged (no row) the witness is NOT PASS (${v.verdict})`);
  let closed = '';
  try { pol.assertClosed?.(); closed = typeof pol.assertClosed === 'function' ? 'OK' : 'NO_ASSERT'; } catch (e) { closed = String((e as Error).message); }
  ok(closed === 'RR_POLICY_E_LATE_START count=1', `boundary: assertClosed fails the caller (${closed})`);
  const u = { ...lateReq, postData: () => JSON.stringify({ p_user_id: 'nobody' }) };
  await fire('request', u);
  ok(compareWitness(expSeed, pre, pre, sink.join('')).verdict === 'FAIL', 'boundary: an unknown-actor late start is FAIL');
  // An already-pending request completing after the cutoff is NOT a new start (stays frozen and idempotent).
  const P = await (async () => {
    const h: Record<string, Array<(x: any) => any>> = {};
    const c2 = { route: async () => {}, on: (ev: string, f: (x: any) => any) => { (h[ev] ??= []).push(f); } };
    const seen: string[] = [];
    const p2: any = await installRequestPolicy(c2 as any, A_ORIGIN, { actorOf, onTelemetry: (r: any) => seen.push(r.status) });
    const r = { ...lateReq, response: async () => ({ status: () => 204 }) };
    for (const f of h.request ?? []) await f(r);
    await p2.finalize(10);
    for (const f of h.requestfinished ?? []) await f(r);
    let ac = 'OK'; try { p2.assertClosed?.(); } catch (e) { ac = String((e as Error).message); }
    return { seen: seen.join(','), late: p2.late, ac };
  })();
  ok(P.seen === 'pending' && P.late.starts === 0 && P.late.completions === 1 && P.ac === 'OK', `boundary: late completion of an already-pending call is not a new start (${JSON.stringify(P)})`);
}
// Setup throw and test failure: finalize runs on every path (static wiring; the browser paths cannot run here).
{
  const ss = read('e2e/roster-reports/session-setup.ts').replace(/^\s*\/\/.*$/gm, '');
  ok(/\} catch \(e\) \{ failure = e; \}\s*\n\s*try \{ if \(policy\) await policy\.finalize\(\); \} catch \(e\) \{ if \(failure === null\) failure = e; \}\s*\n\s*try \{ await browser\.close\(\); \} catch \(e\) \{ if \(failure === null\) failure = e; \}\s*\n\s*try \{ policy\?\.assertClosed\(\); \} catch \(e\) \{ if \(failure === null\) failure = e; \}\s*\n\s*if \(failure !== null\) throw failure;/.test(ss),
    'setup: on every path finalize, then AWAITED browser.close, THEN assertClosed; the first error is kept');
  ok(/try \{ await use\(policy\.forbidden\); \} finally \{\s*\n\s*try \{ await context\.close\(\); \} finally \{ await policy\.finalize\(\); \}\s*\n\s*\}/.test(guarded), 'test fixture: in finally, AWAITED context.close, then finalize');
  ok(/await policy\.finalize\(\); \}\s*\n\s*\}\s*\n\s*policy\.assertClosed\(\);/.test(guarded), 'test fixture: consumes the boundary result AFTER the awaited close');
  ok(/page: async \(\{ page, requestPolicy \}, provide\) => \{\s*\n\s*void requestPolicy;\s*\n\s*await provide\(page\);\s*\n\s*\},/.test(guarded), 'test fixture: lane page depends on requestPolicy (policy lifetime outer to page and consoleErrors)');
}

// 8d. Sink source contract (what a file-level grant cannot itself enforce): exactly one write call, on the checked fd.
const actorsSrc = read('e2e/roster-reports/actors.mjs');
const code8 = actorsSrc.replace(/^\s*\/\/.*$/gm, '');
ok((code8.match(/\bfs\.\w+/g) ?? []).sort().join(',') === 'fs.appendFileSync,fs.closeSync,fs.constants,fs.constants,fs.constants,fs.constants,fs.fstatSync,fs.lstatSync,fs.openSync,fs.realpathSync',
  `sink contract: exactly these fs calls (${(code8.match(/\bfs\.\w+/g) ?? []).sort().join(',')})`);
ok(/fs\.openSync\(p, fs\.constants\.O_WRONLY \| fs\.constants\.O_APPEND \| fs\.constants\.O_NOFOLLOW \| fs\.constants\.O_NONBLOCK\)/.test(code8) && !/O_CREAT|O_TRUNC/.test(code8), 'sink contract: open flags exact, no O_CREAT/O_TRUNC');
ok(/fs\.appendFileSync\(fd, line\)/.test(code8) && (code8.match(/appendFileSync/g) ?? []).length === 1, 'sink contract: the one write goes through the checked descriptor');
ok(/st\.nlink !== 1/.test(code8) && /\(st\.mode & 0o777\) !== 0o600/.test(code8) && /st\.isFile\(\)/.test(code8) && /fs\.closeSync\(fd\)/.test(code8), 'sink contract: same-fd regular/0600/nlink/close');
ok(/Object\.create\(null\)/.test(code8) && /Object\.hasOwn\(map, v\)/.test(code8) && !/\bin (RPCS|ACTORS|STATUSES|ACTOR_IDS)\b/.test(code8), 'sink contract: null-prototype enums with own-key lookup');
ok(/JSON\.stringify\(\{ rpc: rec\.rpc, actor: rec\.actor, status: rec\.status \}\)/.test(code8), 'sink contract: fixed three fields');
ok(!/process\.env\.RR_POLICY_LOG|env\.RR_POLICY_LOG/.test(code8) && /path\.join\(d, SINK_BASENAME\)/.test(code8) && /SINK_BASENAME = 'policy\.jsonl'/.test(code8), 'sink contract: fixed basename under the session root, no env-named file');
const callers = fs.readdirSync(path.join(ROOT, 'e2e/roster-reports')).filter((f) => /appendTelemetry\(/.test(read(`e2e/roster-reports/${f}`)));
ok(callers.sort().join(',') === 'actors.mjs,guarded-test.ts,session-setup.ts', `sink contract: callers are exactly setup and the test fixture (${callers.join(',')})`);

// 8e. PROPOSED exact-file ALLOWED entry (NOT applied; security.yml is unchanged and the gate stays red). It is a
// file-level grant: any write API inside that one file would pass the gate; 8d is what pins the API use.
const PROPOSED = `${/ALLOWED='([^']+)'/.exec(sec8())?.[1]?.replace(/\)$/, '')}|e2e/roster-reports/actors\\.mjs$)`;
function sec8() { return read('.github/workflows/security.yml'); }
const proposed = new RegExp(PROPOSED);
ok(PROPOSED === "^(scripts/|e2e/fixtures/console-errors\\.fixture\\.ts$|src/test/ci/checkLocalTarget\\.test\\.ts$|e2e/roster-reports/actors\\.mjs$)", `proposal: ${PROPOSED}`);
ok(proposed.test('e2e/roster-reports/actors.mjs'), 'proposal: grants exactly e2e/roster-reports/actors.mjs');
for (const n of ['e2e/roster-reports/actors.mjs.bak', 'e2e/roster-reports/actors.mjsx', 'e2e/roster-reports/actors_mjs', 'e2e/roster-reports/Actors.mjs',
  'e2e/roster-reports/request-policy.mjs', 'e2e/roster-reports/guarded-test.ts', 'e2e/roster-reports/session-setup.ts', 'e2e/roster-reports/sub/actors.mjs',
  'e2e/roster-reports-x/actors.mjs', 'xe2e/roster-reports/actors.mjs', 'e2e/gradebook-roles/actors.mjs', 'e2e/roster-reports/actors.ts', 'src/actors.mjs']) {
  ok(!proposed.test(n), `proposal neighbour-negative: ${n} still gated`);
}
// File list for the gate simulation: `git ls-files` (as security.yml uses). With RR_SELFTEST_NO_GIT=1 (a lane where no
// git command may run) it is a filesystem walk instead, which can include untracked files; the mode is printed.
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const walk = (rel: string): string[] => fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).flatMap((d) => {
  const r = rel ? `${rel}/${d.name}` : d.name;
  if (d.isDirectory()) return ['node_modules', '.git', 'dist', 'coverage', 'playwright-report', 'test-results'].includes(d.name) ? [] : walk(r);
  return d.isFile() && SRC_EXT.test(d.name) ? [r] : [];
});
const NO_GIT = process.env.RR_SELFTEST_NO_GIT === '1';
console.log(`INFO gate file list: ${NO_GIT ? 'filesystem walk (RR_SELFTEST_NO_GIT=1; no git command run)' : 'git ls-files'}`);
const tracked = NO_GIT ? walk('') : execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const gateHits = (re: RegExp) => tracked.filter((f) => !re.test(f) && /writeFile|writeFileSync|createWriteStream|appendFile|appendFileSync|Deno\.write/.test(read(f)));
ok(gateHits(new RegExp(/ALLOWED='([^']+)'/.exec(sec8())?.[1] ?? '^$')).join(',') === 'e2e/roster-reports/actors.mjs', 'gate today: RED on exactly e2e/roster-reports/actors.mjs (preserved)');
ok(gateHits(proposed).length === 0, 'gate with the proposal: no hits (only if the exact-file grant is approved)');

// 8f. Session writer: the qualified exclusive private writer, reused unchanged; no path write + chmod afterwards.
{
  const ss = read('e2e/roster-reports/session-setup.ts').replace(/^\s*\/\/.*$/gm, '');
  ok(/import \{ writePrivateFile \} from '\.\.\/gradebook-roles\/journey\/private-dir\.mjs';/.test(ss) && /const state = await context\.storageState\(\);\s*\n\s*writePrivateFile\(dir, `\$\{role\}\.json`, JSON\.stringify\(state\)\);/.test(ss), 'session-setup: storageState() in memory, then writePrivateFile (O_EXCL, 0600)');
  ok(!/storageState\(\{\s*path/.test(ss) && !/chmodSync/.test(ss), 'session-setup: no storageState({ path }) and no after-the-fact chmod');
  ok(/e2e\/gradebook-roles\/journey\/private-dir\.mjs/.test(read('scripts/roster-reports-fixture/PINS.txt')), 'private-dir.mjs is pinned');
}

// 9. run.sh ordering and always-run collection (static).
const code = run.replace(/^\s*#.*$/gm, '');
const at = (re: RegExp) => { const m = re.exec(code); return m ? m.index : -1; };
const order = [/RR_E_PIN\b/, /RR_E_D1_CONSTANT/, /served-app-check\.mjs" "\$E2E_BASE_URL"/, /stack-ownership\.mjs" verify/, /carrier\.sql"/, /RR_E_ASSOC_API/, /seed\.sql" seed\.raw/, /witness\.sql" witness-pre\.txt/, /playwright test/, /summary\.mjs" playwright/, /witness\.sql" witness-post\.txt/, /summary\.mjs" witness/, /^cleanup \|\| true/m, /rr-private\.txt seed\.txt witness\.txt/].map(at);
ok(order.every((x) => x >= 0) && order.every((x, i) => i === 0 || x > order[i - 1]), `run.sh order: pins, D1 constant, served app, D1 verify, carrier, API readback, seed, witness, PW, summary, witness, compare, cleanup, inventory (${order.join(',')})`);
const afterPw = code.slice(at(/playwright test/));
ok(!/refuse /.test(afterPw), 'run.sh: nothing after Playwright refuses (post witness, compare and cleanup always run)');
ok(!/RR_POLICY_LOG/.test(code) && /POLICY_LOG="\$PARENT\/session\/policy\.jsonl"\n: > "\$POLICY_LOG"; chmod 600 "\$POLICY_LOG"/.test(code), 'run.sh: creates the empty 0600 sink at the fixed path; no env names the file');
ok(/\[ "\$\{PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-\}" = "\$GB_SHELL_PATH" \]/.test(code) && /\[ -n "\$\{GB_SHELL_PATH:-\}" \]/.test(code), 'run.sh: pinned shell bound and non-empty');
const pins = read('scripts/roster-reports-fixture/PINS.txt');
const pinned = [...pins.matchAll(/^[0-9a-f]{64} {2}(\S+)$/gm)].map((m) => m[1]);
ok(pinned.length === 11 && pinned.every((f) => code.includes(f)), 'run.sh checks every pinned helper');
ok(/^D1_BOOTSTRAP_SHA256=([0-9a-f]{64})$/m.exec(pins)?.[1] === /^([0-9a-f]{64}) {2}scripts\/local-stack\/bootstrap\.sh$/m.exec(pins)?.[1], 'PINS: D1 constant equals the bootstrap.sh pin');

console.log(`${failures === 0 ? 'PASS' : 'FAIL'} roster-reports fixture selftest: ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);
