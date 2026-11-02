// ABOUTME: Fixed-summary validator for the journey adapter (UNRUN proposal): turns PRIVATE raw outputs (Playwright JSON
// ABOUTME: report, comparator stdout) into the only lines the evidence dir may hold. Raw text is never echoed.
//
//   node run-summary.mjs playwright <raw report.json> <exit code> [<private diag dir>]
//                                                                  -> PLAYWRIGHT exit=<n> expected=<n> ... global_errors=<n>
//                                                                     GLOBAL first=<code> where=<place> diag=<code> diag_class=<name> diags=<n>
//                                                                     CASE <id> status=<S> stage=<G> where=<W> line=<n> cat=<C> obs=<O> errors=<n> all=<G.W.n.C,...> attempts=<n>  (x12)
//                                                                     CASES known=<n> unknown=<n>
//   node run-summary.mjs compare <raw comparator stdout>            -> the comparator's lines, each matched to a fixed grammar
//   node run-summary.mjs shots <raw shot-export stdout>             -> the export manifest, each line matched to its grammar
// Any line or field that does not match its grammar refuses (exit 3, "run-journey refused: SUMMARY_E_*"), so a stray
// value, path, URL, id or error message can never be staged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOT_NAMES, WITHHELD_REASONS } from '../../../e2e/gradebook-roles/journey/shot-core.mjs';
import { BLOCKED_CODE_RE } from '../../../e2e/gradebook-roles/journey/blocked-class.mjs';

export class SummaryError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'SummaryError'; }
}
const MAX_RAW = 32 * 1024 * 1024;
const COUNT_KEYS = ['expected', 'unexpected', 'flaky', 'skipped'];

// Global-error classification. Every value staged here comes from a FIXED list: the journey setup chain's own gate codes
// (session-setup.ts, private-dir.mjs, pairing-proof.mjs), a fixed place, a fixed error-class name, or NONE/OTHER. The
// error message, stack, file path, value and the diag file's message are never echoed.
const ROLE_SUFFIX = ['INSTRUCTOR', 'MEMBER'];
const PER_ROLE = ['NO_PASSWORD', 'SIGNIN_TRANSPORT', 'SIGNIN_PARSE', 'SIGNIN_SHAPE', 'SESSION_SERIALIZE', 'BROWSER_LAUNCH', 'CONTEXT',
  'INIT_SCRIPT', 'PAGE', 'GOTO', 'SETTLE', 'STORAGE_STATE', 'SESSION_NOT_PERSISTED', 'STATE_SERIALIZE', 'PROGRESS', 'BROWSER_CLOSE'];
const SETUP_PLAIN = ['BINDING', 'COMPOSITION_NOT_R5', 'FOREIGN_ORIGIN_BLOCKED', 'FOREIGN_API', 'APP_NEVER_CALLED_API', 'SESSION_DIR_LIST',
  'SESSION_DIR_CONTENT', 'UNCLASSIFIED'];
const DIR_GATE = ['NOT_ABSOLUTE', 'MISSING', 'SYMLINK', 'NOT_DIR', 'INSIDE_REPO', 'MODE', 'OWNER', 'UNREADABLE', 'NOT_EMPTY'];
const GATE1_FILE = ['FILENAME', 'EXCLUSIVE_CREATE', 'WRITE', 'CLOSE', 'FILE_MODE', 'STATE_PARSE', 'STATE_MISSING', 'STATE_MODE'];
const GATE3 = ['NO_SESSION_DIR', 'NO_PROOF', 'NOT_FILE', 'MODE', 'OWNER', 'IN_SESSION_DIR', 'PARENT', 'PARSE', 'VERSION', 'SHAPE',
  'STACK_ID', 'CARRIER', 'DB_MISMATCH', 'API_MISMATCH', 'ORDER', 'LIVE_TRANSPORT', 'LIVE_STATUS', 'LIVE_PARSE', 'LIVE_CONTROL_ID',
  'LIVE_COUNT', 'LIVE_SHAPE', 'LIVE_MISMATCH', 'LIVE_NOT_FILTERING'];
export const GLOBAL_CODES = new Set([
  ...SETUP_PLAIN.map((c) => `JOURNEY_SETUP_E_${c}`),
  ...PER_ROLE.flatMap((c) => ROLE_SUFFIX.map((r) => `JOURNEY_SETUP_E_${c}_${r}`)),
  ...DIR_GATE.flatMap((c) => [`JOURNEY_GATE1_E_${c}`, `JOURNEY_GATE2_E_${c}`]),
  ...GATE1_FILE.map((c) => `JOURNEY_GATE1_E_${c}`),
  'JOURNEY_GATE2_E_SAME_AS_SESSION_DIR',
  ...GATE3.map((c) => `JOURNEY_GATE3_E_${c}`),
]);
const SIGNIN_HTTP = /^JOURNEY_SETUP_E_SIGNIN_HTTP_[1-5][0-9]{2}_(?:INSTRUCTOR|MEMBER)$/;
/** @param {unknown} c */
export const globalCode = (c) => (typeof c === 'string' && (GLOBAL_CODES.has(c) || SIGNIN_HTTP.test(c) || BLOCKED_CODE_RE.test(c)) ? c : 'OTHER');
const DIAG_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'TimeoutError', 'AbortError', 'JourneyGateError']);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SETUP_FILES = ['session-setup.ts', 'private-dir.mjs', 'pairing-proof.mjs', 'blocked-class.mjs'].map((f) => `e2e/gradebook-roles/journey/${f}`)
  .concat(['e2e/gradebook-roles/local-binding.mjs', 'e2e/gradebook-roles/origin-guard.mjs', 'e2e/support/chromium-executable.ts']);
const SPEC_FILES = ['j0-learner-before-publish', 'j1-instructor-publish', 'j2-learner-enroll-submit', 'j3-instructor-grade',
  'j4-learner-readback-certificate'].map((f) => `e2e/gradebook-roles/journey/${f}.spec.ts`);
/** @param {unknown} loc a reporter error location @param {string} root */
function wherePlace(loc, root) {
  if (loc === undefined || loc === null) return 'NONE';
  const f = loc && typeof loc === 'object' ? loc.file : null;
  if (typeof f !== 'string') return 'OTHER';
  const at = (list) => list.some((r) => f === path.join(root, r));
  return at(SETUP_FILES) ? 'SETUP' : at(SPEC_FILES) ? 'SPEC' : f === path.join(root, 'playwright.gradebook-roles.config.ts') ? 'CONFIG' : 'OTHER';
}
/** The first private diag record's fixed stage code and error class only (its message is never read out). */
function diagSummary(dir) {
  if (!dir) return 'diag=NONE diag_class=NONE diags=0';
  let names;
  try { names = fs.readdirSync(dir); } catch { return 'diag=OTHER diag_class=OTHER diags=0'; }
  if (names.length === 0) return 'diag=NONE diag_class=NONE diags=0';
  if (names.length > 99 || names.some((n) => !/^diag-[0-9]{3}\.json$/.test(n))) return `diag=OTHER diag_class=OTHER diags=${Math.min(names.length, 99)}`;
  let d;
  try { d = JSON.parse(readRaw(path.join(dir, names.sort()[0]))); } catch { return `diag=OTHER diag_class=OTHER diags=${names.length}`; }
  const cls = d && typeof d === 'object' && DIAG_CLASSES.has(d.name) ? d.name : 'OTHER';
  return `diag=${globalCode(d && typeof d === 'object' ? d.code : null)} diag_class=${cls} diags=${names.length}`;
}

// Per-case lines (r1, after run 41479414128): one line per journey case, in the fixed journey order, from the JSON report's
// test results. Every field is a fixed enum, a source line number in a known repository file, or a count. The error message
// is only matched against fixed patterns; it, the stack, any title text, URL, id or value is never echoed.
export const CASES = Object.freeze([
  ['J0a', 'jr-0-learner-draft'], ['J0b', 'jr-0-learner-draft'], ['J1', 'jr-1-instructor-publish'], ['J2a', 'jr-2-learner-submit'],
  ['J2b', 'jr-2-learner-submit'], ['J2c', 'jr-2-learner-submit'], ['J3a', 'jr-3-instructor-grade'], ['J3b', 'jr-3-instructor-grade'],
  ['J4a', 'jr-4-learner-readback'], ['J4b', 'jr-4-learner-readback'], ['J4c', 'jr-4-learner-readback'], ['J4d', 'jr-4-learner-readback'],
]);
// Maps, not object literals: a report value such as "constructor" or "__proto__" must not resolve an inherited member.
const STATUS = new Map([['passed', 'PASSED'], ['failed', 'FAILED'], ['timedOut', 'TIMEDOUT'], ['skipped', 'SKIPPED'], ['interrupted', 'INTERRUPTED']]);
// Explicit matcher allowlist (the matchers the journey, its helpers and fixtures use, plus the common locator states). A
// matcher-shaped name that is not listed is OTHER: the category is never built from report text.
const MATCHERS = new Map([
  ['toBe', 'TO_BE'], ['toBeChecked', 'TO_BE_CHECKED'], ['toBeDisabled', 'TO_BE_DISABLED'], ['toBeEnabled', 'TO_BE_ENABLED'],
  ['toBeGreaterThan', 'TO_BE_GREATER_THAN'], ['toBeHidden', 'TO_BE_HIDDEN'], ['toBeNull', 'TO_BE_NULL'], ['toBeTruthy', 'TO_BE_TRUTHY'],
  ['toBeVisible', 'TO_BE_VISIBLE'], ['toContain', 'TO_CONTAIN'], ['toContainText', 'TO_CONTAIN_TEXT'], ['toEqual', 'TO_EQUAL'],
  ['toHaveCount', 'TO_HAVE_COUNT'], ['toHaveLength', 'TO_HAVE_LENGTH'], ['toHaveText', 'TO_HAVE_TEXT'], ['toHaveURL', 'TO_HAVE_URL'],
  ['toHaveValue', 'TO_HAVE_VALUE'], ['toMatch', 'TO_MATCH'],
]);
// Known files a case error can point at. line=<n> is printed only for these (a source line, never data).
const CASE_FILES = [
  ...SPEC_FILES.map((f) => [f, 'SPEC']),
  ['e2e/gradebook-roles/journey/observe.ts', 'OBSERVE'], ['e2e/gradebook-roles/journey/observe-core.mjs', 'OBSERVE'],
  ['e2e/gradebook-roles/journey/progress-oracle.ts', 'ORACLE'], ['e2e/gradebook-roles/journey/shot-core.mjs', 'SHOT'],
  ['e2e/gradebook-roles/guarded-test.ts', 'FIXTURE_ORIGIN'], ['e2e/fixtures/console-errors.fixture.ts', 'FIXTURE_CONSOLE'],
  ['e2e/fixtures/page-helpers.ts', 'HELPER'],
];
// API paths the journey's own call expectations name (observe-core labels are "<METHOD> <path>"), as fixed names.
const OBS_PATHS = {
  '/rest/v1/assignment_submissions': 'ASSIGNMENT_SUBMISSIONS', '/rest/v1/certificates': 'CERTIFICATES',
  '/rest/v1/content_item_progressions': 'CONTENT_ITEM_PROGRESSIONS', '/rest/v1/courses': 'COURSES', '/rest/v1/enrollments': 'ENROLLMENTS',
  '/rest/v1/rpc/log_submission_file_access': 'RPC_LOG_SUBMISSION_FILE_ACCESS', '/rest/v1/submission_attachments': 'SUBMISSION_ATTACHMENTS',
};
const OBS_CODES = ['OBS_NEAR_MISS', 'OBS_COUNT', 'OBS_PENDING', 'OBS_FAILED', 'OBS_STATUS', 'OBS_ORDER'];
const obsPath = (p) => (Object.hasOwn(OBS_PATHS, p) ? OBS_PATHS[p] : null) ?? (p.startsWith('/storage/v1/object/course-documents/') ? 'STORAGE_COURSE_DOCUMENTS' : 'OTHER');
/** Fixed tokens from the observe failure list in the message: code, method, path name, and the trailing number (a count or an HTTP status). */
function obsTokens(msg) {
  const out = [];
  for (const m of msg.replace(/\u001b\[[0-9;]*m/g, '').matchAll(/"(OBS_[A-Z_]{3,12})(?: (GET|POST|PATCH|PUT|DELETE|HEAD) (\/[^\s"]{1,200}))?(?: ([0-9]{1,3}))?"/g)) {
    if (!OBS_CODES.includes(m[1])) { out.push('OTHER'); continue; }
    out.push([m[1], m[2] ?? '', m[3] ? obsPath(m[3]) : '', m[4] ?? ''].filter(Boolean).join(':'));
    if (out.length >= 6) break;
  }
  return out.length ? [...new Set(out)].join(',') : 'NONE';
}
/** Fixed error category. A custom assertion message (and, for the console fixture, the listed console lines) precedes the
 *  matcher line, so up to 400 lines are scanned for a WHOLE line that is a matcher call; every other pattern is matched on the
 *  first line only. Only the enum derived from the match is returned; no line is ever echoed. */
function caseCategory(msg) {
  const lines = msg.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 400);
  const first = lines[0];
  let m = null;
  for (const l of lines) { m = /^(?:Error: )?expect\((?:locator|page|received|value)\)\.(not\.)?(to[A-Z][A-Za-z]{1,30})\(/.exec(l.trim()); if (m) break; }
  if (m) return MATCHERS.has(m[2]) ? `EXPECT_${m[1] ? 'NOT_' : ''}${MATCHERS.get(m[2])}` : 'OTHER';
  if (/^Test timeout of [0-9]{1,7}ms exceeded/.test(first)) return 'TEST_TIMEOUT';
  if (/^(?:Error: )?(?:locator|page)\.[a-zA-Z]{2,24}: Timeout [0-9]{1,7}ms exceeded/.test(first) || /^TimeoutError\b/.test(first)) return 'ACTION_TIMEOUT';
  if (/^(?:Error: )?(?:page|locator)\.[a-zA-Z]{2,24}: (?:net::ERR_|Navigation)/.test(first)) return 'NAVIGATION';
  m = /^(?:JourneyGateError|Error): ((?:JOURNEY|RUN|SHOT|OBS|RS)_[A-Z0-9_]{2,60})$/.exec(first);
  if (m) return globalCode(m[1]) !== 'OTHER' ? m[1] : 'JOURNEY_CODE';
  return 'OTHER';
}
// Stage of one error, from where it points: the test body, the screenshot capture, or a fixture teardown assertion (the
// origin guard and the console fixture assert only after the test body returns). A spec line that calls shot() is CAPTURE;
// the repo's own source line is read only to test that, and nothing from it is printed.
const STAGE_OF = new Map([['SPEC', 'BODY'], ['OBSERVE', 'BODY'], ['ORACLE', 'BODY'], ['HELPER', 'BODY'], ['SHOT', 'CAPTURE']]);
// Fixture files: only the declared line ranges are named. SETUP = the fixture's own lines before use(); TEARDOWN = the exact
// post-use assertion statements. Any other line (the use() line itself, listener removal, past EOF, missing) is UNKNOWN.
// The selftest pins these ranges against the checked-out source, so a fixture edit that moves them fails there first.
export const FIXTURE_RANGES = Object.freeze({
  // guarded-test.ts: 8 fixture start, 9 installOriginGuard, 10 use(blocked), 11 expect(blocked).toEqual([]).
  FIXTURE_ORIGIN: { SETUP: [[8, 9]], TEARDOWN: [[11, 11]] },
  // console-errors.fixture.ts: 381 fixture start .. 461 before use(errors) at 462; post-use assertions: relay bypass 470-476,
  // structural Supabase issues 493-500, console errors 508-511.
  FIXTURE_CONSOLE: { SETUP: [[381, 461]], TEARDOWN: [[470, 476], [493, 500], [508, 511]] },
});
function fixtureStage(where, line) {
  const r = FIXTURE_RANGES[where];
  if (!line) return 'UNKNOWN';
  for (const k of ['SETUP', 'TEARDOWN']) if (r[k].some(([a, b]) => line >= a && line <= b)) return k;
  return 'UNKNOWN';
}
const srcCache = new Map();
const srcLines = (file) => {
  if (!srcCache.has(file)) { let t = null; try { t = fs.readFileSync(file, 'utf8').split('\n'); } catch { /* unknown stays UNKNOWN */ } srcCache.set(file, t); }
  return srcCache.get(file);
};
function specLineIsShot(file, line) {
  const t = srcLines(file);
  return t && line > 0 && line <= t.length ? (/\bshot\(/.test(t[line - 1]) ? 'CAPTURE' : 'BODY') : 'UNKNOWN';
}
// observe.ts holds both the call expectations (BODY) and the shot() wrapper (CAPTURE): a line inside the wrapper, from its
// "export async function shot(" line to its closing "}" at column 0, is CAPTURE.
function observeStage(file, line) {
  const t = srcLines(file);
  if (!t || line < 1 || line > t.length) return 'UNKNOWN';
  const start = t.findIndex((l) => /^export async function shot\(/.test(l));
  if (start < 0) return 'BODY';
  let end = t.findIndex((l, i) => i > start && l === '}');
  if (end < 0) end = t.length - 1;
  return line - 1 >= start && line - 1 <= end ? 'CAPTURE' : 'BODY';
}
/** One error as fixed parts: stage, where, line, category, observe tokens. */
function errorParts(e0, root) {
  const e = e0 && typeof e0 === 'object' ? e0 : {};
  const loc = e.location && typeof e.location === 'object' ? e.location : null;
  const hit = loc && typeof loc.file === 'string' ? CASE_FILES.find(([f]) => loc.file === path.join(root, f)) : null;
  const where = loc ? (hit ? hit[1] : 'OTHER') : 'NONE';
  const line = hit && Number.isInteger(loc.line) && loc.line > 0 && loc.line < 10000 ? loc.line : 0;
  const msg = typeof e.message === 'string' ? e.message : '';
  const cat = msg ? caseCategory(msg) : 'NONE';
  let stage = STAGE_OF.has(where) ? STAGE_OF.get(where) : 'UNKNOWN';
  if (where === 'FIXTURE_ORIGIN' || where === 'FIXTURE_CONSOLE') stage = fixtureStage(where, line);
  if (where === 'SPEC') stage = line ? specLineIsShot(path.join(root, hit[0]), line) : 'UNKNOWN';
  if (where === 'OBSERVE' && hit[0].endsWith('observe.ts')) stage = line ? observeStage(path.join(root, hit[0]), line) : 'UNKNOWN';
  if (cat === 'TEST_TIMEOUT' && where === 'NONE') stage = 'TIMEOUT';
  return { stage, where, line, cat, obs: where === 'OBSERVE' ? obsTokens(msg) : 'NONE' };
}
function caseLine(id, tests, root) {
  const empty = 'stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE';
  if (tests.length === 0) return `CASE ${id} status=ABSENT ${empty} attempts=0`;
  if (tests.length > 1) return `CASE ${id} status=DUPLICATE ${empty} attempts=0`;
  const results = Array.isArray(tests[0].results) ? tests[0].results : [];
  const r = results.length ? results[results.length - 1] : null;
  const status = r ? (typeof r.status === 'string' && STATUS.has(r.status) ? STATUS.get(r.status) : 'OTHER') : 'NORESULT';
  const errs = r && Array.isArray(r.errors) ? r.errors : [];
  // status and errors are the LAST attempt's (retries are 0 in this config); attempts counts all results, never aggregates.
  const att = ` attempts=${Math.min(results.length, 9)}`;
  if (!errs.length) return `CASE ${id} status=${status} ${empty}${att}`;
  // Every error, not just the first (a body failure can be followed by a teardown failure): up to 4, in report order.
  const parts = errs.slice(0, 4).map((e) => errorParts(e, root));
  const f = parts[0];
  const all = parts.map((p) => `${p.stage}.${p.where}.${p.line}.${p.cat}`).join(',') + (errs.length > 4 ? ',MORE' : '');
  return `CASE ${id} status=${status} stage=${f.stage} where=${f.where} line=${f.line} cat=${f.cat} obs=${f.obs} errors=${Math.min(errs.length, 99)} all=${all}${att}`;
}
/** Every test in the report with its project name and title (titles are only matched, never printed). */
function reportTests(j) {
  const out = [];
  const walk = (suite, depth) => {
    if (!suite || typeof suite !== 'object' || depth > 8) return;
    for (const sp of Array.isArray(suite.specs) ? suite.specs : []) {
      for (const t of Array.isArray(sp && sp.tests) ? sp.tests : []) out.push({ title: typeof sp.title === 'string' ? sp.title : '', project: t && t.projectName, results: t && t.results });
    }
    for (const s of Array.isArray(suite.suites) ? suite.suites : []) walk(s, depth + 1);
  };
  for (const s of Array.isArray(j.suites) ? j.suites : []) walk(s, 0);
  return out;
}
export function caseLines(j, root = ROOT) {
  const tests = reportTests(j);
  const known = new Set();
  const lines = CASES.map(([id, project]) => {
    const mine = tests.filter((t) => t.project === project && t.title.startsWith(`${id} `));
    for (const t of mine) known.add(t);
    return caseLine(id, mine, root);
  });
  lines.push(`CASES known=${known.size} unknown=${Math.min(tests.length - known.size, 999)}`);
  return lines.join('\n');
}

/** @param {string} text raw JSON reporter output @param {string} exit @param {string} [diagDir] @param {string} [root] @returns {string} */
export function playwrightSummary(text, exit, diagDir = '', root = ROOT) {
  if (!/^\d{1,3}$/.test(String(exit))) throw new SummaryError('SUMMARY_E_EXIT');
  // No report at all: the config failed to load or the runner never started a reporter.
  if (text.trim() === '') throw new SummaryError('SUMMARY_E_PLAYWRIGHT_EMPTY');
  let j;
  try { j = JSON.parse(text); } catch {
    // A report preceded by stray process stdout (something wrote to stdout in the runner process).
    const at = text.indexOf('\n{');
    if (text[0] !== '{' && at >= 0) { try { JSON.parse(text.slice(at + 1)); } catch { throw new SummaryError('SUMMARY_E_PLAYWRIGHT_PARSE'); } throw new SummaryError('SUMMARY_E_PLAYWRIGHT_POLLUTED'); }
    throw new SummaryError('SUMMARY_E_PLAYWRIGHT_PARSE');
  }
  const st = j && typeof j === 'object' ? j.stats : null;
  if (!st || typeof st !== 'object') throw new SummaryError('SUMMARY_E_PLAYWRIGHT_SHAPE');
  const n = {};
  for (const k of COUNT_KEYS) {
    if (!Number.isInteger(st[k]) || st[k] < 0 || st[k] > 1000) throw new SummaryError('SUMMARY_E_PLAYWRIGHT_SHAPE');
    n[k] = st[k];
  }
  const errs = Array.isArray(j.errors) ? j.errors : [];
  let first = 'NONE', where = 'NONE';
  if (errs.length) {
    const e = errs[0];
    const line = e && typeof e === 'object' && typeof e.message === 'string' ? e.message.split('\n')[0] : '';
    const m = /^JourneyGateError: ([A-Z0-9_]{1,120})$/.exec(line);
    first = m ? globalCode(m[1]) : 'OTHER';
    where = wherePlace(e && typeof e === 'object' ? e.location : null, root);
  }
  return `PLAYWRIGHT exit=${Number(exit)} expected=${n.expected} unexpected=${n.unexpected} flaky=${n.flaky} skipped=${n.skipped} global_errors=${errs.length}\n`
    + `GLOBAL first=${first} where=${where} ${diagSummary(diagDir)}\n`
    + caseLines(j, root);
}

const COMPARE_LINE = [
  /^FAIL W_[A-Z_]+$/,
  /^FAIL W_[A-Z_]+ [A-Za-z0-9_.]{1,64}$/,
  /^PROTECTED (?:-|[a-z_]{1,64}(?:,[a-z_]{1,64})*)$/,
  /^UNPROVEN-EMPTY (?:-|[a-z_]{1,64}(?:,[a-z_]{1,64})*)$/,
  /^(?:PASS|FAIL) journey witness comparison$/,
];
/** @param {string} text raw comparator stdout @returns {string} */
export function compareSummary(text) {
  const lines = text.split('\n').filter((l) => l !== '');
  if (!lines.length || lines.length > 200) throw new SummaryError('SUMMARY_E_COMPARE_SHAPE');
  for (const l of lines) if (!COMPARE_LINE.some((re) => re.test(l))) throw new SummaryError('SUMMARY_E_COMPARE_LINE');
  if (!/^(?:PASS|FAIL) journey witness comparison$/.test(lines[lines.length - 1])) throw new SummaryError('SUMMARY_E_COMPARE_SHAPE');
  return lines.join('\n');
}

const SHOT_LINE = /^SHOT (J[0-4][a-d]?-[a-z-]{3,48}) sha256=[0-9a-f]{64} bytes=[1-9][0-9]{0,7} width=[1-9][0-9]{0,4} height=[1-9][0-9]{0,4}$/;
const WITHHELD_LINE = /^WITHHELD (J[0-4][a-d]?-[a-z-]{3,48}) reason=([A-Z_]{4,24})$/;
/** @param {string} text raw shot-export stdout @param {readonly string[]} names the allowlist @param {readonly string[]} reasons @returns {string} */
export function shotsSummary(text, names, reasons) {
  const lines = text.split('\n').filter((l) => l !== '');
  if (!lines.length) throw new SummaryError('SUMMARY_E_SHOTS_SHAPE');
  const last = lines.pop();
  const m = /^SHOTS (\d{1,2}) captured (\d{1,2}) withheld of (\d{1,2})$/.exec(last);
  if (!m || Number(m[3]) !== names.length) throw new SummaryError('SUMMARY_E_SHOTS_SHAPE');
  let at = -1, cap = 0, wh = 0;
  for (const l of lines) {
    const s = SHOT_LINE.exec(l), w = WITHHELD_LINE.exec(l);
    const i = s ? names.indexOf(s[1]) : w && reasons.includes(w[2]) ? names.indexOf(w[1]) : -1;
    if (i <= at) throw new SummaryError('SUMMARY_E_SHOTS_LINE');   // unknown, duplicate, out of allowlist order, odd reason
    at = i; if (s) cap++; else wh++;
  }
  if (Number(m[1]) !== cap || Number(m[2]) !== wh) throw new SummaryError('SUMMARY_E_SHOTS_SHAPE');
  return [...lines, last].join('\n');
}

/** The raw input, checked and read through ONE descriptor (O_NOFOLLOW, O_NONBLOCK, fstat), bounded to MAX_RAW. */
export function readRaw(file) {
  let fd;
  try { fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { throw new SummaryError('SUMMARY_E_RAW'); }
  let ok = false, buf = null;
  try {
    const st = fs.fstatSync(fd);
    if (st.isFile() && st.size <= MAX_RAW) {
      buf = Buffer.alloc(MAX_RAW + 1);
      let n = 0;
      for (;;) { const r = fs.readSync(fd, buf, n, buf.length - n, null); if (r === 0) break; n += r; if (n > MAX_RAW) break; }
      if (n <= MAX_RAW) { buf = buf.subarray(0, n); ok = true; }
    }
  } catch { ok = false; }
  finally { try { fs.closeSync(fd); } catch { ok = false; } }
  if (!ok) throw new SummaryError('SUMMARY_E_RAW');
  try { return new TextDecoder('utf-8').decode(buf); } catch { throw new SummaryError('SUMMARY_E_RAW'); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [cmd, file, exit] = process.argv.slice(2);
    if (cmd === 'playwright') console.log(playwrightSummary(readRaw(file), exit, process.argv[5] ?? ''));
    else if (cmd === 'compare') console.log(compareSummary(readRaw(file)));
    else if (cmd === 'shots') console.log(shotsSummary(readRaw(file), SHOT_NAMES, WITHHELD_REASONS));
    else throw new SummaryError('SUMMARY_E_USAGE');
  } catch (e) {
    console.log(`run-journey refused: ${e instanceof SummaryError ? e.code : 'SUMMARY_E_UNCLASSIFIED'}`);
    process.exit(3);
  }
}
