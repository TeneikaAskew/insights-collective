// ABOUTME: Gate 3 CONSUMER for the journey lane (UNRUN proposal). Proof v2: checks the SHAPE and PLACEMENT of the pairing file,
// ABOUTME: then re-reads the pairing row LIVE through the anon API before any sign-in. The file alone is never trusted.
//
// Producer: scripts/gradebook-fixture/journey/pairing-producer.mjs, called by run-journey.sh before the rest of the seed
// and before any persona request. It writes a fresh 128-bit nonce into the run-owned control course row THROUGH THE DB
// DSN, reads it back through the DSN and through the anon API, and records only those observed values (no booleans).
// v1 files (with the caller-authored produced_before_seed boolean) are refused.
//
// What this still does NOT prove: that this job booted the stack or that it is disposable. That is the shared owner's
// stack-ownership record (D1), not defined yet, so run-journey.sh refuses before any write. Errors are fixed codes only;
// the nonce is never printed.
import fs from 'node:fs';
import path from 'node:path';
import { JourneyGateError } from './private-dir.mjs';

const HEX128 = /^[0-9a-f]{32}$/;
/** The run-owned control course (ids.ts journey.control.course): the pairing carrier. */
export const PAIRING_COURSE_ID = '9b6c0000-0000-4000-8000-000000000011';
export const PAIRING_PREFIX = 'gb-journey-pairing:';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * @param {string|undefined} file
 * @param {{ sessionDir: string, uid?: number }} opts  sessionDir = the real path of the (already checked) session dir
 * @returns {{ stack_id: string, control_course_id: string }}
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
  if (!own(p, 'version') || p.version !== 2) throw new JourneyGateError('JOURNEY_GATE3_E_VERSION');
  if (Object.keys(p).sort().join(',') !== 'api_read,control_course_id,db_read,journey_rows_before_pairing,stack_id,version') throw new JourneyGateError('JOURNEY_GATE3_E_SHAPE');
  if (typeof p.stack_id !== 'string' || !HEX128.test(p.stack_id)) throw new JourneyGateError('JOURNEY_GATE3_E_STACK_ID');
  if (p.control_course_id !== PAIRING_COURSE_ID) throw new JourneyGateError('JOURNEY_GATE3_E_CARRIER');
  if (p.db_read !== PAIRING_PREFIX + p.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_DB_MISMATCH');
  if (p.api_read !== PAIRING_PREFIX + p.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_API_MISMATCH');
  // An observed count, not a flag: the producer read 0 journey/control rows through the DSN before it inserted the carrier.
  if (p.journey_rows_before_pairing !== 0) throw new JourneyGateError('JOURNEY_GATE3_E_ORDER');
  return { stack_id: p.stack_id, control_course_id: p.control_course_id };
}

/**
 * Live recheck, before the first sign-in POST: the API origin the browser will use must serve the carrier row with THIS
 * proof's nonce right now (anon key only, no persona session), and must filter (a random id returns no row).
 * @param {{ stack_id: string, control_course_id: string }} proof  as returned by assertPairingProof
 * @param {{ apiOrigin: string, anonKey: string, fetchImpl?: typeof fetch, randomId: string }} opts
 * @returns {Promise<string>} the description the API served (equal to the carrier)
 */
export async function assertLivePairing(proof, opts) {
  const f = opts.fetchImpl ?? fetch;
  const get = async (id) => {
    let res, body;
    try {
      res = await f(`${opts.apiOrigin}/rest/v1/courses?id=eq.${id}&select=id,description`, { method: 'GET', redirect: 'error', headers: { apikey: opts.anonKey, Accept: 'application/json' } });
    } catch { throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_TRANSPORT'); }
    if (res.status !== 200) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_STATUS');
    try { body = await res.json(); } catch { throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_PARSE'); }
    if (!Array.isArray(body)) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_PARSE');
    return body;
  };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(opts.randomId)) || opts.randomId === proof.control_course_id) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_CONTROL_ID');
  const rows = await get(proof.control_course_id);
  if (rows.length !== 1) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_COUNT');
  const r = rows[0];
  if (!r || typeof r !== 'object' || Object.keys(r).sort().join(',') !== 'description,id' || r.id !== proof.control_course_id) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_SHAPE');
  if (r.description !== PAIRING_PREFIX + proof.stack_id) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_MISMATCH');
  if ((await get(opts.randomId)).length !== 0) throw new JourneyGateError('JOURNEY_GATE3_E_LIVE_NOT_FILTERING');
  return r.description;
}
