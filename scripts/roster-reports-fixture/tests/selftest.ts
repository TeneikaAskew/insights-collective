// ABOUTME: Static FAKE selftest (no stack, no DB, no browser) for the T-15 acceptance fixture: manifest exactness, id
// ABOUTME: containment, cleanup counts, an independent recomputation of the oracle from seed.sql, and source hygiene.
// Run: npx --no-install tsx scripts/roster-reports-fixture/tests/selftest.ts
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as X from '../../../e2e/roster-reports/expected';
import { classifyRequest } from '../../../e2e/roster-reports/request-policy.mjs';
import { summarizePlaywright, compareWitness, LINE } from '../summary.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failures = 0; let checks = 0;
const ok = (cond: boolean, what: string) => { checks += 1; if (!cond) { failures += 1; console.log(`FAIL ${what}`); } };

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
ok(!of.ok && of.lines.some((l) => /^CASE FAIL project=rr-[a-z-]+ case=RR-[A-Z]\d category=POLICY$/.test(l)), 'summary: failing case fails with its category');
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

// 8. compareWitness fakes.
const expSeed = read('scripts/roster-reports-fixture/expected-seed.txt');
const tel = (a: number, i: number, m: number) => `TELEMETRY actor=admin security_events=${a}\nTELEMETRY actor=instructor security_events=${i}\nTELEMETRY actor=member security_events=${m}`;
const W = (seedText: string, cert: string, t: string) => `${seedText}${cert}\n${t}\n`;
const pre = W(expSeed, 'CERT none', tel(0, 0, 0));
const log = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join('\n');
const L2 = log([{ rpc: 'log_security_event', actor: 'instructor', status: 204 }, { rpc: 'log_security_event', actor: 'member', status: 204 }, { rpc: 'log_security_event', actor: 'admin', status: 500 }]);
ok(compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 1, 1)), L2).ok, 'witness: identical seed and reconciled telemetry pass');
ok(!compareWitness(expSeed, W(expSeed.replace('age_days=30', 'age_days=31'), 'CERT none', tel(0, 0, 0)), W(expSeed.replace('age_days=30', 'age_days=31'), 'CERT none', tel(0, 0, 0)), '').ok, 'witness: seed projection differing from committed fails');
ok(!compareWitness(expSeed, pre, W(expSeed.replace(/ read$/m, ' started'), 'CERT none', tel(0, 0, 0)), '').ok, 'witness: seed changed pre->post fails');
ok(!compareWitness(expSeed, pre, W(expSeed, 'CERT course=x', tel(0, 0, 0)), '').ok, 'witness: certificate change fails');
ok(!compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 2, 1)), L2).ok, 'witness: telemetry delta mismatch fails');
ok(!compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 1, 1)), `${L2}\n${log([{ rpc: 'log_security_event', actor: 'other', status: 204 }])}`).ok, 'witness: unattributed telemetry fails');
ok(!compareWitness('', pre, pre, '').ok, 'witness: empty committed projection fails');
for (const [what, r] of [['pass', compareWitness(expSeed, pre, W(expSeed, 'CERT none', tel(0, 1, 1)), L2)],
  ['all failures', compareWitness('', pre, W(expSeed.replace(/ read$/m, ' started'), 'CERT x', tel(3, 0, 0)), `${L2}\n${log([{ rpc: 'log_security_event', actor: 'other', status: 204 }])}`)],
  ['missing actor', compareWitness(expSeed, W(expSeed, 'CERT none', ''), pre, '')]] as const) ok(stageable(r.lines), `witness lines stageable (${what})`);
// Every fixed line run.sh itself writes into the evidence dir is stageable too.
const echoed = [...read('scripts/roster-reports-fixture/run.sh').matchAll(/echo "(.*)" > "\$OUT\//g)].map((m) => m[1].replace(/\$\([^)]*\)|\$[A-Z_]+/g, '0'));
ok(echoed.length === 7 && echoed.every((l) => STAGE.test(l)), `run.sh evidence lines stageable (${echoed.length})`);
ok(/mktemp -d "\$TMPROOT\/rr-run\.XXXXXXXXXX"/.test(read('scripts/roster-reports-fixture/run.sh')), 'run.sh private parent shape is rr-run.XXXXXXXXXX (the job always() removes it)');

// 8b. Wiring (static): the policy is on every test context and on the session-setup context; the witness emits every
// projection kind the committed file holds, plus CERT and per-actor TELEMETRY, in bytewise order.
const guarded = read('e2e/roster-reports/guarded-test.ts').replace(/^\s*\/\/.*$/gm, '');
ok(/installRequestPolicy\(context, BINDING\.api\.origin/.test(guarded) && /requestPolicy: \[async \(\{ context, originGuard \}/.test(guarded)
  && /expect\(forbidden, '[^']*'\)\.toEqual\(\[\]\)/.test(guarded) && (guarded.match(/\{ auto: true \}/g) ?? []).length === 2, 'guarded-test: auto request policy after the origin guard, forbidden must be empty');
ok(!/readOnly|page\.on\('request'/.test(guarded), 'guarded-test: no after-the-fact read-only observer');
const setup = read('e2e/roster-reports/session-setup.ts').replace(/^\s*\/\/.*$/gm, '');
ok(/installRequestPolicy\(context, api\.origin/.test(setup) && /if \(policy\.forbidden\.length\) throw/.test(setup), 'session-setup: policy on the setup context, throws on any forbidden request');
ok(/isAbsolute\(process\.env\.RR_POLICY_LOG/.test(setup) && /lstatSync/.test(setup) && /0o700/.test(setup) && /getuid/.test(setup), 'session-setup: absolute policy log, 0700 own real session dir');
const wsql = read('scripts/roster-reports-fixture/witness.sql');
const kinds = [...new Set(read('scripts/roster-reports-fixture/expected-seed.txt').split('\n').filter(Boolean).map((l) => l.split(' ')[1]))].sort();
ok(kinds.join(',') === 'course,enrollment,item,module,profile,progression,user' && kinds.every((k) => wsql.includes(`'SEED ${k} '`)), `witness.sql emits every committed SEED kind (${kinds.join(',')})`);
ok(/'CERT '/.test(wsql) && /'TELEMETRY actor='/.test(wsql) && /order by line collate "C"/.test(wsql) && !/\b(insert|update|delete)\b/i.test(wsql.replace(/^--.*$/gm, '')), 'witness.sql: CERT, TELEMETRY, bytewise order, read-only');
ok(/when description ~ '\^rr-association:\[0-9a-f\]\{32\}\$' then 'ASSOC'/.test(wsql), 'witness.sql: the nonce is projected as ASSOC, never printed');
const helpers = read('e2e/roster-reports/helpers.ts');
ok(/export async function assertRrStudents/.test(helpers) && /export async function assertRrReports/.test(helpers)
  && ['instructor.spec.ts', 'admin.spec.ts'].every((f) => /assertRrStudents\(/.test(read(`e2e/roster-reports/${f}`)) && /assertRrReports\(/.test(read(`e2e/roster-reports/${f}`))), 'instructor and admin share the same Students/Reports assertions');

// 9. run.sh ordering and always-run collection (static).
const code = run.replace(/^\s*#.*$/gm, '');
const at = (re: RegExp) => { const m = re.exec(code); return m ? m.index : -1; };
const order = [/RR_E_PIN\b/, /RR_E_D1_CONSTANT/, /served-app-check\.mjs" "\$E2E_BASE_URL"/, /stack-ownership\.mjs" verify/, /carrier\.sql"/, /RR_E_ASSOC_API/, /seed\.sql" "\$RAW\/seed\.raw"/, /witness-pre\.txt" witness-pre/, /playwright test/, /summary\.mjs" playwright/, /witness-post\.txt" witness-post/, /summary\.mjs" witness/, /^cleanup \|\| true/m, /rr-private\.txt seed\.txt witness\.txt/].map(at);
ok(order.every((x) => x >= 0) && order.every((x, i) => i === 0 || x > order[i - 1]), `run.sh order: pins, D1 constant, served app, D1 verify, carrier, API readback, seed, witness, PW, summary, witness, compare, cleanup, inventory (${order.join(',')})`);
const afterPw = code.slice(at(/playwright test/));
ok(!/refuse /.test(afterPw), 'run.sh: nothing after Playwright refuses (post witness, compare and cleanup always run)');
ok(/\[ "\$\{PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-\}" = "\$GB_SHELL_PATH" \]/.test(code) && /\[ -n "\$\{GB_SHELL_PATH:-\}" \]/.test(code), 'run.sh: pinned shell bound and non-empty');
const pins = read('scripts/roster-reports-fixture/PINS.txt');
const pinned = [...pins.matchAll(/^[0-9a-f]{64} {2}(\S+)$/gm)].map((m) => m[1]);
ok(pinned.length === 10 && pinned.every((f) => code.includes(f)), 'run.sh checks every pinned helper');
ok(/^D1_BOOTSTRAP_SHA256=([0-9a-f]{64})$/m.exec(pins)?.[1] === /^([0-9a-f]{64}) {2}scripts\/local-stack\/bootstrap\.sh$/m.exec(pins)?.[1], 'PINS: D1 constant equals the bootstrap.sh pin');

console.log(`${failures === 0 ? 'PASS' : 'FAIL'} roster-reports fixture selftest: ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);
