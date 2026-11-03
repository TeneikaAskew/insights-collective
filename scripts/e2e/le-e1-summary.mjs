#!/usr/bin/env node
// ABOUTME: Derives the six fixed LE-E1 summary lines (lesson-editor lane README section 3) from the PRIVATE Playwright JSON
// ABOUTME: report of an E1-only run. Prints to stdout only; copies no title, message, stack, body or path from the report.
//
// Usage: le-e1-summary.mjs <private report.json> <playwright exit> <commit 40-hex> <setup PASS|FAIL> <private setup.txt> <cleanup PASS|FAIL>
// The setup stage and the backend-contract verdict are read from the PRIVATE redacted run.sh setup output, never inferred from
// the setup step outcome: contract PASS needs its exact PASS line, FAIL its FAIL line, and neither means it was not attempted.
// The refusal stage is printed only as one of SETUP_STAGES; any other text is "unclassified" (no copied text).
// Refuses (exit 2, one fixed line) unless the report holds exactly ONE test whose title contains "E1 save" in the lane
// project; only status words, counts and error COUNTS are read, never titles beyond that check, messages or stacks.
// With setup PASS a missing or unreadable report is a refusal, not a silent "unattempted".
import fs from 'node:fs';
import { failedStep } from '../../e2e/lesson-editor/step-codes.mjs';

const STATUSES = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const refuse = (code) => { console.log(`LE-E1 REFUSED ${code}`); process.exit(2); };

/** The one E1 test this lane may report: spec file (relative to the lane config's testDir), describe path and exact title. */
export const E1_IDENTITY = Object.freeze({
  file: 'lesson-editor.spec.ts',
  describe: 'owner, real backend and TipTap, desktop',
  title: 'E1 save: the returned row is exactly the stored row, the trigger advanced the version, reload keeps it',
  project: 'lesson-editor-chromium',
});
export const MAX_REPORT_BYTES = 8 * 1024 * 1024;
export const READ_CODES = Object.freeze(['LE_READ_E_OPEN', 'LE_READ_E_TYPE', 'LE_READ_E_OWNER', 'LE_READ_E_MODE', 'LE_READ_E_LINKS', 'LE_READ_E_SIZE', 'LE_READ_E_IO', 'LE_READ_E_UTF8']);

/**
 * Private file reader: ONE descriptor for every check and the read (the qualified stack-ownership pattern). O_NOFOLLOW
 * refuses a final symlink, O_NONBLOCK keeps a FIFO from blocking (fstat then refuses it); the opened inode must be a regular
 * file owned by this uid, mode exactly 0600 (or 0600/0644 when allowWorldRead), one link, at most max bytes, and it must not
 * grow past max while read. Returns { ok: true, text } or { ok: false, code } with a fixed READ_CODES code. fsImpl is
 * injectable so selftests drive every branch with fakes (no file is written).
 */
export function readPrivateBounded(file, { max = MAX_REPORT_BYTES, modes = [0o600], fsImpl = fs, uid = (typeof process.getuid === 'function' ? process.getuid() : -1) } = {}) {
  let fd;
  try { fd = fsImpl.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { return { ok: false, code: 'LE_READ_E_OPEN' }; }
  const inner = () => {
    let st;
    try { st = fsImpl.fstatSync(fd); } catch { return { ok: false, code: 'LE_READ_E_IO' }; }
    if (!st.isFile()) return { ok: false, code: 'LE_READ_E_TYPE' };
    if (uid >= 0 && st.uid !== uid) return { ok: false, code: 'LE_READ_E_OWNER' };
    if (!modes.includes(st.mode & 0o7777)) return { ok: false, code: 'LE_READ_E_MODE' };
    if (st.nlink !== 1) return { ok: false, code: 'LE_READ_E_LINKS' };
    if (!(st.size >= 0 && st.size <= max)) return { ok: false, code: 'LE_READ_E_SIZE' };
    const buf = Buffer.alloc(max + 1);
    let n = 0;
    try { for (;;) { const r = fsImpl.readSync(fd, buf, n, buf.length - n, null); if (r === 0) break; n += r; if (n > max) break; } }
    catch { return { ok: false, code: 'LE_READ_E_IO' }; }
    if (n > max) return { ok: false, code: 'LE_READ_E_SIZE' };
    try { return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, n)) }; }
    catch { return { ok: false, code: 'LE_READ_E_UTF8' }; }
  };
  let res;
  try { res = inner(); } catch { res = { ok: false, code: 'LE_READ_E_IO' }; }
  // The descriptor is always closed; a failed close fails the read (a successful result is never returned past it).
  try { fsImpl.closeSync(fd); } catch { res = { ok: false, code: 'LE_READ_E_IO' }; }
  return res;
}

/** Collect every test (spec x project) in a Playwright JSON report, with its file and describe path. */
export function testsOf(report) {
  const out = [];
  const walk = (suite, file, describes) => {
    const f = typeof suite?.file === 'string' ? suite.file : file;
    // A file-level suite has the file name as its title; describe suites add their title to the path.
    const d = suite && suite.title !== undefined && suite.title !== f ? [...describes, String(suite.title)] : describes;
    for (const s of suite?.specs ?? []) for (const t of s.tests ?? []) out.push({
      title: typeof s.title === 'string' ? s.title : '',
      file: typeof s.file === 'string' ? s.file : f,
      describe: d.join(' > '),
      projectName: String(t.projectName ?? ''),
      expectedStatus: t.expectedStatus,
      status: t.status,
      results: Array.isArray(t.results) ? t.results : [],
    });
    for (const c of suite?.suites ?? []) walk(c, f, d);
  };
  for (const s of report?.suites ?? []) walk(s, undefined, []);
  return out;
}

const count = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const errorsOf = (v) => (Array.isArray(v) ? v.length : v == null ? 0 : -1);

/**
 * The E1 classification. PASS needs ALL of: exactly one test in the whole report (zero-case setup refuses), that test is
 * the E1 test by exact identity (spec file, describe path, full title) in the lane project, exactly one attempt (no retry, no flaky), that attempt passed with no errors, the
 * test expected to pass and reported as expected, report stats of exactly 1 expected and 0 unexpected/flaky/skipped,
 * and NO report-level errors (global setup/teardown, or beforeAll/afterAll failures Playwright files outside a test).
 * The single attempt must be retry 0 (a sole retry:1 result means an earlier attempt was dropped from the report).
 * A skipped or never-run E1 is "unattempted", never a pass. Anything that is not a clean single pass is "failed".
 */
export function e1Result(report) {
  const all = testsOf(report);
  if (all.length !== 1) return { code: 'LE_SUM_E_SELECTION' };
  const t = all[0];
  // Exact identity, never a substring: the known spec file, its describe path and the full E1 title.
  if (t.title !== E1_IDENTITY.title || t.file !== E1_IDENTITY.file || t.describe !== E1_IDENTITY.describe) return { code: 'LE_SUM_E_NOT_E1' };
  if (t.projectName !== E1_IDENTITY.project) return { code: 'LE_SUM_E_PROJECT' };
  for (const r of t.results) if (!STATUSES.has(r?.status)) return { code: 'LE_SUM_E_STATUS' };
  const st = report?.stats ?? {};
  const [ex, un, fl, sk] = [st.expected, st.unexpected, st.flaky, st.skipped].map(count);
  if ([ex, un, fl, sk].includes(null)) return { code: 'LE_SUM_E_STATS' };
  const globalErrors = errorsOf(report?.errors);
  if (globalErrors < 0) return { code: 'LE_SUM_E_REPORT' };
  if (globalErrors > 0) return { result: 'failed', step: 'unknown' };
  const attempted = t.results.filter((r) => r.status !== 'skipped');
  if (attempted.length === 0 || t.expectedStatus === 'skipped' || t.status === 'skipped') return { result: 'unattempted', step: 'none' };
  const only = t.results[0];
  const clean = t.results.length === 1
    && only.retry === 0
    && only.status === 'passed'
    && errorsOf(only.errors) === 0 && only.error == null
    && t.expectedStatus === 'passed' && t.status === 'expected'
    && ex === 1 && un === 0 && fl === 0 && sk === 0;
  if (clean) return { result: 'passed', step: 'none' };
  // Not a clean pass: Playwright's own status word for a single attempt (failed, timedOut or interrupted), else 'failed'.
  // The step is the fixed E1 phase code from step-codes.mjs (titles only, never a message) or 'unknown'.
  const single = t.results.length === 1 && only.status !== 'passed';
  return { result: single ? only.status : 'failed', step: single ? failedStep(only) : 'unknown' };
}

/** run.sh setup stage labels (its quiet labels), in the order setup runs them. */
export const SETUP_STAGES = Object.freeze(['preflight', 'personas', 'fixture', 'read', 'quizhash', 'owner change', 'backend contract']);
/** Fixed setup codes run.sh may print as exactly "LE-SETUP-CODE: <code>" (preflight exit status mapped by a fixed case). */
export const SETUP_CODES = Object.freeze(['LE_PRE_E_INPUT', 'LE_PRE_E_P1', 'LE_PRE_E_P2', 'LE_PRE_E_P3_HTTP', 'LE_PRE_E_P3_COUNT',
  'LE_PRE_E_P3_TABLES', 'LE_PRE_E_P4', 'LE_PRE_E_UNEXPECTED', 'UNMAPPED']);
const CONTRACT_PASS = /^PASS le-contract: \d+ checks on the LOCAL isolated stack \(says nothing about the deployed backend\)$/;

/**
 * From the redacted setup output: the stage run.sh refused at (first "FAIL le-run:" line, mapped onto SETUP_STAGES, else
 * "unclassified"; "none" if there is no such line) and the backend-contract verdict (PASS / FAIL / unattempted).
 */
export function setupFacts(text) {
  const ls = String(text).split('\n');
  const first = ls.find((l) => l.startsWith('FAIL le-run: '));
  let stage = 'none';
  if (first !== undefined) {
    const rest = first.slice('FAIL le-run: '.length);
    stage = SETUP_STAGES.find((s) => rest === s || rest.startsWith(`${s} exited `) || rest.startsWith(`${s} (`) || rest.startsWith(`${s}: `)) ?? 'unclassified';
  }
  const pass = ls.filter((l) => CONTRACT_PASS.test(l)).length;
  const fail = ls.some((l) => l.startsWith('FAIL le-contract: '));
  const contract = pass === 1 && !fail ? 'PASS' : fail ? 'FAIL' : pass > 1 ? 'FAIL' : 'unattempted';
  // setup code: exactly one exact "LE-SETUP-CODE: <code>" line with an allowlisted code; none -> "none"; anything else -> "unclassified"
  const codeLines = ls.filter((l) => l.startsWith('LE-SETUP-CODE: '));
  let code = 'none';
  if (codeLines.length === 1) { const c = codeLines[0].slice('LE-SETUP-CODE: '.length); code = SETUP_CODES.includes(c) ? c : 'unclassified'; }
  else if (codeLines.length > 1) code = 'unclassified';
  return { stage, contract, code };
}

export function lines({ commit, setup, stage, code = 'none', contract, result, step = 'none', cleanup }) {
  return [
    `LE-E1 tier: authentic isolated LOCAL stack; commit=${commit}; not production, not deployed backend`,
    `LE-E1 setup: ${setup}`,
    `LE-E1 setup refused at: ${stage}`,
    `LE-E1 setup code: ${code}`,
    `LE-E1 backend-contract: ${contract}`,
    "LE-E1 selection: 1 test (--grep 'E1 save')",
    `LE-E1 result: ${result}`,
    `LE-E1 failed step: ${step}`,
    `LE-E1 cleanup: ${cleanup}`,
  ];
}

function main(argv) {
  const [file, pw, commit, setup, setupFile, cleanup] = argv;
  if (argv.length !== 6) refuse('LE_SUM_E_USAGE');
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) refuse('LE_SUM_E_COMMIT');
  for (const v of [setup, cleanup]) if (v !== 'PASS' && v !== 'FAIL') refuse('LE_SUM_E_FLAG');
  // The redacted setup output is written under umask 077 into the private parent; same-descriptor bounded read, 0600 only.
  const so = readPrivateBounded(setupFile, { max: 256 * 1024 });
  if (!so.ok) refuse('LE_SUM_E_SETUP_OUTPUT');
  const { stage, contract, code } = setupFacts(so.text);
  // Consistency: a passed setup step must show the contract PASS and no refusal; a failed one must show a refusal.
  if (setup === 'PASS' && (contract !== 'PASS' || stage !== 'none')) refuse('LE_SUM_E_SETUP_INCONSISTENT');
  if (setup === 'FAIL' && stage === 'none') refuse('LE_SUM_E_SETUP_INCONSISTENT');
  if (!/^\d{1,3}$/.test(pw ?? '')) refuse('LE_SUM_E_EXIT');
  let result = 'unattempted';
  let step = 'none';
  if (setup === 'PASS') {
    // Playwright's JSON reporter writes with the process umask; the job runs it under umask 077, so only 0600 is accepted.
    const r = readPrivateBounded(file);
    if (!r.ok) refuse('LE_SUM_E_REPORT');
    let report;
    try { report = JSON.parse(r.text); } catch { refuse('LE_SUM_E_REPORT'); }
    const c = e1Result(report);
    if (c.code) refuse(c.code);
    result = c.result;
    step = c.step;
    if (result === 'passed' && pw !== '0') { result = 'failed'; step = 'unknown'; }
  }
  for (const l of lines({ commit, setup, stage, code, contract, result, step, cleanup })) console.log(l);
  process.exit(result === 'passed' && setup === 'PASS' && contract === 'PASS' && cleanup === 'PASS' ? 0 : 1);
}

if (process.argv[1] && /le-e1-summary\.mjs$/.test(process.argv[1])) {
  // Fixed outer catch: nothing thrown below ever reaches stdout or stderr with its own text.
  try { main(process.argv.slice(2)); } catch { console.log('LE-E1 REFUSED LE_SUM_E_UNCLASSIFIED'); process.exit(2); }
}
