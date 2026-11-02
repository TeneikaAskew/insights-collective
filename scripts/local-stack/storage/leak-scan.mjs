#!/usr/bin/env node
// ABOUTME: Secondary, field-aware leak tripwire for the Storage composition: scans the public evidence for exact byte strings
// ABOUTME: derived from the private pins (P1..P5). It is NOT the confidentiality control and a PASS is NOT proof of no leak.
//
// The primary controls are elsewhere: the private input is bound to one step, raw psql streams stay in the private dir,
// and every public line is a fixed format (digests, PASS/FAIL, fixed codes). This scan only catches a regression that
// copies a recognisable field verbatim into a staged file.
//
// Fields (from the private pins.tsv, never printed):
//   P1  each policy name of 12 bytes or more, and its base64
//   P2  each full USING / WITH CHECK expression, and its base64
//   P3  each top-level AND clause (outside quotes and parentheses) of 24 bytes or more
//   P4  each course bucket MIME list (comma joined), and its base64
//   P5  each course bucket size limit, matched as a number with no letter or digit on either side
// Any candidate that already occurs in the public tree (the reference files) is dropped, so ordinary words, public
// helper names and numbers that the repository already publishes cannot cause a false failure.
//
// CLI: leak-scan.mjs <priv dir> <reference list file> <evidence dir>
//   <reference list file>: NUL-separated repository-relative paths (git ls-files -z), read relative to the cwd.
// Output: exactly "LEAKSCAN PASS", or one "LEAKSCAN FAIL <relative path> <P#>" line per hit (no matched text), then exit 1.
// Unreadable or oversized evidence entries print "LEAKSCAN FAIL <relative path> UNSCANNABLE". Refusals print
// "leak-scan refused: <CODE>" and exit 3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageError, parsePins, COURSE_BUCKETS } from './storage-core.mjs';
import { assertPrivateDir, readPrivate, PINS_FILE } from './storage-job.mjs';

export const MAX_SCAN_FILE = 64 * 1024 * 1024;
export const MAX_REFERENCE_FILE = 8 * 1024 * 1024;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const refuse = (c) => { throw new StorageError(c); };

/** Top-level AND clauses: split on the keyword AND at parenthesis depth 0, outside single and double quotes. */
export function topLevelClauses(expr) {
  let e = expr.trim();
  // Strip balanced outer parentheses that wrap the whole expression.
  const wraps = (x) => {
    if (!x.startsWith('(') || !x.endsWith(')')) return false;
    let d = 0, q = null;
    for (let i = 0; i < x.length; i++) {
      const c = x[i];
      if (q) { if (c === q) { if (x[i + 1] === q) { i++; continue; } q = null; } continue; }
      if (c === "'" || c === '"') q = c; else if (c === '(') d++; else if (c === ')') { d--; if (d === 0 && i < x.length - 1) return false; }
    }
    return d === 0;
  };
  while (wraps(e)) e = e.slice(1, -1).trim();
  const out = []; let d = 0, q = null, start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (q) { if (c === q) { if (e[i + 1] === q) { i++; continue; } q = null; } continue; }
    if (c === "'" || c === '"') q = c;
    else if (c === '(') d++;
    else if (c === ')') d--;
    else if (d === 0 && /\s/.test(c) && /^\s+AND\s/i.test(e.slice(i))) {
      out.push(e.slice(start, i).trim());
      const m = e.slice(i).match(/^\s+AND\s+/i);
      i += m[0].length - 1; start = i + 1;
    }
  }
  out.push(e.slice(start).trim());
  return out.filter(Boolean);
}

/** Candidate fields from parsed LIVE pins: [{ field, text, numeric }]. */
export function candidates(pins) {
  const c = [];
  const add = (field, text, numeric = false) => { if (typeof text === 'string' && text.length) c.push({ field, text, numeric }); };
  for (const x of pins.policies.values()) {
    if (Buffer.byteLength(x.name) >= 12) { add('P1', x.name); add('P1', b64(x.name)); }
    for (const e of [x.using, x.check]) {
      if (e === null || e === undefined) continue;
      add('P2', e); add('P2', b64(e));
      for (const cl of topLevelClauses(e)) if (Buffer.byteLength(cl) >= 24 && cl !== e) add('P3', cl);
    }
  }
  for (const id of COURSE_BUCKETS) {
    const v = pins.buckets.get(id);
    if (!v) continue;
    if (v.mimes) { const l = v.mimes.join(','); add('P4', l); add('P4', b64(l)); }
    if (v.size !== null && v.size !== undefined) add('P5', String(v.size), true);
  }
  return c;
}

const numberAt = (hay, needle) => {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const a = hay[i - 1], b = hay[i + needle.length];
    if (!(a && /[A-Za-z0-9]/.test(a)) && !(b && /[A-Za-z0-9]/.test(b))) return true;
  }
  return false;
};
const occurs = (hay, cand) => (cand.numeric ? numberAt(hay, cand.text) : hay.includes(cand.text));

/** Drops every candidate that already occurs in one of the public reference texts. */
export function filterPublic(cands, referenceTexts) {
  return cands.filter((c) => !referenceTexts.some((t) => occurs(t, c)));
}

/** Scans named texts ([{ rel, text }] or { rel, unscannable: true }); returns the fixed output lines. */
export function scanTexts(cands, entries) {
  const lines = [];
  for (const e of entries) {
    if (e.unscannable) { lines.push(`LEAKSCAN FAIL ${e.rel} UNSCANNABLE`); continue; }
    const hit = new Set();
    for (const c of cands) if (!hit.has(c.field) && occurs(e.text, c)) hit.add(c.field);
    for (const f of [...hit].sort()) lines.push(`LEAKSCAN FAIL ${e.rel} ${f}`);
  }
  return lines.length ? lines : ['LEAKSCAN PASS'];
}

/** Every regular file under dir (symlinks and special files are reported UNSCANNABLE, never followed). */
export function collect(dir, rel = '') {
  const out = [];
  for (const d of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) { out.push(...collect(dir, r)); continue; }
    if (!d.isFile()) { out.push({ rel: r, unscannable: true }); continue; }
    const p = path.join(dir, r);
    const st = fs.lstatSync(p);
    if (st.size > MAX_SCAN_FILE) { out.push({ rel: r, unscannable: true }); continue; }
    out.push({ rel: r, text: fs.readFileSync(p).toString('latin1') });
  }
  return out;
}

export function run(privDir, refListFile, evidenceDir) {
  const dir = assertPrivateDir(privDir);
  const pins = parsePins(readPrivate(dir, PINS_FILE));
  if (pins.source !== 'LIVE') refuse('ST_E_SOURCE');
  const refs = [];
  for (const rel of fs.readFileSync(refListFile, 'utf8').split('\0').filter(Boolean)) {
    let st; try { st = fs.lstatSync(rel); } catch { continue; } // a tracked path absent from the checkout adds nothing
    if (!st.isFile() || st.size > MAX_REFERENCE_FILE) continue;
    refs.push(fs.readFileSync(rel).toString('latin1'));
  }
  if (refs.length === 0) refuse('ST_E_LEAKSCAN_REFS');
  // Candidates are compared in latin1 space on both sides, so UTF-8 bytes match byte for byte.
  const cands = filterPublic(candidates(pins).map((c) => ({ ...c, text: Buffer.from(c.text, 'utf8').toString('latin1') })), refs);
  let ev; try { ev = collect(evidenceDir); } catch { refuse('ST_E_LEAKSCAN_EVIDENCE'); }
  return scanTexts(cands, ev);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (process.argv.length !== 5) refuse('ST_E_USAGE');
    const lines = run(...process.argv.slice(2));
    for (const l of lines) console.log(l);
    process.exit(lines[0] === 'LEAKSCAN PASS' ? 0 : 1);
  } catch (e) {
    console.error(`leak-scan refused: ${e instanceof StorageError ? e.code : 'ST_E_UNCLASSIFIED'}`);
    process.exit(3);
  }
}
