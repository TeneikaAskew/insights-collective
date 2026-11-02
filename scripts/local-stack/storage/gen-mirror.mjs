// ABOUTME: Builds the Storage mirror SQL and the policy identity list from LIVE pins text, in memory, and refuses unless the
// ABOUTME: pins and the generated SQL equal the reviewed sha256 constants below. No file I/O: s0 writes the private copies.
//
// The pins and the mirror are derived on the runner from the private input (storage-job.mjs s0) and never committed. The two
// digests are the public review anchors: a different input, converter or generator cannot produce a passing run.
import { createHash } from 'node:crypto';
import { StorageError, parsePins, generateMirror, policyIdentity } from './storage-core.mjs';

export const LIVE_PINS_SHA256 = '02ce9f854d091ee634cbbffbddabf8d94bec3c66f0d0ac91c8da2e42c7ae1124';
export const MIRROR_SHA256 = '2d519c9db99cabdaeeffc59c2cda6a05fda4a4f302dfbc963e4eb257e2a98c53';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');

export function build(pinsText, { pinsSha = LIVE_PINS_SHA256, mirrorSha = MIRROR_SHA256 } = {}) {
  if (typeof pinsText !== 'string' || sha(pinsText) !== pinsSha) throw new StorageError('ST_E_PINS_SHA');
  const live = parsePins(pinsText);
  const { sql, creates } = generateMirror(live); // generateMirror re-checks the statement shapes (assertMirrorShape)
  if (sha(sql) !== mirrorSha) throw new StorageError('ST_E_MIRROR_SHA');
  const ids = [...live.policies.values()].map((x) => `${x.table}\t${Buffer.from(x.name, 'utf8').toString('base64')}\t${policyIdentity(x, md5)}`).sort();
  return { sql, creates, identities: `${ids.join('\n')}\n`, live };
}
