// ABOUTME: Local comparator for the journey witness (UNRUN proposal; exercised only on fakes in journey-selftest.mjs). Binds
// ABOUTME: <ID:name> placeholders, requires an exact journey multiset, exact manifest additions and unchanged protected hashes.
//
// Usage: node scripts/gradebook-fixture/journey/tests/compare-witness.mjs <pre.txt> <post.txt>   (exit 0 PASS, 1 FAIL)
// Prints fixed verdict codes and HASH names only, never witness lines (they carry ids, not secrets, but stay private anyway).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const JOURNEY_KINDS = ['COURSE', 'ENROLL', 'PROG', 'SUB', 'ATT', 'OBJ', 'CERT', 'AUDIT', 'NOTIF'];
/** Protected scopes that the seed itself makes non-empty (control course, its module and page, the private bucket). An
 *  empty value here means the witness did not see what it claims to protect, so it FAILS instead of passing vacuously. */
export const REQUIRED_NONEMPTY = ['other_courses', 'other_modules', 'other_items', 'buckets'];
/** The EXACT set of HASH scopes witness-journey.sql declares (the selftest and static contract R10 check this list against
 *  the SQL). Both witnesses must carry every one of them, once, and nothing else: a scope missing from BOTH sides is a
 *  missing scope, never "unchanged". Grammar per kind:
 *    counted  "<n> <md5>" with n >= 1, or "0 empty"
 *    single   "<md5>"                          (one-row hashes of the journey shell)
 *    guarded  counted, or "ABSENT" (table missing on this stack: FAILS) */
export const DECLARED_HASHES = Object.freeze(Object.assign(Object.create(null), {
  other_courses: 'counted', other_enrollments: 'counted', other_progressions: 'counted', other_submissions: 'counted',
  other_attachments: 'counted', other_objects: 'counted', buckets: 'counted', other_certificates: 'counted',
  other_audit_events: 'counted', other_notifications: 'counted', other_modules: 'counted', other_items: 'counted',
  other_assignments: 'counted', quiz_submissions: 'counted', quiz_submission_answers: 'counted',
  grade_change_notifications: 'counted', certificate_verification_attempts: 'guarded', grades: 'counted',
  grade_history: 'counted', journey_course_rest: 'single', journey_modules_items_assignment: 'single',
}));
/** Own-key membership only: inherited names such as toString, constructor or __proto__ are never declared scopes. */
const isDeclared = (n) => Object.prototype.hasOwnProperty.call(DECLARED_HASHES, n);
const MD5 = '[0-9a-f]{32}';
const COUNTED = new RegExp(`^(?:[1-9][0-9]* ${MD5}|0 empty)$`);
const SINGLE = new RegExp(`^${MD5}$`);
const hashWellFormed = (kind, v) => kind === 'single' ? SINGLE.test(v) : kind === 'guarded' ? (v === 'ABSENT' || COUNTED.test(v)) : COUNTED.test(v);

const kindOf = (l) => l.split(' ', 1)[0];

/** @param {string} text */
export function parseWitness(text) {
  const out = { journey: [], manifest: new Map(), hashes: new Map(), unknown: [], duplicateHashes: [] };
  for (const raw of text.split('\n')) {
    const l = raw.replace(/\r$/, '');
    if (!l.trim() || l.startsWith('#')) continue;
    const k = kindOf(l);
    if (JOURNEY_KINDS.includes(k)) out.journey.push(l);
    else if (k === 'MANIFEST') {
      const m = l.match(new RegExp(`^MANIFEST (\\S+) (${UUID})$`));
      if (!m) { out.unknown.push(l); continue; }
      if (!out.manifest.has(m[1])) out.manifest.set(m[1], new Set());
      out.manifest.get(m[1]).add(m[2]);
    } else if (k === 'HASH') {
      const m = l.match(/^HASH (\S+) (.+)$/);
      if (!m) { out.unknown.push(l); continue; }
      if (out.hashes.has(m[1])) { out.duplicateHashes.push(m[1]); continue; }
      out.hashes.set(m[1], m[2]);
    } else out.unknown.push(l);
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Expected line -> { re, names } where each <ID:name> becomes a UUID capture group. */
function compile(line) {
  const names = [];
  let src = '';
  let last = 0;
  for (const m of line.matchAll(/<ID:([a-z_]+)>/g)) {
    src += esc(line.slice(last, m.index)) + `(${UUID})`;
    names.push(m[1]);
    last = m.index + m[0].length;
  }
  src += esc(line.slice(last));
  return { re: new RegExp(`^${src}$`), names };
}

/** Backtracking multiset match of expected journey lines onto actual lines with consistent, distinct bindings. */
function bindAll(expected, actual) {
  const pats = expected.map(compile);
  const used = new Array(actual.length).fill(false);
  const bind = new Map();
  const step = (i) => {
    if (i === pats.length) return true;
    for (let j = 0; j < actual.length; j++) {
      if (used[j]) continue;
      const m = actual[j].match(pats[i].re);
      if (!m) continue;
      const added = [];
      let okay = true;
      pats[i].names.forEach((n, k) => {
        const v = m[k + 1];
        if (bind.has(n)) { if (bind.get(n) !== v) okay = false; return; }
        if ([...bind.values()].includes(v)) { okay = false; return; }
        bind.set(n, v); added.push(n);
      });
      if (okay) { used[j] = true; if (step(i + 1)) return true; used[j] = false; }
      for (const n of added) bind.delete(n);
    }
    return false;
  };
  return step(0) ? bind : null;
}

/**
 * @param {string} preText @param {string} postText
 * @param {{ expectedPre?: string, expectedPost?: string }} [exp]
 * @returns {{ ok: boolean, failures: string[], protectedHashes: string[], unprovenEmpty: string[] }}
 */
export function compareWitness(preText, postText, exp = {}) {
  const expectedPre = exp.expectedPre ?? fs.readFileSync(path.join(HERE, '..', 'expected-journey-pre.txt'), 'utf8');
  const expectedPost = exp.expectedPost ?? fs.readFileSync(path.join(HERE, '..', 'expected-journey-post.txt'), 'utf8');
  const failures = [];
  const pre = parseWitness(preText);
  const post = parseWitness(postText);
  if (pre.unknown.length) failures.push('W_PRE_UNKNOWN_LINE');
  if (post.unknown.length) failures.push('W_POST_UNKNOWN_LINE');

  // Pre: exactly the draft shell, and no journey-scope manifest rows at all.
  const ePre = expectedPre.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  if (JSON.stringify([...pre.journey].sort()) !== JSON.stringify([...ePre].sort())) failures.push('W_PRE_JOURNEY_MISMATCH');
  if ([...pre.manifest.values()].some((s) => s.size)) failures.push('W_PRE_MANIFEST_NOT_EMPTY');

  // Post journey lines: exact multiset with consistent bindings; nothing extra, nothing missing.
  const ePostAll = expectedPost.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const ePost = ePostAll.filter((l) => JOURNEY_KINDS.includes(kindOf(l)));
  const eAdded = ePostAll.filter((l) => l.startsWith('ADDED '));
  if (ePostAll.length !== ePost.length + eAdded.length) failures.push('W_EXPECTED_UNKNOWN_LINE');
  let bind = null;
  if (post.journey.length !== ePost.length) failures.push(post.journey.length > ePost.length ? 'W_POST_EXTRA_LINE' : 'W_POST_MISSING_LINE');
  else {
    bind = bindAll(ePost, post.journey);
    if (!bind) failures.push('W_POST_JOURNEY_MISMATCH');
  }

  // Manifest: no removed rows; the added rows are exactly the expected ADDED set per table.
  for (const [t, ids] of pre.manifest) for (const id of ids) if (!post.manifest.get(t)?.has(id)) failures.push(`W_MANIFEST_REMOVED ${t}`);
  const added = new Map();
  for (const [t, ids] of post.manifest) {
    const a = [...ids].filter((id) => !pre.manifest.get(t)?.has(id)).sort();
    if (a.length) added.set(t, a);
  }
  if (bind) {
    const want = new Map();
    for (const l of eAdded) {
      const m = l.match(/^ADDED (\S+) <ID:([a-z_]+)>$/);
      if (!m) { failures.push('W_EXPECTED_BAD_ADDED'); continue; }
      if (!want.has(m[1])) want.set(m[1], []);
      want.get(m[1]).push(m[2]);
    }
    for (const t of new Set([...want.keys(), ...added.keys()])) {
      const have = [...(added.get(t) ?? [])];
      const names = want.get(t) ?? [];
      if (have.length !== names.length) { failures.push(have.length > names.length ? `W_MANIFEST_EXTRA ${t}` : `W_MANIFEST_MISSING ${t}`); continue; }
      // Bound names must be added rows of this table; unbound names (rows with no journey line id) take the rest.
      for (const n of names.filter((n) => bind.has(n))) {
        const i = have.indexOf(bind.get(n));
        if (i < 0) failures.push(`W_BOUND_ID_NOT_ADDED ${t}`); else have.splice(i, 1);
      }
      if (have.length !== names.filter((n) => !bind.has(n)).length) failures.push(`W_MANIFEST_UNMATCHED ${t}`);
    }
  }

  // Protected hashes: EXACTLY the declared scopes on BOTH sides, well formed, equal. Empty is reported as UNPROVEN-EMPTY
  // (a narrowed claim, not protection) and FAILS for the required non-empty scopes.
  const protectedHashes = [];
  const unprovenEmpty = [];
  for (const [side, w] of [['PRE', pre], ['POST', post]]) {
    for (const n of w.duplicateHashes) failures.push(`W_HASH_DUPLICATE_${side} ${n}`);
    for (const n of w.hashes.keys()) if (!isDeclared(n)) failures.push(`W_HASH_UNDECLARED_${side} ${n}`);
    for (const n of Object.keys(DECLARED_HASHES)) {
      if (!w.hashes.has(n)) failures.push(`W_HASH_MISSING_${side} ${n}`);
      else if (!hashWellFormed(DECLARED_HASHES[n], w.hashes.get(n))) failures.push(`W_HASH_MALFORMED_${side} ${n}`);
    }
  }
  for (const n of Object.keys(DECLARED_HASHES)) {
    const a = pre.hashes.get(n), b = post.hashes.get(n);
    if (a === undefined || b === undefined || !hashWellFormed(DECLARED_HASHES[n], a) || !hashWellFormed(DECLARED_HASHES[n], b)) continue;
    if (a !== b) { failures.push(`W_HASH_CHANGED ${n}`); continue; }
    if (a === 'ABSENT') { failures.push(`W_HASH_ABSENT ${n}`); continue; }
    if (a === '0 empty') {
      if (REQUIRED_NONEMPTY.includes(n)) failures.push(`W_REQUIRED_SCOPE_EMPTY ${n}`); else unprovenEmpty.push(n);
    } else protectedHashes.push(n);
  }

  return { ok: failures.length === 0, failures, protectedHashes, unprovenEmpty };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [preF, postF] = process.argv.slice(2);
  if (!preF || !postF) { console.log('FAIL W_USAGE'); process.exit(1); }
  const r = compareWitness(fs.readFileSync(preF, 'utf8'), fs.readFileSync(postF, 'utf8'));
  for (const f of r.failures) console.log(`FAIL ${f}`);
  console.log(`PROTECTED ${r.protectedHashes.join(',') || '-'}`);
  console.log(`UNPROVEN-EMPTY ${r.unprovenEmpty.join(',') || '-'}`);
  console.log(r.ok ? 'PASS journey witness comparison' : 'FAIL journey witness comparison');
  process.exit(r.ok ? 0 : 1);
}
