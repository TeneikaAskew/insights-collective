// ABOUTME: Static FAKE selftest (no stack, no DB, no browser) for the T-15 acceptance fixture: manifest exactness, id
// ABOUTME: containment, cleanup counts, an independent recomputation of the oracle from seed.sql, and source hygiene.
// Run: npx --no-install tsx scripts/roster-reports-fixture/tests/selftest.ts
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as X from '../../../e2e/roster-reports/expected';
import { classifyRequest, installRequestPolicy, forbiddenCategory, forbiddenMessage, FORBIDDEN_KEEP, COUNT_CAP } from '../../../e2e/roster-reports/request-policy.mjs';
import * as ActorsModule from '../../../e2e/roster-reports/actors.mjs';
import os from 'node:os';
import crypto from 'node:crypto';
import { summarizePlaywright, compareWitness as compareWitnessRaw, LINE, readBounded, classifyCode, phase, playwrightSummary, OWN_CODES, ownCode } from '../summary.mjs';

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
const PS_BODY_SHA256 = '196a799acbc0451f86ccd11a69c3a4f044274230c2c9fa810751a47308caf98d'; // schema/03_functions.sql platform_stats() as reviewed (lines 1797-1813)
const cls = (m: string, u: string) => classifyRequest(m, u, A).verdict;
ok(cls('GET', `${A}/rest/v1/courses?select=*`) === 'allow' && cls('HEAD', `${A}/rest/v1/enrollments`) === 'allow', 'policy: GET/HEAD allowed');
ok(cls('POST', `${A}/auth/v1/token?grant_type=password`) === 'allow' && cls('POST', `${A}/auth/v1/token?grant_type=refresh_token`) === 'allow', 'policy: token grants allowed');
ok(cls('POST', `${A}/auth/v1/token?grant_type=pkce`) === 'forbid' && cls('POST', `${A}/auth/v1/logout`) === 'forbid', 'policy: other auth POSTs forbidden');
ok(['has_admin_access', 'is_course_instructor', 'get_user_roles', 'platform_stats'].every((r) => cls('POST', `${A}/rest/v1/rpc/${r}`) === 'allow'), 'policy: exactly the 4 read RPCs allowed');
ok(cls('POST', `${A}/rest/v1/rpc/log_security_event`) === 'telemetry', 'policy: log_security_event is telemetry');
ok(cls('POST', `${A}/rest/v1/rpc/course_roster_stats`) === 'forbid' && cls('POST', `${A}/rest/v1/rpc/has_admin_access?x=1`) === 'forbid', 'policy: unknown RPC or RPC with a query forbidden');
ok(['POST', 'PATCH', 'PUT', 'DELETE'].every((m) => cls(m, `${A}/rest/v1/enrollments`) === 'forbid'), 'policy: table writes forbidden');
ok(cls('POST', `${A}/storage/v1/object/x`) === 'forbid' && cls('POST', 'not a url') === 'forbid', 'policy: storage write and unparseable forbidden');
ok(cls('POST', 'http://127.0.0.1:8080/x') === 'pass' && cls('POST', 'http://127.0.0.1:54322/rest/v1/x') === 'pass', 'policy: other origins left to the origin guard');

// 6b. platform_stats read contract (runs 41579692950: setup refused POST rpc/platform_stats from Index's CTASection).
// Exactly POST <api>/rest/v1/rpc/platform_stats with no query is allowed; every neighbour keeps its old verdict. The
// allowance is tied to the reviewed function: if the pinned identity, grant, or body changes, these checks fail.
{
  const PS = `${A}/rest/v1/rpc/platform_stats`;
  const v = (m: string, u: string) => classifyRequest(m, u, A);
  ok(JSON.stringify(v('POST', PS)) === '{"verdict":"allow","kind":"read-rpc:platform_stats"}', 'platform_stats: exact POST, no query -> allow (read-rpc)');
  for (const [m, u, want] of [
    ['POST', `${PS}?x=1`, 'forbid'], ['POST', `${PS}?`, 'allow'], ['POST', `${PS}/`, 'forbid'], ['POST', `${PS}/x`, 'forbid'], ['POST', `${A}/rest/v1/rpc/Platform_Stats`, 'forbid'],
    ['POST', `${A}/rest/v1/rpc/platform_statsx`, 'forbid'], ['POST', `${A}/rest/v1/rpc/platform_stats_x`, 'forbid'], ['POST', `${A}/rest/v1/rpc/%70latform_stats`, 'forbid'],
    ['POST', `${A}/rest/v1/rpc/xplatform_stats`, 'forbid'], ['POST', `${A}/rest/v1/platform_stats`, 'forbid'], ['POST', `${A}/rest/v1/rpc/rpc/platform_stats`, 'forbid'],
    ['PATCH', PS, 'forbid'], ['PUT', PS, 'forbid'], ['DELETE', PS, 'forbid'], ['OPTIONS', PS, 'forbid'], ['BREW', PS, 'forbid'],
    ['GET', PS, 'allow'], ['HEAD', PS, 'allow'],
    ['POST', `${A}/rest/v1/rpc/log_audit_event`, 'forbid'], ['POST', `${A}/rest/v1/rpc/admin_user_role_counts`, 'forbid'], ['POST', `${A}/rest/v1/rpc/course_roster_stats`, 'forbid'],
    ['POST', `${A}/rest/v1/rpc/start_quiz_attempt`, 'forbid'], ['POST', `${A}/rest/v1/rpc/update_user_roles`, 'forbid'], ['POST', `${A}/rest/v1/rpc/get_course_stats`, 'forbid'],
    ['POST', 'http://127.0.0.1:9999/rest/v1/rpc/platform_stats', 'pass'],
  ] as const) ok(v(m, u).verdict === want, `platform_stats neighbour: ${m} ${u.replace(A, '<api>')} -> ${want} (${v(m, u).verdict})`);
  // GET/HEAD were already allowed by the pre-existing read rule for every API path (unchanged); '?' alone is an empty
  // search in WHATWG URL, the same request as no query. Neither is new.
  ok(JSON.stringify(Object.keys(Object.fromEntries((read('e2e/roster-reports/request-policy.mjs').match(/export const READ_RPCS = Object\.freeze\(\[([^\]]*)\]\)/)?.[1] ?? '').split(',').map((x) => [x.trim(), 1])))) === JSON.stringify(["'has_admin_access'", "'is_course_instructor'", "'get_user_roles'", "'platform_stats'"]), 'platform_stats: READ_RPCS is exactly the 3 old names plus platform_stats');
  // Pins: the allowance holds only for the reviewed function.
  const idt = read('scripts/local-stack/schema/identities.tsv');
  ok(/^function\tplatform_stats\(\)\t5ab548ca2f14e912efbc0473165fd0f0$/m.test(idt) && /^function_grant\tplatform_stats\(\)\t85d64555c4ac4794b09b15e3a29b64af$/m.test(idt), 'platform_stats pin: identities.tsv function and grant signatures unchanged');
  const fn = read('scripts/local-stack/schema/03_functions.sql');
  const body = /CREATE OR REPLACE FUNCTION public\.platform_stats\(\)[\s\S]*?\$function\$\n;/.exec(fn)?.[0] ?? '';
  ok(crypto.createHash('sha256').update(body).digest('hex') === PS_BODY_SHA256 && /^ RETURNS TABLE\(published_courses integer, community_members integer, avg_completion integer\)\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\n/m.test(body)
    && !/\b(insert|update|delete|merge|truncate|nextval|setval|set_config|pg_notify|perform|execute)\b/i.test(body.replace(/--[^\n]*/g, '')), `platform_stats pin: local-stack body is the reviewed zero-arg STABLE SELECT-only aggregate (sha256 ${crypto.createHash('sha256').update(body).digest('hex').slice(0, 16)})`);
  ok(/^revoke all on function public\.platform_stats\(\) from public, anon, authenticated; grant execute on function public\.platform_stats\(\) to anon; grant execute on function public\.platform_stats\(\) to authenticated; grant execute on function public\.platform_stats\(\) to service_role;$/m.test(read('scripts/local-stack/schema/05_triggers_grants.sql')), 'platform_stats pin: local-stack grant line unchanged');
  const migs = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql') && fs.statSync(path.join(ROOT, 'supabase/migrations', f)).isFile() && /platform_stats/.test(read(`supabase/migrations/${f}`)));
  ok(migs.join(',') === '20260809000000_public_platform_stats.sql', `platform_stats pin: exactly one migration defines it (${migs.join(',')})`);
}

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
// 7d. Report framing (run 41613979959: SUMMARY_E_INPUT). run.sh captures the whole Playwright stdout as the JSON report and
// summary.mjs parses that file whole, so (a) no lane code that runs in the runner process may write to stdout, and (b) each
// CLI phase refuses with its own fixed code: cases JSON, report JSON, report reducer, witness reducer. The parser is NOT
// made tolerant: a framed report still fails, now as SUMMARY_E_REPORT_JSON, and no input text reaches the output.
{
  const casesText = read('scripts/roster-reports-fixture/cases.json');
  const goodReport = JSON.stringify(rep(cases.default));
  const SETUP_LINE = '[roster-reports setup] association proven; admin, instructor and member sessions saved\n';
  const code = (fn: () => unknown) => { try { fn(); return 'OK'; } catch (e) { return String((e as Error).message); } };
  const viaPhase = playwrightSummary(casesText, goodReport, 0, 'default');
  ok(viaPhase.ok && JSON.stringify(viaPhase.lines) === JSON.stringify(sp(rep(cases.default), 0).lines), 'phases: a clean report gives exactly the reducer result');
  ok(code(() => playwrightSummary(casesText, SETUP_LINE + goodReport, 0, 'default')) === 'SUMMARY_E_REPORT_JSON', 'phases: a stdout line before the report is SUMMARY_E_REPORT_JSON (not tolerated)');
  ok(code(() => playwrightSummary(casesText, goodReport + '\nlate stdout\n', 0, 'default')) === 'SUMMARY_E_REPORT_JSON', 'phases: a stdout line after the report is SUMMARY_E_REPORT_JSON');
  ok(code(() => playwrightSummary(casesText, '', 0, 'default')) === 'SUMMARY_E_REPORT_JSON', 'phases: an empty report is SUMMARY_E_REPORT_JSON');
  ok(code(() => playwrightSummary('{"default": [', goodReport, 0, 'default')) === 'SUMMARY_E_CASES_JSON', 'phases: unparseable cases.json is SUMMARY_E_CASES_JSON');
  ok(code(() => playwrightSummary('{}', goodReport, 0, 'default')) === 'SUMMARY_E_REPORT_REDUCER', 'phases: a reducer throw (cases without default) is SUMMARY_E_REPORT_REDUCER');
  ok(code(() => playwrightSummary('{"default": [', 'x' + goodReport, 0, 'default')) === 'SUMMARY_E_CASES_JSON', 'phases: cases.json is classified before the report');
  ok(code(() => phase('SUMMARY_E_WITNESS_REDUCER', () => { throw new Error('SUMMARY_E_TELEMETRY_SHAPE'); })) === 'SUMMARY_E_TELEMETRY_SHAPE', 'phases: an inner SUMMARY_E code passes through unchanged');
  ok(code(() => phase('SUMMARY_E_WITNESS_REDUCER', () => { throw new TypeError('secret-marker /private/path'); })) === 'SUMMARY_E_WITNESS_REDUCER', 'phases: a foreign throw becomes the phase code, its message dropped');
  ok(code(() => phase('SUMMARY_E_REPORT_JSON', () => { throw new Error('SUMMARY_E_x lower'); })) === 'SUMMARY_E_REPORT_JSON', 'phases: a near-miss code is not passed through');
  // r3 (safety hold 10:19): pass-through is a FINITE set, not a pattern. Every genuine code passes both boundaries;
  // a matching-looking foreign message (prefix, long, constructor-like, non-Error) never does.
  const GENUINE = ['SUMMARY_E_OPEN', 'SUMMARY_E_NOT_FILE', 'SUMMARY_E_PRIVATE_FILE', 'SUMMARY_E_TOO_LARGE', 'SUMMARY_E_TELEMETRY_SHAPE', 'SUMMARY_E_CASES_JSON', 'SUMMARY_E_REPORT_JSON', 'SUMMARY_E_REPORT_REDUCER', 'SUMMARY_E_WITNESS_REDUCER'];
  ok(OWN_CODES.size === GENUINE.length && GENUINE.every((g) => OWN_CODES.has(g)), 'own codes: exactly the reader, telemetry and phase codes');
  const sumCodes = [...new Set(read('scripts/roster-reports-fixture/summary.mjs').match(/SUMMARY_E_[A-Z_]+/g) ?? [])].filter((c) => c !== 'SUMMARY_E_INPUT' && c !== 'SUMMARY_E_USAGE');
  ok(sumCodes.every((c) => OWN_CODES.has(c)) && sumCodes.length === OWN_CODES.size, `own codes: every code summary.mjs can throw is in the set and nothing else (${sumCodes.length})`);
  for (const g of GENUINE) ok(code(() => phase('SUMMARY_E_REPORT_JSON', () => { throw new Error(g); })) === g && ownCode(new Error(g)) === g, `genuine code passes both boundaries (${g})`);
  const FOREIGN: [string, unknown][] = [['matching prefix', new Error('SUMMARY_E_SYNTHETIC_PRIVATE_MARKER')], ['long', new Error('SUMMARY_E_' + 'A'.repeat(1000))],
    ['genuine plus suffix', new Error('SUMMARY_E_OPEN_X')], ['genuine with trailing newline', new Error('SUMMARY_E_OPEN\n')], ['constructor', new Error('constructor')],
    ['__proto__', new Error('__proto__')], ['non-Error object', { message: 'SUMMARY_E_OPEN' }], ['string throw', 'SUMMARY_E_OPEN']];
  for (const [what, thrown] of FOREIGN) {
    ok(code(() => phase('SUMMARY_E_WITNESS_REDUCER', () => { throw thrown; })) === 'SUMMARY_E_WITNESS_REDUCER', `phase: foreign ${what} becomes the phase code`);
    ok(ownCode(thrown) === null, `CLI catch: foreign ${what} is not an own code (falls back to SUMMARY_E_INPUT)`);
  }
  const sumSrc2 = read('scripts/roster-reports-fixture/summary.mjs').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\/\^SUMMARY_E_\[A-Z_\]\+\$\//.test(sumSrc2) && (sumSrc2.match(/ownCode\(e\)/g) ?? []).length === 2, 'summary source: no pattern-based pass-through; ownCode at both exception-to-output boundaries');
  // CLI end to end on private 0600 files: stdout is exactly one fixed code, exit 3; the clean report still summarises.
  const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rr-frame-'));
  try {
    const w = (n: string, t: string) => { const p = path.join(d, n); fs.writeFileSync(p, t, { mode: 0o600 }); fs.chmodSync(p, 0o600); return p; };
    const cli = (args: string[]) => { try { return { rc: 0, out: execFileSync('node', [path.join(ROOT, 'scripts/roster-reports-fixture/summary.mjs'), ...args], { stdio: 'pipe' }).toString() }; } catch (e) { const x = e as { status: number; stdout: Buffer }; return { rc: x.status, out: String(x.stdout) }; } };
    const framed = cli(['playwright', w('framed.json', SETUP_LINE + goodReport), '0', 'default']);
    ok(framed.rc === 3 && framed.out === 'SUMMARY_E_REPORT_JSON\n', `CLI: the run's framing (setup line + report) is exit 3 SUMMARY_E_REPORT_JSON (got ${framed.rc})`);
    ok(!framed.out.includes('roster-reports setup') && !framed.out.includes(d), 'CLI: no input text or path in the refusal');
    const clean = cli(['playwright', w('clean.json', goodReport), '0', 'default']);
    ok(clean.rc === 0 && clean.out.trim().split('\n').every((l) => STAGE.test(l)) && /PLAYWRIGHT exit=0 global_errors=0 verdict=PASS$/.test(clean.out.trim()), 'CLI: a clean report summarises (exit 0, stageable)');
    const loose = w('loose.json', goodReport); fs.chmodSync(loose, 0o644);
    ok(cli(['playwright', loose, '0', 'default']).out === 'SUMMARY_E_PRIVATE_FILE\n', 'CLI: the private-file guard on the report is unchanged');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
  for (const c of ['SUMMARY_E_CASES_JSON', 'SUMMARY_E_REPORT_JSON', 'SUMMARY_E_REPORT_REDUCER', 'SUMMARY_E_WITNESS_REDUCER']) ok(STAGE.test(c), `phase code stageable (${c})`);
  // Producer side: lane code that runs in the Playwright runner process (config, global setup and their lane imports) never
  // writes to stdout. Specs and fixtures run in workers, whose stdout the JSON reporter captures into the report instead.
  const noStdout = (rel: string) => !/\bconsole\.(log|info|debug|dir|table)\s*\(|process\.stdout\b/.test(read(rel).replace(/^\s*\/\/.*$/gm, ''));
  for (const rel of ['playwright.roster-reports.config.ts', 'e2e/roster-reports/session-setup.ts', 'e2e/roster-reports/request-policy.mjs', 'e2e/roster-reports/actors.mjs', 'e2e/roster-reports/expected.ts']) {
    ok(noStdout(rel), `producer: ${rel} writes nothing to stdout (the JSON report owns it)`);
  }
  ok(/--reporter=json --output="\$RAW\/test-results"\) > "\$RAW\/playwright\.json" 2> "\$RAW\/playwright\.err"/.test(read('scripts/roster-reports-fixture/run.sh')), 'run.sh: stdout is the report and stderr is private (contract the producer checks rely on)');
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
ok(/installRequestPolicy\(context, BINDING\.api\.origin/.test(guarded) && /requestPolicy: \[async \(\{ context, originGuard \}, use, testInfo\)/.test(guarded)
  && /const refusal = policy\.forbiddenReport\('test', actorOfProject\(testInfo\.project\.name\)\);\s*\n\s*if \(refusal\) throw new Error\(refusal\);/.test(guarded) && (guarded.match(/\{ auto: true \}/g) ?? []).length === 2, 'guarded-test: auto request policy after the origin guard, forbidden must be empty');
ok(!/readOnly|page\.on\('request'/.test(guarded), 'guarded-test: no after-the-fact read-only observer');
const setup = read('e2e/roster-reports/session-setup.ts').replace(/^\s*\/\/.*$/gm, '');
ok(/installRequestPolicy\(context, api\.origin/.test(setup) && /const refusal = policy\.forbiddenReport\('setup', role\);\s*\n\s*if \(refusal\) throw new Error\(refusal\);/.test(setup), 'session-setup: policy on the setup context, throws a fixed code on any forbidden request');
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
  // Existing file: the explicit 0o600 open argument changes nothing on an existing file (no O_CREAT): an existing 0600
  // file is appended and stays 0600 / nlink 1 even under a permissive umask.
  { const r = fresh(); const prev = process.umask(0); try { ok(sinkCode(() => appendTelemetry(R, r.env)) === 'OK' && (fs.statSync(r.file).mode & 0o777) === 0o600 && fs.statSync(r.file).nlink === 1 && fs.statSync(r.file).size > 0, 'sink: existing 0600 file appended, mode/nlink unchanged (umask 0)'); } finally { process.umask(prev); } }
  { const r = fresh(); fs.rmSync(r.file); const prev = process.umask(0); try { ok(sinkCode(() => appendTelemetry(R, r.env)) === 'RR_SINK_E_OPEN' && !fs.existsSync(r.file), 'sink: absent file -> RR_SINK_E_OPEN and still not created (umask 0)'); } finally { process.umask(prev); } }
  // Wrong owner needs chown, which only root can do; elsewhere these are reported as SKIPPED, never as passed.
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    neg('file owned by another uid', 'RR_SINK_E_FILE', (r) => { fs.chownSync(r.file, 65534, 65534); });
    neg('session dir owned by another uid', 'RR_SINK_E_ROOT', (r) => { fs.chownSync(r.session, 65534, 65534); });
    neg('rr-run parent owned by another uid', 'RR_SINK_E_ROOT', (r) => { fs.chownSync(r.parent, 65534, 65534); });
  } else {
    console.log('INFO sink: wrong-owner controls SKIPPED (not root; chown unavailable)');
  }
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

// 8c3. Actor attribution on the 'request' handler (CodeQL 625 fix: dead initializer removed). Every path yields the
// same actor as before: actorOf's own result on success; 'unknown' when actorOf throws, postData is unparseable, or
// postData is absent; and actorOf receives String(p_user_id ?? '') exactly.
{
  const KNOWN = 'e2e00000-0000-4000-8000-000000000002';
  const attribution = async (postData: () => string | null, actorOfFn: (id: string) => string) => {
    const handlers: Record<string, Array<(x: any) => any>> = {};
    const ctx = { route: async () => {}, on: (ev: string, f: (x: any) => any) => { (handlers[ev] ??= []).push(f); } };
    const seen: Array<{ rpc: string; actor: string; status: string }> = [];
    const pol: any = await installRequestPolicy(ctx as any, A_ORIGIN, { actorOf: actorOfFn, onTelemetry: (r: any) => seen.push(r) });
    const req = { method: () => 'POST', url: () => `${A_ORIGIN}/rest/v1/rpc/log_security_event`, postData, response: async () => ({ status: () => 204 }) };
    for (const f of handlers.request ?? []) f(req);
    for (const f of handlers.requestfinished ?? []) await f(req);
    await pol.finalize(0);
    return seen;
  };
  const args: string[] = [];
  const spy = (id: string) => { args.push(id); return actorOf(id); };
  const cases: Array<[string, () => string | null, (id: string) => string, string, string | null]> = [
    ['known actor', () => JSON.stringify({ p_user_id: KNOWN }), spy, 'instructor', KNOWN],
    ['unmapped id', () => JSON.stringify({ p_user_id: 'nobody' }), spy, 'unknown', 'nobody'],
    ['actorOf throws', () => JSON.stringify({ p_user_id: KNOWN }), () => { throw new Error('boom'); }, 'unknown', null],
    ['unparseable postData', () => '{not json', spy, 'unknown', null],
    ['missing p_user_id', () => JSON.stringify({}), spy, 'unknown', ''],
    ['null postData', () => null, spy, 'unknown', ''],
    ['numeric p_user_id is stringified', () => JSON.stringify({ p_user_id: 7 }), spy, 'unknown', '7'],
  ];
  for (const [name, pd, fn, want, wantArg] of cases) {
    args.length = 0;
    const seen = await attribution(pd, fn);
    ok(seen.length === 1 && seen[0].actor === want && seen[0].status === 'success' && seen[0].rpc === 'log_security_event',
      `attribution: ${name} -> ${want} (${JSON.stringify(seen)})`);
    ok(wantArg === null ? args.length === 0 : args.length === 1 && args[0] === wantArg, `attribution: ${name} passes ${JSON.stringify(wantArg)} to actorOf (${JSON.stringify(args)})`);
  }
  const rp = read('e2e/roster-reports/request-policy.mjs').replace(/^\s*\/\/.*$/gm, '');
  ok(/let actor;\n\s*try \{ actor = /.test(rp) && /catch \{ actor = 'unknown'; \}/.test(rp) && !/let actor = 'unknown'/.test(rp), 'attribution: no dead initializer; the catch assigns unknown');
}

// 8c4. Refusal diagnostics (run 41576138960: setup:80 forbidden throw printed as first=OTHER, because the classifier's
// literal 'forbidden API requests' never matched the thrown 'request(s)'). Every setup/test refusal is now a FIXED code
// with fixed-enum or integer fields; summary.mjs classifies it; nothing derived from a URL, path, id or token is printed.
{
  const OLD_MSG = 'Error: roster-reports setup: 2 forbidden API request(s) were aborted before send';
  const g = (message: string, file = '/w/e2e/roster-reports/session-setup.ts', line = 80) =>
    sp(rep(cases.default, 'expected', { errors: [{ message, location: { file, line } }] }), 1).lines.find((l) => l.startsWith('PLAYWRIGHT ')) ?? '';
  ok(g(OLD_MSG) === 'PLAYWRIGHT exit=1 global_errors=1 first=OTHER file=session-setup.ts line=80 verdict=FAIL', `diag: the run's OLD message replays as first=OTHER (${g(OLD_MSG)})`);
  const NEW_MSG = 'Error: RR_POLICY_E_FORBIDDEN scope=setup actor=admin count=2 distinct=1 method=POST resource=rpc rpc=platform_stats';
  ok(g(NEW_MSG) === 'PLAYWRIGHT exit=1 global_errors=1 first=RR_POLICY_E_FORBIDDEN scope=setup actor=admin count=2 distinct=1 method=POST resource=rpc rpc=platform_stats file=session-setup.ts line=80 verdict=FAIL',
    `diag: the NEW setup refusal is classified with its fixed fields (${g(NEW_MSG)})`);
  // Every code the setup and test fixture can throw is in summary's CODES (none falls back to OTHER/RR_UNKNOWN_CODE).
  const setupSrc = read('e2e/roster-reports/session-setup.ts'); const guardedSrc = read('e2e/roster-reports/guarded-test.ts');
  const thrown = [...new Set([...`${setupSrc}\n${guardedSrc}`.matchAll(/new Error\(['`](RR_[A-Z_]+)/g)].map((m) => m[1]))].sort();
  ok(thrown.join(',') === 'RR_SETUP_E_APP_API,RR_SETUP_E_ASSOCIATION,RR_SETUP_E_NONCE,RR_SETUP_E_ORIGIN,RR_SETUP_E_PASSWORD,RR_SETUP_E_SESSION_DIR,RR_SETUP_E_SESSION_STATE,RR_SETUP_E_SIGNIN,RR_TEST_E_ORIGIN', `diag: fixed codes thrown by setup/test (${thrown.join(',')})`);
  for (const c of [...thrown, 'RR_POLICY_E_FORBIDDEN', 'RR_POLICY_E_LATE_START', 'RR_SINK_E_ROOT', 'RR_SINK_E_WRITE', 'RR_SINK_E_UNKNOWN']) ok(classifyCode(`Error: ${c}`) === c, `diag: ${c} classified as itself`);
  ok(!/new Error\((['"`])(?!RR_)/.test(setupSrc.replace(/^\s*\/\/.*$/gm, '')) && !/new Error\((['"`])(?!RR_)/.test(guardedSrc.replace(/^\s*\/\/.*$/gm, '')), 'diag: setup and test fixture throw ONLY fixed RR_ codes (no free-text messages)');
  ok(!/expect\((blocked|policy\.forbidden)/.test(guardedSrc), 'diag: no expect() that would print blocked origins or refused requests');
  ok(/try \{ st = fs\.lstatSync\(d\); \} catch \{ throw new Error\('RR_SETUP_E_SESSION_DIR'\); \}/.test(setupSrc), 'diag: a missing session dir never puts its path in the message');
  // Fallbacks and hostile values: unknown code, hostile fields, prototype keys, URL-ish values, oversize, duplicates.
  ok(classifyCode('RR_FOO_E_BAR count=3') === 'RR_UNKNOWN_CODE count=3', 'diag: unknown code -> RR_UNKNOWN_CODE');
  ok(classifyCode('roster-reports setup: x') === null && classifyCode('') === null && classifyCode('xRR_POLICY_E_FORBIDDEN') === null, 'diag: non-code messages fall through to the legacy categories');
  const HOSTILE = 'RR_POLICY_E_FORBIDDEN scope=__proto__ actor=constructor count=-1 distinct=1e9 method=post resource=http://evil.example/rest/v1/secret?token=abc rpc=toString http=99999 extra=x private=marker';
  const hc = classifyCode(HOSTILE) ?? '';
  ok(hc === 'RR_POLICY_E_FORBIDDEN scope=unknown actor=unknown count=unknown distinct=unknown method=unknown resource=unknown rpc=unknown http=unknown', `diag: hostile fields -> unknown, extra keys dropped (${hc})`);
  ok(!/evil|secret|token|marker|proto|constructor|toString|http:/.test(hc), 'diag: no hostile substring reaches the output');
  ok(classifyCode('RR_POLICY_E_FORBIDDEN count=1 count=99') === 'RR_POLICY_E_FORBIDDEN count=1', 'diag: a duplicated key keeps the first value');
  ok(classifyCode(`RR_POLICY_E_FORBIDDEN count=${'9'.repeat(600)}`) === 'RR_POLICY_E_FORBIDDEN count=unknown', 'diag: oversize value bounded');
  ok(classifyCode('RR_SETUP_E_SIGNIN actor=admin http=401\n    at secret (/home/x/private.ts:1:1)') === 'RR_SETUP_E_SIGNIN actor=admin http=401', 'diag: only the first line is read (no stack text)');
  ok(stageable([g(HOSTILE), g(NEW_MSG), g(OLD_MSG)]), 'diag: PLAYWRIGHT lines with codes stay in the staging grammar');
  const caseLine = sp((() => { const r = rep(cases.default); (r.suites[0].specs[0].tests[0] as any).status = 'unexpected'; (r.suites[0].specs[0].tests[0] as any).results = [{ errors: [{ message: 'Error: RR_TEST_E_ORIGIN actor=instructor count=1', location: { file: '/w/e2e/roster-reports/guarded-test.ts', line: 21 } }] }]; return r; })(), 1).lines.find((l) => l.startsWith('CASE FAIL')) ?? '';
  ok(/^CASE FAIL project=rr-instructor case=RR-I1 category=RR_TEST_E_ORIGIN actor=instructor count=1 file=guarded-test\.ts line=21$/.test(caseLine) && stageable([caseLine]), `diag: a test refusal is classified on its CASE line (${caseLine})`);
  // forbiddenCategory: finite fields only, for hostile URLs too.
  const fc = (m: string, u: string) => JSON.stringify(forbiddenCategory(m, u));
  ok(fc('POST', `${A_ORIGIN}/rest/v1/rpc/platform_stats`) === '{"method":"POST","resource":"rpc","rpc":"platform_stats"}', 'diag: known RPC named from the fixed list');
  ok(fc('POST', `${A_ORIGIN}/rest/v1/rpc/private_marker_fn`) === '{"method":"POST","resource":"rpc","rpc":"unknown"}', 'diag: unknown RPC -> unknown (name never stored)');
  ok(fc('POST', `${A_ORIGIN}/rest/v1/rpc/has_admin_access?x=1`) === '{"method":"POST","resource":"rpc_read_with_query","rpc":"has_admin_access"}', 'diag: read RPC with a query');
  ok(fc('POST', `${A_ORIGIN}/rest/v1/rpc/log_security_event?x=1`) === '{"method":"POST","resource":"rpc_telemetry_with_query","rpc":"log_security_event"}', 'diag: telemetry RPC with a query');
  ok(fc('PATCH', `${A_ORIGIN}/rest/v1/notifications?id=eq.7150a000-0000-4000-8000-000000000001`) === '{"method":"PATCH","resource":"rest_table","rpc":"none"}', 'diag: table write -> rest_table, no table name or id');
  ok(fc('POST', `${A_ORIGIN}/auth/v1/logout`) === '{"method":"POST","resource":"auth_other","rpc":"none"}' && fc('POST', `${A_ORIGIN}/auth/v1/token?grant_type=pkce`) === '{"method":"POST","resource":"auth_token","rpc":"none"}', 'diag: auth categories');
  ok(fc('POST', `${A_ORIGIN}/storage/v1/object/sign/avatars/u/x.png`) === '{"method":"POST","resource":"storage_sign","rpc":"none"}' && fc('POST', `${A_ORIGIN}/storage/v1/object/list/avatars`) === '{"method":"POST","resource":"storage_list","rpc":"none"}' && fc('PUT', `${A_ORIGIN}/storage/v1/object/a/b`) === '{"method":"PUT","resource":"storage_other","rpc":"none"}', 'diag: storage categories');
  ok(fc('POST', `${A_ORIGIN}/functions/v1/assistant-ai`) === '{"method":"POST","resource":"functions","rpc":"none"}' && fc('POST', `${A_ORIGIN}/graphql/v1`) === '{"method":"POST","resource":"graphql","rpc":"none"}' && fc('POST', `${A_ORIGIN}/realtime/v1/api`) === '{"method":"POST","resource":"realtime","rpc":"none"}', 'diag: functions/graphql/realtime');
  ok(fc('BREW', `${A_ORIGIN}/private-marker/x`) === '{"method":"OTHER","resource":"other_path","rpc":"none"}' && fc('POST', 'not a url') === '{"method":"POST","resource":"unparseable","rpc":"none"}', 'diag: unknown method and path fall back; unparseable');
  for (const h of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) ok(fc('POST', `${A_ORIGIN}/rest/v1/rpc/${h}`) === '{"method":"POST","resource":"rpc","rpc":"unknown"}' && fc(h, `${A_ORIGIN}/x`) === '{"method":"OTHER","resource":"other_path","rpc":"none"}', `diag: '${h}' as RPC or method -> fallback (own-key lookup)`);
  ok(forbiddenMessage('setup', 'admin', [], 0) === null, 'diag: nothing refused -> no message');
  const recs = [forbiddenCategory('POST', `${A_ORIGIN}/rest/v1/rpc/log_audit_event`), forbiddenCategory('PATCH', `${A_ORIGIN}/rest/v1/x`), forbiddenCategory('POST', `${A_ORIGIN}/rest/v1/rpc/log_audit_event`)];
  ok(forbiddenMessage('setup', 'member', recs, 3) === 'RR_POLICY_E_FORBIDDEN scope=setup actor=member count=3 distinct=2 method=POST resource=rpc rpc=log_audit_event', 'diag: message describes the FIRST refusal plus count and distinct');
  ok(forbiddenMessage('bogus', 'constructor', recs, 3)?.startsWith('RR_POLICY_E_FORBIDDEN scope=unknown actor=unknown ') === true, 'diag: scope/actor fall back to unknown');
  ok(classifyCode(forbiddenMessage('test', 'instructor', recs, 3) ?? '') === forbiddenMessage('test', 'instructor', recs, 3), 'diag: every forbiddenMessage round-trips through the summary unchanged');
  // Bounded acquisition and lifecycle through the real route handler on a fake context.
  {
    let handler: ((r: any) => Promise<unknown>) | null = null;
    const ctx = { route: async (_p: string, h: any) => { handler = h; }, on: () => {} };
    const pol: any = await installRequestPolicy(ctx as any, A_ORIGIN, { actorOf });
    const aborted: string[] = [];
    const fire = (m: string, u: string) => handler!({ request: () => ({ method: () => m, url: () => u }), abort: async (why: string) => { aborted.push(why); }, fallback: async () => { aborted.push('fallback'); } });
    await fire('POST', `${A_ORIGIN}/rest/v1/rpc/platform_stats?secret=marker`);
    for (let i = 0; i < 40; i += 1) await fire('PATCH', `${A_ORIGIN}/rest/v1/t${i}?id=eq.${i}`);
    await fire('GET', `${A_ORIGIN}/rest/v1/courses`);
    ok(aborted.filter((a) => a === 'blockedbyclient').length === 41 && aborted.at(-1) === 'fallback', 'diag: every refusal still aborted before send; reads still pass');
    ok(pol.forbidden.length === FORBIDDEN_KEEP && pol.refused.count === 41 && Object.isFrozen(pol.forbidden[0]), `diag: bounded records (${pol.forbidden.length}/${FORBIDDEN_KEEP}) and full count (${pol.refused.count})`);
    ok(!JSON.stringify(pol.forbidden).includes('marker') && !JSON.stringify(pol.forbidden).includes('t1') && !/eq\./.test(JSON.stringify(pol.forbidden)), 'diag: no URL, query or table text stored');
    ok(pol.forbiddenReport('test', 'admin') === 'RR_POLICY_E_FORBIDDEN scope=test actor=admin count=41 distinct=2 method=POST resource=rpc_read_with_query rpc=platform_stats', `diag: report (${pol.forbiddenReport('test', 'admin')})`);
    await pol.finalize(0);
    await fire('DELETE', `${A_ORIGIN}/rest/v1/x`);
    ok(pol.refused.count === 42 && aborted.at(-1) === 'blockedbyclient', 'diag: a refusal after finalize is still aborted and counted (consumed after the awaited close)');
    ok(COUNT_CAP === 99_999 && forbiddenMessage('setup', 'admin', recs, 10 ** 9)?.includes(' count=99999 ') === true, 'diag: count capped');
  }
  // Boundary beyond FORBIDDEN_KEEP: 16 identical refusals, then a PATCH. count is every refusal (17); distinct is sampled
  // from the 16 retained records only, so the 17th (PATCH) is not represented (distinct=1).
  {
    let handler: ((r: any) => Promise<unknown>) | null = null;
    const pol: any = await installRequestPolicy({ route: async (_p: string, h: any) => { handler = h; }, on: () => {} } as any, A_ORIGIN, { actorOf });
    const fire = (m: string, u: string) => handler!({ request: () => ({ method: () => m, url: () => u }), abort: async () => {}, fallback: async () => {} });
    for (let i = 0; i < FORBIDDEN_KEEP; i += 1) await fire('POST', `${A_ORIGIN}/rest/v1/rpc/log_audit_event`);
    await fire('PATCH', `${A_ORIGIN}/rest/v1/x`);
    ok(pol.refused.count === 17 && pol.forbidden.length === 16 && pol.forbiddenReport('setup', 'admin') === 'RR_POLICY_E_FORBIDDEN scope=setup actor=admin count=17 distinct=1 method=POST resource=rpc rpc=log_audit_event',
      `diag: >16 boundary: 16 identical then PATCH -> count=17 distinct=1 (${pol.forbiddenReport('setup', 'admin')})`);
  }
  // Original error preserved: the first failure is kept and rethrown unchanged (no wrapping, no new message).
  ok(/if \(failure !== null\) throw failure;/.test(setupSrc) && !/new Error\([^)]*failure/.test(setupSrc) && !/failure = new Error/.test(setupSrc), 'diag: the first failure is rethrown as is (never wrapped)');
}

// 8d. Sink source contract (what a file-level grant cannot itself enforce): exactly one write call, on the checked fd.
const actorsSrc = read('e2e/roster-reports/actors.mjs');
const code8 = actorsSrc.replace(/^\s*\/\/.*$/gm, '');
ok((code8.match(/\bfs\.\w+/g) ?? []).sort().join(',') === 'fs.appendFileSync,fs.closeSync,fs.constants,fs.constants,fs.constants,fs.constants,fs.fstatSync,fs.lstatSync,fs.openSync,fs.realpathSync',
  `sink contract: exactly these fs calls (${(code8.match(/\bfs\.\w+/g) ?? []).sort().join(',')})`);
// The one open, exactly (alert 624 response: explicit 0o600 third argument; flags unchanged, no O_CREAT/O_TRUNC, so the
// mode argument is never applied by the kernel to an existing file and no file is ever created or re-permissioned).
const OPEN_LINE = "  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600); }";
ok(actorsSrc.split('\n').filter((l) => l === OPEN_LINE).length === 1 && (code8.match(/openSync\(/g) ?? []).length === 1, 'sink contract: the one openSync line is exactly the reviewed line (flags + 0o600)');
ok(!/O_CREAT|O_TRUNC|O_EXCL/.test(code8) && !/\b(f|l)?ch(mod|own)(Sync)?\b|\bumask\b|\butimes/.test(code8), 'sink contract: no O_CREAT/O_TRUNC/O_EXCL and no permission-changing call (chmod/chown/umask)');
ok(/fs\.appendFileSync\(fd, line\)/.test(code8) && (code8.match(/appendFileSync/g) ?? []).length === 1, 'sink contract: the one write goes through the checked descriptor');
ok(/st\.nlink !== 1/.test(code8) && /\(st\.mode & 0o777\) !== 0o600/.test(code8) && /st\.isFile\(\)/.test(code8) && /fs\.closeSync\(fd\)/.test(code8), 'sink contract: same-fd regular/0600/nlink/close');
ok(/Object\.create\(null\)/.test(code8) && /Object\.hasOwn\(map, v\)/.test(code8) && !/\bin (RPCS|ACTORS|STATUSES|ACTOR_IDS)\b/.test(code8), 'sink contract: null-prototype enums with own-key lookup');
ok(/JSON\.stringify\(\{ rpc: rec\.rpc, actor: rec\.actor, status: rec\.status \}\)/.test(code8), 'sink contract: fixed three fields');
ok(!/process\.env\.RR_POLICY_LOG|env\.RR_POLICY_LOG/.test(code8) && /path\.join\(d, SINK_BASENAME\)/.test(code8) && /SINK_BASENAME = 'policy\.jsonl'/.test(code8), 'sink contract: fixed basename under the session root, no env-named file');
const callers = fs.readdirSync(path.join(ROOT, 'e2e/roster-reports')).filter((f) => /appendTelemetry\(/.test(read(`e2e/roster-reports/${f}`)));
ok(callers.sort().join(',') === 'actors.mjs,guarded-test.ts,session-setup.ts', `sink contract: callers are exactly setup and the test fixture (${callers.join(',')})`);

// 8e. APPLIED exact-file ALLOWED entry, read from security.yml itself (no "red today" state is hard-coded). It is a
// file-level grant: any write API inside that one file would pass the gate; 8d is what pins the API use.
const ACTORS_ENTRY = 'e2e/roster-reports/actors\\.mjs$';
// Every pre-existing ALLOWED alternative, in order, exactly as in the composition base's security.yml (the
// claude/roster-reports-job-compose security.yml at d39cc69f). If the composition base changes this list, this check
// fails on purpose: an existing entry must not be altered or dropped while the actors entry is added.
const BASE_ENTRIES = [
  'scripts/',
  'e2e/fixtures/console-errors\\.fixture\\.ts$',
  'e2e/quiz-lifecycle/session\\.fixture\\.ts$',
  'src/test/ci/(checkLocalTarget|caseDiagnostics|checkLearnerAuthGate|checkT09StageContract|gbJobHolds|checkGradebookJourneyJob)\\.test\\.ts$',
];
function sec8() { return read('.github/workflows/security.yml'); }
const allowedMatches = [...sec8().matchAll(/ALLOWED='([^']+)'/g)];
ok(allowedMatches.length === 1, `security.yml: exactly one ALLOWED assignment (${allowedMatches.length})`);
const ALLOWED = allowedMatches[0]?.[1] ?? '';
/** Top-level alternatives of ^( ... ), splitting only on '|' outside nested parentheses. */
const topAlternatives = (re: string): string[] | null => {
  if (!re.startsWith('^(') || !re.endsWith(')')) return null;
  const body = re.slice(2, -1); const out: string[] = []; let depth = 0; let cur = '';
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '\\') { cur += c + (body[i + 1] ?? ''); i += 1; continue; }
    if (c === '(') depth += 1; else if (c === ')') depth -= 1;
    if (c === '|' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return depth === 0 ? out : null;
};
const alts = topAlternatives(ALLOWED) ?? [];
ok(alts.length > 0, `security.yml: ALLOWED is a ^( ... ) alternation (${ALLOWED})`);
ok(alts.filter((a) => a === ACTORS_ENTRY).length === 1, `applied: ${ACTORS_ENTRY} present exactly once as its own alternative`);
ok(alts.filter((a) => /actors/.test(a)).length === 1, 'applied: no other alternative mentions actors (no widened or duplicate grant)');
const withoutActors = alts.filter((a) => a !== ACTORS_ENTRY);
ok(JSON.stringify(withoutActors) === JSON.stringify(BASE_ENTRIES), `applied: every pre-existing entry present, unchanged, in order, and nothing else added (${JSON.stringify(withoutActors)})`);
const real = new RegExp(ALLOWED);
const minusActors = new RegExp(`^(${withoutActors.join('|')})`);
ok(real.test('e2e/roster-reports/actors.mjs'), 'applied: the real regex grants exactly e2e/roster-reports/actors.mjs');
for (const n of ['e2e/roster-reports/actors.mjs.bak', 'e2e/roster-reports/actors.mjsx', 'e2e/roster-reports/actors_mjs', 'e2e/roster-reports/Actors.mjs',
  'e2e/roster-reports/request-policy.mjs', 'e2e/roster-reports/guarded-test.ts', 'e2e/roster-reports/session-setup.ts', 'e2e/roster-reports/sub/actors.mjs',
  'e2e/roster-reports-x/actors.mjs', 'xe2e/roster-reports/actors.mjs', 'e2e/gradebook-roles/actors.mjs', 'e2e/roster-reports/actors.ts', 'src/actors.mjs']) {
  ok(!real.test(n), `neighbour-negative (real regex): ${n} still gated`);
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
const WRITER_LINE = read('e2e/roster-reports/actors.mjs').split('\n').findIndex((l) => /fs\.appendFileSync\(fd, line\)/.test(l)) + 1;
const hitsMinus = gateHits(minusActors);
ok(hitsMinus.join(',') === 'e2e/roster-reports/actors.mjs' && WRITER_LINE === 67, `gate WITHOUT the actors entry: RED on exactly e2e/roster-reports/actors.mjs:${WRITER_LINE} (${hitsMinus.join(',')})`);
ok(gateHits(real).length === 0, `gate WITH the applied entry: GREEN, no hits (${gateHits(real).join(',')})`);

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
// 9b. EXIT trap and cleanup, behavioural (run 41623433467: all lines PASS, exit 1). The REAL cleanup/on_exit/trap block is
// taken verbatim from run.sh and run under bash -euo pipefail in a fresh owned mkdtemp root with a fake tail: step 9 is
// 'cleanup || true' plus the independent absence check, then 'exit RC'. A real removal failure is simulated with a shell
// function rm. No service, no network, no file outside the owned root.
{
  const defs = /^cleanup\(\) \{[\s\S]*?^trap [^\n]*\n/m.exec(run)?.[0] ?? '';
  ok(/^trap on_exit EXIT$/m.test(defs) && /^on_exit\(\) \{/m.test(defs), 'trap: run.sh installs on_exit (status-preserving), not bare cleanup');
  const TAIL = String.raw`
exec 2>&1; set -euo pipefail; umask 077; TMPROOT="$1"; SCEN="$2"
PARENT="$(mktemp -d "$TMPROOT/rr-run.XXXXXXXXXX")"; mkdir -m 700 "$PARENT/raw"; : > "$PARENT/raw/x"
OUTSIDE="$TMPROOT/outside-dir"; mkdir -p "$OUTSIDE"; : > "$OUTSIDE/keep"
eval "$DEFS"
step9() { cleanup || true; if [ -e "$PARENT" ] || [ -L "$PARENT" ]; then echo "PRIVATE STILL_PRESENT verdict=FAIL"; else echo "PRIVATE REMOVED verdict=PASS"; fi; }
case "$SCEN" in
  exit0) step9; exit 0 ;;
  exit5) step9; exit 5 ;;
  already-absent) rm -rf -- "$PARENT"; exit 0 ;;
  early-refuse3) exit 3 ;;
  rm-fails-exit0) rm() { return 1; }; exit 0 ;;
  rm-fails-exit5) rm() { return 1; }; exit 5 ;;
  unsafe-shape) rm -rf -- "$PARENT"; PARENT="$OUTSIDE"; exit 0 ;;
  unsafe-symlink) rm -rf -- "$PARENT"; ln -s "$OUTSIDE" "$PARENT"; exit 0 ;;
  step9-rm-fails-exit5) rm() { echo "SYNTHETIC_PRIVATE_PATH $PARENT" >&2; return 1; }; step9; exit 5 ;;
esac`;
  const FAILED = 'PRIVATE TRAP_CLEANUP_FAILED verdict=FAIL';
  const tail = (d: string, scen: string) => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rr-trap-'));
    try {
      let rc = 0; let out = '';
      try { out = execFileSync('bash', ['-c', TAIL, 'rr-trap', root, scen], { env: { PATH: process.env.PATH ?? '/usr/bin:/bin', DEFS: d }, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
      catch (e) { const x = e as { status: number; stdout: Buffer }; rc = x.status; out = String(x.stdout ?? ''); }
      const left = fs.readdirSync(root).filter((n) => n.startsWith('rr-run.')).length;
      return { rc, out: out.trim().split('\n').filter(Boolean), left, outsideIntact: fs.existsSync(path.join(root, 'outside-dir', 'keep')) };
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  };
  const want: [string, number, number, string[]][] = [
    ['exit0', 0, 0, ['PRIVATE REMOVED verdict=PASS']], ['exit5', 5, 0, ['PRIVATE REMOVED verdict=PASS']], ['already-absent', 0, 0, []], ['early-refuse3', 3, 0, []],
    ['rm-fails-exit0', 9, 1, [FAILED]], ['rm-fails-exit5', 5, 1, [FAILED]], ['unsafe-shape', 9, 0, [FAILED]], ['unsafe-symlink', 9, 1, [FAILED]],
    // Normal step 9 removal failure, stdout and stderr merged as run.sh's 2>&1: the rm's private-path stderr never appears,
    // step 9 reports STILL_PRESENT, the trap adds its fixed line, and the primary status 5 is kept.
    ['step9-rm-fails-exit5', 5, 1, ['PRIVATE STILL_PRESENT verdict=FAIL', FAILED]]];
  for (const [scen, rc, left, lines] of want) {
    const r = tail(defs, scen);
    ok(r.rc === rc && r.left === left && r.outsideIntact && JSON.stringify(r.out) === JSON.stringify(lines), `trap tail ${scen}: exit ${rc}, rr-run left ${left}, outside intact, lines ${JSON.stringify(lines)} (got exit ${r.rc} left ${r.left} intact ${r.outsideIntact} ${JSON.stringify(r.out)})`);
  }
  ok(STAGE.test(FAILED) && LINE.test(FAILED) && !/[/\\]|eyJ|password|secret|=\//i.test(FAILED), 'trap: the cleanup-failure line is stageable and carries no path or credential shape');
  ok(/^\s*cleanup 2>\/dev\/null \|\| c=\$\?$/m.test(defs), 'trap: cleanup stderr (which can name paths) is not emitted from the trap');
  ok(/^\s*rm -rf -- "\$PARENT" 2>\/dev\/null$/m.test(defs) && (defs.match(/\brm -rf\b/g) ?? []).length === 1, 'cleanup: its one rm discards stderr centrally (step 9 and trap alike); the status is kept');
  // OLD control: the 64c4a67 definitions under the same tail give exit 1 for requested 0 and 5 (the run's defect).
  const OLD = 'cleanup() { case "$PARENT" in "$TMPROOT"/rr-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }\ntrap cleanup EXIT\n';
  ok(tail(OLD, 'exit0').rc === 1 && tail(OLD, 'exit5').rc === 1, 'trap OLD control: the previous definitions turn exit 0 and exit 5 into 1 (defect reproduced)');
}
const pins = read('scripts/roster-reports-fixture/PINS.txt');
const pinned = [...pins.matchAll(/^[0-9a-f]{64} {2}(\S+)$/gm)].map((m) => m[1]);
ok(pinned.length === 11 && pinned.every((f) => code.includes(f)), 'run.sh checks every pinned helper');
ok(/^D1_BOOTSTRAP_SHA256=([0-9a-f]{64})$/m.exec(pins)?.[1] === /^([0-9a-f]{64}) {2}scripts\/local-stack\/bootstrap\.sh$/m.exec(pins)?.[1], 'PINS: D1 constant equals the bootstrap.sh pin');

console.log(`${failures === 0 ? 'PASS' : 'FAIL'} roster-reports fixture selftest: ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);
