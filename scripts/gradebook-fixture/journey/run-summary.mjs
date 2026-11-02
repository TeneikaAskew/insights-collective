// ABOUTME: Fixed-summary validator for the journey adapter (UNRUN proposal): turns PRIVATE raw outputs (Playwright JSON
// ABOUTME: report, comparator stdout) into the only lines the evidence dir may hold. Raw text is never echoed.
//
//   node run-summary.mjs playwright <raw report.json> <exit code>   -> one line: PLAYWRIGHT exit=<n> expected=<n> ...
//   node run-summary.mjs compare <raw comparator stdout>            -> the comparator's lines, each matched to a fixed grammar
// Any line or field that does not match its grammar refuses (exit 3, "run-journey refused: SUMMARY_E_*"), so a stray
// value, path, URL, id or error message can never be staged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class SummaryError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'SummaryError'; }
}
const MAX_RAW = 32 * 1024 * 1024;
const COUNT_KEYS = ['expected', 'unexpected', 'flaky', 'skipped'];

/** @param {string} text raw JSON reporter output @param {string} exit @returns {string} */
export function playwrightSummary(text, exit) {
  if (!/^\d{1,3}$/.test(String(exit))) throw new SummaryError('SUMMARY_E_EXIT');
  let j;
  try { j = JSON.parse(text); } catch { throw new SummaryError('SUMMARY_E_PLAYWRIGHT_PARSE'); }
  const st = j && typeof j === 'object' ? j.stats : null;
  if (!st || typeof st !== 'object') throw new SummaryError('SUMMARY_E_PLAYWRIGHT_SHAPE');
  const n = {};
  for (const k of COUNT_KEYS) {
    if (!Number.isInteger(st[k]) || st[k] < 0 || st[k] > 1000) throw new SummaryError('SUMMARY_E_PLAYWRIGHT_SHAPE');
    n[k] = st[k];
  }
  const errors = Array.isArray(j.errors) ? j.errors.length : 0;
  return `PLAYWRIGHT exit=${Number(exit)} expected=${n.expected} unexpected=${n.unexpected} flaky=${n.flaky} skipped=${n.skipped} global_errors=${errors}`;
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

function readRaw(file) {
  let st;
  try { st = fs.lstatSync(file); } catch { throw new SummaryError('SUMMARY_E_RAW'); }
  if (!st.isFile() || st.size > MAX_RAW) throw new SummaryError('SUMMARY_E_RAW');
  try { return fs.readFileSync(file, 'utf8'); } catch { throw new SummaryError('SUMMARY_E_RAW'); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [cmd, file, exit] = process.argv.slice(2);
    if (cmd === 'playwright') console.log(playwrightSummary(readRaw(file), exit));
    else if (cmd === 'compare') console.log(compareSummary(readRaw(file)));
    else throw new SummaryError('SUMMARY_E_USAGE');
  } catch (e) {
    console.log(`run-journey refused: ${e instanceof SummaryError ? e.code : 'SUMMARY_E_UNCLASSIFIED'}`);
    process.exit(3);
  }
}
