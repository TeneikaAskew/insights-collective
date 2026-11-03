#!/usr/bin/env node
// ABOUTME: Fixed-format summaries for run.sh. Every input is read through ONE bounded handle (open, fstat, read, close).
// ABOUTME: Output is fixed enums only (own-entry Map lookups) and computed integers; never a title, name, message or path.
// Every line matches the job's staging grammar LINE below (UPPER tokens and lower_key=value pairs only).
//
// CLI:
//   summary.mjs playwright <json> <playwright exit> <default|pending>  -> CASE lines + one PLAYWRIGHT line; exit 0 only when the
//       (project, case) inventory equals cases.json EXACTLY (no omission, duplicate or extra) and every case passed
//   summary.mjs witness <expected-seed> <pre> <post> <policy log>    -> WITNESS lines; exit 0 only when the pre SEED section
//       equals the committed projection exactly, SEED and CERT sections are unchanged pre->post, and the security_events delta
//       per actor equals the 'success' records of known actors in the sink. Unknown/malformed records: FAIL (exit 1).
//       Failed/pending telemetry: reported separately as non-fatal, verdict INCOMPLETE (exit 4), never PASS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LIMIT = 8 * 1024 * 1024;
export const LINE = /^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$/;

// Fixed output enums. Every emitted field is either one of these constants or an integer the code computed; no input
// string is ever printed, and lookups use Map#get (own entries only), so 'constructor' and friends map to the fallback.
const fixed = (pairs) => new Map(pairs);
export const PROJECTS = fixed(['rr-instructor', 'rr-admin', 'rr-learner', 'rr-error-pending'].map((p) => [p, p]));
export const CASES = fixed(['RR-I1', 'RR-I2', 'RR-I3', 'RR-I4', 'RR-I5', 'RR-M1', 'RR-M2', 'RR-A1', 'RR-L1', 'RR-L2', 'RR-L3', 'RR-P1'].map((c) => [c, c]));
export const STATUS = fixed([['expected', 'PASS'], ['unexpected', 'FAIL'], ['skipped', 'SKIP'], ['flaky', 'FLAKY']]);
export const SPEC_FILES = fixed(['instructor.spec.ts', 'admin.spec.ts', 'learner.spec.ts', 'mobile-keyboard.spec.ts', 'error.pending.ts', 'guarded-test.ts', 'helpers.ts', 'session-setup.ts'].map((f) => [f, f]));
export const VARIANTS = fixed([['default', 'default'], ['pending', 'pending']]);
const pick = (map, v, fallback) => (typeof v === 'string' && map.has(v) ? map.get(v) : fallback);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/**
 * Bounded same-handle reader (pattern of scripts/e2e/stack-ownership.mjs readRecord): ONE descriptor opened with
 * O_RDONLY|O_NOFOLLOW|O_NONBLOCK (a symlink fails at open; a FIFO opens at once and is refused by the type check);
 * fstat on that descriptor (regular file; for private inputs also 0600, this uid, nlink 1; size <= max); read at most
 * max+1 bytes (growth after fstat is refused); always close. Fixed SUMMARY_E_* codes only.
 */
export function readBounded(p, max = LIMIT, { privateFile = false } = {}) {
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK); }
  catch (e) { throw new Error(e && e.code === 'ELOOP' ? 'SUMMARY_E_NOT_FILE' : 'SUMMARY_E_OPEN'); }
  try {
    let st;
    try { st = fs.fstatSync(fd); } catch { throw new Error('SUMMARY_E_OPEN'); }
    if (!st.isFile()) throw new Error('SUMMARY_E_NOT_FILE');
    if (privateFile && ((st.mode & 0o777) !== 0o600 || st.nlink !== 1 || (typeof process.getuid === 'function' && st.uid !== process.getuid()))) throw new Error('SUMMARY_E_PRIVATE_FILE');
    if (st.size > max) throw new Error('SUMMARY_E_TOO_LARGE');
    const buf = Buffer.alloc(max + 1);
    let off = 0;
    for (;;) { const n = fs.readSync(fd, buf, off, max + 1 - off, off); if (n === 0) break; off += n; if (off > max) throw new Error('SUMMARY_E_TOO_LARGE'); }
    return buf.subarray(0, off).toString('utf8');
  } finally { fs.closeSync(fd); }
}

// Error category: a CLASSIFICATION of the first error message by fixed patterns, not a root cause. It is reported with
// the first error's pinned source location (spec file from SPEC_FILES, integer line) so the phase is locatable.
const CATEGORIES = [
  ['ORIGIN', /requests to non-approved origins/],
  ['POLICY', /forbidden API requests/],
  ['TIMEOUT', /Timeout|timed out|exceeded/i],
  ['ASSERTION', /expect\(|toHave|toEqual|toBe/],
];
const category = (msg) => (CATEGORIES.find(([, re]) => re.test(msg)) ?? ['OTHER'])[0];
const where = (e) => {
  const loc = e && typeof e === 'object' ? e.location : null;
  const file = pick(SPEC_FILES, loc && typeof loc.file === 'string' ? path.basename(loc.file) : undefined, 'OTHER');
  const line = int(loc?.line, 1, 99999);
  return ` file=${file} line=${line === null ? 'NONE' : line}`;
};

export function summarizePlaywright(report, pwExit, variant, cases) {
  const v = pick(VARIANTS, variant, null);
  const want = [...cases.default, ...(v === 'pending' ? cases.pendingExtra : [])].map(([p, c]) => `project=${pick(PROJECTS, p, 'OTHER')} case=${pick(CASES, c, 'UNKEYED')}`);
  const got = [];
  const lines = [];
  let bad = v === null;
  const walk = (s) => {
    for (const spec of (Array.isArray(s?.specs) ? s.specs : [])) for (const t of (Array.isArray(spec?.tests) ? spec.tests : [])) {
      const m = /^(RR-[A-Z]\d) /.exec(typeof spec.title === 'string' ? spec.title : '');
      const key = `project=${pick(PROJECTS, t?.projectName, 'OTHER')} case=${pick(CASES, m ? m[1] : undefined, 'UNKEYED')}`;
      got.push(key);
      const st = pick(STATUS, t?.status, 'OTHER');
      const errs = (Array.isArray(t?.results) ? t.results : []).flatMap((r) => (Array.isArray(r?.errors) ? r.errors : (r?.error ? [r.error] : [])));
      const e = errs[0];
      lines.push(`CASE ${st} ${key}${st === 'PASS' ? '' : ` category=${e === undefined ? 'NONE' : category(String(e?.message ?? ''))}${e === undefined ? '' : where(e)}`}`);
      if (st !== 'PASS') bad = true;
    }
    for (const c of (Array.isArray(s?.suites) ? s.suites : [])) walk(c);
  };
  for (const s of (Array.isArray(report?.suites) ? report.suites : [])) walk(s);
  const missing = want.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !want.includes(k));
  const dup = got.filter((k, i) => got.indexOf(k) !== i);
  const globalErrors = Array.isArray(report?.errors) ? report.errors.length : 0;
  const exit = int(typeof pwExit === 'number' ? pwExit : /^\d{1,3}$/.test(String(pwExit)) ? Number(pwExit) : NaN, 0, 255);
  if (missing.length || extra.length || dup.length || globalErrors || exit !== 0) bad = true;
  lines.sort();
  lines.push(`INVENTORY variant=${v ?? 'OTHER'} expected=${want.length} got=${got.length} missing=${missing.length} extra=${extra.length} duplicate=${dup.length}`);
  for (const k of missing) lines.push(`MISSING ${k}`);
  const g0 = globalErrors ? report.errors[0] : null;
  lines.push(`PLAYWRIGHT exit=${exit === null ? 'X' : exit} global_errors=${globalErrors}${g0 ? ` first=${category(String(g0?.message ?? ''))}${where(g0)}` : ''} verdict=${bad ? 'FAIL' : 'PASS'}`);
  return { ok: !bad, lines };
}

const section = (text, tag) => text.split('\n').filter((l) => l.startsWith(`${tag} `)).join('\n');

export function compareWitness(expectedSeed, pre, post, policyLog) {
  const lines = [];
  let ok = true;
  const seedPre = section(pre, 'SEED');
  const seedWant = expectedSeed.split('\n').filter((l) => l.startsWith('SEED ')).join('\n');
  const n = seedWant.split('\n').filter(Boolean).length;
  if (n === 0) { lines.push('WITNESS SEED_PROJECTION EMPTY'); ok = false; }
  else if (seedPre === seedWant) lines.push(`WITNESS SEED_PROJECTION MATCHES lines=${n}`);
  else { lines.push('WITNESS SEED_PROJECTION DIFFERS'); ok = false; }
  for (const tag of ['SEED', 'CERT']) {
    const a = section(pre, tag); const b = section(post, tag);
    if (a === b) lines.push(`WITNESS ${tag} UNCHANGED lines=${a.split('\n').filter(Boolean).length}`);
    else { lines.push(`WITNESS ${tag} CHANGED`); ok = false; }
  }
  // Telemetry: a separate, scoped reconciliation. Not learning data, and not a whole-history claim.
  const count = (text) => Object.fromEntries(section(text, 'TELEMETRY').split('\n').filter(Boolean).map((l) => {
    const m = /^TELEMETRY actor=(admin|instructor|member) security_events=(\d+)$/.exec(l);
    if (!m) throw new Error('SUMMARY_E_TELEMETRY_SHAPE');
    return [m[1], Number(m[2])];
  }));
  const before = count(pre); const after = count(post);
  // Every sink line must be exactly a canonical record. Only success by a known actor counts; anything else fails.
  const recorded = { admin: 0, instructor: 0, member: 0 };
  const bad = { unknown: 0, failed: 0, pending: 0, malformed: 0 };
  const KNOWN = new Set(['admin', 'instructor', 'member']);
  const lines2 = policyLog === '' ? [] : policyLog.split('\n');
  if (lines2.length && lines2.pop() !== '') bad.malformed += 1; // the file must end with a newline
  for (const l of lines2) {
    const m = /^\{"rpc":"log_security_event","actor":"(admin|instructor|member|unknown)","status":"(success|failed|pending)"\}$/.exec(l);
    if (!m) { bad.malformed += 1; continue; }
    if (m[2] !== 'success') bad[m[2]] += 1;
    else if (!KNOWN.has(m[1])) bad.unknown += 1;
    else recorded[m[1]] += 1;
  }
  for (const a of ['admin', 'instructor', 'member']) {
    if (!(a in before) || !(a in after)) { lines.push(`WITNESS TELEMETRY MISSING actor=${a}`); ok = false; continue; }
    const delta = after[a] - before[a];
    const match = delta === recorded[a];
    lines.push(`WITNESS TELEMETRY ${match ? 'RECONCILED' : 'MISMATCH'} actor=${a} delta=${delta} recorded=${recorded[a]}`);
    if (!match) ok = false;
  }
  // Unknown-actor or malformed records cannot be reconciled: FAIL. Failed or pending (unsettled) telemetry is product
  // logging that did not complete: reported separately and NON-FATAL to the product, but the run then cannot claim
  // complete preservation, so the verdict is INCOMPLETE (never PASS). Counts per actor are not event-identity proof.
  for (const k of ['unknown', 'malformed']) if (bad[k]) { lines.push(`WITNESS TELEMETRY ${k.toUpperCase()} count=${bad[k]}`); ok = false; }
  let incomplete = false;
  for (const k of ['failed', 'pending']) if (bad[k]) { lines.push(`WITNESS TELEMETRY_NONFATAL ${k.toUpperCase()} count=${bad[k]}`); incomplete = true; }
  lines.push('WITNESS TELEMETRY_PROOF scope=counts_per_actor identity=NOT_PROVEN');
  const verdict = !ok ? 'FAIL' : incomplete ? 'INCOMPLETE' : 'PASS';
  lines.push(`WITNESS verdict=${verdict}`);
  return { ok: verdict === 'PASS', verdict, lines };
}

function main(argv) {
  const [mode, ...a] = argv;
  try {
    if (mode === 'playwright' && a.length === 3 && ['default', 'pending'].includes(a[2])) {
      const cases = JSON.parse(readBounded(path.join(HERE, 'cases.json'), 65536));
      const r = summarizePlaywright(JSON.parse(readBounded(a[0], LIMIT, { privateFile: true })), a[1], a[2], cases);
      console.log(r.lines.join('\n'));
      return r.ok ? 0 : 1;
    }
    if (mode === 'witness' && a.length === 4) {
      const r = compareWitness(readBounded(a[0]), readBounded(a[1], LIMIT, { privateFile: true }), readBounded(a[2], LIMIT, { privateFile: true }), readBounded(a[3], 256 * 1024, { privateFile: true }));
      console.log(r.lines.join('\n'));
      return r.verdict === 'PASS' ? 0 : r.verdict === 'INCOMPLETE' ? 4 : 1;
    }
    console.log('SUMMARY_E_USAGE');
    return 2;
  } catch (e) {
    const code = /^SUMMARY_E_[A-Z_]+$/.test(String(e?.message)) ? e.message : 'SUMMARY_E_INPUT';
    console.log(code);
    return 3;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
