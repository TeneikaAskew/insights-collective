#!/usr/bin/env node
// ABOUTME: Builder-authoring DSN entry (UNRUN): the seed, bound to the qualified pairing proof, and the read-only witness.
// ABOUTME: Reuses the gradebook lane's private psql and pairing-proof modules unchanged; no DSN or value on argv or stdout.
//
//   ba-db.mjs seed    <pairing proof file> <session dir> <private dir>      -> one fixed line on success
//   ba-db.mjs witness <private dir> <out file in that dir> <created nonce>  -> raw witness lines to the private out file
// The seed runs only after pairing-producer.mjs `pair` (carrier written through the DSN, read back through the DSN AND the
// anon API) and only with :pairing = that proof's carrier: seed.sql refuses unless this database holds exactly it.
// Errors: "ba-db refused: BA_DB_E_<CODE>" and exit 3. Nothing raw is printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPsql, includeScript } from '../gradebook-fixture/journey/private-psql.mjs';
import { assertPairingProof, PAIRING_PREFIX } from '../../e2e/gradebook-roles/journey/pairing-proof.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_OK = 'BA_SEED_OK courses=2 sections=5 lessons=5';
class DbError extends Error { constructor(code) { super(code); this.code = code; } }
const psql = async (script, privDir) => { try { return await runPsql({ script, privDir }); } catch { throw new DbError('BA_DB_E_PSQL'); } };

async function seed(proofFile, sessionDir, privDir) {
  let proof;
  try { proof = assertPairingProof(proofFile, { sessionDir }); } catch { throw new DbError('BA_DB_E_PROOF'); }
  let script;
  try { script = includeScript(path.join(HERE, 'seed.sql'), { pairing: PAIRING_PREFIX + proof.stack_id }); } catch { throw new DbError('BA_DB_E_SCRIPT'); }
  const lines = await psql(script, privDir);
  if (lines.length !== 1 || lines[0] !== SEED_OK) throw new DbError('BA_DB_E_SEED');
  return SEED_OK;
}

async function witness(privDir, outFile, nonce) {
  if (!/^[0-9a-f]{16,32}$/.test(String(nonce))) throw new DbError('BA_DB_E_NONCE');
  let real;
  try { real = fs.realpathSync(privDir); } catch { throw new DbError('BA_DB_E_PRIVATE_DIR'); }
  if (path.dirname(path.resolve(outFile)) !== real) throw new DbError('BA_DB_E_OUT_NOT_PRIVATE');
  let script;
  try { script = includeScript(path.join(HERE, 'witness.sql'), { nonce }); } catch { throw new DbError('BA_DB_E_SCRIPT'); }
  const lines = await psql(script, privDir);
  try { fs.writeFileSync(outFile, lines.join('\n') + '\n', { mode: 0o600, flag: 'wx' }); } catch { throw new DbError('BA_DB_E_OUT_WRITE'); }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b, c] = process.argv.slice(2);
  (async () => {
    if (cmd === 'seed' && a && b && c) return seed(a, b, c);
    if (cmd === 'witness' && a && b && c) return witness(a, b, c);
    throw new DbError('BA_DB_E_USAGE');
  })().then((line) => { if (line) console.log(line); process.exit(0); }, (e) => {
    console.log(`ba-db refused: ${e instanceof DbError ? e.code : 'BA_DB_E_UNCLASSIFIED'}`);
    process.exit(3);
  });
}
