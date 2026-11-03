#!/usr/bin/env node
// ABOUTME: Pure in-process fake selftest for the builder-authoring fixture: ids and seed shape, the exact 15-entry inventory
// ABOUTME: summary, the witness comparison and the created-course manifest. No DB, no network, no browser. Needs no #162 file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { A, B, SEEDED_COURSES, SEEDED_MODULES, SEEDED_ITEMS, INVENTORY, PROJECTS, SHOT_NAMES } from '../ids.mjs';
import { summarizeReport, compareWitness, manifest, checkLines, errorClass, LINE, SummaryError } from '../summary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };

// ---- fakes ----
const TITLES = { R1: 'BA-R1 section reorder is stored and survives reload', R2: 'BA-R2 lesson reorder is stored and survives reload',
  C1: 'BA-C1 scratch creation makes one complete course and opens it', D1: 'BA-D1 an applied delete removes the lesson, in the UI and in storage',
  D2: 'BA-D2 a delete that matches zero rows is refused and the lesson stays on screen' };
const entry = (project, c, status, extra = {}) => ({ projectName: project, status, results: [{ status: status === 'expected' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed', steps: [], ...extra }], c });
const report = (tests, errors = []) => ({ errors, suites: [{ title: 'f', specs: tests.map((t) => ({ title: TITLES[t.c], tests: [t] })), suites: [] }] });
const goodTests = () => INVENTORY.map((x) => entry(x.project, x.case, x.expect === 'passed' ? 'expected' : 'skipped'));
const firstFail = (r) => r.lines.find((l) => l.startsWith('TEST FAIL') || l.startsWith('TEST MISSING') || l.startsWith('TEST DUPLICATE'));

const W = (over = {}) => {
  const rows = {
    b_course: [[B.course, 'b'.repeat(32)]], b_module: B.sections.map((s) => [s.id, 'c'.repeat(32)]), b_item: [],
    a_course: [[A.course, 'd'.repeat(32)]], a_module: A.sections.map((s) => [s.id, 'e'.repeat(32)]),
    a_item: [...A.lessons, A.deletable, A.vanishing].map((l) => [l.id, 'f'.repeat(32)]), ...over.rows,
  };
  const lines = [];
  for (const [k, list] of Object.entries(rows)) for (const [id, h] of list) lines.push(`${k} ${id} ${h}`);
  for (const k of ['other_courses', 'other_modules', 'other_items']) lines.push(`${k} ${over[k] ?? '6 ' + '0'.repeat(32)}`);
  for (const k of ['enrollments', 'progressions', 'certificates']) lines.push(`learner ${k} ${over[k] ?? 0}`);
  return lines.sort().join('\n') + '\n';
};
const postW = (over = {}) => W({ rows: { a_item: A.lessons.map((l) => [l.id, 'f'.repeat(32)]), ...(over.rows ?? {}) }, ...over });

// ---- ids and seed ----
ok('every seeded id is in the 9b6e0000 namespace and unique', () => {
  const all = [...SEEDED_COURSES, ...SEEDED_MODULES, ...SEEDED_ITEMS];
  assert.equal(new Set(all).size, all.length);
  for (const id of all) assert.match(id, /^9b6e0000-0000-4000-8000-0000000[0-9]{5}$/);
});
ok('the inventory is exactly 15 entries: 11 executions and 4 intentional delete skips', () => {
  assert.equal(INVENTORY.length, 15);
  assert.deepEqual(INVENTORY.filter((x) => x.expect === 'skipped').map((x) => `${x.project}:${x.case}`), ['ba-768:D1', 'ba-768:D2', 'ba-390:D1', 'ba-390:D2']);
  assert.deepEqual(PROJECTS, ['ba-1440', 'ba-768', 'ba-390']);
});
const seed = fs.readFileSync(path.join(HERE, '..', 'seed.sql'), 'utf8');
const code = seed.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
ok('seed: plain INSERTs only (no ON CONFLICT, no UPDATE, no DELETE), bound to the pairing carrier first', () => {
  assert.doesNotMatch(code, /on\s+conflict|\bupdate\s+public|\bdelete\s+from|\btruncate\b|\bdrop\b/i);
  assert.ok(code.indexOf("raise exception 'BA_SEED_E_CARRIER'") > 0 && code.indexOf('BA_SEED_E_CARRIER') < code.indexOf('insert into'));
  assert.match(code, /:'pairing'/);
});
ok('seed.sql creates exactly the ids.mjs rows and nothing else', () => {
  const ids = [...code.matchAll(/\('(9b6e0000-[0-9a-f-]{27})'/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, [...SEEDED_COURSES, ...SEEDED_MODULES, ...SEEDED_ITEMS].sort());
});
ok('witness.sql is read-only', () => {
  const w = fs.readFileSync(path.join(HERE, '..', 'witness.sql'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(w, /\b(insert|update|delete|truncate|drop|alter|create|grant)\b/i);
});
ok('no SQL cleanup file remains in the lane', () => {
  assert.deepEqual(fs.readdirSync(path.join(HERE, '..')).filter((f) => /cleanup|manifest\.mjs/.test(f)), []);
});

// ---- playwright inventory summary ----
ok('a complete run passes with 11 PASS and 4 SKIP lines, all in the staging grammar', () => {
  const r = summarizeReport(report(goodTests()), 0);
  assert.equal(r.ok, true);
  assert.equal(r.lines[0], 'PLAYWRIGHT exit=0 entries=15 passed=11 failed=0 skipped=4 missing=0 duplicate=0 unknown=0 global_errors=0');
  assert.equal(r.lines.filter((l) => l.startsWith('TEST PASS')).length, 11);
  assert.equal(r.lines.filter((l) => l.startsWith('TEST SKIP')).length, 4);
  assert.equal(r.lines.at(-1), 'VERDICT PASS');
  assert.ok(checkLines(r.lines));
});
ok('a missing entry fails', () => {
  const r = summarizeReport(report(goodTests().slice(1)), 0);
  assert.equal(r.ok, false); assert.equal(firstFail(r), 'TEST MISSING project=ba-1440 case=R1');
});
ok('a duplicate entry fails', () => {
  const t = goodTests(); t.push(entry('ba-768', 'R2', 'expected'));
  const r = summarizeReport(report(t), 0);
  assert.equal(r.ok, false); assert.equal(firstFail(r), 'TEST DUPLICATE project=ba-768 case=R2 count=2');
});
ok('an extra (unknown) test fails without naming it', () => {
  const t = goodTests(); const rep = report(t); rep.suites[0].specs.push({ title: 'something else', tests: [{ projectName: 'ba-1440', status: 'expected', results: [{}] }] });
  const r = summarizeReport(rep, 0);
  assert.equal(r.ok, false); assert.match(r.lines[0], /unknown=1/); assert.ok(!r.lines.join('\n').includes('something else'));
});
ok('an unintended skip and an executed intentional skip both fail', () => {
  const t = goodTests(); t[0] = entry('ba-1440', 'R1', 'skipped'); t[8] = entry('ba-768', 'D1', 'expected');
  const r = summarizeReport(report(t), 0);
  assert.equal(r.ok, false);
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=R1 status=skipped stage=none error=other'));
  assert.ok(r.lines.includes('TEST FAIL project=ba-768 case=D1 stage=not_skipped error=status_expected'));
});
ok('a global error or a non-zero exit fails even with every entry passing', () => {
  assert.equal(summarizeReport(report(goodTests(), [{ message: 'x' }]), 0).ok, false);
  assert.equal(summarizeReport(report(goodTests()), 1).ok, false);
});
ok('a failure reports a fixed stage and error class, never the message', () => {
  const t = goodTests();
  t[1] = entry('ba-1440', 'R2', 'unexpected', { error: { message: 'Error: BA_R2_E_LAYOUT at secret-path' }, steps: [{ title: 'before_state', steps: [] }, { title: 'ui_reorder', error: { message: 'x' }, steps: [{ title: 'locator.click secret', error: {} }] }] });
  t[2] = entry('ba-1440', 'C1', 'unexpected', { error: { message: 'Timeout 5000ms exceeded' }, steps: [{ title: 'Some Title', error: {} }] });
  const r = summarizeReport(report(t), 1);
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=R2 status=unexpected stage=ui_reorder error=BA_R2_E_LAYOUT'));
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=C1 status=unexpected stage=none error=timeout'));
  assert.ok(!r.lines.join('\n').includes('secret')); assert.ok(checkLines(r.lines));
  assert.equal(errorClass('expect(received).toEqual'), 'assertion');
});
ok('a retried pass is not a pass', () => {
  const t = goodTests(); t[0].results.push({ status: 'passed', steps: [] });
  assert.equal(summarizeReport(report(t), 0).ok, false);
});

// ---- witness ----
ok('witness: B untouched, A authored fields untouched, exactly the two one-shot lessons gone, nothing else changed', () => {
  const r = compareWitness(W(), postW());
  assert.equal(r.ok, true);
  assert.deepEqual(r.lines, ['WITNESS PASS b_rows=3 a_course=1 a_sections=3 a_lessons_kept=3 a_lessons_deleted=2 other=unchanged',
    'LEARNER_HISTORY EMPTY enrollments=0 progressions=0 certificates=0 preservation=not_exercised', 'VERDICT PASS']);
  assert.ok(checkLines(r.lines));
});
ok('witness: a touched B row, a changed A section, a third deletion or a non-fixture change each fail by kind', () => {
  assert.ok(compareWitness(W(), postW({ rows: { b_module: [[B.sections[0].id, '1'.repeat(32)], [B.sections[1].id, 'c'.repeat(32)]] } })).lines.includes('WITNESS FAIL kind=b_module'));
  assert.ok(compareWitness(W(), postW({ rows: { a_module: A.sections.map((s, i) => [s.id, (i ? 'e' : '2').repeat(32)]) } })).lines.includes('WITNESS FAIL kind=a_module'));
  assert.ok(compareWitness(W(), postW({ rows: { a_item: A.lessons.slice(1).map((l) => [l.id, 'f'.repeat(32)]) } })).lines.includes('WITNESS FAIL kind=a_item'));
  assert.ok(compareWitness(W(), W()).lines.includes('WITNESS FAIL kind=a_item'), 'nothing deleted is a failure too');
  assert.ok(compareWitness(W(), postW({ other_items: '6 ' + '9'.repeat(32) })).lines.includes('WITNESS FAIL kind=other_items'));
});
ok('witness: learner history present is reported, never claimed as preserved, and fails', () => {
  const r = compareWitness(W({ enrollments: 1 }), postW({ enrollments: 1 }));
  assert.equal(r.ok, false); assert.ok(r.lines.includes('LEARNER_HISTORY PRESENT enrollments=1 progressions=0 certificates=0'));
});
ok('witness: an unknown or duplicate line refuses', () => {
  assert.throws(() => compareWitness(W() + 'b_course nope\n', postW()), SummaryError);
  assert.throws(() => compareWitness(W() + `a_course ${A.course} ${'d'.repeat(32)}\n`, postW()), SummaryError);
});

// ---- manifest (bounded reads) ----
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-st-')); fs.chmodSync(d, 0o700); return d; };
const put = (d, f, t) => fs.writeFileSync(path.join(d, f), t, { mode: 0o600 });
const uuid = (i) => `9c000000-0000-4000-8000-00000000000${i}`;
ok('manifest: three exact records pass; missing, malformed, duplicate, unknown, oversize or wrong-mode records fail', () => {
  const d = tmp(); PROJECTS.forEach((p, i) => put(d, `created-${p}.json`, JSON.stringify({ id: uuid(i) }))); put(d, 'report.json', '{}');
  assert.deepEqual(manifest(d), { ok: true, lines: ['MANIFEST created=3 projects=ba-1440,ba-768,ba-390', 'VERDICT PASS'] });
  fs.rmSync(path.join(d, 'created-ba-390.json'));
  assert.deepEqual(manifest(d).lines, ['MANIFEST created=2 missing=ba-390', 'VERDICT FAIL']);
  put(d, 'created-ba-390.json', JSON.stringify({ id: uuid(0) }));
  assert.equal(manifest(d).lines[0], 'MANIFEST FAIL reason=duplicate_id');
  fs.rmSync(path.join(d, 'created-ba-390.json')); put(d, 'created-ba-390.json', JSON.stringify({ id: uuid(2), x: 1 }));
  assert.equal(manifest(d).lines[0], 'MANIFEST FAIL reason=bad_id');
  fs.rmSync(path.join(d, 'created-ba-390.json')); put(d, 'created-ba-390.json', 'x'.repeat(65));
  assert.throws(() => manifest(d), SummaryError);
  fs.rmSync(path.join(d, 'created-ba-390.json')); put(d, 'created-ba-390.json', JSON.stringify({ id: uuid(2) })); fs.chmodSync(path.join(d, 'created-ba-390.json'), 0o644);
  assert.throws(() => manifest(d), SummaryError);
  put(d, 'stray.txt', 'x'); assert.equal(manifest(d).lines[0], 'MANIFEST FAIL reason=unknown_file');
  fs.rmSync(d, { recursive: true });
});
ok('the staging grammar accepts the fixed lines and rejects titles and messages', () => {
  assert.ok(LINE.test('TEST PASS project=ba-1440 case=R1'));
  assert.ok(LINE.test('SHOT name=ba_r1_1440 sha256=' + 'a'.repeat(64) + ' bytes=10 width=1440 height=900'));
  assert.ok(!LINE.test('TEST PASS BA-R1 section reorder'));
  assert.ok(!LINE.test('SHOTS 3 captured 0 withheld of 10'));
  assert.equal(SHOT_NAMES.length, 10);
});
console.log(`PASS builder-authoring fixture selftest (${n} checks)`);
