#!/usr/bin/env node
// ABOUTME: Fixed-line summaries for the builder-authoring adapter (UNRUN): the exact 15-entry Playwright inventory, the
// ABOUTME: before/after witness comparison, and the created-course manifest. Bounded reads; no title, path, value or message.
//
// Every output line matches the shared staging grammar
//   ^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$
// and each mode prints at most 64 lines / 4096 bytes. Exit 0 = PASS, 1 = FAIL (lines printed), 2 = input refused.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVENTORY, PROJECTS, A } from './ids.mjs';

export const LINE = /^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$/;
export class SummaryError extends Error { constructor(code) { super(code); this.code = code; } }

/** One handle, no-follow: a regular 0600 file owned by this process, 1..max bytes, read with a hard cap. */
export function readBounded(file, max, { uid = typeof process.getuid === 'function' ? process.getuid() : -1 } = {}) {
  let fd;
  try { fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { throw new SummaryError('open'); }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw new SummaryError('type');
    if ((st.mode & 0o777) !== 0o600 || (uid >= 0 && st.uid !== uid)) throw new SummaryError('mode');
    if (st.size < 1 || st.size > max) throw new SummaryError('size');
    const buf = Buffer.alloc(max + 1);
    let n = 0;
    for (;;) { const r = fs.readSync(fd, buf, n, buf.length - n, null); if (r === 0) break; n += r; if (n > max) throw new SummaryError('size'); }
    if (n !== st.size) throw new SummaryError('growth');
    return buf.subarray(0, n).toString('utf8');
  } catch (e) { throw e instanceof SummaryError ? e : new SummaryError('read'); } finally { try { fs.closeSync(fd); } catch { /* closed */ } }
}

const CASE_RE = /^BA-(R1|R2|C1|D1|D2) /;
const STAGE_RE = /^[a-z][a-z0-9_]{0,40}$/;

/** First failing step (depth first) with a fixed lower-case title; 'none' otherwise. Never the step's text otherwise. */
function failedStage(steps) {
  for (const s of steps ?? []) {
    const inner = failedStage(s.steps);
    if (inner !== 'none') return inner;
    if (s.error && typeof s.title === 'string' && STAGE_RE.test(s.title)) return s.title;
  }
  return 'none';
}
/** Fixed error class: an own BA_* code, else timeout / assertion / other. The message itself never leaves. */
export function errorClass(msg) {
  const m = typeof msg === 'string' ? msg : '';
  const own = m.match(/\b(BA_[A-Z0-9_]{1,56})\b/);
  if (own) return own[1];
  if (/timeout|timed out/i.test(m)) return 'timeout';
  if (/expect\(/.test(m)) return 'assertion';
  return 'other';
}

/** @returns {{ ok: boolean, lines: string[] }} */
export function summarizeReport(report, exit) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.suites)) throw new SummaryError('report_shape');
  if (!/^[0-9]{1,3}$/.test(String(exit))) throw new SummaryError('exit');
  const seen = [];
  let unknown = 0;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) {
      const m = typeof spec.title === 'string' ? spec.title.match(CASE_RE) : null;
      if (!m || !PROJECTS.includes(t.projectName)) { unknown += 1; continue; }
      const results = Array.isArray(t.results) ? t.results : [];
      const last = results[results.length - 1] ?? {};
      seen.push({ project: t.projectName, case: m[1], status: t.status, results: results.length, stage: failedStage(last.steps), error: errorClass(last.error?.message) });
    }
    for (const c of suite.suites ?? []) walk(c);
  };
  for (const s of report.suites) walk(s);
  const globalErrors = Array.isArray(report.errors) ? report.errors.length : 0;
  const lines = [];
  let passed = 0, failed = 0, skipped = 0, missing = 0, duplicate = 0;
  for (const want of INVENTORY) {
    const hits = seen.filter((x) => x.project === want.project && x.case === want.case);
    const tag = `project=${want.project} case=${want.case}`;
    if (hits.length === 0) { missing += 1; lines.push(`TEST MISSING ${tag}`); continue; }
    if (hits.length > 1) { duplicate += 1; lines.push(`TEST DUPLICATE ${tag} count=${hits.length}`); continue; }
    const h = hits[0];
    if (want.expect === 'skipped') {
      if (h.status === 'skipped') { skipped += 1; lines.push(`TEST SKIP ${tag} reason=intentional`); }
      else { failed += 1; lines.push(`TEST FAIL ${tag} stage=not_skipped error=status_${String(h.status).replace(/[^a-z]/g, '') || 'none'}`); }
      continue;
    }
    if (h.status === 'expected' && h.results === 1) { passed += 1; lines.push(`TEST PASS ${tag}`); continue; }
    failed += 1;
    const st = ['expected', 'unexpected', 'flaky', 'skipped'].includes(h.status) ? h.status : 'other';
    lines.push(`TEST FAIL ${tag} status=${st} stage=${h.stage} error=${h.error}`);
  }
  const ok = exit === 0 || exit === '0' ? missing === 0 && duplicate === 0 && failed === 0 && unknown === 0 && globalErrors === 0
    && passed === INVENTORY.filter((x) => x.expect === 'passed').length && skipped === INVENTORY.filter((x) => x.expect === 'skipped').length : false;
  lines.unshift(`PLAYWRIGHT exit=${exit} entries=${seen.length + unknown} passed=${passed} failed=${failed} skipped=${skipped} missing=${missing} duplicate=${duplicate} unknown=${unknown} global_errors=${globalErrors}`);
  lines.push(`VERDICT ${ok ? 'PASS' : 'FAIL'}`);
  return { ok, lines };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KINDS = ['b_course', 'b_module', 'b_item', 'a_course', 'a_module', 'a_item'];
const OTHERS = ['other_courses', 'other_modules', 'other_items'];
const LEARNER = ['enrollments', 'progressions', 'certificates'];

/** Parse witness.sql output (raw, private). Refuses anything that is not one of its fixed line shapes. */
export function parseWitness(text) {
  const w = { rows: new Map(KINDS.map((k) => [k, new Map()])), other: new Map(), learner: new Map() };
  for (const line of text.split('\n')) {
    if (line === '') continue;
    let m;
    if ((m = line.match(/^(b_course|b_module|b_item|a_course|a_module|a_item) ([0-9a-f-]{36}) ([0-9a-f]{32})$/)) && UUID.test(m[2])) {
      if (w.rows.get(m[1]).has(m[2])) throw new SummaryError('witness_duplicate');
      w.rows.get(m[1]).set(m[2], m[3]);
    } else if ((m = line.match(/^(other_courses|other_modules|other_items) ([0-9]{1,9}) ([0-9a-f]{32}|none)$/))) {
      if (w.other.has(m[1])) throw new SummaryError('witness_duplicate');
      w.other.set(m[1], `${m[2]} ${m[3]}`);
    } else if ((m = line.match(/^learner (enrollments|progressions|certificates) ([0-9]{1,9})$/))) {
      if (w.learner.has(m[1])) throw new SummaryError('witness_duplicate');
      w.learner.set(m[1], Number(m[2]));
    } else throw new SummaryError('witness_line');
  }
  if (OTHERS.some((k) => !w.other.has(k)) || LEARNER.some((k) => !w.learner.has(k))) throw new SummaryError('witness_incomplete');
  return w;
}

const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

/**
 * Before/after comparison. Untouched: course B rows (all columns), course A's authored fields, A's sections without
 * position, every row outside the fixture and the run's wizard courses. Expected change: exactly the two one-shot lessons
 * (D1 deletable, D2 vanishing) are gone; every other A lesson is unchanged apart from position.
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
  const learnerEmpty = LEARNER.every((k) => pre.learner.get(k) === 0 && post.learner.get(k) === 0);
  const lines = [];
  if (bad.length === 0) {
    lines.push(`WITNESS PASS b_rows=${pre.rows.get('b_course').size + pre.rows.get('b_module').size + pre.rows.get('b_item').size} a_course=1 a_sections=3 a_lessons_kept=${keptPre.size} a_lessons_deleted=2 other=unchanged`);
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
    else throw new SummaryError('usage');
    if (!checkLines(r.lines)) throw new SummaryError('grammar');
  } catch (e) {
    console.log(`SUMMARY FAIL reason=${e instanceof SummaryError && /^[a-z_]{1,40}$/.test(e.code) ? e.code : 'unclassified'}`);
    process.exit(2);
  }
  console.log(r.lines.join('\n'));
  process.exit(r.ok ? 0 : 1);
}
