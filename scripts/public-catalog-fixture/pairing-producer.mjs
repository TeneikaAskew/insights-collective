#!/usr/bin/env node
// ABOUTME: Lane-owned PAIRING producer (proof v2): writes one fresh 32-hex stack_id into a never-rendered carrier, reads it back
// ABOUTME: through this lane's DSN AND the anonymous API, and records only observed values. UNRUN; not in TRUSTED_PRODUCERS yet.
//
// Carrier (chosen with the shared bootstrap owner, 2026-11-02 03:34Z): ONE run-owned row in the EXISTING public.blog_tags
// (name = slug = stack_id). The snapshot grants anon SELECT and its RLS read policy is USING (true); no page under src queries
// blog_tags, so the nonce never reaches /, /courses, a course page or a screenshot. Courses, modules and the RLS negative
// controls are untouched. If anon cannot read the row on the real stack this FAILS CLOSED; no authenticated or DSN read is ever
// substituted for api_read (a weaker proof of the anon path).
//
// Order (run.sh): after D1 ownership verify, before W0 and the seed. Steps, each fail-closed with a fixed code:
//   P0 precheck: blog_tags holds no row at all (fresh stack)       P1 insert the carrier through the DSN (exactly 1 row)
//   P2 DSN readback equals the carrier                             P3 anon API readback: exactly 200, one row, name = slug = id
//   P4 filter control: the same anon query for a random id is exactly 200 []
// Then proof v2 is written with O_EXCL, mode 0600, into the private staging dir. The stack_id is never printed, logged, put on
// a command line, in the environment or in a URL: it reaches psql only inside the SQL text on stdin, and the two API reads
// query the FIXED carrier id and a RANDOM id.
//
// CLI: node pairing-producer.mjs pair <private dir>     prints one fixed line; exit 0 or 3
// The CLI enforces its own eligibility, so it is safe outside run.sh too. Before ANY child process or HTTP request:
//   E1 guards (loopback app/API origins, shared target guard, anon key, canonical password-free DSN + private passfile, tier)
//   E2 run id   E3 PRE contract gate (BLOCKED while its pins are empty)   E4 D1 module blob pin
//   E5 D1 record read statically: file rules, this run and attempt, these origins, the expected bootstrap digest
//   E6 output dir: an existing directory (no symlink), owned by this uid, mode 0700-or-stricter, equal to its realpath, and
//      the proof destination absent
// Only then: D1 live check (one read-only psql query of the system identifier, then the shared verifier), then P0 to P4.
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_PREFIX } from './fixtures.mjs';
import { runGuards } from './guards.mjs';
import { checkPreContract } from './pre-contract.mjs';
import { checkHelperPins, D1_PINS } from './helper-pins.mjs';
import { ownershipFailures, EXPECTED_BOOTSTRAP_SHA256, D1_MODULE } from './d1-ownership.mjs';
import { pathToFileURL } from 'node:url';

export const PRODUCER = 'scripts/public-catalog-fixture/pairing-producer.mjs';
export const PAIRING_TAG_ID = `${ID_PREFIX}000000000900`;
const HEX32 = /^[0-9a-f]{32}$/;

export class PairError extends Error { constructor(code) { super(code); this.code = code; this.name = 'PairError'; } }

/** Anonymous PostgREST read of one blog_tags row by id. Returns the parsed rows or throws a fixed code. */
async function anonRead(fetchImpl, apiOrigin, anonKey, id) {
  let r;
  try {
    r = await fetchImpl(`${apiOrigin}/rest/v1/blog_tags?select=id,name,slug&id=eq.${encodeURIComponent(id)}`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' }, redirect: 'manual' });
  } catch { throw new PairError('PAIR_E_API_HTTP'); }
  if (r.status !== 200) throw new PairError('PAIR_E_API_STATUS');
  let j; try { j = await r.json(); } catch { throw new PairError('PAIR_E_API_JSON'); }
  if (!Array.isArray(j)) throw new PairError('PAIR_E_API_SHAPE');
  return j;
}

/** Pure core with injected db and fetch, so fakes drive every branch. Returns proof v2. */
export async function producePairing(o) {
  const trace = o.trace ?? [];
  if (!HEX32.test(o.nonce ?? '')) throw new PairError('PAIR_E_NONCE');
  if (!HEX32.test(o.runId ?? '')) throw new PairError('PAIR_E_RUN_ID');
  trace.push('precheck');
  const n = await o.db.tagCount();
  if (!Number.isInteger(n) || n < 0) throw new PairError('PAIR_E_PRECHECK');
  if (n !== 0) throw new PairError('PAIR_E_USED_STACK');
  trace.push('insert');
  if ((await o.db.insertCarrier(PAIRING_TAG_ID, o.nonce)) !== 1) throw new PairError('PAIR_E_INSERT');
  trace.push('dbread');
  const rows = await o.db.readCarrier(PAIRING_TAG_ID);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].name !== o.nonce || rows[0].slug !== o.nonce) throw new PairError('PAIR_E_DB_MISMATCH');
  trace.push('apiread');
  const api = await anonRead(o.fetchImpl, o.apiOrigin, o.anonKey, PAIRING_TAG_ID);
  if (api.length !== 1 || api[0].id !== PAIRING_TAG_ID || api[0].name !== o.nonce || api[0].slug !== o.nonce) throw new PairError('PAIR_E_API_MISMATCH');
  trace.push('filter');
  if (o.randomId === PAIRING_TAG_ID) throw new PairError('PAIR_E_FILTER');
  const ctl = await anonRead(o.fetchImpl, o.apiOrigin, o.anonKey, o.randomId);
  if (ctl.length !== 0) throw new PairError('PAIR_E_FILTER');
  return { version: 2, stack_id: o.nonce, db_read: rows[0].name, api_read: api[0].name, run_id: o.runId, produced_before_seed: true, producer: PRODUCER };
}

// ---- real DSN access (CLI only; never used by the controls) ----
function psql(env, script) {
  const child = { PATH: env.PATH, PGPASSFILE: String(env.PUBLIC_ACCEPT_DB_PASSFILE ?? '') };
  const r = spawnSync('psql', ['-w', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', String(env.PUBLIC_ACCEPT_DB_URL ?? ''), '-f', '-'],
    { input: script, env: child, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  if (r.status !== 0) throw new PairError('PAIR_E_PSQL');
  return r.stdout.split('\n').filter(Boolean);
}
const lit = (v) => { if (!HEX32.test(v) && !/^[0-9a-f-]{36}$/.test(v)) throw new PairError('PAIR_E_SCRIPT'); return `'${v}'`; };
const realDb = (env) => ({
  async tagCount() {
    const out = psql(env, "select 'TAGS ' || count(*) from public.blog_tags;\n").filter((l) => /^TAGS \d+$/.test(l));
    if (out.length !== 1) throw new PairError('PAIR_E_PRECHECK');
    return Number(out[0].slice(5));
  },
  async insertCarrier(id, v) {
    return psql(env, `with i as (insert into public.blog_tags (id, name, slug) values (${lit(id)}::uuid, ${lit(v)}, ${lit(v)}) returning 1) select 'INSERTED ' || count(*) from i;\n`)
      .filter((l) => l === 'INSERTED 1').length;
  },
  async readCarrier(id) {
    return psql(env, `select 'ROW ' || name || ' ' || slug from public.blog_tags where id = ${lit(id)}::uuid;\n`)
      .filter((l) => l.startsWith('ROW ')).map((l) => { const [, name, slug] = l.split(' '); return { name, slug }; });
  },
});

/** E6: the private output dir and an absent proof destination. Returns the destination path or throws a fixed code. */
export function checkOutputDir(dir, uid = process.getuid()) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new PairError('PAIR_E_OUT_DIR');
  let st; try { st = fs.lstatSync(dir); } catch { throw new PairError('PAIR_E_OUT_DIR'); }
  if (!st.isDirectory() || (st.mode & 0o077) !== 0 || st.uid !== uid) throw new PairError('PAIR_E_PRIVATE_DIR');
  let real; try { real = fs.realpathSync(dir); } catch { throw new PairError('PAIR_E_OUT_DIR'); }
  if (real !== dir) throw new PairError('PAIR_E_OUT_DIR');
  const dest = path.join(dir, 'stack-proof.json');
  try { fs.lstatSync(dest); } catch (e) { if (e && e.code === 'ENOENT') return dest; throw new PairError('PAIR_E_PROOF_DEST'); }
  throw new PairError('PAIR_E_PROOF_EXISTS');
}

/** E1 to E6, no child process and no HTTP. Returns what the live phase needs, or throws a fixed code. */
export async function checkEligibility({ argv, env, root, uid = process.getuid() }) {
  if (argv.length !== 2 || argv[0] !== 'pair') throw new PairError('PAIR_E_USAGE');
  const g = runGuards(env, { requireProof: false });
  if (g.length) throw new PairError(`PAIR_E_ELIGIBILITY_${g[0].split(':')[0].replace(/^PUBLIC_CATALOG_E_/, '')}`);
  if (!HEX32.test(env.PUBLIC_ACCEPT_RUN_ID ?? '')) throw new PairError('PAIR_E_RUN_ID');
  if (checkPreContract(root).length) throw new PairError('PAIR_E_PRE_CONTRACT');
  if (checkHelperPins(root, D1_PINS).length) throw new PairError('PAIR_E_D1_PIN');
  const mod = await import(pathToFileURL(path.join(root, D1_MODULE)).href);
  const apiOrigin = new URL(env.PUBLIC_ACCEPT_API_URL).origin; const appOrigin = new URL(env.PUBLIC_ACCEPT_BASE_URL).origin;
  const rec = mod.readRecord(env.STACK_OWNERSHIP_FILE);
  if (!rec.ok) throw new PairError(`PAIR_E_D1_${rec.code}`);
  const r = rec.record;
  if (r.run_id !== String(env.GITHUB_RUN_ID ?? '') || r.run_attempt !== String(env.GITHUB_RUN_ATTEMPT ?? '')) throw new PairError('PAIR_E_D1_RUN');
  if (r.api_origin !== apiOrigin || r.app_origin !== appOrigin) throw new PairError('PAIR_E_D1_ORIGIN');
  if (r.bootstrap_sha256 !== EXPECTED_BOOTSTRAP_SHA256) throw new PairError('PAIR_E_D1_BOOTSTRAP');
  const dest = checkOutputDir(argv[1], uid);
  return { mod, apiOrigin, appOrigin, dir: argv[1], dest };
}

export function writeProof(dir, proof) {
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || (st.mode & 0o077) !== 0 || st.uid !== process.getuid()) throw new PairError('PAIR_E_PRIVATE_DIR');
  const file = path.join(dir, 'stack-proof.json');
  let fd; try { fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
  catch { throw new PairError('PAIR_E_PROOF_EXISTS'); }
  try { fs.writeSync(fd, JSON.stringify(proof)); } finally { fs.closeSync(fd); }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const el = await checkEligibility({ argv, env, root });
  // D1 live check: the only DB access before the first write is this read-only query.
  const live = psql(env, "select 'SYSID ' || system_identifier::text from pg_control_system();\n").filter((l) => /^SYSID \d+$/.test(l));
  if (live.length !== 1) throw new PairError('PAIR_E_D1_LIVE_READ');
  const bad = ownershipFailures({ verifyRecord: el.mod.verifyRecord, file: env.STACK_OWNERSHIP_FILE, runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, liveSystemIdentifier: live[0].slice(6), apiOrigin: el.apiOrigin, appOrigin: el.appOrigin });
  if (bad.length) throw new PairError(bad[0].replace(/^PUBLIC_CATALOG_E_/, 'PAIR_E_'));
  checkOutputDir(el.dir); // re-check immediately before the first write
  const proof = await producePairing({ db: realDb(env), fetchImpl: globalThis.fetch, apiOrigin: el.apiOrigin, anonKey: env.PUBLIC_ACCEPT_ANON_KEY,
    nonce: randomBytes(16).toString('hex'), runId: env.PUBLIC_ACCEPT_RUN_ID, randomId: randomUUID() });
  writeProof(el.dir, proof);
}

const isMain = (() => { try { return !!process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); } catch { return false; } })();
if (isMain) {
  main().then(() => console.log('PUBLIC_CATALOG_PAIRING_OK carrier written through the DSN, read back through the DSN and the anon API'),
    (e) => { console.log(e instanceof PairError && /^PAIR_E_[A-Z0-9_]+$/.test(e.code) ? e.code : 'PAIR_E_UNCLASSIFIED'); process.exit(3); });
}
