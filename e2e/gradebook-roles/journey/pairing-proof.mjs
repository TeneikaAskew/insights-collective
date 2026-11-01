// ABOUTME: Gate 3 consumer for the journey lane (UNRUN proposal). The journey refuses to sign anyone in, seed, or send a
// ABOUTME: persona request unless a pairing proof produced BEFORE the seed says the API and the DB are one owned, disposable stack.
//
// The PRODUCER of this proof does not exist yet. It belongs to the shared runner (PR 134 thread: scripts/e2e,
// e2e/support, workflows) and is gate 3 of the four pending gates. Until it lands, this check fails closed, so the
// journey cannot run. The contract the producer must meet is written down here so it can be reviewed on its own:
//
//   1. owned/disposable: the stack was created by THIS job (stack_id is a fresh 128-bit value written at bootstrap,
//      before any fixture), and the job holds its lifetime (it is destroyed at job end; no cleanup SQL exists).
//   2. read-only pairing, before any fixture write and before the first persona POST (sign-in is a POST):
//      db_read  = stack_id read through the loopback DB DSN,
//      api_read = stack_id read through the approved API origin with the anon key only (no persona session).
//   3. both reads equal stack_id; produced_before_seed is true; the file is 0600 in the private session dir.
//
// Errors are fixed codes only.
import fs from 'node:fs';
import { JourneyGateError } from './private-dir.mjs';

const HEX128 = /^[0-9a-f]{32}$/;

/** @param {string|undefined} file @returns {{ stack_id: string }} */
export function assertPairingProof(file) {
  if (!file) throw new JourneyGateError('JOURNEY_GATE3_E_NO_PROOF');
  let st;
  try { st = fs.lstatSync(file); } catch { throw new JourneyGateError('JOURNEY_GATE3_E_NO_PROOF'); }
  if (!st.isFile() || st.isSymbolicLink()) throw new JourneyGateError('JOURNEY_GATE3_E_NOT_FILE');
  if ((st.mode & 0o777) !== 0o600) throw new JourneyGateError('JOURNEY_GATE3_E_MODE');
  let p;
  try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new JourneyGateError('JOURNEY_GATE3_E_PARSE'); }
  if (!p || typeof p !== 'object') throw new JourneyGateError('JOURNEY_GATE3_E_PARSE');
  const keys = Object.keys(p).sort().join(',');
  if (keys !== 'api_read,db_read,produced_before_seed,stack_id,version') throw new JourneyGateError('JOURNEY_GATE3_E_SHAPE');
  if (p.version !== 1) throw new JourneyGateError('JOURNEY_GATE3_E_VERSION');
  if (typeof p.stack_id !== 'string' || !HEX128.test(p.stack_id)) throw new JourneyGateError('JOURNEY_GATE3_E_STACK_ID');
  if (p.db_read !== p.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_DB_MISMATCH');
  if (p.api_read !== p.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_API_MISMATCH');
  if (p.produced_before_seed !== true) throw new JourneyGateError('JOURNEY_GATE3_E_ORDER');
  return { stack_id: p.stack_id };
}
