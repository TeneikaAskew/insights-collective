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
// Output (fixed categories only; no file name, path or matched text is ever printed):
//   "LEAKSCAN PASS files=<n>"                          exit 0
//   "LEAKSCAN FAIL <P1..P5> files=<n>"                 one line per field with hits
//   "LEAKSCAN FAIL <CATEGORY> entries=<n>"             one line per unsafe-entry category (see ENTRY_CATEGORIES)
//   then exit 1. Refusals print "leak-scan refused: <CODE>" and exit 3.
// Reads: every evidence and reference file is opened once with O_NOFOLLOW|O_NONBLOCK and checked on the SAME descriptor
// (regular file, this uid, size bound, bounded read, growth refused), the descriptor's resolved path must lie inside its
// root (/proc/self/fd), and directories are walked by entry type without following links. This is the descriptor logic
// of the qualified shot-export readHandle with two stated relaxations only: mode is not required to be 0600 (evidence
// and checkout files are 0644) and an empty file is allowed (an empty receipt is a staging matter, not a leak).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageError, parsePins, COURSE_BUCKETS } from './storage-core.mjs';
import { assertPrivateDir, readPrivate, PINS_FILE } from './storage-job.mjs';

export const MAX_SCAN_FILE = 64 * 1024 * 1024;
export const MAX_SCAN_TOTAL = 512 * 1024 * 1024;
export const MAX_REFERENCE_FILE = 8 * 1024 * 1024;
export const MAX_REFLIST = 16 * 1024 * 1024;
export const MAX_ENTRIES = 20000;
export const MAX_DEPTH = 16;
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const ENTRY_CATEGORIES = Object.freeze(['SYMLINK', 'SPECIAL', 'OVERSIZE', 'OUTSIDE_ROOT', 'RACE', 'NAME', 'UNREADABLE', 'LIMIT']);
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

/**
 * Bounded read on one descriptor (see header). Returns { buf } or { cat } with a fixed ENTRY_CATEGORIES value.
 * io and fdPath are injectable for deterministic race controls; production uses fs and /proc/self/fd.
 */
export function readBounded(file, max, rootReal, { io = fs, uid = typeof process.getuid === 'function' ? process.getuid() : -1, fdPath = (fd) => fs.readlinkSync(`/proc/self/fd/${fd}`) } = {}) {
  let fd;
  try { fd = io.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch (e) { return { cat: e && e.code === 'ELOOP' ? 'SYMLINK' : 'UNREADABLE' }; }
  let cat = null, buf = null;
  try {
    let real = null;
    try { real = fdPath(fd); } catch { cat = 'OUTSIDE_ROOT'; }
    if (!cat && !(typeof real === 'string' && real.startsWith(`${rootReal}/`))) cat = 'OUTSIDE_ROOT';
    const st = cat ? null : io.fstatSync(fd);
    if (cat) { /* reported below */ }
    else if (!st.isFile()) cat = 'SPECIAL';
    else if (uid >= 0 && st.uid !== uid) cat = 'UNREADABLE';
    else if (st.size > max) cat = 'OVERSIZE';
    else {
      const cap = Buffer.alloc(Math.min(max, st.size) + 1);
      let n = 0;
      for (;;) {
        const r = io.readSync(fd, cap, n, cap.length - n, null);
        if (r === 0) break;
        n += r;
        if (n > st.size) { cat = 'RACE'; break; }
      }
      if (!cat && n !== st.size) cat = 'RACE';
      if (!cat) buf = Buffer.from(cap.subarray(0, n));
    }
  } catch { cat = cat ?? 'UNREADABLE'; }
  finally { try { io.closeSync(fd); } catch { cat = cat ?? 'UNREADABLE'; } }
  return cat ? { cat } : { buf };
}

/**
 * Walks root without following links. Returns { texts: [latin1 strings], cats: Map(category -> count) }. Names are never
 * returned or printed; an unsafe name is counted as NAME and its entry is not opened.
 */
export function collect(root, opts = {}) {
  const rootReal = fs.realpathSync(root);
  const texts = [], cats = new Map();
  const bump = (c) => cats.set(c, (cats.get(c) ?? 0) + 1);
  let entries = 0, total = 0;
  const walk = (rel, depth) => {
    if (depth > MAX_DEPTH) { bump('LIMIT'); return; }
    const abs = rel ? path.join(rootReal, rel) : rootReal;
    let st;
    try { st = fs.lstatSync(abs); } catch { bump('RACE'); return; }
    if (!st.isDirectory()) { bump(st.isSymbolicLink() ? 'SYMLINK' : 'RACE'); return; }
    let real;
    try { real = fs.realpathSync(abs); } catch { bump('RACE'); return; }
    if (real !== abs) { bump('OUTSIDE_ROOT'); return; }
    let list;
    try { list = fs.readdirSync(abs, { withFileTypes: true }); } catch { bump('UNREADABLE'); return; }
    list.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    for (const d of list) {
      if (++entries > MAX_ENTRIES) { bump('LIMIT'); return; }
      if (!SAFE_NAME.test(d.name)) { bump('NAME'); continue; }
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) { walk(r, depth + 1); continue; }
      if (d.isSymbolicLink()) { bump('SYMLINK'); continue; }
      if (!d.isFile()) { bump('SPECIAL'); continue; }
      const got = readBounded(path.join(rootReal, r), MAX_SCAN_FILE, rootReal, opts);
      if (got.cat) { bump(got.cat); continue; }
      total += got.buf.length;
      if (total > MAX_SCAN_TOTAL) { bump('LIMIT'); return; }
      texts.push(got.buf.toString('latin1'));
    }
  };
  walk('', 0);
  return { texts, cats };
}

/** Fixed output lines from scanned texts and entry categories. */
export function verdictLines(cands, texts, cats = new Map()) {
  const per = new Map();
  for (const t of texts) {
    const hit = new Set();
    for (const c of cands) if (!hit.has(c.field) && occurs(t, c)) hit.add(c.field);
    for (const f of hit) per.set(f, (per.get(f) ?? 0) + 1);
  }
  const lines = [];
  for (const f of ['P1', 'P2', 'P3', 'P4', 'P5']) if (per.has(f)) lines.push(`LEAKSCAN FAIL ${f} files=${per.get(f)}`);
  for (const c of ENTRY_CATEGORIES) if (cats.get(c)) lines.push(`LEAKSCAN FAIL ${c} entries=${cats.get(c)}`);
  return lines.length ? lines : [`LEAKSCAN PASS files=${texts.length}`];
}

/** Reference texts from a NUL list of repository-relative paths under cwd; unsafe or unreadable paths are skipped. */
export function referenceTexts(refListFile, cwdReal, opts = {}) {
  const lst = readBounded(refListFile, MAX_REFLIST, path.dirname(fs.realpathSync(refListFile)), opts);
  if (lst.cat) refuse('ST_E_LEAKSCAN_REFS');
  const refs = [];
  for (const rel of lst.buf.toString('utf8').split('\0').filter(Boolean)) {
    if (rel.startsWith('/') || rel.split('/').some((p) => p === '..' || p === '.' || p === '')) refuse('ST_E_LEAKSCAN_REFS');
    const got = readBounded(path.join(cwdReal, rel), MAX_REFERENCE_FILE, cwdReal, opts);
    if (!got.cat) refs.push(got.buf.toString('latin1')); // skipping a reference only keeps more candidates (stricter)
  }
  if (refs.length === 0) refuse('ST_E_LEAKSCAN_REFS');
  return refs;
}

export function run(privDir, refListFile, evidenceDir, opts = {}) {
  const dir = assertPrivateDir(privDir);
  const pins = parsePins(readPrivate(dir, PINS_FILE));
  if (pins.source !== 'LIVE') refuse('ST_E_SOURCE');
  const refs = referenceTexts(refListFile, fs.realpathSync(process.cwd()), opts);
  // Candidates are compared in latin1 space on both sides, so UTF-8 bytes match byte for byte.
  const cands = filterPublic(candidates(pins).map((c) => ({ ...c, text: Buffer.from(c.text, 'utf8').toString('latin1') })), refs);
  let ev;
  try { const st = fs.lstatSync(evidenceDir); if (!st.isDirectory()) throw new Error('x'); ev = collect(evidenceDir, opts); } catch { refuse('ST_E_LEAKSCAN_EVIDENCE'); }
  return verdictLines(cands, ev.texts, ev.cats);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (process.argv.length !== 5) refuse('ST_E_USAGE');
    const lines = run(...process.argv.slice(2));
    for (const l of lines) console.log(l);
    process.exit(lines[0].startsWith('LEAKSCAN PASS') ? 0 : 1);
  } catch (e) {
    console.error(`leak-scan refused: ${e instanceof StorageError ? e.code : 'ST_E_UNCLASSIFIED'}`);
    process.exit(3);
  }
}
