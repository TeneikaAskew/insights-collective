// ABOUTME: Lifecycle-matrix SYNTHETIC target (LOCAL candidate, unrun), host CLI only: the `select` check that runs first in the
// ABOUTME: synthetic job, the host-derived `LE-SYN` summary, and the owned-directory `cleanup`. Never E1 evidence or acceptance.
//
//   synthetic.mjs select                         -> one fixed line; exit 0 only if LE_TARGET is exactly SYNTHETIC and no
//                                                   authentic input or baseURL source is set in this step's environment
//   synthetic.mjs summary <ctl dir> <parent> <repo> -> fixed `LE-SYN ...` lines only (never `LE-E1`); exit 0 only on PASS, which
//                                                   the HOST derives from every arm's own receipts (DESIGN-r3 section 6)
//   synthetic.mjs cleanup <ctl dir> <parent> <repo> -> fixed `SYN_CLEANUP ...` lines; exit 0 only when every directory this run
//                                                   recorded is proven absent (or nothing was created); otherwise preserves
//
// Design: pr134/e1-lifecycle-matrix-r1/DESIGN-r3.md and the five review constraints. Writers: none. DELETION (disclosed, need N2):
// `cleanup` unlinks and removes directories ONLY inside directories that run-lane recorded in C/syn-created, never recursively by
// API, never following a link, never crossing a device, and only after the aggregate lane verdict proves no container is left.
import fs from 'node:fs';
import path from 'node:path';
import { SYN_ARMS, lanePaths, laneExitFromGates, selectLine, synArmDirs, synArmPaths, synArmResult, synCreatedPath, synIntentPath, synOwnership, synSummaryLines } from './contract.mjs';
import { readVerdict } from './gates.mjs';
import { readPrivateBounded } from '../le-e1-summary.mjs';

const PARENT_RE = /^syn-[1-9]\d{0,19}-[1-9]\d{0,4}$/;
const presence = (fsx, p) => { try { fsx.lstatSync(p); return true; } catch (e) { return e?.code === 'ENOENT' ? false : null; } };
/** A private receipt: null when absent (ENOENT), its text when a bounded private read succeeds, otherwise a value no parser accepts. */
const receipt = (fsx, p, max) => {
  const e = presence(fsx, p);
  if (e === false) return null;
  const r = e ? readPrivateBounded(p, { max, fsImpl: fsx }) : { ok: false };
  return r.ok ? r.text : '\u0000unreadable';
};

/** Every arm's host-derived result plus the root verdict (gates.mjs readVerdict over the AGGREGATE receipts). */
export function synResults(fsx, root) {
  const rootVerdict = readVerdict(fsx, root);
  const arms = SYN_ARMS.map((arm) => {
    const A = synArmPaths(root, arm);
    const gatesText = receipt(fsx, A.gates, 65536);
    return synArmResult({ arm, verdict: readVerdict(fsx, A), laneText: receipt(fsx, A.laneTxt, 4096), exit: laneExitFromGates(gatesText) });
  });
  return { rootVerdict, arms };
}

/** Recorded content directories (the only places an unrecorded entry may exist): <arm>/out and <arm>/lane/{work,evidence,evidence/pw-output}. */
const CONTENT = /^[A-D]\/(?:out|lane\/work|lane\/evidence|lane\/evidence\/pw-output)$/;
const MAX_ENTRIES = 10000, MAX_DEPTH = 16;

/**
 * DESIGN-r3 section 3 with review constraint 1. Order:
 * 1. the aggregate lane verdict must be ok with CONTAINER LANE_ABSENT or LANE_NO_CONTAINER, else nothing is touched;
 * 2. ownership from C/syn-create-intent and C/syn-created only: NOT_INVOKED removes nothing, UNRESOLVED preserves everything;
 * 3. the WHOLE owned subtree is validated before anything is removed, with lstat only (no link is followed): each recorded
 *    directory must still have its recorded dev, ino, uid and mode; a recorded directory may hold only recorded directories,
 *    except the recorded content directories, whose unrecorded entries must be on the same device, ours, and a regular file with
 *    one link, a symlink (the link itself is removed) or a directory satisfying the same, within fixed bounds. A missing,
 *    mismatched, foreign or unrecorded entry refuses its directory, and every refusal propagates to EVERY ancestor;
 * 4. only unrefused subtrees are removed, deepest first, each entry re-checked by lstat (same dev and ino and type) right before
 *    its unlink or rmdir (never a recursive removal);
 * 5. every recorded path that was not preserved must then be absent.
 * Infrastructure paths (P and every arm's six dirs, evidence/pw-output included) are RESERVED: one without its own record is
 * never generated content; it refuses its parent (UNRECORDED), which propagates. Before each removal, every validated ancestor up
 * to P is re-checked too (same dev, ino, a real directory, no direct refusal); a changed ancestor refuses its anchor (CHANGED).
 * Scope of the claim: these are path-based lstat checks in a trusted runner workspace. lstat does not follow the LAST component,
 * but the kernel still resolves every intermediate component, and check-then-unlink is not atomic, so this narrows but does not
 * prevent an arbitrary hostile concurrent mutation of the tree.
 * Returns { ok, lines }. ok only when nothing was preserved (or nothing was created).
 */
export function synCleanup(fsx, { C, P, R, uid }) {
  const out = [];
  const done = (ok, last) => ({ ok, lines: [...out, last] });
  let root;
  try { root = lanePaths(P, C, R); } catch { return done(false, 'SYN_CLEANUP PRESERVED USAGE'); }
  if (!PARENT_RE.test(path.basename(P))) return done(false, 'SYN_CLEANUP PRESERVED USAGE');
  const v = readVerdict(fsx, root);
  if (!v.ok || !['LANE_ABSENT', 'LANE_NO_CONTAINER'].includes(v.container)) return done(false, 'SYN_CLEANUP PRESERVED UNRESOLVED_TEARDOWN');
  const own = synOwnership({ intent: presence(fsx, synIntentPath(root)), createdText: receipt(fsx, synCreatedPath(root), 65536), P });
  if (own.state === 'NOT_INVOKED') return done(true, 'SYN_CLEANUP NOT_INVOKED');
  if (own.state === 'UNRESOLVED') return done(false, 'SYN_CLEANUP PRESERVED UNRESOLVED_OWNERSHIP');
  const rec = new Map(own.entries.map((e) => [e.path, e]));
  const RESERVED = new Set([P, ...SYN_ARMS.flatMap((a) => synArmDirs(synArmPaths(root, a)))]);
  const rel = (p) => (p === P ? 'P' : `P/${path.relative(P, p)}`);
  const refused = new Map(); // recorded path -> reason
  /** Refuse a recorded path and propagate the refusal to EVERY recorded ancestor up to P at once. */
  const refuse = (p, why) => {
    if (!refused.has(p)) refused.set(p, why);
    for (let a = path.dirname(p); a === P || a.startsWith(`${P}/`); a = path.dirname(a)) { if (rec.has(a) && !refused.has(a)) refused.set(a, 'CHILD'); if (a === P) break; }
  };
  let budget = MAX_ENTRIES;
  const lst = (p) => { try { return fsx.lstatSync(p, { bigint: true }); } catch (e) { return e?.code === 'ENOENT' ? 'ENOENT' : null; } };
  // Validate an unrecorded entry inside a content dir; returns ops (deepest first) or null when refused.
  const unrecorded = (q, dev, depth) => {
    if (--budget < 0 || depth > MAX_DEPTH || RESERVED.has(q)) return null;
    const s = lst(q);
    if (!s || s === 'ENOENT' || String(s.dev) !== dev || Number(s.uid) !== uid) return null;
    const id = { path: q, dev: String(s.dev), ino: String(s.ino) };
    if (s.isSymbolicLink()) return [{ ...id, kind: 'link' }];
    if (s.isFile()) return Number(s.nlink) === 1 ? [{ ...id, kind: 'file' }] : null;
    if (!s.isDirectory()) return null;
    let names;
    try { names = fsx.readdirSync(q); } catch { return null; }
    const ops = [];
    for (const n of names) { const sub = unrecorded(path.join(q, n), dev, depth + 1); if (!sub) return null; ops.push(...sub); }
    return [...ops, { ...id, kind: 'dir' }];
  };
  // Validate a recorded dir; returns ops for its removable parts. Marks refusals (own and propagated).
  const recorded = (p) => {
    const e = rec.get(p);
    const s = lst(p);
    if (s === 'ENOENT') { refuse(p, 'MISSING'); return []; }
    if (!s || !s.isDirectory() || s.isSymbolicLink() || String(s.dev) !== e.dev || String(s.ino) !== e.ino || Number(s.uid) !== e.uid
      || (Number(s.mode) & 0o7777) !== 0o700) { refuse(p, 'MISMATCH'); return []; }
    visited.add(p);
    let names;
    try { names = fsx.readdirSync(p); } catch { refuse(p, 'MISMATCH'); return []; }
    const ops = [];
    for (const n of names) {
      const q = path.join(p, n);
      if (rec.has(q)) { ops.push(...recorded(q)); continue; }
      if (RESERVED.has(q)) { refuse(p, 'UNRECORDED'); continue; } // reserved infrastructure without its own record
      if (!CONTENT.test(path.relative(P, p))) { refuse(p, 'UNRECORDED'); continue; }
      const sub = unrecorded(q, e.dev, 1);
      if (sub) ops.push(...sub); else refuse(p, 'FOREIGN');
    }
    return [...ops, { path: p, dev: e.dev, ino: e.ino, kind: 'dir' }];
  };
  const visited = new Set();
  const ops = recorded(P);
  // A recorded dir never reached from P (gone from its parent's listing, or under a refused directory) is not verified: kept.
  for (const p of rec.keys()) if (!visited.has(p)) refuse(p, 'UNVERIFIED');
  // Removal: only unrefused entries, deepest first, each re-checked right before its own unlink or rmdir.
  const anchorOf = (q) => (rec.has(q) ? q : [...rec.keys()].filter((r) => q.startsWith(`${r}/`)).sort((x, y) => y.length - x.length)[0]);
  const ident = new Map(ops.map((o) => [o.path, o]));
  /** The first validated ancestor of q (up to P) that is directly refused or no longer the same real directory; else null. */
  const ancestorFault = (q) => {
    for (let a = path.dirname(q); a === P || a.startsWith(`${P}/`); a = path.dirname(a)) {
      if (refused.has(a) && refused.get(a) !== 'CHILD') return a;
      const id = ident.get(a), s = id ? lst(a) : 'SKIP';
      if (s !== 'SKIP' && (!s || s === 'ENOENT' || !s.isDirectory() || s.isSymbolicLink() || String(s.dev) !== id.dev || String(s.ino) !== id.ino)) return a;
      if (a === P) break;
    }
    return null;
  };
  for (const o of ops) {
    const anchor = anchorOf(o.path);
    if (refused.has(anchor) && o.kind === 'dir' && rec.has(o.path)) continue;
    if (refused.has(anchor) && refused.get(anchor) !== 'CHILD') continue; // nothing inside a directly refused dir is touched
    const fault = ancestorFault(o.path);
    if (fault) { refuse(anchorOf(fault), 'CHANGED'); continue; }
    const s = lst(o.path);
    const same = s && s !== 'ENOENT' && String(s.dev) === o.dev && String(s.ino) === o.ino
      && (o.kind === 'dir' ? s.isDirectory() && !s.isSymbolicLink() : o.kind === 'link' ? s.isSymbolicLink() : s.isFile() && !s.isSymbolicLink());
    if (!same) { refuse(anchor, 'CHANGED'); continue; }
    try { if (o.kind === 'dir') fsx.rmdirSync(o.path); else fsx.unlinkSync(o.path); } catch { refuse(anchor, 'REMOVE'); }
  }
  let removed = 0;
  for (const p of rec.keys()) {
    if (refused.has(p)) continue;
    if (lst(p) === 'ENOENT') removed++; else refused.set(p, 'STILL_PRESENT');
  }
  for (const [p, why] of [...refused.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) out.push(`SYN_CLEANUP PRESERVED ${why} ${rel(p)}`);
  out.push(`SYN_CLEANUP REMOVED ${removed} OF ${rec.size}`);
  return refused.size ? done(false, 'SYN_CLEANUP PRESERVED') : done(true, 'SYN_CLEANUP CLEAN');
}

if (process.argv[1] && /le-lane\/synthetic\.mjs$/.test(process.argv[1])) {
  const [cmd, C, P, R] = process.argv.slice(2);
  try {
    if (cmd === 'select') { const s = selectLine(process.env); console.log(s.line); process.exit(s.ok ? 0 : 1); }
    if (cmd === 'summary') {
      const root = lanePaths(P, C, R);
      if (!PARENT_RE.test(path.basename(root.P))) throw new Error('parent');
      const s = synSummaryLines(synResults(fs, root));
      for (const l of s.lines) console.log(l);
      process.exit(s.ok ? 0 : 1);
    }
    if (cmd === 'cleanup') {
      const r = synCleanup(fs, { C, P, R, uid: process.getuid() });
      for (const l of r.lines) console.log(l);
      process.exit(r.ok ? 0 : 1);
    }
    console.log('LE-SYN USAGE'); process.exit(2);
  } catch { console.log(cmd === 'cleanup' ? 'SYN_CLEANUP PRESERVED UNCLASSIFIED' : 'LE-SYN RESULT UNRESOLVED UNCLASSIFIED'); process.exit(1); }
}
