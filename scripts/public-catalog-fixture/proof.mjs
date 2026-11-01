// ABOUTME: Owned-stack proof CONSUMER. Reads the proof through a no-follow descriptor and requires a regular, single-link file
// ABOUTME: owned by this uid with mode exactly 0600, bound to this run and stack. A valid shape alone is NOT ownership.
//
// The trusted PRODUCER (a pre-seed step in the shared stack bootstrap that reads stack_id from the DB and through PostgREST
// before anything is written) does not exist. TRUSTED_PRODUCERS is therefore empty and every real run is BLOCKED with
// PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER, whatever the proof file says. Adding a producer is a reviewed change: its path and git
// blob id go here.
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';

export const TRUSTED_PRODUCERS = Object.freeze({});
export const P = {
  NO_PROOF: 'PUBLIC_CATALOG_E_NO_STACK_PROOF',
  BAD_FILE: 'PUBLIC_CATALOG_E_PROOF_FILE',
  BAD_FIELDS: 'PUBLIC_CATALOG_E_PROOF_FIELDS',
  BLOCKED: 'PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER',
};
const HEX32 = /^[0-9a-f]{32}$/;

/** Pure check of an fstat result, so the owner/mode/link rules are testable without chown. */
export function assessProofStat(st, uid) {
  if (!st.isFile()) return `${P.BAD_FILE}: not a regular file`;
  if (st.nlink !== 1) return `${P.BAD_FILE}: link count must be 1`;
  if (st.uid !== uid) return `${P.BAD_FILE}: not owned by this uid`;
  if ((st.mode & 0o7777) !== 0o600) return `${P.BAD_FILE}: mode must be exactly 0600`;
  return null;
}

/** Pure check of the parsed fields against this run. */
export function assessProofFields(p, runId) {
  if (!HEX32.test(runId ?? '')) return `${P.BAD_FIELDS}: PUBLIC_ACCEPT_RUN_ID must be 32 hex`;
  if (p?.version !== 2 || !HEX32.test(p.stack_id ?? '') || p.db_read !== p.stack_id || p.api_read !== p.stack_id
      || p.run_id !== runId || p.produced_before_seed !== true || typeof p.producer !== 'string') {
    return `${P.BAD_FIELDS}: proof does not bind this run, the DB and the API to one stack before the seed`;
  }
  if (!Object.hasOwn(TRUSTED_PRODUCERS, p.producer)) return `${P.BLOCKED}: no reviewed proof producer exists`;
  return null;
}

export function checkStackProof(file, runId, uid = process.getuid()) {
  if (!file) return `${P.NO_PROOF}: PUBLIC_ACCEPT_STACK_PROOF is unset`;
  let fd;
  try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW); } catch { return `${P.NO_PROOF}: unreadable or a symlink`; }
  try {
    const bad = assessProofStat(fstatSync(fd), uid); if (bad) return bad;
    let p; try { p = JSON.parse(readFileSync(fd, 'utf8')); } catch { return `${P.BAD_FIELDS}: not JSON`; }
    return assessProofFields(p, runId);
  } finally { closeSync(fd); }
}
