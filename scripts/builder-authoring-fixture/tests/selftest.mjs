#!/usr/bin/env node
// ABOUTME: Pure in-process fake selftest for the builder-authoring fixture: ids and seed shape, the exact 18-entry inventory
// ABOUTME: summary, the witness comparison and the created-course manifest. No DB, no network, no browser. Needs no #162 file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { A, B, SEEDED_COURSES, SEEDED_MODULES, SEEDED_ITEMS, INVENTORY, PROJECTS, SHOT_NAMES } from '../ids.mjs';
import { summarizeReport, compareWitness, manifest, checkLines, errorClass, failedStage, childCode, readBounded, LINE, SummaryError } from '../summary.mjs';
import { pick, STAGES, TEST_ERRORS, CHILD_CODES, SUMMARY_REASONS, OBS_KINDS, R1_DROPS, R1_SCROLLS, obsKind, r1DropKind, r1ScrollKind, r1Code } from '../codes.mjs';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };

// ---- fakes ----
const TITLES = { R1: 'BA-R1 section reorder is stored and survives reload',
  R1S: 'BA-R1S SYNCHRONIZED-INPUT CANDIDATE section reorder waits for the target announcement, is stored and survives reload', R2: 'BA-R2 lesson reorder is stored and survives reload',
  C1: 'BA-C1 scratch creation makes one complete course and opens it', D1: 'BA-D1 an applied delete removes the lesson, in the UI and in storage',
  D2: 'BA-D2 a delete that matches zero rows is refused and the lesson stays on screen' };
const entry = (project, c, status, extra = {}) => ({ projectName: project, status, results: [{ status: status === 'expected' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed', retry: 0, steps: [], ...extra }], c });
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
  // Live probe shape: rows, row-keys, sensitive row-keys, excluded row-keys (courses 21 columns, modules 13, items 12).
  const nRows = { a_course: rows.a_course.length, a_module: rows.a_module.length, a_item: rows.a_item.length };
  const cols = { a_course: [21, 1], a_module: [13, 2], a_item: [12, 2] };
  for (const [k, [c, e]] of Object.entries(cols)) lines.push(over[`probe_${k}`] ?? `probe ${k} ${nRows[k]} ${nRows[k] * c} ${nRows[k] * (c - e)} ${nRows[k] * e}`);
  return lines.sort().join('\n') + '\n';
};
const postW = (over = {}) => W({ rows: { a_item: A.lessons.map((l) => [l.id, 'f'.repeat(32)]), ...(over.rows ?? {}) }, ...over });

// ---- ids and seed ----
ok('every seeded id is in the 9b6e0000 namespace and unique', () => {
  const all = [...SEEDED_COURSES, ...SEEDED_MODULES, ...SEEDED_ITEMS];
  assert.equal(new Set(all).size, all.length);
  for (const id of all) assert.match(id, /^9b6e0000-0000-4000-8000-0000000[0-9]{5}$/);
});
ok('the inventory is exactly 18 entries: 14 executions (R1S is the separately labelled synchronized candidate) and 4 intentional delete skips', () => {
  assert.equal(INVENTORY.length, 18);
  assert.deepEqual(INVENTORY.filter((x) => x.case === 'R1S').map((x) => `${x.project}:${x.expect}`), ['ba-1440:passed', 'ba-768:passed', 'ba-390:passed']);
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
ok('a complete run passes with 14 PASS and 4 SKIP lines, all in the staging grammar', () => {
  const r = summarizeReport(report(goodTests()), 0);
  assert.equal(r.ok, true);
  assert.equal(r.lines[0], 'PLAYWRIGHT exit=0 entries=18 passed=14 failed=0 skipped=4 missing=0 duplicate=0 unknown=0 global_errors=0');
  assert.equal(r.lines.filter((l) => l.startsWith('TEST PASS')).length, 14);
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
  const t = goodTests(); const at = (p, c) => INVENTORY.findIndex((x) => x.project === p && x.case === c);
  t[at('ba-1440', 'R1')] = entry('ba-1440', 'R1', 'skipped'); t[at('ba-768', 'D1')] = entry('ba-768', 'D1', 'expected');
  const r = summarizeReport(report(t), 0);
  assert.equal(r.ok, false);
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=R1 status=skipped attempts=1 stage=none error=other'));
  assert.ok(r.lines.includes('TEST FAIL project=ba-768 case=D1 stage=not_skipped status=expected attempts=1'));
});
ok('a global error or a non-zero exit fails even with every entry passing', () => {
  assert.equal(summarizeReport(report(goodTests(), [{ message: 'x' }]), 0).ok, false);
  assert.equal(summarizeReport(report(goodTests()), 1).ok, false);
});
ok('a failure reports a fixed stage and error class, never the message', () => {
  const t = goodTests();
  t[INVENTORY.findIndex((x) => x.project === 'ba-1440' && x.case === 'R2')] = entry('ba-1440', 'R2', 'unexpected', { error: { message: 'Error: BA_R2_E_LAYOUT at secret-path' }, steps: [{ title: 'before_state', steps: [] }, { title: 'ui_reorder', error: { message: 'x' }, steps: [{ title: 'locator.click secret', error: {} }] }] });
  t[INVENTORY.findIndex((x) => x.project === 'ba-1440' && x.case === 'C1')] = entry('ba-1440', 'C1', 'unexpected', { error: { message: 'Timeout 5000ms exceeded' }, steps: [{ title: 'Some Title', error: {} }] });
  const r = summarizeReport(report(t), 1);
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=R2 status=unexpected attempts=1 stage=ui_reorder error=BA_R2_E_LAYOUT'));
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=C1 status=unexpected attempts=1 stage=unlisted error=timeout'));
  assert.ok(!r.lines.join('\n').includes('secret')); assert.ok(checkLines(r.lines));
  assert.equal(errorClass('expect(received).toEqual'), 'assertion');
});
ok('a retried pass is not a pass', () => {
  const t = goodTests(); t[0].results.push({ status: 'passed', retry: 1, steps: [] });
  assert.equal(summarizeReport(report(t), 0).ok, false);
  const u = goodTests(); u[0].results[0].retry = 1;
  assert.equal(summarizeReport(report(u), 0).ok, false, 'a single result that is itself a retry is not a first-try pass');
});
ok('(4) an intentional skip with two results, a retried result or an executed result fails; exactly 18, no retries', () => {
  const idx = INVENTORY.findIndex((x) => x.project === 'ba-768' && x.case === 'D1');
  const cases = [
    (e) => { e.results.push({ status: 'skipped', retry: 1, steps: [] }); },
    (e) => { e.results[0].retry = 1; },
    (e) => { e.results[0].status = 'passed'; },
    (e) => { e.results = []; },
  ];
  for (const mutate of cases) {
    const t = goodTests(); mutate(t[idx]);
    const r = summarizeReport(report(t), 0);
    assert.equal(r.ok, false);
    assert.match(firstFail(r), /^TEST FAIL project=ba-768 case=D1 (stage=not_skipped status=skipped attempts=[0-9]+|reason=intended_skip_unattempted attempts=0)$/);
    assert.ok(checkLines(r.lines));
  }
});
ok('(B) intended-skip breakdown: executed, retried or multi-result violations are executed failures; zero attempts is unattempted; a valid skip is neither', () => {
  const idx = INVENTORY.findIndex((x) => x.project === 'ba-768' && x.case === 'D1');
  const bd = (mutate) => { const t = goodTests(); mutate(t[idx]); return summarizeReport(report(t), 1).lines[1]; };
  const bdLine = (ep, ef, u, iu, is) => `PLAYWRIGHT_BREAKDOWN executed_passed=${ep} executed_failed=${ef} unattempted=${u} intended_skip_unattempted=${iu} intended_skipped=${is}`;
  assert.equal(bd(() => {}), bdLine(14, 0, 0, 0, 4));                                          // valid intentional skip
  assert.equal(bd((e) => { e.results[0].status = 'passed'; e.status = 'expected'; }), bdLine(14, 1, 0, 0, 3)); // executed
  assert.equal(bd((e) => { e.results[0].retry = 1; }), bdLine(14, 1, 0, 0, 3));                // retried
  assert.equal(bd((e) => { e.results.push({ status: 'skipped', retry: 1, steps: [] }); }), bdLine(14, 1, 0, 0, 3)); // two results
  assert.equal(bd((e) => { e.results = []; }), bdLine(14, 0, 1, 1, 3));                        // zero attempts
  // an expected-pass entry: executed failure versus zero attempts
  const r1 = INVENTORY.findIndex((x) => x.project === 'ba-1440' && x.case === 'R1');
  const t = goodTests(); t[r1] = entry('ba-1440', 'R1', 'unexpected');
  assert.equal(summarizeReport(report(t), 1).lines[1], bdLine(13, 1, 0, 0, 4));
  t[r1] = { projectName: 'ba-1440', status: 'skipped', results: [], c: 'R1' };
  assert.equal(summarizeReport(report(t), 1).lines[1], bdLine(13, 0, 1, 0, 4));
  assert.ok(!summarizeReport(report(t), 1).lines.join('\n').includes('dependency'));
});

ok('hosted run 41564184929 shape: 1 executed failure, 4 passes, 10 unattempted (4 of them intended skips) are told apart; still FAIL', () => {
  const t = goodTests();
  const i = (p, c) => INVENTORY.findIndex((x) => x.project === p && x.case === c);
  t[i('ba-1440', 'R1')] = entry('ba-1440', 'R1', 'unexpected', { error: { message: 'Error: BA_OBS_E_COUNT_ZERO' }, steps: [{ title: 'ui_reorder', error: {} }] });
  for (const p of ['ba-768', 'ba-390']) for (const c of ['R1', 'R2', 'C1', 'D1', 'D2']) t[i(p, c)] = { projectName: p, status: 'skipped', results: [], c };
  // that run predates BA-R1S: its report has exactly the 15 old entries, so the 3 R1S rows read as MISSING and nothing else moves
  const old = t.filter((e) => e.c !== 'R1S');
  assert.equal(old.length, 15);
  const r = summarizeReport(report(old), 1);
  assert.equal(r.ok, false);
  assert.equal(r.lines[0], 'PLAYWRIGHT exit=1 entries=15 passed=4 failed=11 skipped=0 missing=3 duplicate=0 unknown=0 global_errors=0');
  for (const p of ['ba-1440', 'ba-768', 'ba-390']) assert.ok(r.lines.includes(`TEST MISSING project=${p} case=R1S`));
  assert.equal(r.lines[1], 'PLAYWRIGHT_BREAKDOWN executed_passed=4 executed_failed=1 unattempted=10 intended_skip_unattempted=4 intended_skipped=0');
  assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=R1 status=unexpected attempts=1 stage=ui_reorder error=BA_OBS_E_COUNT_ZERO'));
  assert.ok(r.lines.includes('TEST FAIL project=ba-768 case=R1 reason=unattempted attempts=0'));
  assert.ok(r.lines.includes('TEST FAIL project=ba-390 case=D2 reason=intended_skip_unattempted attempts=0'));
  assert.equal(r.lines.filter((l) => l.includes('reason=unattempted ')).length, 6);
  assert.equal(r.lines.filter((l) => l.includes('reason=intended_skip_unattempted')).length, 4);
  assert.ok(checkLines(r.lines));
  // exit 0 with the same shape still fails: an incomplete inventory is never accepted
  assert.equal(summarizeReport(report(old), 0).ok, false);
  assert.equal(summarizeReport(report(t), 0).ok, false);
});
ok('BA-R1S candidate failures print one listed code, separately from R1; no R1TRACE/R1MONITOR line for R1S; R1 unaffected', () => {
  const i = (p, c) => INVENTORY.findIndex((x) => x.project === p && x.case === c);
  for (const code of ['BA_R1S_E_TIMEOUT_OVER_SELF', 'BA_R1S_E_WRONG_DRAG', 'BA_R1S_E_PRE_STALE', 'BA_R1S_E_LOCATE', 'BA_OBS_E_COUNT_ZERO']) {
    const t = goodTests();
    t[i('ba-1440', 'R1S')] = entry('ba-1440', 'R1S', 'unexpected', { error: { message: `Error: ${code} secret-id` }, steps: [{ title: 'ui_reorder', error: {} }] });
    const r = summarizeReport(report(t), 1);
    assert.ok(r.lines.includes(`TEST FAIL project=ba-1440 case=R1S status=unexpected attempts=1 stage=ui_reorder error=${code}`), code);
    assert.ok(r.lines.includes('TEST PASS project=ba-1440 case=R1'));
    assert.equal(r.lines.filter((l) => l.startsWith('R1TRACE ') || l.startsWith('R1MONITOR ')).length, 6, 'three R1 entries only');
    assert.ok(!r.lines.join('\n').includes('secret'));
    assert.ok(checkLines(r.lines));
  }
  assert.equal(errorClass('Error: BA_R1S_E_OVER_TARGET'), 'unlisted', 'success word is not an error code');
  assert.equal(errorClass('Error: BA_R1S_E___proto__'), 'unlisted');
});
ok('R1 diagnostic codes: obsKind is finite; every composed BA_R1_E_<obs>_<drop>_<scroll> code is listed and grammar-safe', () => {
  assert.equal(obsKind(['OBS_COUNT POST /rest/v1/rpc/reorder_modules 0'], 1), 'COUNT_ZERO');
  assert.equal(obsKind(['OBS_NEAR_MISS x', 'OBS_COUNT x 2'], 1), 'COUNT_OVER');
  assert.equal(obsKind(['OBS_STATUS x 403'], 1), 'STATUS');
  assert.equal(obsKind(['OBS_PENDING x'], 1), 'PENDING');
  assert.equal(obsKind(['OBS_COUNT x NaN'], 1), 'OTHER');
  assert.equal(obsKind(['__proto__'], 1), 'OTHER'); assert.equal(obsKind(null, 1), 'OTHER');
  for (const o of OBS_KINDS) {
    assert.equal(errorClass(`Error: BA_OBS_E_${o}`), `BA_OBS_E_${o}`);
    for (const d of R1_DROPS) for (const sc of R1_SCROLLS) {
      const c = `BA_R1_E_${o}_${d}_${sc}`;
      assert.equal(errorClass(`Error: ${c}`), c); assert.ok(c.length <= 64 && LINE.test(`TEST FAIL error=${c}`));
    }
  }
  assert.equal(errorClass('BA_R1_E_COUNT_ZERO_DROP_SELF_SIDEWAYS'), 'unlisted');
  assert.equal(errorClass('BA_R1_E_LOCATE'), 'BA_R1_E_LOCATE');
});
ok('(A) R1 reducers: rejected baseline, final and live-region reads are UNAVAILABLE; valid no-drop, still, self and target are named', () => {
  const M = '9b6e0000-0000-4000-8000-0000000000a1', T = '9b6e0000-0000-4000-8000-0000000000a2';
  const drop = (x) => `Draggable item ${M} was dropped${x}`;
  // rejected live-region reads
  for (const bad of [null, undefined, 'text', [], [1], [null], ['ok', 2], { length: 1 }]) assert.equal(r1DropKind(bad, M, T), 'DROP_UNAVAILABLE');
  for (const [m, t] of [['', T], [M, ''], [M, M], [null, T], [M, 7]]) assert.equal(r1DropKind([drop('.')], m, t), 'DROP_UNAVAILABLE');
  // valid live-region reads
  assert.equal(r1DropKind(['', `Picked up draggable item ${M}.`], M, T), 'NO_DROP');
  assert.equal(r1DropKind([drop('.')], M, T), 'DROP_NONE');
  assert.equal(r1DropKind(['', `  ${drop(` over droppable area ${T}`)} `], M, T), 'DROP_TARGET');
  assert.equal(r1DropKind([drop(` over droppable area ${M}`)], M, T), 'DROP_SELF');
  assert.equal(r1DropKind([drop(' over droppable area 9b6e0000-0000-4000-8000-0000000000a3')], M, T), 'DROP_OTHER');
  // scroll: rejected baseline, rejected final, both valid
  for (const bad of [null, undefined, NaN, Infinity, '0', {}]) {
    assert.equal(r1ScrollKind(bad, 0), 'SCROLL_UNAVAILABLE'); assert.equal(r1ScrollKind(0, bad), 'SCROLL_UNAVAILABLE');
  }
  assert.equal(r1ScrollKind(0, 0), 'STILL'); assert.equal(r1ScrollKind(120, 120), 'STILL'); assert.equal(r1ScrollKind(0, 312.5), 'SCROLLED');
  // primary category preserved; unlisted words never print
  assert.equal(r1Code('BA_OBS_E_COUNT_ZERO', 'DROP_SELF', 'SCROLLED'), 'BA_R1_E_COUNT_ZERO_DROP_SELF_SCROLLED');
  assert.equal(r1Code('BA_OBS_E_NEAR_MISS', 'DROP_UNAVAILABLE', 'SCROLL_UNAVAILABLE'), 'BA_R1_E_NEAR_MISS_DROP_UNAVAILABLE_SCROLL_UNAVAILABLE');
  for (const m of [null, 'Error: BA_OBS_E_COUNT_ZERO', 'BA_OBS_E_EVIL', 'BA_OBS_E___PROTO__', 'timeout 5000ms']) assert.equal(r1Code(m, 'NO_DROP', 'STILL'), 'BA_R1_E_OTHER_NO_DROP_STILL');
  assert.equal(r1Code('BA_OBS_E_STATUS', '__proto__', 'SIDEWAYS'), 'BA_R1_E_STATUS_DROP_UNAVAILABLE_SCROLL_UNAVAILABLE');
});
ok('(A) R1 spec wiring: reads go through the reducers, failed reads are null, and no NO_DROP / STILL / 0 default remains', () => {
  const src = fs.readFileSync(path.join(HERE, '..', '..', '..', 'e2e', 'builder-authoring', 'reorder.spec.ts'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.match(code, /throw new Error\(r1Code\(e instanceof Error \? e\.message : null, r1DropKind\(texts, moving, target\), r1ScrollKind\(scrollBefore, scrollAfter\)\)\)/);
  assert.match(code, /scrollBefore = await page\.evaluate\(\(\) => window\.scrollY\)\.catch\(\(\) => null\)/);
  assert.match(code, /let scrollBefore: unknown = null;/);
  assert.match(code, /\.catch\(\(\) => null\);\n\s*const scrollAfter = await page\.evaluate\(\(\) => window\.scrollY\)\.catch\(\(\) => null\);/);
  for (const banned of ["'NO_DROP'", "'STILL'", "'SCROLLED'", 'scrollBefore = 0', 'catch(() => scrollBefore)']) assert.ok(!code.includes(banned), banned);
  assert.match(code, /catch \{ throw new Error\('BA_R1_E_LOCATE'\); \}/);
  // the keys are unchanged: focus, Space, ArrowDown, Space; the one task barrier (TEST EXPERIMENT, see CONTRACT.md) sits
  // between the pickup Space and ArrowDown and nothing else is added (trace-selftest checks it in detail)
  assert.match(code, /await handle\.focus\(\);[\s\S]*?press\('Space'\);\s*await page\.evaluate\(\(\) => new Promise\(\(r\) => setTimeout\(r, 0\)\)\);\s*await page\.keyboard\.press\('ArrowDown'\);\s*await page\.keyboard\.press\('Space'\);/);
});

ok('the R1 trace fake-DOM controls (tests/trace-selftest.mjs) pass, so the existing job selftest step runs them', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'trace-selftest.mjs')], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 0, 'trace-selftest failed');
  assert.match(r.stdout, /\nPASS builder-authoring R1 trace selftest \([0-9]+ checks\)\n$/);
});

// ---- (1) finite maps: hostile values, inherited keys, grammar ----
const HOSTILE = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'prototype', 'ui_reorder x', 'UI_REORDER',
  'ui_reorder\nVERDICT PASS', 'ui_reorder ', '', 'a'.repeat(200), 'stage=evil', '../../etc', 'BA_R2_E_LAYOUT_EVIL', 'BA_hasOwnProperty',
  'BA___proto__', 'BA_constructor', 'BA_E_READ_SECRETS', 'BA_SETUP_E_SIGNIN_HTTP_500', 'xBA_R2_E_LAYOUT', 'TOKEN=abc', 'VERDICT PASS'];
ok('(1) stage: only STAGES values print; hostile and inherited titles print unlisted; a listed parent still wins', () => {
  for (const h of HOSTILE) {
    assert.equal(failedStage([{ title: h, error: {} }]), 'unlisted', h);
    assert.equal(failedStage([{ title: 'ui_reorder', error: {}, steps: [{ title: h, error: {} }] }]), 'ui_reorder', h);
  }
  assert.equal(failedStage([{ title: 'ui_delete', steps: [] }]), 'none');
  assert.equal(failedStage(null), 'none'); assert.equal(failedStage('x'), 'none');
  assert.equal(Object.getPrototypeOf(STAGES), null); assert.ok(Object.isFrozen(STAGES));
});
ok('(1) error class: only TEST_ERRORS values print; unlisted, inherited, suffixed or embedded BA_ tokens print unlisted/other', () => {
  for (const h of HOSTILE) {
    const v = errorClass(`Error: ${h} at /secret/path`);
    assert.ok(Object.values(TEST_ERRORS).includes(v) || ['unlisted', 'timeout', 'assertion', 'other'].includes(v), h);
    assert.ok(h === '' || !v.includes(h) || Object.prototype.hasOwnProperty.call(TEST_ERRORS, h), h);
  }
  assert.equal(errorClass('BA_R2_E_LAYOUT_EVIL'), 'unlisted');
  assert.equal(errorClass('xBA_R2_E_LAYOUT'), 'other');
  assert.equal(errorClass('BA___proto__ then BA_R2_E_LAYOUT'), 'BA_R2_E_LAYOUT');
  assert.equal(errorClass('BA_constructor'), 'unlisted');
  assert.equal(errorClass({ toString: () => 'BA_R2_E_LAYOUT' }), 'other', 'a non-string message is never read');
});
ok('(1) statuses: hostile or inherited test/result statuses print other; a hostile skipped status never prints itself', () => {
  for (const h of HOSTILE) {
    const t = goodTests(); t[0].status = h; t[0].results[0].status = h;
    const idx = INVENTORY.findIndex((x) => x.project === 'ba-390' && x.case === 'D2'); t[idx].status = h;
    const r = summarizeReport(report(t), 1);
    assert.ok(r.lines.includes('TEST FAIL project=ba-1440 case=R1 status=other attempts=1 stage=none error=other'), h);
    assert.ok(r.lines.includes('TEST FAIL project=ba-390 case=D2 stage=not_skipped status=other attempts=1'), h);
    assert.ok(checkLines(r.lines), h);
  }
});
ok('(1) hostile project names and spec titles are unknown entries, never printed', () => {
  for (const h of ['__proto__', 'constructor', 'toString', 'BA-1440', 'ba-1440x']) {
    const t = goodTests(); t[0].projectName = h;
    const r = summarizeReport(report(t), 0);
    assert.match(r.lines[0], /unknown=1/); assert.ok(!r.lines.join('\n').includes(h)); assert.ok(checkLines(r.lines));
  }
  const rep = report(goodTests()); rep.suites[0].specs[0].title = 'BA-__proto__ x';
  assert.match(summarizeReport(rep, 0).lines[0], /unknown=1/);
});
ok('(1) child refusal codes: only CHILD_CODES values print; suffixed, inherited, dynamic or foreign-prefixed codes do not', () => {
  assert.equal(childCode('ba-db refused: BA_DB_E_PSQL\n'), 'BA_DB_E_PSQL');
  assert.equal(childCode('noise\nrun-journey refused: PAIR_E_USED_STACK\n'), 'PAIR_E_USED_STACK');
  for (const h of HOSTILE) for (const pre of ['ba-db', 'ba-shots', 'run-journey']) {
    const v = childCode(`${pre} refused: ${h}\n`);
    assert.equal(v, Object.prototype.hasOwnProperty.call(CHILD_CODES, h) ? h : 'UNLISTED', h);
  }
  assert.equal(childCode('ba-db refused: BA_DB_E_PSQL extra\n'), 'UNLISTED');
  assert.equal(childCode('run-journey refused: RUN_E_D1_SO_WHATEVER\n'), 'UNLISTED');
  assert.equal(childCode('run-journey refused: RUN_E_PIN scripts/x.mjs\n'), 'UNLISTED');
  assert.equal(childCode('other refused: BA_DB_E_PSQL\n'), 'NONE');
  assert.equal(childCode(''), 'NONE');
  for (const v of Object.values(CHILD_CODES)) assert.match(v, /^[A-Z][A-Z0-9_]{1,63}$/);
});
ok('(1) summary refusal reasons: every printed reason is a SUMMARY_REASONS value or unclassified (CLI, real files)', () => {
  const run = (...a) => spawnSync(process.execPath, [path.join(HERE, '..', 'summary.mjs'), ...a], { encoding: 'utf8' });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-sr-'));
  const r1 = run('playwright', path.join(d, 'absent.json'), '0');
  assert.equal(r1.status, 2); assert.equal(r1.stdout, 'SUMMARY FAIL reason=open\n');
  fs.writeFileSync(path.join(d, 'bad.json'), '{not json', { mode: 0o600 });
  assert.equal(run('playwright', path.join(d, 'bad.json'), '0').stdout, 'SUMMARY FAIL reason=report_parse\n');
  assert.equal(run('__proto__').stdout, 'SUMMARY FAIL reason=usage\n');
  assert.equal(run('playwright', path.join(d, 'bad.json'), 'constructor').stdout, 'SUMMARY FAIL reason=report_parse\n');
  fs.writeFileSync(path.join(d, 'r.json'), JSON.stringify({ suites: [] }), { mode: 0o600 });
  assert.equal(run('playwright', path.join(d, 'r.json'), '__proto__').stdout, 'SUMMARY FAIL reason=exit\n');
  fs.writeFileSync(path.join(d, 'c.txt'), 'ba-db refused: __proto__\n', { mode: 0o600 });
  assert.equal(run('childcode', path.join(d, 'c.txt')).stdout, 'UNLISTED\n');
  for (const h of HOSTILE) assert.equal(pick(SUMMARY_REASONS, h, 'unclassified'), 'unclassified', h);
  fs.rmSync(d, { recursive: true });
});
ok('(5) the private reader refuses a second hard link (single-link check), a symlink and a wrong mode', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-rb-'));
  fs.writeFileSync(path.join(d, 'f'), 'x', { mode: 0o600 });
  assert.equal(readBounded(path.join(d, 'f'), 8), 'x');
  fs.linkSync(path.join(d, 'f'), path.join(d, 'g'));
  assert.throws(() => readBounded(path.join(d, 'f'), 8), (e) => e.code === 'links');
  fs.rmSync(path.join(d, 'g')); fs.symlinkSync(path.join(d, 'f'), path.join(d, 's'));
  assert.throws(() => readBounded(path.join(d, 's'), 8), (e) => e.code === 'open');
  fs.chmodSync(path.join(d, 'f'), 0o644); assert.throws(() => readBounded(path.join(d, 'f'), 8), (e) => e.code === 'mode');
  fs.rmSync(d, { recursive: true });
});

// ---- witness ----
ok('witness: B whole rows untouched, A projections untouched, exactly the two one-shot lessons gone, nothing else changed', () => {
  const r = compareWitness(W(), postW());
  assert.equal(r.ok, true);
  assert.deepEqual(r.lines, ['WITNESS PASS b_rows=3 a_course=1 a_sections=3 a_lessons_kept=3 a_lessons_deleted=2 other=unchanged',
    'WITNESS_SCOPE b=whole_rows a_course_fields=20 a_module_fields=11 a_item_fields=10 excluded=updated_at,position probe=sensitive',
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
ok('(3) witness probe: an insensitive column, a wrongly excluded column, a missing probe or a changed field count fails', () => {
  // an extra column left out of the projection (e.g. module.description): 3 more excluded, 3 fewer sensitive
  assert.ok(compareWitness(W({ probe_a_module: 'probe a_module 3 39 30 9' }), postW()).lines.includes('WITNESS FAIL kind=probe_a_module'));
  // a column whose replacement does not move the md5 (neither sensitive nor excluded)
  assert.ok(compareWitness(W(), postW({ probe_a_item: 'probe a_item 3 36 29 6' })).lines.includes('WITNESS FAIL kind=probe_a_item'));
  // a column added between the two snapshots
  assert.ok(compareWitness(W(), postW({ probe_a_course: 'probe a_course 1 22 21 1' })).lines.includes('WITNESS FAIL kind=probe_a_course'));
  // the probe saw the wrong rows
  assert.ok(compareWitness(W({ probe_a_course: 'probe a_course 0 0 0 0' }), postW()).lines.includes('WITNESS FAIL kind=probe_a_course'));
  assert.throws(() => compareWitness(W().split('\n').filter((l) => !l.startsWith('probe a_item')).join('\n'), postW()), (e) => e.code === 'witness_incomplete');
});
ok('(3) witness.sql: A projections leave out exactly updated_at (course) and position, updated_at (sections, lessons); B whole rows', () => {
  const w = fs.readFileSync(path.join(HERE, '..', 'witness.sql'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const subtracted = new Set([...w.matchAll(/\) - '([a-z_]+)'/g), ...w.matchAll(/ - '([a-z_]+)'/g)].map((m) => m[1]));
  assert.deepEqual([...subtracted].sort(), ['position', 'updated_at']);
  assert.match(w, /'a_course ' \|\| c\.id \|\| ' ' \|\| md5\(\(to_jsonb\(c\) - 'updated_at'\)::text\)/);
  assert.match(w, /'a_module ' \|\| m\.id \|\| ' ' \|\| md5\(\(to_jsonb\(m\) - 'position' - 'updated_at'\)::text\)/);
  assert.match(w, /'a_item ' \|\| i\.id \|\| ' ' \|\| md5\(\(to_jsonb\(i\) - 'position' - 'updated_at'\)::text\)/);
  for (const k of ['b_course', 'b_module', 'b_item']) assert.match(w, new RegExp(`'${k} ' \\|\\| [cmi]\\.id \\|\\| ' ' \\|\\| md5\\(row\\([cmi]\\.\\*\\)::text\\)`));
  for (const k of ['a_course', 'a_module', 'a_item']) assert.match(w, new RegExp(`'probe ${k} '`));
  assert.doesNotMatch(w, /row\([a-z]\.[a-z]/, 'no hand-picked column lists remain');
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
