// ABOUTME: Owned-stack proof CONSUMER. Reads the proof through a no-follow descriptor and requires a regular, single-link file
// ABOUTME: owned by this uid with mode exactly 0600, bound to this run and stack. A valid shape alone is NOT ownership.
//
// TRUSTED_PRODUCERS maps a reviewed producer's repo path to its exact git blob. The only entry is this lane's pairing producer,
// at the bytes source-qualified in #150 d751a683 and composed job #157 f0fbd1e7 (T 04:11Z and 04:24Z). A proof naming any
// other producer is refused with PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER, and checkStackProof also refuses when the producer file
// on disk is not those exact bytes (PUBLIC_CATALOG_E_PRODUCER_PIN). Changing the producer means a new reviewed pin here.
// A pin is source qualification only: it is not a run approval.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessStat, readPrivateFile } from './private-file.mjs';
import { checkHelperPins } from './helper-pins.mjs';

export const TRUSTED_PRODUCERS = Object.freeze({
  'scripts/public-catalog-fixture/pairing-producer.mjs': 'b8a555ba9f15eee1b17f477ba8c477a6434fa4ec',
});
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const P = {
  NO_PROOF: 'PUBLIC_CATALOG_E_NO_STACK_PROOF',
  BAD_FILE: 'PUBLIC_CATALOG_E_PROOF_FILE',
  BAD_FIELDS: 'PUBLIC_CATALOG_E_PROOF_FIELDS',
  BLOCKED: 'PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER',
  PIN: 'PUBLIC_CATALOG_E_PRODUCER_PIN',
};
const HEX32 = /^[0-9a-f]{32}$/;

/** Pure check of an fstat result, so the owner/mode/link rules are testable without chown (private-file.mjs rules). */
export const MAX_PROOF = 4096;
export function assessProofStat(st, uid) {
  const bad = assessStat(st, uid, { privateMode: true, max: MAX_PROOF });
  return bad ? `${P.BAD_FILE}: ${bad}` : null;
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

export function checkStackProof(file, runId, uid = process.getuid(), root = ROOT) {
  if (!file) return `${P.NO_PROOF}: PUBLIC_ACCEPT_STACK_PROOF is unset`;
  const r = readPrivateFile(file, { max: MAX_PROOF, privateMode: true, uid });
  if (r.error === 'OPEN') return `${P.NO_PROOF}: unopenable or a symlink`;
  if (r.error) return `${P.BAD_FILE}: ${r.error}`;
  let p; try { p = JSON.parse(r.buf.toString('utf8')); } catch { return `${P.BAD_FIELDS}: not JSON`; }
  const bad = assessProofFields(p, runId);
  if (bad) return bad;
  if (checkHelperPins(root, { [p.producer]: TRUSTED_PRODUCERS[p.producer] }).length) return `${P.PIN}: producer file is not the pinned bytes`;
  return null;
}
