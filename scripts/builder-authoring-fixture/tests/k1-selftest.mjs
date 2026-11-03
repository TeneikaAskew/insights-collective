#!/usr/bin/env node
// ABOUTME: Pure in-process fake selftest for the K1-ONLY run (T-18 copy acceptance): suite selection, seed-k1 and witness-k1
// ABOUTME: shape, the 3-entry summary, the whole-row witness, the copied-only manifest and the complete-outline oracle negatives.
// No DB, no network, no browser, no #162 file. The baseline selftests (selftest.mjs etc.) stay byte-identical and still pass.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, '..');
const ROOT = path.join(FIX, '..', '..');
if (process.env.BA_SUITE !== undefined) throw new Error('run the K1 selftest without BA_SUITE; it selects the suite itself');
process.env.BA_SUITE = 'k1';
const ids = await import('../ids.mjs');
const { A, B, S, INVENTORY, CASES, PROJECTS, SHOT_PLAN, SHOT_NAMES, SEEDED_COURSES, SEEDED_MODULES, SEEDED_ITEMS, SUITE } = ids;
const { summarizeReport, compareWitnessK1, manifestK1, errorClass, checkLines, SummaryError } = await import('../summary.mjs');
const { storedOutlineProblems, renderedProblems, k1Error } = await import('../k1-oracle.mjs');
const { K1_PROBLEMS, TEST_ERRORS, STAGES, pick } = await import('../codes.mjs');

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };
const blob = (rel) => { const b = fs.readFileSync(path.join(ROOT, rel)); return createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
const strip = (t) => t.split('\n').filter((l) => !l.trim().startsWith('--') && !l.trim().startsWith('//')).join('\n');
const child = (code, env = {}) => {
  const e = { ...process.env, ...env };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete e[k];
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: FIX, env: e, encoding: 'utf8' });
};

// ---- suite selection ----
ok('K1 suite: exactly K1 in ba-1440, ba-768, ba-390 (all executions), 3 K1 shots, S seeded in addition to A and B', () => {
  assert.equal(SUITE, 'k1');
  assert.deepEqual(CASES, ['K1']);
  assert.deepEqual(INVENTORY.map((x) => `${x.project}:${x.case}:${x.expect}`), ['ba-1440:K1:passed', 'ba-768:K1:passed', 'ba-390:K1:passed']);
  assert.deepEqual(SHOT_NAMES, ['ba_k1_1440', 'ba_k1_768', 'ba_k1_390']);
  for (const nm of SHOT_NAMES) assert.equal(SHOT_PLAN[nm][0], `ba-${nm.split('_')[2]}`);
  assert.ok(SEEDED_COURSES.includes(S.course) && SEEDED_COURSES.length === 3 && SEEDED_MODULES.length === 7 && SEEDED_ITEMS.length === 8);
});
ok('baseline suite (BA_SUITE unset) is the unchanged 18-entry inventory with no K1 and the 10 baseline shots', () => {
  const r = child("import('./ids.mjs').then((m) => console.log(JSON.stringify([m.SUITE, m.INVENTORY.length, m.CASES, m.SHOT_NAMES.length, m.SEEDED_COURSES.length])))", { BA_SUITE: undefined });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ['full', 18, ['R1', 'R1S', 'R2', 'C1', 'D1', 'D2'], 10, 2]);
});
ok('any other BA_SUITE value refuses at import (no fallback to either suite)', () => {
  for (const v of ['', 'K1', 'full', 'k1 ', 'k2', '__proto__']) {
    const r = child("import('./ids.mjs').then(() => console.log('LOADED'), (e) => console.log(e.message))", { BA_SUITE: v });
    assert.equal(r.stdout.trim(), 'BA_E_SUITE', JSON.stringify(v));
  }
});

// ---- baseline bytes and pins kept ----
ok('baseline files keep their qualified bytes: config b7653ec1, ba-shots 837dbc0a, shot-plan 20730c15', () => {
  assert.equal(blob('playwright.builder-authoring.config.ts'), 'b7653ec1986ed68c6e2f7a4bb96ea084e913d764');
  assert.equal(blob('scripts/builder-authoring-fixture/ba-shots.mjs'), '837dbc0ad772a01647a52ebc3ed3fe57d78f0827');
  assert.equal(blob('scripts/builder-authoring-fixture/shot-plan.mjs'), '20730c158d0e63e9ed43d55045c8dbb9b6d6b300');
  assert.match(fs.readFileSync(path.join(ROOT, 'playwright.builder-authoring.config.ts'), 'utf8'), /testMatch: \['reorder\.spec\.ts', 'create\.spec\.ts', 'delete\.spec\.ts'\],/);
});
ok('K1 config: the unchanged lane config with only testMatch replaced by copy.spec.ts, refusing without BA_SUITE=k1', () => {
  const t = strip(fs.readFileSync(path.join(ROOT, 'playwright.builder-authoring-k1.config.ts'), 'utf8'));
  assert.match(t, /import base from '\.\/playwright\.builder-authoring\.config';/);
  assert.match(t, /if \(process\.env\.BA_SUITE !== 'k1'\) throw new Error\(/);
  assert.match(t, /export default defineConfig\(\{ \.\.\.base, testMatch: \['copy\.spec\.ts'\] \}\);/);
  assert.equal((t.match(/defineConfig\(/g) ?? []).length, 1);
  assert.doesNotMatch(t, /retries|projects|dependencies|grep|repeatEach/);
});
ok('run.sh: no argument is the baseline (old config, old lane); "k1" alone selects the K1 run; a preset BA_SUITE refuses', () => {
  const t = fs.readFileSync(path.join(FIX, 'run.sh'), 'utf8');
  assert.ok(t.includes('[ -z "${BA_SUITE+x}" ] || refuse RUN_E_USAGE 2'));
  assert.ok(t.includes('  1:) CONFIG=playwright.builder-authoring.config.ts; LANE=builder-authoring ;;'));
  assert.ok(t.includes('  2:k1) export BA_SUITE=k1; CONFIG=playwright.builder-authoring-k1.config.ts; LANE=builder-authoring-k1 ;;'));
  assert.ok(t.includes('  *) refuse RUN_E_USAGE 2 ;;'));
  assert.ok(t.indexOf('[ -z "${BA_SUITE+x}" ]') < t.indexOf('mktemp -d'), 'selection before any dir or write');
  assert.ok(t.includes('npx --no-install playwright test -c "$CONFIG" --output='));
  assert.equal((t.match(/playwright test/g) ?? []).length, 1);
  assert.ok(t.includes('GB_LANE="$LANE"'));
  assert.ok(t.includes('node "$HERE/ba-db.mjs" seed-k1 "$BA_PAIRING_PROOF" "$BA_SESSION_DIR" "$RAW"'));
});

// ---- seed-k1 and witness-k1 ----
ok('seed-k1.sql: plain INSERTs of exactly S, carrier and used-stack refusals first; with seed.sql it creates exactly SEEDED_*', () => {
  const k = strip(fs.readFileSync(path.join(FIX, 'seed-k1.sql'), 'utf8'));
  const base = strip(fs.readFileSync(path.join(FIX, 'seed.sql'), 'utf8'));
  assert.doesNotMatch(k, /on\s+conflict|\bupdate\s+public|\bdelete\s+from|\btruncate\b|\bdrop\b/i);
  assert.ok(k.indexOf('BA_SEED_E_CARRIER') > 0 && k.indexOf('BA_SEED_E_USED_STACK') < k.indexOf('insert into'));
  assert.match(k, /:'pairing'/);
  const idsIn = (t) => [...t.slice(t.indexOf('insert into')).matchAll(/\('(9b6e0000-[0-9a-f-]{27})'/g)].map((m) => m[1]);
  assert.deepEqual(idsIn(k).sort(), [S.course, ...S.sections.map((s) => s.id), ...S.lessons.map((l) => l.id)].sort());
  assert.deepEqual([...idsIn(base), ...idsIn(k)].sort(), [...SEEDED_COURSES, ...SEEDED_MODULES, ...SEEDED_ITEMS].sort());
  for (const l of S.lessons) assert.ok(k.includes(`'${l.type}', '${l.title}', '${l.content.replace(/'/g, "''")}', ${l.position},`), l.title);
  assert.match(k, /select 'BA_SEED_K1_OK courses=1 sections=2 lessons=3';\s*$/);
});
ok('witness-k1.sql is read-only and lists A, B and S as WHOLE rows (no projection); copies and C1 are not excluded alike', () => {
  const w = strip(fs.readFileSync(path.join(FIX, 'witness-k1.sql'), 'utf8'));
  assert.doesNotMatch(w, /\b(insert|update|delete|truncate|drop|alter|create|grant)\b/i);
  assert.doesNotMatch(w, /to_jsonb\([a-z]\) -/);
  for (const k of ['a', 'b', 's']) for (const [kind, t] of [['course', 'courses c where c.id'], ['module', 'modules m where m.course_id'], ['item', 'content_items i where i.course_id']]) {
    assert.match(w, new RegExp(`'${k}_${kind} ' \\|\\| [cmi]\\.id \\|\\| ' ' \\|\\| md5\\(row\\([cmi]\\.\\*\\)::text\\) from public\\.${t.replace('.', '\\.')} = '9b6e0000-`), `${k}_${kind}`);
  }
  assert.ok(w.includes("'BA Wizard Copy ' || :'nonce'"));
  assert.ok(!w.includes('BA Wizard Course'), 'a C1 creation is not excluded, so it changes other_courses');
});

// ---- summary (K1 inventory) ----
const TITLE = 'BA-K1 copy from another course makes one complete copy, opens it, keeps it after reload and leaves the source unchanged';
const pass = (p, extra = {}) => ({ projectName: p, status: 'expected', results: [{ status: 'passed', retry: 0, steps: [], errors: [], ...extra }] });
const report = (tests, errors = [], title = TITLE) => ({ errors, suites: [{ title: 'copy.spec.ts', specs: tests.map((t) => ({ title: t.title ?? title, tests: [t] })), suites: [] }] });
const good = () => PROJECTS.map((p) => pass(p));
ok('summary: all three K1 entries attempted once and passed is the only PASS', () => {
  const r = summarizeReport(report(good()), 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.lines, ['PLAYWRIGHT exit=0 entries=3 passed=3 failed=0 skipped=0 missing=0 duplicate=0 unknown=0 global_errors=0',
    'PLAYWRIGHT_BREAKDOWN executed_passed=3 executed_failed=0 unattempted=0 intended_skip_unattempted=0 intended_skipped=0',
    'TEST PASS project=ba-1440 case=K1', 'TEST PASS project=ba-768 case=K1', 'TEST PASS project=ba-390 case=K1', 'VERDICT PASS']);
  assert.ok(checkLines(r.lines));
});
ok('summary negatives: unattempted, missing, duplicate, retried, hook/fixture error, global error, nonzero exit, baseline title', () => {
  const fails = {
    unattempted_768: () => { const t = good(); t[1] = { projectName: 'ba-768', status: 'skipped', results: [] }; return report(t); },
    missing_390: () => report(good().slice(0, 2)),
    duplicate: () => report([...good(), pass('ba-768')]),
    retried: () => { const t = good(); t[0].results = [{ status: 'failed', retry: 0, steps: [] }, { status: 'passed', retry: 1, steps: [], errors: [] }]; return report(t); },
    retry_flag: () => { const t = good(); t[2].results[0].retry = 1; return report(t); },
    hook_error: () => { const t = good(); t[2].results[0].errors = [{ message: 'afterAll hook' }]; return report(t); },
    global_error: () => report(good(), [{ message: 'globalSetup' }]),
    baseline_title: () => ({ errors: [], suites: [{ title: 'f', specs: [...good().map((t) => ({ title: TITLE, tests: [t] })), { title: 'BA-R1 section reorder is stored and survives reload', tests: [pass('ba-1440')] }], suites: [] }] }),
    unknown_title: () => report(good(), [], 'BA-K2 something'),
  };
  for (const [name, mk] of Object.entries(fails)) {
    const r = summarizeReport(mk(), 0);
    assert.equal(r.ok, false, name);
    assert.equal(r.lines.at(-1), 'VERDICT FAIL', name);
    assert.ok(checkLines(r.lines), name);
  }
  assert.equal(summarizeReport(report(good()), 1).ok, false, 'nonzero exit');
  assert.ok(summarizeReport(report(good().slice(0, 2)), 0).lines.includes('TEST MISSING project=ba-390 case=K1'));
  const u = good(); u[1] = { projectName: 'ba-768', status: 'skipped', results: [] };
  assert.ok(summarizeReport(report(u), 1).lines.includes('TEST FAIL project=ba-768 case=K1 reason=unattempted attempts=0'));
});
ok('summary: a K1 oracle failure prints its fixed code and stage, never the message', () => {
  for (const w of K1_PROBLEMS) {
    const t = good();
    t[0] = { projectName: 'ba-1440', status: 'unexpected', results: [{ status: 'failed', retry: 0, errors: [{}], error: { message: `Error: BA_K1_E_${w} secret-title` }, steps: [{ title: 'after_reload', error: {} }] }] };
    const r = summarizeReport(report(t), 1);
    assert.ok(r.lines.includes(`TEST FAIL project=ba-1440 case=K1 status=unexpected attempts=1 stage=after_reload error=BA_K1_E_${w}`), w);
    assert.ok(!r.lines.join('\n').includes('secret'));
  }
  assert.equal(errorClass('Error: BA_K1_E_NOPE'), 'unlisted');
  assert.equal(pick(STAGES, 'ui_copy', null), 'ui_copy');
  const spec = fs.readFileSync(path.join(ROOT, 'e2e/builder-authoring/copy.spec.ts'), 'utf8');
  const steps = [...spec.matchAll(/test\.step\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(steps, ['before_state', 'ui_copy', 'db_settled', 'rendered', 'after_reload', 'screenshot']);
  for (const s of steps) assert.equal(pick(STAGES, s, null), s, s);
  for (const c of [...spec.matchAll(/k1Error\(\['([A-Z_]+)'\]\)/g)].map((m) => m[1])) assert.ok(K1_PROBLEMS.includes(c), c);
  for (const c of ['BA_K1_E_READ', 'BA_E_COPIED_RECORD']) assert.equal(pick(TEST_ERRORS, c, null), c);
});

// ---- witness (K1) ----
const H = (c) => c.repeat(32);
const KROWS = {
  a_course: [A.course], a_module: A.sections.map((x) => x.id), a_item: [...A.lessons, A.deletable, A.vanishing].map((x) => x.id),
  b_course: [B.course], b_module: B.sections.map((x) => x.id), b_item: [],
  s_course: [S.course], s_module: S.sections.map((x) => x.id), s_item: S.lessons.map((x) => x.id),
};
const KW = (over = {}) => {
  const lines = [];
  for (const [k, list] of Object.entries({ ...KROWS, ...(over.rows ?? {}) })) for (const id of list) lines.push(`${k} ${id} ${(over.hash?.[id]) ?? H(k[0] === 'a' ? 'a' : k[0] === 'b' ? 'b' : 'c')}`);
  for (const k of ['other_courses', 'other_modules', 'other_items', 'other_quizzes', 'other_assignments']) if (over[k] !== null) lines.push(`${k} ${over[k] ?? '4 ' + H('0')}`);
  lines.push(`copies ${over.copies ?? 0}`);
  for (const k of ['enrollments', 'progressions', 'certificates']) lines.push(`learner ${k} ${over[k] ?? 0}`);
  return lines.sort().join('\n') + '\n';
};
const post = (over = {}) => KW({ copies: 3, ...over });
ok('witness K1: A, B and S whole rows unchanged, other rows unchanged, 0 copies before and exactly 3 after passes', () => {
  const r = compareWitnessK1(KW(), post());
  assert.equal(r.ok, true);
  assert.deepEqual(r.lines, ['WITNESS PASS a_rows=9 b_rows=3 s_rows=6 whole_rows=unchanged copies=3 other=unchanged',
    'LEARNER_HISTORY EMPTY enrollments=0 progressions=0 certificates=0 preservation=not_exercised', 'VERDICT PASS']);
  assert.ok(checkLines(r.lines));
});
ok('witness K1 negatives: A reorder (row change), A delete, touched B or S row, C1 or other creation, wrong copy counts, learner rows', () => {
  const fail = (pre, po, kind) => { const r = compareWitnessK1(pre, po); assert.equal(r.ok, false, kind); assert.ok(r.lines.includes(`WITNESS FAIL kind=${kind}`), `${kind}: ${r.lines}`); };
  fail(KW(), post({ hash: { [A.sections[0].id]: H('9') } }), 'a_module');            // a reorder changes the whole row
  fail(KW(), post({ hash: { [A.lessons[1].id]: H('9') } }), 'a_item');
  fail(KW(), post({ rows: { a_item: KROWS.a_item.filter((x) => x !== A.deletable.id) } }), 'a_item'); // no expected D1 delete
  fail(KW(), post({ hash: { [B.course]: H('9') } }), 'b_course');
  fail(KW(), post({ hash: { [S.lessons[0].id]: H('9') } }), 's_item');
  fail(KW(), post({ rows: { s_item: KROWS.s_item.slice(1) } }), 's_item');
  fail(KW(), post({ rows: { s_module: [...KROWS.s_module, '9b6e0000-0000-4000-8000-000000000039'] } }), 's_module');
  fail(KW(), post({ other_courses: '5 ' + H('1') }), 'other_courses');                 // a C1 'BA Wizard Course' creation
  fail(KW(), post({ other_items: '5 ' + H('1') }), 'other_items');
  fail(KW(), post({ other_quizzes: '5 ' + H('1') }), 'other_quizzes');
  fail(KW(), post({ other_assignments: '5 ' + H('1') }), 'other_assignments');
  fail(KW(), post({ copies: 2 }), 'copies');
  fail(KW(), post({ copies: 4 }), 'copies');
  fail(KW({ copies: 1 }), post(), 'pre_copies');
  fail(KW({ rows: { s_item: [] } }), post({ rows: { s_item: [] } }), 'pre_s_item');
  const l = compareWitnessK1(KW({ enrollments: 1 }), post({ enrollments: 1 }));
  assert.equal(l.ok, false); assert.ok(l.lines.includes('LEARNER_HISTORY PRESENT enrollments=1 progressions=0 certificates=0'));
});
ok('witness K1: an unknown, duplicate or missing line refuses', () => {
  assert.throws(() => compareWitnessK1(KW() + 'x_course nope\n', post()), (e) => e instanceof SummaryError && e.code === 'witness_line');
  assert.throws(() => compareWitnessK1(KW() + `s_course ${S.course} ${H('c')}\n`, post()), (e) => e.code === 'witness_duplicate');
  assert.throws(() => compareWitnessK1(KW({ other_quizzes: null }), post()), (e) => e.code === 'witness_incomplete');
  assert.throws(() => compareWitnessK1(KW() + 'probe a_item 5 60 50 10\n', post()), (e) => e.code === 'witness_line', 'a baseline probe line is not a K1 line');
});

// ---- manifest (K1: copied only) ----
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-k1-')); fs.chmodSync(d, 0o700); return d; };
const put = (d, f, t) => fs.writeFileSync(path.join(d, f), t, { mode: 0o600 });
const uuid = (i) => `9c000000-0000-4000-8000-00000000000${i}`;
ok('manifest K1: exactly three distinct copied records pass; a created record, missing, duplicate or malformed record fails', () => {
  const d = tmp(); PROJECTS.forEach((p, i) => put(d, `copied-${p}.json`, JSON.stringify({ id: uuid(i) }))); put(d, 'report.json', '{}');
  assert.deepEqual(manifestK1(d), { ok: true, lines: ['MANIFEST copied=3 projects=ba-1440,ba-768,ba-390', 'VERDICT PASS'] });
  put(d, 'created-ba-1440.json', JSON.stringify({ id: uuid(5) }));
  assert.equal(manifestK1(d).lines[0], 'MANIFEST FAIL reason=unknown_file', 'no C1 record in the K1 run');
  fs.rmSync(path.join(d, 'created-ba-1440.json'));
  fs.rmSync(path.join(d, 'copied-ba-390.json'));
  assert.deepEqual(manifestK1(d).lines, ['MANIFEST copied=2 missing=ba-390', 'VERDICT FAIL']);
  put(d, 'copied-ba-390.json', JSON.stringify({ id: uuid(0) }));
  assert.equal(manifestK1(d).lines[0], 'MANIFEST FAIL reason=duplicate_id');
  fs.rmSync(path.join(d, 'copied-ba-390.json')); put(d, 'copied-ba-390.json', JSON.stringify({ id: uuid(2), x: 1 }));
  assert.equal(manifestK1(d).lines[0], 'MANIFEST FAIL reason=bad_id');
  fs.rmSync(path.join(d, 'copied-ba-390.json')); put(d, 'copied-ba-390.json', JSON.stringify({ id: uuid(2) })); fs.chmodSync(path.join(d, 'copied-ba-390.json'), 0o644);
  assert.throws(() => manifestK1(d), SummaryError, 'wrong mode');
  fs.rmSync(d, { recursive: true });
});
ok('summary CLI in the K1 suite routes witness and manifest to the K1 comparisons (the tail of run.sh is unchanged)', () => {
  const d = tmp(); const pre = path.join(d, 'pre.txt'), po = path.join(d, 'post.txt');
  put(d, 'pre.txt', KW()); put(d, 'post.txt', post());
  const r = spawnSync(process.execPath, [path.join(FIX, 'summary.mjs'), 'witness', pre, po], { encoding: 'utf8', env: { ...process.env, BA_SUITE: 'k1' } });
  assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /^WITNESS PASS a_rows=9 b_rows=3 s_rows=6 /);
  const base = { ...process.env }; delete base.BA_SUITE;
  const b = spawnSync(process.execPath, [path.join(FIX, 'summary.mjs'), 'witness', pre, po], { encoding: 'utf8', env: base });
  assert.equal(b.status, 2, 'the baseline comparison refuses a K1 witness'); assert.equal(b.stdout, 'SUMMARY FAIL reason=witness_line\n');
  fs.rmSync(d, { recursive: true });
});

// ---- oracle: the complete stored outline and the complete rendered sections ----
const EXPECTED = S.sections.map((s, si) => [s.title, s.position, S.lessons.filter((l) => l.section === si).map((l) => [l.title, l.type, l.position, l.content])]);
const C = '9c000000-0000-4000-8000-0000000000c1';
const mid = (i) => `9c000000-0000-4000-8000-00000000010${i}`, iid = (i) => `9c000000-0000-4000-8000-00000000020${i}`;
const copyRows = () => {
  const mods = S.sections.map((s, i) => ({ id: mid(i), course_id: C, title: s.title, position: s.position }));
  const items = S.lessons.map((l, i) => ({ id: iid(i), course_id: C, module_id: mid(l.section), title: l.title, type: l.type, position: l.position, content: l.content }));
  return { mods, itemsByCourse: items, itemsByModule: items.map((x) => ({ ...x })) };
};
ok('oracle: the exact complete copy has no problem, whatever order the rows arrive in', () => {
  assert.deepEqual(storedOutlineProblems(copyRows(), EXPECTED), []);
  const r = copyRows(); r.mods.reverse(); r.itemsByCourse.reverse();
  assert.deepEqual(storedOutlineProblems(r, EXPECTED), []);
});
ok('oracle negatives: orphan extra row, extra section, row from another course on a copy section, duplicate, lost content, reorder, gap', () => {
  const p = (mut) => { const r = copyRows(); mut(r); return storedOutlineProblems(r, EXPECTED); };
  const orphan = { id: iid(9), course_id: C, module_id: '9c000000-0000-4000-8000-0000000001ff', title: 'Stray', type: 'page', position: 0, content: '' };
  assert.deepEqual(p((r) => { r.itemsByCourse.push(orphan); }), ['ITEM_COUNT', 'ORPHAN', 'LINK']);
  assert.deepEqual(p((r) => { r.mods.push({ id: mid(9), course_id: C, title: 'Extra', position: 2 }); }), ['MODULE_COUNT', 'OUTLINE']);
  assert.deepEqual(p((r) => { r.itemsByModule.push({ ...orphan, course_id: 'other', module_id: mid(0) }); }), ['ITEM_COUNT', 'LINK']);
  assert.deepEqual(p((r) => { r.itemsByCourse[1].id = r.itemsByCourse[0].id; r.itemsByModule[1].id = r.itemsByModule[0].id; }), ['DUPLICATE_ID']);
  assert.deepEqual(p((r) => { r.itemsByCourse[0].content = ''; }), ['OUTLINE'], 'content lost after reload');
  assert.deepEqual(p((r) => { r.itemsByCourse[0].content += ' '; }), ['OUTLINE'], 'not byte-equal');
  assert.deepEqual(p((r) => { r.itemsByCourse[1].type = 'page'; }), ['OUTLINE']);
  assert.deepEqual(p((r) => { r.mods[0].position = 1; r.mods[1].position = 0; }), ['OUTLINE'], 'swapped sections');
  assert.deepEqual(p((r) => { r.itemsByCourse[1].position = 2; }), ['OUTLINE'], 'not dense');
  assert.deepEqual(p((r) => { r.itemsByCourse.pop(); }), ['ITEM_COUNT', 'LINK', 'OUTLINE'], 'a lost lesson');
  assert.deepEqual(storedOutlineProblems({ mods: null, itemsByCourse: [], itemsByModule: [] }, EXPECTED), ['READ']);
  assert.equal(k1Error(['ORPHAN']).message, 'BA_K1_E_ORPHAN');
  assert.equal(k1Error(['nope']).message, 'BA_K1_E_READ');
});
ok('rendered negatives: swapped, extra or missing section, and a missing or extra lesson', () => {
  const titles = EXPECTED.map((s) => s[0]), lessons = EXPECTED.map((s) => s[2].map((l) => l[0]));
  assert.deepEqual(renderedProblems(titles, lessons, EXPECTED), []);
  assert.deepEqual(renderedProblems([...titles].reverse(), [...lessons].reverse(), EXPECTED), ['RENDER_SECTIONS', 'RENDER_LESSONS']);
  assert.deepEqual(renderedProblems([...titles, 'BA Section One'], [...lessons, []], EXPECTED), ['RENDER_SECTIONS', 'RENDER_LESSONS']);
  assert.deepEqual(renderedProblems(titles.slice(0, 1), lessons.slice(0, 1), EXPECTED), ['RENDER_SECTIONS', 'RENDER_LESSONS']);
  assert.deepEqual(renderedProblems(titles, [lessons[0].slice(1), lessons[1]], EXPECTED), ['RENDER_LESSONS']);
  assert.deepEqual(renderedProblems(titles, [[...lessons[0], 'Stray'], lessons[1]], EXPECTED), ['RENDER_LESSONS']);
});
ok('spec wiring: after the reload the COMPLETE stored outline, children and source are compared again, not only the ids', () => {
  const spec = fs.readFileSync(path.join(ROOT, 'e2e/builder-authoring/copy.spec.ts'), 'utf8');
  const reload = spec.slice(spec.indexOf("test.step('after_reload'"), spec.indexOf("test.step('screenshot'"));
  for (const call of ['await page.reload();', 'await rendered(page);', 'await assertCompleteCopy(page, id);', 'await assertSourceUnchanged(page);']) assert.ok(reload.includes(call), call);
  const helpers = fs.readFileSync(path.join(ROOT, 'e2e/builder-authoring/k1-helpers.ts'), 'utf8');
  assert.ok(helpers.includes('module_id=in.('), 'rows on the copy sections are read whatever their course');
  assert.doesNotMatch(helpers, /hasText: \/\^B/, 'no title filter on the rendered sections');
  assert.doesNotMatch(spec + helpers, /writeFile|appendFile|createWriteStream/);
});
console.log(`PASS builder-authoring K1 selftest (${n} checks)`);
