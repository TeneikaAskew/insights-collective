// ABOUTME: Gate 3 CONSUMER for the journey lane (UNRUN proposal). It checks the SHAPE and PLACEMENT of a pairing-proof file
// ABOUTME: before any sign-in, seed or persona request. It does NOT establish trust: every value in the file is caller-authored.
//
// What this check is NOT: proof that the stack is owned, disposable, current-run, or that API and DB are one stack. A
// file with five matching strings can be written by anyone; accepting it only means "the shape is right". The
// trustworthy part is the PRODUCER plus an ordered pre-seed runner, which do not exist yet (shared runner, PR 134
// thread; BLOCKED). Until both exist and are reviewed, the journey is not run-ready whatever this function returns.
//
// Producer contract to review separately:
//   1. stack_id is a fresh 128-bit value written at stack bootstrap by THIS job, before any fixture;
//   2. db_read is read through the loopback DB DSN and api_read through the approved API origin with the anon key only
//      (no persona session), both BEFORE the seed and before the first persona POST (sign-in is a POST);
//   3. the file lives in its OWN private 0700 directory, never in the session directory (which must be empty at setup).
// Errors are fixed codes only.
import fs from 'node:fs';
import path from 'node:path';
import { JourneyGateError } from './private-dir.mjs';

const HEX128 = /^[0-9a-f]{32}$/;

/**
 * @param {string|undefined} file
 * @param {{ sessionDir: string, uid?: number }} opts  sessionDir = the real path of the (already checked) session dir
 * @returns {{ stack_id: string }}
 */
export function assertPairingProof(file, opts) {
  if (!opts || !opts.sessionDir) throw new JourneyGateError('JOURNEY_GATE3_E_NO_SESSION_DIR');
  if (!file || !path.isAbsolute(file)) throw new JourneyGateError('JOURNEY_GATE3_E_NO_PROOF');
  let st;
  try { st = fs.lstatSync(file); } catch { throw new JourneyGateError('JOURNEY_GATE3_E_NO_PROOF'); }
  if (st.isSymbolicLink() || !st.isFile()) throw new JourneyGateError('JOURNEY_GATE3_E_NOT_FILE');
  if ((st.mode & 0o777) !== 0o600) throw new JourneyGateError('JOURNEY_GATE3_E_MODE');
  const uid = opts.uid ?? (typeof process.getuid === 'function' ? process.getuid() : -1);
  if (uid >= 0 && st.uid !== uid) throw new JourneyGateError('JOURNEY_GATE3_E_OWNER');
  let real, parent, sess;
  try { real = fs.realpathSync(file); parent = path.dirname(real); sess = fs.realpathSync(opts.sessionDir); }
  catch { throw new JourneyGateError('JOURNEY_GATE3_E_NO_PROOF'); }
  // Separate directories: the proof never sits in (or under) the session dir, and the session dir never sits under it.
  if (parent === sess || real.startsWith(sess + path.sep) || sess.startsWith(parent + path.sep)) throw new JourneyGateError('JOURNEY_GATE3_E_IN_SESSION_DIR');
  let pst;
  try { pst = fs.lstatSync(parent); } catch { throw new JourneyGateError('JOURNEY_GATE3_E_PARENT'); }
  if (pst.isSymbolicLink() || !pst.isDirectory() || (pst.mode & 0o777) !== 0o700 || (uid >= 0 && pst.uid !== uid)) throw new JourneyGateError('JOURNEY_GATE3_E_PARENT');
  let p;
  try { p = JSON.parse(fs.readFileSync(real, 'utf8')); } catch { throw new JourneyGateError('JOURNEY_GATE3_E_PARSE'); }
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new JourneyGateError('JOURNEY_GATE3_E_PARSE');
  if (Object.keys(p).sort().join(',') !== 'api_read,db_read,produced_before_seed,stack_id,version') throw new JourneyGateError('JOURNEY_GATE3_E_SHAPE');
  if (p.version !== 1) throw new JourneyGateError('JOURNEY_GATE3_E_VERSION');
  if (typeof p.stack_id !== 'string' || !HEX128.test(p.stack_id)) throw new JourneyGateError('JOURNEY_GATE3_E_STACK_ID');
  if (p.db_read !== p.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_DB_MISMATCH');
  if (p.api_read !== p.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_API_MISMATCH');
  if (p.produced_before_seed !== true) throw new JourneyGateError('JOURNEY_GATE3_E_ORDER');
  return { stack_id: p.stack_id };
}
