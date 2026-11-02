// ABOUTME: Fixed-summary validator for the journey adapter (UNRUN proposal): turns PRIVATE raw outputs (Playwright JSON
// ABOUTME: report, comparator stdout) into the only lines the evidence dir may hold. Raw text is never echoed.
//
//   node run-summary.mjs playwright <raw report.json> <exit code> [<private diag dir>]
//                                                                  -> PLAYWRIGHT exit=<n> expected=<n> ... global_errors=<n>
//                                                                     GLOBAL first=<code> where=<place> diag=<code> diag_class=<name> diags=<n>
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
    + `GLOBAL first=${first} where=${where} ${diagSummary(diagDir)}`;
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
