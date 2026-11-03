#!/usr/bin/env node
// ABOUTME: Fixed-line summaries for the builder-authoring adapter (UNRUN): the exact 18-entry Playwright inventory, the
// ABOUTME: before/after witness comparison, and the created-course manifest. Bounded reads; no title, path, value or message.
//
// Every output line matches the shared staging grammar
//   ^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$
// and each mode prints at most 64 lines / 4096 bytes. Exit 0 = PASS, 1 = FAIL (lines printed), 2 = input refused.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVENTORY, PROJECTS, A } from './ids.mjs';
import { R1_TRACE_ANNOTATION, R1_TRACE_ORDER, parseR1Trace } from './r1-trace.mjs';
import { R1_MONITOR_ANNOTATION, R1_MONITOR_ORDER, parseR1Monitor } from './r1-monitor.mjs';
import { pick, STAGES, STAGE_UNLISTED, TEST_ERRORS, ERROR_UNLISTED, TEST_STATUS, RESULT_STATUS, STATUS_OTHER, CHILD_CODES,
  CHILD_NONE, CHILD_UNLISTED, CHILD_PREFIXES, SUMMARY_REASONS, SUMMARY_UNCLASSIFIED } from './codes.mjs';

export const LINE = /^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$/;
export class SummaryError extends Error { constructor(code) { super(code); this.code = code; } }

/** One handle, no-follow: a regular 0600 single-link file owned by this process, 1..max bytes, read with a hard cap. */
export function readBounded(file, max, { uid = typeof process.getuid === 'function' ? process.getuid() : -1 } = {}) {
  let fd;
  try { fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { throw new SummaryError('open'); }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw new SummaryError('type');
    if (st.nlink !== 1) throw new SummaryError('links');
    if ((st.mode & 0o777) !== 0o600 || (uid >= 0 && st.uid !== uid)) throw new SummaryError('mode');
    if (st.size < 1 || st.size > max) throw new SummaryError('size');
    const buf = Buffer.alloc(max + 1);
    let n = 0;
    for (;;) { const r = fs.readSync(fd, buf, n, buf.length - n, null); if (r === 0) break; n += r; if (n > max) throw new SummaryError('size'); }
    if (n !== st.size) throw new SummaryError('growth');
    return buf.subarray(0, n).toString('utf8');
  } catch (e) { throw e instanceof SummaryError ? e : new SummaryError('read'); } finally { try { fs.closeSync(fd); } catch { /* closed */ } }
}

const CASE_RE = /^BA-(R1S|R1|R2|C1|D1|D2) /;
const CASES = Object.freeze(Object.assign(Object.create(null), { R1: 'R1', R1S: 'R1S', R2: 'R2', C1: 'C1', D1: 'D1', D2: 'D2' }));

/**
 * The failure stage, from the STAGES map only: depth first, the first failing step whose title is an own key of STAGES;
 * 'unlisted' when steps failed but none is listed; 'none' when no step failed. The title itself never leaves.
 */
export function failedStage(steps) {
  let sawError = false;
  const walk = (list) => {
    for (const s of Array.isArray(list) ? list : []) {
      if (!s || typeof s !== 'object') continue;
      const inner = walk(s.steps);
      if (inner) return inner;
      if (s.error) { sawError = true; const v = pick(STAGES, s.title, null); if (v) return v; }
    }
    return null;
  };
  return walk(steps) ?? (sawError ? STAGE_UNLISTED : 'none');
}
/**
 * Fixed error class. A BA_* token in the message prints only as a TEST_ERRORS value; a BA_* token that is not an own key
 * prints 'unlisted'. Without one: timeout / assertion / other. The message itself never leaves.
 */
export function errorClass(msg) {
  const m = typeof msg === 'string' ? msg : '';
  const tokens = m.match(/(?<![A-Za-z0-9_])BA_[A-Za-z0-9_]+/g) ?? [];
  for (const t of tokens) { const v = pick(TEST_ERRORS, t, null); if (v) return v; }
  if (tokens.length) return ERROR_UNLISTED;
  if (/timeout|timed out/i.test(m)) return 'timeout';
  if (/expect\(/.test(m)) return 'assertion';
  return 'other';
}
/** The R1 trace words from the last result's annotations (else the test's), or a fixed state word. Diagnostic only. */
const annotationOf = (t, last, type, parse) => {
  const lists = [Array.isArray(last?.annotations) ? last.annotations : null, Array.isArray(t?.annotations) ? t.annotations : null];
  const src = lists.find((l) => l && l.some((a) => a && typeof a === 'object' && a.type === type));
  if (!src) return 'absent';
  const hits = src.filter((a) => a && typeof a === 'object' && a.type === type);
  if (hits.length !== 1) return 'duplicate';
  return parse(hits[0].description) ?? 'unlisted';
};
const traceOf = (t, last) => annotationOf(t, last, R1_TRACE_ANNOTATION, parseR1Trace);
/** The R1 monitor words (TEST-ONLY diagnostic, r1-monitor.mjs), same rules as the trace; never changes the verdict. */
const monitorOf = (t, last) => annotationOf(t, last, R1_MONITOR_ANNOTATION, parseR1Monitor);
const traceLine = (project, tr) => (typeof tr === 'string'
  ? `R1TRACE project=${project} state=${tr}`
  : `R1TRACE project=${project} ${R1_TRACE_ORDER.map((k) => `${k}=${tr[k]}`).join(' ')}`);
const monitorLine = (project, mo) => (typeof mo === 'string'
  ? `R1MONITOR project=${project} state=${mo}`
  : `R1MONITOR project=${project} ${R1_MONITOR_ORDER.map((k) => `${k}=${mo[k]}`).join(' ')}`);
const resultView = (r) => (r && typeof r === 'object' ? { status: pick(RESULT_STATUS, r.status, STATUS_OTHER), retry: r.retry } : { status: STATUS_OTHER, retry: null });
/** One attempt, first try, with exactly the wanted result status. */
const singleAttempt = (h, want) => h.results.length === 1 && h.results[0].retry === 0 && h.results[0].status === want;

/** @returns {{ ok: boolean, lines: string[] }} */
export function summarizeReport(report, exit) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.suites)) throw new SummaryError('report_shape');
  if (!/^[0-9]{1,3}$/.test(String(exit))) throw new SummaryError('exit');
  const seen = [];
  let unknown = 0;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) {
      const m = typeof spec.title === 'string' ? spec.title.match(CASE_RE) : null;
      const kase = m ? pick(CASES, m[1], null) : null;
      const project = t && typeof t === 'object' ? PROJECTS.find((p) => p === t.projectName) : undefined;
      if (!kase || !project) { unknown += 1; continue; }
      const results = Array.isArray(t.results) ? t.results : [];
      const last = results[results.length - 1] ?? {};
      seen.push({ project, case: kase, status: pick(TEST_STATUS, t.status, STATUS_OTHER), results: results.map(resultView),
        stage: failedStage(last?.steps), error: errorClass(last?.error?.message), trace: kase === 'R1' ? traceOf(t, last) : null,
        monitor: kase === 'R1' ? monitorOf(t, last) : null });
    }
    for (const c of suite.suites ?? []) walk(c);
  };
  for (const s of report.suites) walk(s);
  const globalErrors = Array.isArray(report.errors) ? report.errors.length : 0;
  const lines = [];
  let passed = 0, failed = 0, skipped = 0, missing = 0, duplicate = 0;
  // Separate finite counts (they do not change the verdict): executed entries (at least one result), and entries with the
  // report shape of a test never attempted (status skipped, ZERO results). That shape does not prove WHY it was not
  // attempted (a failed dependency project is one cause, not the only one), so the name is neutral. intended_skip_unattempted
  // is the subset planned as intentional skips: their skip call never ran, so they are not intentional skip results.
  let executedPassed = 0, executedFailed = 0, unattempted = 0, intendedUnattempted = 0;
  const notAttempted = (h) => h.status === 'skipped' && h.results.length === 0;
  for (const want of INVENTORY) {
    const hits = seen.filter((x) => x.project === want.project && x.case === want.case);
    const tag = `project=${want.project} case=${want.case}`;
    if (hits.length === 0) { missing += 1; lines.push(`TEST MISSING ${tag}`); continue; }
    if (hits.length > 1) { duplicate += 1; lines.push(`TEST DUPLICATE ${tag} count=${Math.min(hits.length, 99)}`); continue; }
    const h = hits[0];
    const attempts = Math.min(h.results.length, 99);
    if (want.expect === 'skipped') {
      // An intentional skip is exactly one first-try result that is itself skipped: a retried, re-run or executed entry fails.
      if (h.status === 'skipped' && singleAttempt(h, 'skipped')) { skipped += 1; lines.push(`TEST SKIP ${tag} reason=intentional`); }
      else if (notAttempted(h)) { failed += 1; unattempted += 1; intendedUnattempted += 1; lines.push(`TEST FAIL ${tag} reason=intended_skip_unattempted attempts=0`); }
      else {
        // An attempted violation (executed, retried, or several results) is an executed failure too.
        failed += 1; if (attempts > 0) executedFailed += 1;
        lines.push(`TEST FAIL ${tag} stage=not_skipped status=${h.status} attempts=${attempts}`);
      }
      continue;
    }
    // The R1 trace is printed for every attempted R1 entry, pass or fail; it never changes the verdict.
    if (want.case === 'R1' && attempts > 0) { lines.push(traceLine(want.project, h.trace)); lines.push(monitorLine(want.project, h.monitor)); }
    if (h.status === 'expected' && singleAttempt(h, 'passed')) { passed += 1; executedPassed += 1; lines.push(`TEST PASS ${tag}`); continue; }
    failed += 1;
    if (notAttempted(h)) { unattempted += 1; lines.push(`TEST FAIL ${tag} reason=unattempted attempts=0`); continue; }
    if (attempts > 0) executedFailed += 1;
    lines.push(`TEST FAIL ${tag} status=${h.status} attempts=${attempts} stage=${h.stage} error=${h.error}`);
  }
  const ok = exit === 0 || exit === '0' ? missing === 0 && duplicate === 0 && failed === 0 && unknown === 0 && globalErrors === 0
    && passed === INVENTORY.filter((x) => x.expect === 'passed').length && skipped === INVENTORY.filter((x) => x.expect === 'skipped').length : false;
  lines.unshift(`PLAYWRIGHT exit=${exit} entries=${seen.length + unknown} passed=${passed} failed=${failed} skipped=${skipped} missing=${missing} duplicate=${duplicate} unknown=${unknown} global_errors=${globalErrors}`,
    `PLAYWRIGHT_BREAKDOWN executed_passed=${executedPassed} executed_failed=${executedFailed} unattempted=${unattempted} intended_skip_unattempted=${intendedUnattempted} intended_skipped=${skipped}`);
  lines.push(`VERDICT ${ok ? 'PASS' : 'FAIL'}`);
  return { ok, lines };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KINDS = ['b_course', 'b_module', 'b_item', 'a_course', 'a_module', 'a_item'];
const OTHERS = ['other_courses', 'other_modules', 'other_items'];
const LEARNER = ['enrollments', 'progressions', 'certificates'];
/** Columns each A projection leaves out (witness.sql); the probe must report exactly rows x this many excluded keys. */
export const PROJECTION_EXCLUDED = Object.freeze({ a_course: ['updated_at'], a_module: ['position', 'updated_at'], a_item: ['position', 'updated_at'] });
const PROBES = Object.keys(PROJECTION_EXCLUDED);

/** Parse witness.sql output (raw, private). Refuses anything that is not one of its fixed line shapes. */
export function parseWitness(text) {
  const w = { rows: new Map(KINDS.map((k) => [k, new Map()])), other: new Map(), learner: new Map(), probe: new Map() };
  for (const line of text.split('\n')) {
    if (line === '') continue;
    let m;
    if ((m = line.match(/^(b_course|b_module|b_item|a_course|a_module|a_item) ([0-9a-f-]{36}) ([0-9a-f]{32})$/)) && UUID.test(m[2])) {
      if (w.rows.get(m[1]).has(m[2])) throw new SummaryError('witness_duplicate');
      w.rows.get(m[1]).set(m[2], m[3]);
    } else if ((m = line.match(/^(other_courses|other_modules|other_items) ([0-9]{1,9}) ([0-9a-f]{32}|none)$/))) {
      if (w.other.has(m[1])) throw new SummaryError('witness_duplicate');
      w.other.set(m[1], `${m[2]} ${m[3]}`);
    } else if ((m = line.match(/^probe (a_course|a_module|a_item) ([0-9]{1,6}) ([0-9]{1,7}) ([0-9]{1,7}) ([0-9]{1,7})$/))) {
      if (w.probe.has(m[1])) throw new SummaryError('witness_duplicate');
      w.probe.set(m[1], { rows: Number(m[2]), keys: Number(m[3]), sensitive: Number(m[4]), excluded: Number(m[5]) });
    } else if ((m = line.match(/^learner (enrollments|progressions|certificates) ([0-9]{1,9})$/))) {
      if (w.learner.has(m[1])) throw new SummaryError('witness_duplicate');
      w.learner.set(m[1], Number(m[2]));
    } else throw new SummaryError('witness_line');
  }
  if (OTHERS.some((k) => !w.other.has(k)) || LEARNER.some((k) => !w.learner.has(k)) || PROBES.some((k) => !w.probe.has(k))) throw new SummaryError('witness_incomplete');
  return w;
}

const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

/**
 * The live mutation negative for one A projection: per row, every column but the excluded ones moves the md5, and the
 * excluded ones are exactly the listed columns. Returns the compared field count per row, or null.
 */
export function probeFields(p, kind, rows) {
  const excl = PROJECTION_EXCLUDED[kind].length;
  if (!p || p.rows !== rows || rows < 1 || p.keys % rows !== 0) return null;
  const perRow = p.keys / rows;
  if (perRow <= excl || p.excluded !== rows * excl || p.sensitive + p.excluded !== p.keys) return null;
  return perRow - excl;
}

/**
 * Before/after comparison. Untouched: course B rows (whole rows), course A (every column but updated_at), A's sections and
 * lessons (every column but position and updated_at), every row outside the fixture and the run's wizard courses. Each A
 * projection must pass its live probe before and after with the same field count. Expected change: exactly the two
 * one-shot lessons (D1 deletable, D2 vanishing) are gone.
 */
export function compareWitness(preText, postText) {
  const pre = parseWitness(preText), post = parseWitness(postText);
  const bad = [];
  const expectPre = { b_course: 1, b_module: 2, b_item: 0, a_course: 1, a_module: 3, a_item: 5 };
  for (const [k, n] of Object.entries(expectPre)) if (pre.rows.get(k).size !== n) bad.push(`pre_${k}`);
  for (const k of ['b_course', 'b_module', 'b_item', 'a_course', 'a_module']) if (!sameMap(pre.rows.get(k), post.rows.get(k))) bad.push(k);
  const gone = new Set([A.deletable.id, A.vanishing.id]);
  const keptPre = new Map([...pre.rows.get('a_item')].filter(([id]) => !gone.has(id)));
  if (![...gone].every((id) => pre.rows.get('a_item').has(id)) || !sameMap(keptPre, post.rows.get('a_item'))) bad.push('a_item');
  for (const k of OTHERS) if (pre.other.get(k) !== post.other.get(k)) bad.push(k);
  const fields = {};
  for (const [k, rowsPre, rowsPost] of [['a_course', 1, 1], ['a_module', 3, 3], ['a_item', 5, 3]]) {
    const f = probeFields(pre.probe.get(k), k, rowsPre), g = probeFields(post.probe.get(k), k, rowsPost);
    if (f === null || g === null || f !== g) bad.push(`probe_${k}`); else fields[k] = f;
  }
  const learnerEmpty = LEARNER.every((k) => pre.learner.get(k) === 0 && post.learner.get(k) === 0);
  const lines = [];
  if (bad.length === 0) {
    lines.push(`WITNESS PASS b_rows=${pre.rows.get('b_course').size + pre.rows.get('b_module').size + pre.rows.get('b_item').size} a_course=1 a_sections=3 a_lessons_kept=${keptPre.size} a_lessons_deleted=2 other=unchanged`);
    lines.push(`WITNESS_SCOPE b=whole_rows a_course_fields=${fields.a_course} a_module_fields=${fields.a_module} a_item_fields=${fields.a_item} excluded=updated_at,position probe=sensitive`);
  } else {
    for (const k of [...new Set(bad)]) lines.push(`WITNESS FAIL kind=${k}`);
  }
  lines.push(learnerEmpty
    ? 'LEARNER_HISTORY EMPTY enrollments=0 progressions=0 certificates=0 preservation=not_exercised'
    : `LEARNER_HISTORY PRESENT ${LEARNER.map((k) => `${k}=${post.learner.get(k)}`).join(' ')}`);
  const ok = bad.length === 0 && learnerEmpty;
  lines.push(`VERDICT ${ok ? 'PASS' : 'FAIL'}`);
  return { ok, lines };
}

/** The run dir holds report.json plus exactly one created-<project>.json per project ({"id":<uuid>}), distinct. */
export function manifest(runDir, opts = {}) {
  let entries;
  try { entries = fs.readdirSync(runDir).sort(); } catch { throw new SummaryError('run_dir'); }
  const allowed = new Set(['report.json', ...PROJECTS.map((p) => `created-${p}.json`)]);
  if (entries.some((e) => !allowed.has(e))) return { ok: false, lines: ['MANIFEST FAIL reason=unknown_file', 'VERDICT FAIL'] };
  const ids = [], missingP = [];
  for (const p of PROJECTS) {
    if (!entries.includes(`created-${p}.json`)) { missingP.push(p); continue; }
    const id = createdId(readBounded(path.join(runDir, `created-${p}.json`), 64, opts));
    if (!id) return { ok: false, lines: ['MANIFEST FAIL reason=bad_id', 'VERDICT FAIL'] };
    ids.push(id);
  }
  if (new Set(ids).size !== ids.length) return { ok: false, lines: ['MANIFEST FAIL reason=duplicate_id', 'VERDICT FAIL'] };
  const ok = missingP.length === 0;
  return { ok, lines: [`MANIFEST created=${ids.length}${ok ? ` projects=${PROJECTS.join(',')}` : ` missing=${missingP.join(',')}`}`, `VERDICT ${ok ? 'PASS' : 'FAIL'}`] };
}

/** The exact record recordCreatedCourse writes: {"id":"<uuid v4>"} and nothing else. */
export function createdId(text) {
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  return o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).join(',') === 'id' && UUID.test(String(o.id)) && text === JSON.stringify(o) ? o.id : null;
}

/**
 * The refusal code a child printed, as a CHILD_CODES value: the first line that starts with one of the fixed producer
 * prefixes selects the map entry; a code that is not an own key prints UNLISTED; no refusal line prints NONE.
 */
export function childCode(text) {
  for (const line of String(text).split('\n')) {
    const pre = CHILD_PREFIXES.find((p) => line.startsWith(p));
    if (pre) return pick(CHILD_CODES, line.slice(pre.length), CHILD_UNLISTED);
  }
  return CHILD_NONE;
}

export function checkLines(lines) {
  return lines.length <= 64 && Buffer.byteLength(lines.join('\n') + '\n') <= 4096 && lines.every((l) => LINE.test(l));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, a, b] = process.argv.slice(2);
  let r;
  try {
    if (mode === 'playwright') {
      let report;
      try { report = JSON.parse(readBounded(a, 16 * 1024 * 1024)); } catch (e) { throw e instanceof SummaryError ? e : new SummaryError('report_parse'); }
      r = summarizeReport(report, b);
    } else if (mode === 'witness') r = compareWitness(readBounded(a, 256 * 1024), readBounded(b, 256 * 1024));
    else if (mode === 'manifest') r = manifest(a);
    else if (mode === 'childcode') { console.log(childCode(readBounded(a, 64 * 1024))); process.exit(0); }
    else throw new SummaryError('usage');
    if (!checkLines(r.lines)) throw new SummaryError('grammar');
  } catch (e) {
    console.log(`SUMMARY FAIL reason=${e instanceof SummaryError ? pick(SUMMARY_REASONS, e.code, SUMMARY_UNCLASSIFIED) : SUMMARY_UNCLASSIFIED}`);
    process.exit(2);
  }
  console.log(r.lines.join('\n'));
  process.exit(r.ok ? 0 : 1);
}
