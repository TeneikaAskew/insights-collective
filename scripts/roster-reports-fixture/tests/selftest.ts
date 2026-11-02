// ABOUTME: Static FAKE selftest (no stack, no DB, no browser) for the T-15 acceptance fixture: manifest exactness, id
// ABOUTME: containment, cleanup counts, an independent recomputation of the oracle from seed.sql, and source hygiene.
// Run: npx --no-install tsx scripts/roster-reports-fixture/tests/selftest.ts
import fs from 'node:fs';
import path from 'node:path';
import * as X from '../../../e2e/roster-reports/expected';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failures = 0; let checks = 0;
const ok = (cond: boolean, what: string) => { checks += 1; if (!cond) { failures += 1; console.log(`FAIL ${what}`); } };

// 1. Manifest: unique, well-formed, run-owned namespace.
const manifest = read('scripts/roster-reports-fixture/MANIFEST.tsv').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));
const ids = manifest.map((m) => m[1]);
ok(new Set(ids).size === ids.length, 'manifest ids unique');
ok(ids.every((i) => /^7150a000-0000-4000-8000-[0-9a-f]{12}$/.test(i)), 'manifest ids in the 7150a000 namespace');
const byTable = (t: string) => manifest.filter((m) => m[0] === t).map((m) => m[1]);

// 2. Containment: every fixture-namespace id in seed/cleanup/expected is in the manifest, and the seed writes every one.
const NS = /7150a000-0000-4000-8000-[0-9a-f]{12}/g;
const seed = process.env.RR_SELFTEST_SEED ? fs.readFileSync(process.env.RR_SELFTEST_SEED, 'utf8') : read('scripts/roster-reports-fixture/seed.sql');
const cleanup = read('scripts/roster-reports-fixture/cleanup.sql');
for (const [name, text] of [['seed.sql', seed], ['cleanup.sql', cleanup], ['expected.ts', read('e2e/roster-reports/expected.ts')]] as const) {
  const extra = [...new Set(text.match(NS) ?? [])].filter((i) => !ids.includes(i));
  ok(extra.length === 0, `${name}: no id outside the manifest (${extra.join(',')})`);
}
ok(ids.every((i) => seed.includes(i)), 'seed.sql writes every manifest id');
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

console.log(`${failures === 0 ? 'PASS' : 'FAIL'} roster-reports fixture selftest: ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);
