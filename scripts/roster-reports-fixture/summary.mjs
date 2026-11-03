#!/usr/bin/env node
// ABOUTME: Fixed-format summaries for run.sh. Every input is read through ONE bounded handle (open, fstat, read, close).
// ABOUTME: Output is fixed enums only: case ids from cases.json, PASS/FAIL/SKIP/FLAKY, error categories; never titles or values.
// Every line matches the job's staging grammar LINE below (UPPER tokens and lower_key=value pairs only).
//
// CLI:
//   summary.mjs playwright <json> <playwright exit> <default|pending>  -> CASE lines + one PLAYWRIGHT line; exit 0 only when the
//       (project, case) inventory equals cases.json EXACTLY (no omission, duplicate or extra) and every case passed
//   summary.mjs witness <expected-seed> <pre> <post> <policy log>    -> WITNESS lines; exit 0 only when the pre SEED section
//       equals the committed projection exactly, SEED and CERT sections are unchanged pre->post, and the security_events delta
//       per actor equals the telemetry calls the request policy recorded with a 2xx status
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LIMIT = 8 * 1024 * 1024;
export const LINE = /^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*| [a-z][a-z0-9_]*=[A-Za-z0-9_.,-]{1,64})*$/;
const tok = (v) => (/^[A-Za-z0-9_.,-]{1,64}$/.test(String(v)) ? String(v) : 'X');

/** Read a regular file through a single handle, refusing links, non-files and anything over `max` bytes. */
export function readBounded(p, max = LIMIT) {
  const fd = fs.openSync(p, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw new Error('SUMMARY_E_NOT_FILE');
    if (st.size > max) throw new Error('SUMMARY_E_TOO_LARGE');
    const buf = Buffer.alloc(st.size);
    let off = 0;
    while (off < st.size) { const n = fs.readSync(fd, buf, off, st.size - off, off); if (n === 0) break; off += n; }
    if (off !== st.size) throw new Error('SUMMARY_E_SHORT_READ');
    return buf.toString('utf8');
  } finally { fs.closeSync(fd); }
}

const CATEGORIES = [
  ['ORIGIN', /requests to non-approved origins/],
  ['POLICY', /forbidden API requests/],
  ['TIMEOUT', /Timeout|timed out|exceeded/i],
  ['ASSERTION', /expect\(|toHave|toEqual|toBe/],
];
const category = (msg) => (CATEGORIES.find(([, re]) => re.test(msg)) ?? ['OTHER'])[0];
const STATUS = { expected: 'PASS', unexpected: 'FAIL', skipped: 'SKIP', flaky: 'FLAKY' };

export function summarizePlaywright(report, pwExit, variant, cases) {
  const want = [...cases.default, ...(variant === 'pending' ? cases.pendingExtra : [])].map(([p, c]) => `project=${p} case=${c}`);
  const got = [];
  const lines = [];
  let bad = false;
  const walk = (s) => {
    for (const spec of s.specs ?? []) for (const t of spec.tests ?? []) {
      const m = /^(RR-[A-Z]\d) /.exec(spec.title ?? '');
      const id = m ? m[1] : 'UNKEYED';
      const key = `project=${/^[a-z0-9-]{1,40}$/.test(t.projectName ?? '') ? t.projectName : 'OTHER'} case=${id}`;
      got.push(key);
      const st = STATUS[t.status] ?? 'OTHER';
      const err = (t.results ?? []).flatMap((r) => r.errors ?? (r.error ? [r.error] : [])).map((e) => String(e?.message ?? ''))[0];
      lines.push(`CASE ${st} ${key}${st === 'PASS' ? '' : ` category=${err === undefined ? 'NONE' : category(err)}`}`);
      if (st !== 'PASS') bad = true;
    }
    for (const c of s.suites ?? []) walk(c);
  };
  for (const s of report.suites ?? []) walk(s);
  const missing = want.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !want.includes(k));
  const dup = got.filter((k, i) => got.indexOf(k) !== i);
  const globalErrors = (report.errors ?? []).length;
  if (missing.length || extra.length || dup.length || globalErrors || String(pwExit) !== '0') bad = true;
  lines.sort();
  lines.push(`INVENTORY variant=${tok(variant)} expected=${want.length} got=${got.length} missing=${missing.length} extra=${extra.length} duplicate=${dup.length}`);
  for (const k of missing) lines.push(`MISSING ${k}`);
  lines.push(`PLAYWRIGHT exit=${/^\d{1,3}$/.test(String(pwExit)) ? pwExit : 'X'} global_errors=${globalErrors}${globalErrors ? ` first=${category(String(report.errors[0]?.message ?? ''))}` : ''} verdict=${bad ? 'FAIL' : 'PASS'}`);
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
  const recorded = { admin: 0, instructor: 0, member: 0 };
  let unattributed = 0;
  for (const l of policyLog.split('\n').filter(Boolean)) {
    const r = JSON.parse(l);
    if (r.rpc !== 'log_security_event' || !(r.status >= 200 && r.status < 300)) continue;
    if (r.actor in recorded) recorded[r.actor] += 1; else unattributed += 1;
  }
  for (const a of ['admin', 'instructor', 'member']) {
    if (!(a in before) || !(a in after)) { lines.push(`WITNESS TELEMETRY MISSING actor=${a}`); ok = false; continue; }
    const delta = after[a] - before[a];
    const match = delta === recorded[a];
    lines.push(`WITNESS TELEMETRY ${match ? 'RECONCILED' : 'MISMATCH'} actor=${a} delta=${delta} recorded=${recorded[a]}`);
    if (!match) ok = false;
  }
  if (unattributed) { lines.push(`WITNESS TELEMETRY UNATTRIBUTED count=${unattributed}`); ok = false; }
  lines.push(`WITNESS verdict=${ok ? 'PASS' : 'FAIL'}`);
  return { ok, lines };
}

function main(argv) {
  const [mode, ...a] = argv;
  try {
    if (mode === 'playwright' && a.length === 3 && ['default', 'pending'].includes(a[2])) {
      const cases = JSON.parse(readBounded(path.join(HERE, 'cases.json'), 65536));
      const r = summarizePlaywright(JSON.parse(readBounded(a[0])), a[1], a[2], cases);
      console.log(r.lines.join('\n'));
      return r.ok ? 0 : 1;
    }
    if (mode === 'witness' && a.length === 4) {
      const r = compareWitness(readBounded(a[0]), readBounded(a[1]), readBounded(a[2]), readBounded(a[3]));
      console.log(r.lines.join('\n'));
      return r.ok ? 0 : 1;
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
