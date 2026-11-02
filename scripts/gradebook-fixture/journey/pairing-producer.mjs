// ABOUTME: Gate 3 PRODUCER for the journey lane (UNRUN proposal): writes a fresh nonce into the run-owned control course
// ABOUTME: through the DB DSN, reads it back through the DSN and the anon API, and records only observed values (proof v2).
//
// Called only by run-journey.sh, in its fixed order (static contract R11). Subcommands (<raw> = the run's private 0700 raw
// dir, where psql stderr and the passfile live and which the runner's trap removes):
//   pins <repo>               shared files must equal their agreed git blob ids (reused unchanged, never edited here)
//   dsn                       the DSN (from the environment only) passes the shared strict parser IN-PROCESS
//   ownership <raw>           D1: the shared owner's stack-ownership record, read once through a non-blocking no-follow handle,
//                             verified by the shared module against this run and a LIVE system identifier, then this lane's
//                             checks (same bytes, origins, the PINNED expected bootstrap identity: none yet, so it refuses)
//   appverify                 the shared hermetic served-app verification (none pinned yet, so it refuses)
//   pair <proof dir> <raw>    P0 precheck, P1 carrier insert, P2 DSN readback, P3 anon API readback, then proof v2 (0600)
//   seed <proof file> <raw>   the rest of the seed (seed-journey.sql), bound to this proof's nonce
// Output is a fixed code or PASS line only. The nonce is never printed or logged, and no DSN, password or nonce is ever on
// a command line (psql runs through private-psql.mjs: -w, password in a private passfile, SQL on stdin).
//
// Authorisation of the FIRST write (the carrier INSERT) comes from the gates before it (pins, guards, D1 with a pinned
// bootstrap identity, served-app verification), never from the pairing itself, which can only be observed after it.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { runPsql, includeScript } from './private-psql.mjs';
import { fileURLToPath } from 'node:url';
import { assertLivePairing, assertPairingProof, PAIRING_COURSE_ID, PAIRING_PREFIX } from '../../../e2e/gradebook-roles/journey/pairing-proof.mjs';
import { writePrivateFile, JourneyGateError } from '../../../e2e/gradebook-roles/journey/private-dir.mjs';
import { assertStrictLocalBinding } from '../../../e2e/gradebook-roles/local-binding.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HEX128 = /^[0-9a-f]{32}$/;
export const SEED_PASS = 'PASS journey seed: 1 draft course (1 module, page + 10-point upload assignment) and 1 published control course (1 module, 1 page); nothing else';

/** Shared helpers reused UNCHANGED (agreed with the shared owner 2026-11-01 23:56Z; blobs equal on main, f2112ce, c199ba7). */
export const HELPER_PINS = Object.freeze(Object.assign(Object.create(null), {
  'scripts/e2e/assert-safe-target.mjs': 'd94b9d6d9744bc7ebcf59bb5cd9bf9df52cf9ada',
  'scripts/local-db/assert-local-dsn.mjs': '9632c7b40dc7a7a739f97342592085f975c58913',
  'e2e/support/chromium-executable.ts': 'ce26c40ebdc6e7893a7bcd502f71fe0bf136dd45',
  // D1 (shared owner, draft #154 head 7e31eec on main 32ccf7d, 2026-11-02 00:37Z). Until it is in this branch's
  // base, these two are absent and `pins` refuses, so the adapter cannot run.
  'scripts/e2e/stack-ownership.mjs': 'ea39300dda9673b66fc6918b75929ca1b5e5d467',
  'scripts/e2e/fixtures/stack-ownership.fake.json': 'f1c384ec604bfa377af28b425ff981e2c072a32a',
  // The reviewed bootstrap the D1 record must name (same blob on main 32ccf7d, 1cb7f68 and 0f3c659).
  'scripts/local-stack/bootstrap.sh': 'aa34aa297e3ec1a214e33ebb09fc934f6991cbaa',
}));
export const D1_MODULE = 'scripts/e2e/stack-ownership.mjs';
/** sha256 of the reviewed scripts/local-stack/bootstrap.sh (blob aa34aa29, pinned above), the digest the D1 record must
 *  name. A reviewed constant in this source: never read from the record or the job env. `ownership` also re-hashes the
 *  pinned file and refuses if it differs, so the constant cannot drift from the reviewed bytes. Agreed with the shared
 *  owner 2026-11-02 00:48Z and checked independently (sha256 of the blob on main, 0f3c659 and the working file). */
export const EXPECTED_BOOTSTRAP_SHA256 = 'b41a9ed8d7b3207cb2ad4faf71ec8b7fd703a816d02ec0eb92c99a18af452715';
export const BOOTSTRAP_FILE = 'scripts/local-stack/bootstrap.sh';
/** The shared hermetic served-app verifier ({ path, blob }), to run before the carrier INSERT. Not delivered as a module this
 *  adapter can call and pin: null refuses (RUN_E_APP_UNVERIFIED), so the adapter stays BLOCKED before its first write. */
export const SERVED_APP_VERIFIER = null;

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

const DIGITS = /^[0-9]{1,20}$/;
const MAX_RECORD = 4096;
const sortedJson = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort());

/**
 * Reads the record ONCE through a single non-blocking, no-follow handle: regular file, caller-owned, exactly 0600 and at
 * most 4 KiB are all checked on THAT handle (fstat), the read is bounded and must equal the fstat size, and the handle is
 * always closed. A FIFO, directory, device or symlink never blocks and is refused. io is injectable for fakes.
 * @returns {{ code: string|null, bytes?: Buffer }}
 */
export function readRecordHandle(file, { uid, io = fs } = {}) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) return { code: 'RUN_E_D1_HANDLE_OPEN' };
  let fd;
  try { fd = io.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { return { code: 'RUN_E_D1_HANDLE_OPEN' }; }
  let res = null;
  try {
    let st;
    try { st = io.fstatSync(fd); } catch { res = { code: 'RUN_E_D1_HANDLE_STAT' }; }
    const me = uid ?? (typeof process.getuid === 'function' ? process.getuid() : -1);
    if (!res && !st.isFile()) res = { code: 'RUN_E_D1_HANDLE_TYPE' };
    if (!res && ((st.mode & 0o777) !== 0o600 || (me >= 0 && st.uid !== me))) res = { code: 'RUN_E_D1_MODE_EXACT' };
    if (!res && (st.size > MAX_RECORD || st.size < 2)) res = { code: 'RUN_E_D1_HANDLE_SIZE' };
    if (!res) {
      const buf = Buffer.alloc(MAX_RECORD + 1);
      let total = 0;
      try {
        for (;;) {
          const n = io.readSync(fd, buf, total, buf.length - total, null);
          if (n === 0) break;
          total += n;
          if (total >= buf.length) break;
        }
      } catch { res = { code: 'RUN_E_D1_HANDLE_READ' }; }
      if (!res && total > MAX_RECORD) res = { code: 'RUN_E_D1_HANDLE_SIZE' };
      if (!res && total !== st.size) res = { code: 'RUN_E_D1_HANDLE_GROWTH' };
      if (!res) res = { code: null, bytes: buf.subarray(0, total) };
    }
  } finally {
    try { io.closeSync(fd); } catch { if (!res || res.code === null) res = { code: 'RUN_E_D1_HANDLE_CLOSE' }; }
  }
  return res;
}

/**
 * D1 consumer. Order: module and inputs, the PINNED expected bootstrap identity, one-handle read of the record, the
 * shared verifyRecord (schema v1, run id and attempt, origins, LIVE pg system identifier), the shared record must equal the
 * bytes this lane read, then origins and the bootstrap identity again. `disposable: true` is a declaration by the bootstrap
 * and is never treated as proof here; nor are a well-formed hash, the current system identifier or run strings by themselves.
 * @param {{ verifyRecord: Function, file: string|undefined, runId: string|undefined, runAttempt: string|undefined,
 *   liveSystemIdentifier: string, apiOrigin: string, appOrigin: string, expectedBootstrapSha256: string|null, uid?: number, io?: object }} o
 * @returns {string[]} fixed codes; empty means verified
 */
export function stackOwnershipFailures(o) {
  if (!o || typeof o.verifyRecord !== 'function') return ['RUN_E_D1_MODULE'];
  if (!DIGITS.test(String(o.runAttempt ?? ''))) return ['RUN_E_D1_NO_ATTEMPT'];
  if (typeof o.expectedBootstrapSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.expectedBootstrapSha256)) return ['RUN_E_D1_BOOTSTRAP_UNPINNED'];
  const h = readRecordHandle(o.file, { uid: o.uid, io: o.io });
  if (h.code) return [h.code];
  let mine;
  try { mine = JSON.parse(h.bytes.toString('utf8')); } catch { return ['RUN_E_D1_HANDLE_PARSE']; }
  if (!mine || typeof mine !== 'object' || Array.isArray(mine)) return ['RUN_E_D1_HANDLE_PARSE'];
  let r;
  try { r = o.verifyRecord(o.file, { runId: o.runId, runAttempt: o.runAttempt, liveSystemIdentifier: o.liveSystemIdentifier, apiOrigin: o.apiOrigin, appOrigin: o.appOrigin, expectedBootstrapSha256: o.expectedBootstrapSha256 }); }
  catch { return ['RUN_E_D1_MODULE']; }
  if (!r || typeof r !== 'object' || typeof r.code !== 'string') return ['RUN_E_D1_MODULE'];
  if (r.ok !== true || r.code !== 'SO_OK') return [`RUN_E_D1_${/^SO_[A-Z_]+$/.test(r.code) ? r.code : 'MODULE'}`];
  const record = r.record;
  if (!record || typeof record !== 'object' || sortedJson(record) !== sortedJson(mine)) return ['RUN_E_D1_HANDLE_CHANGED'];
  if (record.api_origin !== o.apiOrigin) return ['RUN_E_D1_API_ORIGIN'];
  if (record.app_origin !== o.appOrigin) return ['RUN_E_D1_APP_ORIGIN'];
  if (record.bootstrap_sha256 !== o.expectedBootstrapSha256) return ['RUN_E_D1_BOOTSTRAP_MISMATCH'];
  return [];
}

/**
 * Served-app gate, before the carrier INSERT: the pinned shared verifier must return exactly { ok: true } for this app
 * origin. With no verifier pinned it refuses.
 * @param {{ verifier: { path: string, blob: string }|null, root: string, appOrigin: string, importImpl?: Function }} o
 */
export async function servedAppFailures(o) {
  const v = o.verifier;
  if (!v || typeof v.path !== 'string' || !/^[0-9a-f]{40}$/.test(String(v.blob))) return ['RUN_E_APP_UNVERIFIED'];
  let buf;
  try { buf = fs.readFileSync(path.join(o.root, v.path)); } catch { return ['RUN_E_APP_VERIFIER_PIN']; }
  if (gitBlobId(buf) !== v.blob) return ['RUN_E_APP_VERIFIER_PIN'];
  let r;
  try { const mod = await (o.importImpl ?? ((p) => import(p)))(path.join(o.root, v.path)); r = await mod.verifyServedApp({ appOrigin: o.appOrigin }); }
  catch { return ['RUN_E_APP_VERIFIER']; }
  if (!r || r.ok !== true || Object.keys(r).length !== 1) return ['RUN_E_APP_UNVERIFIED'];
  return [];
}

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

// ---- real DSN access (CLI only): private-psql.mjs, no DSN on argv, SQL on stdin, raw stderr in the private dir ----
const PRECHECK = `select 'JOURNEY_ROWS ' || (
    (select count(*) from public.courses where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from public.modules where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from public.content_items where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from public.assignments where id::text like '9b6c0000-0000-4000-8000-%')
  + (select count(*) from storage.objects where bucket_id = 'course-documents' and name like 'submissions/9b6c0000-0000-4000-8000-%'));\n`;
const psqlIn = async (raw, script) => { try { return await runPsql({ script, privDir: raw }); } catch { throw new PairError('PAIR_E_PSQL'); } };
const carrierScript = (carrier, file) => {
  if (!/^gb-journey-pairing:[0-9a-f]{32}$/.test(carrier)) throw new PairError('PAIR_E_SCRIPT');
  try { return includeScript(file, { pairing: carrier }); } catch { throw new PairError('PAIR_E_SCRIPT'); }
};
const realDb = (raw) => ({
  async journeyRowCount() {
    const out = (await psqlIn(raw, PRECHECK)).filter((l) => l.startsWith('JOURNEY_ROWS '));
    if (out.length !== 1 || !/^JOURNEY_ROWS \d+$/.test(out[0])) throw new PairError('PAIR_E_PRECHECK');
    return Number(out[0].slice(13));
  },
  async insertCarrier(carrier) { return (await psqlIn(raw, carrierScript(carrier, path.join(HERE, 'pairing-seed.sql')))).filter((l) => l === 'PAIRING_INSERTED').length; },
  async readCarrier() {
    return (await psqlIn(raw, `select 'CARRIER ' || coalesce(description, '') from public.courses where id = '${PAIRING_COURSE_ID}';\n`))
      .filter((l) => l.startsWith('CARRIER ')).map((l) => l.slice(8));
  },
});

/** sha256 of the pinned bootstrap file in this tree (null if unreadable). */
export function bootstrapFileSha256(root) {
  try { return createHash('sha256').update(fs.readFileSync(path.join(root, BOOTSTRAP_FILE))).digest('hex'); } catch { return null; }
}

async function cli(argv) {
  const [cmd, arg, raw] = argv;
  const root = path.resolve(HERE, '../../..');
  if (cmd === 'pins') { const f = pinFailures(arg ?? ''); if (f.length) throw new PairError(f[0]); return `PASS shared file pins (${Object.keys(HELPER_PINS).length} blobs unchanged)`; }
  if (cmd === 'dsn') { assertStrictLocalBinding(); return 'PASS loopback DSN (checked in-process)'; }
  if (cmd === 'ownership') {
    const f = pinFailures(root);                                // the module is re-checked right before it is imported
    if (f.length) throw new PairError(f[0]);
    const { api, app } = assertStrictLocalBinding();
    // Cheap, deterministic refusals first (no DB contact while the bootstrap identity is not pinned).
    if (typeof EXPECTED_BOOTSTRAP_SHA256 !== 'string' || !/^[0-9a-f]{64}$/.test(EXPECTED_BOOTSTRAP_SHA256)) throw new PairError('RUN_E_D1_BOOTSTRAP_UNPINNED');
    if (bootstrapFileSha256(root) !== EXPECTED_BOOTSTRAP_SHA256) throw new PairError('RUN_E_D1_BOOTSTRAP_FILE');
    const live = (await psqlIn(arg, "select 'SYSID ' || system_identifier::text from pg_control_system();\n")).filter((l) => l.startsWith('SYSID '));
    if (live.length !== 1) throw new PairError('RUN_E_D1_LIVE_READ');
    const mod = await import(path.join(root, D1_MODULE));
    const bad = stackOwnershipFailures({ verifyRecord: mod.verifyRecord, file: process.env.STACK_OWNERSHIP_FILE, runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT, liveSystemIdentifier: live[0].slice(6), apiOrigin: api.origin, appOrigin: app.origin,
      expectedBootstrapSha256: EXPECTED_BOOTSTRAP_SHA256 });
    if (bad.length) throw new PairError(bad[0]);
    return 'PASS stack ownership record verified for this run, this cluster and the pinned bootstrap (disposable is declared, not proven)';
  }
  if (cmd === 'appverify') {
    const { app } = assertStrictLocalBinding();
    const bad = await servedAppFailures({ verifier: SERVED_APP_VERIFIER, root, appOrigin: app.origin });
    if (bad.length) throw new PairError(bad[0]);
    return 'PASS served app verified by the pinned shared verifier';
  }
  if (cmd === 'pair') {
    const { api, anonKey } = assertStrictLocalBinding();      // runs the shared DSN guard again, in-process, right before the write
    const proof = await producePairing({ db: realDb(raw), apiOrigin: api.origin, anonKey, nonce: randomBytes(16).toString('hex'), randomId: randomUUID() });
    writePrivateFile(arg, 'pairing-proof.json', JSON.stringify(proof));
    return 'PASS pairing: carrier written through the DSN, read back through the DSN and the anon API';
  }
  if (cmd === 'seed') {
    // The proof's own placement rules need a session dir to compare against; the runner passes it as GB_SESSION_DIR.
    const p = assertPairingProof(arg, { sessionDir: String(process.env.GB_SESSION_DIR ?? '') });
    const out = await psqlIn(raw, carrierScript(PAIRING_PREFIX + p.stack_id, path.join(HERE, 'seed-journey.sql')));
    const ok = out.filter((l) => l === SEED_PASS);
    if (ok.length !== 1) throw new PairError('PAIR_E_SEED');
    return SEED_PASS;
  }
  throw new PairError('PAIR_E_USAGE');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  cli(process.argv.slice(2)).then((m) => { console.log(m); }, (e) => {
    const c = e && typeof e.code === 'string' && /^[A-Z0-9_]+( [a-z0-9_./-]+)?$/.test(e.code) ? e.code : 'PAIR_E_UNCLASSIFIED';
    console.log(`run-journey refused: ${c}`);
    process.exit(3);
  });
}
