// ABOUTME: Gate 3 PRODUCER for the journey lane (UNRUN proposal): writes a fresh nonce into the run-owned control course
// ABOUTME: through the DB DSN, reads it back through the DSN and the anon API, and records only observed values (proof v2).
//
// Called only by run-journey.sh, in its fixed order (static contract R11). Subcommands:
//   pins <repo>          shared helpers must equal their agreed git blob ids (reused unchanged, never edited here)
//   ownership            D1 stack-ownership record (shared owner). NOT DEFINED YET, so this always refuses.
//   pair <proof dir>     P0 precheck, P1 carrier insert, P2 DSN readback, P3 anon API readback, then proof v2 (0600)
//   seed <proof file>    the rest of the seed (seed-journey.sql), bound to this proof's nonce
// Output is a fixed code or PASS line only. The nonce is never printed, logged or put on a command line.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertLivePairing, assertPairingProof, PAIRING_COURSE_ID, PAIRING_PREFIX } from '../../../e2e/gradebook-roles/journey/pairing-proof.mjs';
import { writePrivateFile, JourneyGateError } from '../../../e2e/gradebook-roles/journey/private-dir.mjs';
import { assertStrictLocalBinding } from '../../../e2e/gradebook-roles/local-binding.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HEX128 = /^[0-9a-f]{32}$/;

/** Shared helpers reused UNCHANGED (agreed with the shared owner 2026-11-01 23:56Z; blobs equal on main, f2112ce, c199ba7). */
export const HELPER_PINS = Object.freeze(Object.assign(Object.create(null), {
  'scripts/e2e/assert-safe-target.mjs': 'd94b9d6d9744bc7ebcf59bb5cd9bf9df52cf9ada',
  'scripts/local-db/assert-local-dsn.mjs': '9632c7b40dc7a7a739f97342592085f975c58913',
  'e2e/support/chromium-executable.ts': 'ce26c40ebdc6e7893a7bcd502f71fe0bf136dd45',
}));

export class PairError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'PairError'; }
}

/** git blob id of a byte string (what `git hash-object` prints), without needing git. */
export const gitBlobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

/** @param {string} root @returns {string[]} one `RUN_E_PIN <path>` per helper that is missing or differs */
export function pinFailures(root) {
  const f = [];
  for (const [rel, want] of Object.entries(HELPER_PINS)) {
    let buf;
    try { const st = fs.lstatSync(path.join(root, rel)); if (!st.isFile()) throw new Error('x'); buf = fs.readFileSync(path.join(root, rel)); }
    catch { f.push(`RUN_E_PIN ${rel}`); continue; }
    if (gitBlobId(buf) !== want) f.push(`RUN_E_PIN ${rel}`);
  }
  return f;
}

/**
 * D1: the shared owner's machine-readable stack-ownership record. Announced (STACK_OWNERSHIP_FILE, 0600 JSON with run id,
 * attempt, PG system_identifier, origins, created_at, bootstrap sha256) but its exact schema is not delivered, so nothing
 * here may treat any file as ownership proof yet. Always refuses; the run is BLOCKED before any DB contact.
 * @returns {string[]}
 */
export function stackOwnershipFailures(_env = process.env) { return ['RUN_E_D1_UNDEFINED']; }

/**
 * The pairing core. db and fetchImpl are injected so fakes drive every branch (journey-selftest PAIR section).
 * Order is fixed: precheck -> insert -> DSN readback -> anon API readback (and its filtering control).
 * @param {{ db: { journeyRowCount(): Promise<number>, insertCarrier(v: string): Promise<number>, readCarrier(): Promise<string[]> },
 *   fetchImpl?: typeof fetch, apiOrigin: string, anonKey: string, nonce: string, randomId: string, trace?: string[] }} o
 */
export async function producePairing(o) {
  const trace = o.trace ?? [];
  if (typeof o.nonce !== 'string' || !HEX128.test(o.nonce)) throw new PairError('PAIR_E_NONCE');
  const carrier = PAIRING_PREFIX + o.nonce;
  trace.push('precheck');
  const n = await o.db.journeyRowCount();
  if (!Number.isInteger(n) || n < 0) throw new PairError('PAIR_E_PRECHECK');
  if (n !== 0) throw new PairError('PAIR_E_USED_STACK');
  trace.push('insert');
  if ((await o.db.insertCarrier(carrier)) !== 1) throw new PairError('PAIR_E_INSERT');
  trace.push('dbread');
  const rows = await o.db.readCarrier();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0] !== carrier) throw new PairError('PAIR_E_DB_MISMATCH');
  trace.push('apiread');
  let apiRead;
  try {
    apiRead = await assertLivePairing({ stack_id: o.nonce, control_course_id: PAIRING_COURSE_ID },
      { apiOrigin: o.apiOrigin, anonKey: o.anonKey, fetchImpl: o.fetchImpl, randomId: o.randomId });
  } catch (e) {
    if (e instanceof JourneyGateError && e.code.startsWith('JOURNEY_GATE3_E_LIVE_')) throw new PairError(`PAIR_E_API_${e.code.slice('JOURNEY_GATE3_E_LIVE_'.length)}`);
    throw new PairError('PAIR_E_API_UNCLASSIFIED');
  }
  return { version: 2, stack_id: o.nonce, control_course_id: PAIRING_COURSE_ID, db_read: rows[0], api_read: apiRead, journey_rows_before_pairing: n };
}

// ---- real DSN access (used only by the CLI; never by the selftest) ----
const SAFE_PATH = /^[A-Za-z0-9_./-]+$/;
function psql(script) {
  const env = { ...process.env };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT', 'PGPASSFILE']) delete env[k];
  const r = spawnSync('psql', [String(process.env.SUPABASE_DB_URL ?? ''), '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: script, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  if (r.status !== 0) throw new PairError('PAIR_E_PSQL');
  return r.stdout.split('\n').filter(Boolean);
}
// The nonce is set inside psql's own script input (\set), so it never appears in argv, env or output.
const withCarrier = (carrier, file) => {
  if (!/^gb-journey-pairing:[0-9a-f]{32}$/.test(carrier) || !SAFE_PATH.test(file)) throw new PairError('PAIR_E_SCRIPT');
  return `\\set pairing '${carrier}'\n\\i ${file}\n`;
};
const PRECHECK = `select 'JOURNEY_ROWS ' || (
    (select count(*) from public.courses where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from public.modules where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from public.content_items where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from public.assignments where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from storage.objects where bucket_id = 'course-documents' and name like 'submissions/9b6c0000-0000-4000-8000-%'));\n`;
const realDb = {
  async journeyRowCount() {
    const out = psql(PRECHECK).filter((l) => l.startsWith('JOURNEY_ROWS '));
    if (out.length !== 1 || !/^JOURNEY_ROWS \d+$/.test(out[0])) throw new PairError('PAIR_E_PRECHECK');
    return Number(out[0].slice(13));
  },
  async insertCarrier(carrier) { return psql(withCarrier(carrier, path.join(HERE, 'pairing-seed.sql'))).filter((l) => l === 'PAIRING_INSERTED').length; },
  async readCarrier() {
    return psql(`select 'CARRIER ' || coalesce(description, '') from public.courses where id = '${PAIRING_COURSE_ID}';\n`)
      .filter((l) => l.startsWith('CARRIER ')).map((l) => l.slice(8));
  },
};

async function cli(argv) {
  const [cmd, arg] = argv;
  if (cmd === 'pins') { const f = pinFailures(arg ?? ''); if (f.length) throw new PairError(f[0]); return 'PASS shared helper pins (3 blobs unchanged)'; }
  if (cmd === 'ownership') { throw new PairError(stackOwnershipFailures()[0]); }
  if (cmd === 'pair') {
    const { api, anonKey } = assertStrictLocalBinding();      // runs assert-local-dsn again right before the write
    const proof = await producePairing({ db: realDb, apiOrigin: api.origin, anonKey, nonce: randomBytes(16).toString('hex'), randomId: randomUUID() });
    writePrivateFile(arg, 'pairing-proof.json', JSON.stringify(proof));
    return 'PASS pairing: carrier written through the DSN, read back through the DSN and the anon API';
  }
  if (cmd === 'seed') {
    // The proof's own placement rules need a session dir to compare against; the runner passes it as GB_SESSION_DIR.
    const p = assertPairingProof(arg, { sessionDir: String(process.env.GB_SESSION_DIR ?? '') });
    const out = psql(withCarrier(PAIRING_PREFIX + p.stack_id, path.join(HERE, 'seed-journey.sql')));
    if (!out.some((l) => l.startsWith('PASS journey seed:'))) throw new PairError('PAIR_E_SEED');
    return out.filter((l) => l.startsWith('PASS journey seed:'))[0];
  }
  throw new PairError('PAIR_E_USAGE');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  cli(process.argv.slice(2)).then((m) => { console.log(m); }, (e) => {
    console.log(`run-journey refused: ${e && typeof e.code === 'string' ? e.code : 'PAIR_E_UNCLASSIFIED'}`);
    process.exit(3);
  });
}
