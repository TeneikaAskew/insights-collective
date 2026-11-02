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
// Then proof v2 is written with O_EXCL, mode 0600, into the private staging dir. The stack_id is never printed, logged or put
// on a command line or in the environment: it goes to psql on stdin and to fetch in a URL that is never logged.
//
// CLI: node pairing-producer.mjs pair <private dir>     prints one fixed line; exit 0 or 3
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_PREFIX } from './fixtures.mjs';

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
function psql(script) {
  const env = { PATH: process.env.PATH, PGPASSFILE: String(process.env.PUBLIC_ACCEPT_DB_PASSFILE ?? '') };
  const r = spawnSync('psql', ['-w', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', String(process.env.PUBLIC_ACCEPT_DB_URL ?? ''), '-f', '-'],
    { input: script, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  if (r.status !== 0) throw new PairError('PAIR_E_PSQL');
  return r.stdout.split('\n').filter(Boolean);
}
const lit = (v) => { if (!HEX32.test(v) && !/^[0-9a-f-]{36}$/.test(v)) throw new PairError('PAIR_E_SCRIPT'); return `'${v}'`; };
const realDb = {
  async tagCount() {
    const out = psql("select 'TAGS ' || count(*) from public.blog_tags;\n").filter((l) => /^TAGS \d+$/.test(l));
    if (out.length !== 1) throw new PairError('PAIR_E_PRECHECK');
    return Number(out[0].slice(5));
  },
  async insertCarrier(id, v) {
    return psql(`with i as (insert into public.blog_tags (id, name, slug) values (${lit(id)}::uuid, ${lit(v)}, ${lit(v)}) returning 1) select 'INSERTED ' || count(*) from i;\n`)
      .filter((l) => l === 'INSERTED 1').length;
  },
  async readCarrier(id) {
    return psql(`select 'ROW ' || name || ' ' || slug from public.blog_tags where id = ${lit(id)}::uuid;\n`)
      .filter((l) => l.startsWith('ROW ')).map((l) => { const [, name, slug] = l.split(' '); return { name, slug }; });
  },
};

export function writeProof(dir, proof) {
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || (st.mode & 0o077) !== 0 || st.uid !== process.getuid()) throw new PairError('PAIR_E_PRIVATE_DIR');
  const file = path.join(dir, 'stack-proof.json');
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeSync(fd, JSON.stringify(proof)); } finally { fs.closeSync(fd); }
}

const isMain = (() => { try { return !!process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); } catch { return false; } })();
if (isMain) {
  (async () => {
    const [cmd, dir] = process.argv.slice(2);
    if (cmd !== 'pair' || !dir) throw new PairError('PAIR_E_USAGE');
    let api; try { api = new URL(process.env.PUBLIC_ACCEPT_API_URL).origin; } catch { throw new PairError('PAIR_E_API_ORIGIN'); }
    const proof = await producePairing({ db: realDb, fetchImpl: fetch, apiOrigin: api, anonKey: process.env.PUBLIC_ACCEPT_ANON_KEY,
      nonce: randomBytes(16).toString('hex'), runId: process.env.PUBLIC_ACCEPT_RUN_ID, randomId: randomUUID() });
    writeProof(dir, proof);
  })().then(() => console.log('PUBLIC_CATALOG_PAIRING_OK carrier written through the DSN, read back through the DSN and the anon API'),
    (e) => { console.log(e instanceof PairError ? e.code : 'PAIR_E_UNCLASSIFIED'); process.exit(3); });
}
