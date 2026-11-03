#!/usr/bin/env node
// ABOUTME: Lesson-editor owned-lifetime probe: is any process of THIS uid still carrying this run's private marker
// ABOUTME: (LE_OWNED_RUN=<token>) in its environment? Read-only /proc scan; prints nothing; the exit status is the answer.
//
// The job starts every lane process (run.sh setup and its children, Playwright, its workers, the egress proxy and every
// browser it launches) with LE_OWNED_RUN set to a fresh random token kept in the private parent (0600). Environments are
// inherited, so the marker binds the actual owned process tree, whatever a process is named and whichever process group or
// session it moved to. Exit status mirrors pgrep so the job maps it explicitly: 0 = a marked process is alive, 1 = none,
// 3 = could not decide (unreadable token, /proc unreadable, an own process whose environment cannot be read). A process that
// vanishes during the scan is not counted. Zombies have an empty environment and hold no resources beyond their pid.
// On exit 3 it prints exactly one fixed reason code from REASONS (no pid, path, errno text or environment content), so an
// undecided scan is classified in the evidence instead of being anonymous. The code never changes the answer.
//
// Usage: le-owned-procs.mjs <token file>
import fs from 'node:fs';
import path from 'node:path';
import { readPrivateBounded } from './le-e1-summary.mjs';

export const MARKER = 'LE_OWNED_RUN';
const TOKEN = /^[0-9a-f]{32}$/;
/** The only lines the CLI may print (on exit 3). */
export const REASONS = Object.freeze(['LE_PROCS_E_TOKEN', 'LE_PROCS_E_PROCDIR', 'LE_PROCS_E_STAT', 'LE_PROCS_E_ENVIRON_EACCES',
  'LE_PROCS_E_ENVIRON_EPERM', 'LE_PROCS_E_ENVIRON_OTHER', 'LE_PROCS_E_UNCLASSIFIED']);
const environCode = (e) => (e && e.code === 'EACCES' ? 'LE_PROCS_E_ENVIRON_EACCES' : e && e.code === 'EPERM' ? 'LE_PROCS_E_ENVIRON_EPERM' : 'LE_PROCS_E_ENVIRON_OTHER');

/**
 * Count live processes of uid whose environment holds exactly MARKER=token. Returns { count } or { error: true, code }.
 * fsImpl and procRoot are injectable so selftests drive every branch without a real process table.
 */
export function scanOwned(token, { procRoot = '/proc', fsImpl = fs, uid = process.getuid(), self = process.pid } = {}) {
  if (!TOKEN.test(String(token))) return { error: true, code: 'LE_PROCS_E_TOKEN' };
  const want = Buffer.from(`${MARKER}=${token}`);
  let names;
  try { names = fsImpl.readdirSync(procRoot); } catch { return { error: true, code: 'LE_PROCS_E_PROCDIR' }; }
  let count = 0;
  for (const n of names) {
    if (!/^[1-9][0-9]*$/.test(n) || Number(n) === self) continue;
    let st;
    try { st = fsImpl.statSync(path.join(procRoot, n)); } catch (e) { if (e && (e.code === 'ENOENT' || e.code === 'ESRCH')) continue; return { error: true, code: 'LE_PROCS_E_STAT' }; }
    if (st.uid !== uid) continue;
    let env;
    try { env = fsImpl.readFileSync(path.join(procRoot, n, 'environ')); } catch (e) { if (e && (e.code === 'ENOENT' || e.code === 'ESRCH')) continue; return { error: true, code: environCode(e) }; }
    let start = 0;
    for (let i = 0; i <= env.length; i++) {
      if (i === env.length || env[i] === 0) {
        if (i - start === want.length && env.subarray(start, i).equals(want)) { count++; break; }
        start = i + 1;
      }
    }
  }
  return { count };
}

if (process.argv[1] && /le-owned-procs\.mjs$/.test(process.argv[1])) {
  let code = 3;
  let reason = 'LE_PROCS_E_UNCLASSIFIED';
  try {
    const args = process.argv.slice(2);
    if (args.length === 1) {
      const t = readPrivateBounded(args[0], { max: 64 });
      if (!t.ok) reason = 'LE_PROCS_E_TOKEN';
      else {
        const r = scanOwned(t.text.trim());
        if (!r.error) code = r.count > 0 ? 0 : 1;
        else if (REASONS.includes(r.code)) reason = r.code;
      }
    }
  } catch { code = 3; reason = 'LE_PROCS_E_UNCLASSIFIED'; }
  if (code === 3) process.stdout.write(`${reason}\n`);
  process.exit(code);
}
