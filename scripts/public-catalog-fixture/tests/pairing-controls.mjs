#!/usr/bin/env node
// ABOUTME: Fake-driven controls for the lane pairing producer (blog_tags carrier): every refusal branch, the step order, the
// ABOUTME: anon-only request shape, the private proof write and the proof consumer's verdict. No psql, no network, no stack.
import { mkdtempSync, chmodSync, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { producePairing, writeProof, PairError, PAIRING_TAG_ID, PRODUCER } from '../pairing-producer.mjs';
import { assessProofFields, TRUSTED_PRODUCERS } from '../proof.mjs';
import { gitBlobId } from '../helper-pins.mjs';
import { runGuards } from '../guards.mjs';

let bad = 0;
const ok = (c, n) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); };
const NONCE = 'b'.repeat(32); const RUN = 'c'.repeat(32); const KEY = 'anon-key-for-controls-0123456789'; const API = 'http://127.0.0.1:54321';
const RANDOM = '11111111-2222-4333-8444-555555555555';

function world(o = {}) {
  const calls = { db: [], http: [] };
  const db = {
    async tagCount() { calls.db.push('count'); return o.count ?? 0; },
    async insertCarrier(id, v) { calls.db.push(`insert ${id === PAIRING_TAG_ID} ${v === NONCE}`); return o.inserted ?? 1; },
    async readCarrier() { calls.db.push('read'); return o.dbRows ?? [{ name: NONCE, slug: NONCE }]; },
  };
  const fetchImpl = async (url, init) => {
    calls.http.push({ url, init });
    if (o.fetchThrows) throw new Error('down');
    const isCtl = url.includes(RANDOM);
    const status = isCtl ? (o.ctlStatus ?? 200) : (o.status ?? 200);
    const body = isCtl ? (o.ctlRows ?? []) : (o.apiRows ?? [{ id: PAIRING_TAG_ID, name: NONCE, slug: NONCE }]);
    return { status, json: async () => body };
  };
  return { calls, args: { db, fetchImpl, apiOrigin: API, anonKey: KEY, nonce: o.nonce ?? NONCE, runId: RUN, randomId: o.randomId ?? RANDOM, trace: [] } };
}
async function run(o) { const w = world(o); try { return { proof: await producePairing(w.args), w }; } catch (e) { return { code: e instanceof PairError ? e.code : `THROW ${e}`, w }; } }

const p = await run({});
ok(p.proof && p.proof.stack_id === NONCE && p.proof.db_read === NONCE && p.proof.api_read === NONCE && p.proof.run_id === RUN && p.proof.produced_before_seed === true && p.proof.producer === PRODUCER, 'P1 positive: proof v2 carries only observed values');
ok(JSON.stringify(p.w.args.trace) === JSON.stringify(['precheck', 'insert', 'dbread', 'apiread', 'filter']), 'P2 fixed order: precheck, insert, DSN read, anon API read, random-id filter control');
ok(assessProofFields(p.proof, RUN) === null && TRUSTED_PRODUCERS[PRODUCER] === 'b8a555ba9f15eee1b17f477ba8c477a6434fa4ec' && Object.keys(TRUSTED_PRODUCERS).length === 1, 'P3 the consumer accepts the produced fields; TRUSTED_PRODUCERS holds only this producer at blob b8a555ba');
ok(assessProofFields({ ...p.proof, producer: 'scripts/local-stack/stack-proof.mjs' }, RUN)?.startsWith('PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER'), 'P3b a proof naming any other producer is still BLOCKED_NO_PRODUCER');
ok(gitBlobId(readFileSync(new URL('../pairing-producer.mjs', import.meta.url))) === TRUSTED_PRODUCERS[PRODUCER], 'P3c the producer file in this tree is exactly the pinned bytes');
const h = p.w.calls.http;
ok(h.length === 2 && h.every((c) => c.init.headers.apikey === KEY && c.init.headers.Authorization === `Bearer ${KEY}` && Object.keys(c.init.headers).sort().join() === 'Accept,Authorization,apikey'), 'P4 both API reads use the anon key only (no session, no service role)');
ok(h.every((c) => !c.url.includes(NONCE)) && h[0].url.endsWith(`id=eq.${PAIRING_TAG_ID}`) && h[1].url.endsWith(`id=eq.${RANDOM}`), 'P5 the nonce never appears in a URL; the run-owned id and the random id are queried');

const cases = [
  ['N1 stack already holds a tag', { count: 1 }, 'PAIR_E_USED_STACK'],
  ['N2 precheck unreadable', { count: -1 }, 'PAIR_E_PRECHECK'],
  ['N3 insert conflict (0 rows)', { inserted: 0 }, 'PAIR_E_INSERT'],
  ['N4 DSN readback differs', { dbRows: [{ name: NONCE, slug: 'x' }] }, 'PAIR_E_DB_MISMATCH'],
  ['N5 DSN readback two rows', { dbRows: [{ name: NONCE, slug: NONCE }, { name: NONCE, slug: NONCE }] }, 'PAIR_E_DB_MISMATCH'],
  ['N6 anon API 401', { status: 401 }, 'PAIR_E_API_STATUS'],
  ['N7 anon API 206', { status: 206 }, 'PAIR_E_API_STATUS'],
  ['N8 anon cannot read the row (RLS hides it: 200 [])', { apiRows: [] }, 'PAIR_E_API_MISMATCH'],
  ['N9 anon API returns another value', { apiRows: [{ id: PAIRING_TAG_ID, name: 'd'.repeat(32), slug: 'd'.repeat(32) }] }, 'PAIR_E_API_MISMATCH'],
  ['N10 anon API not an array', { apiRows: { id: PAIRING_TAG_ID } }, 'PAIR_E_API_SHAPE'],
  ['N11 filter ignored (random id returns the row)', { ctlRows: [{ id: PAIRING_TAG_ID, name: NONCE, slug: NONCE }] }, 'PAIR_E_FILTER'],
  ['N12 filter control non-200', { ctlStatus: 500 }, 'PAIR_E_API_STATUS'],
  ['N13 network failure', { fetchThrows: true }, 'PAIR_E_API_HTTP'],
  ['N14 malformed nonce', { nonce: 'XYZ' }, 'PAIR_E_NONCE'],
  ['N15 random id equals the carrier id', { randomId: PAIRING_TAG_ID }, 'PAIR_E_FILTER'],
];
for (const [name, o, code] of cases) { const r = await run(o); ok(r.code === code, `${name} -> ${code} (got ${r.code ?? 'PROOF'})`); }
const used = await run({ count: 1 });
ok(!used.w.calls.db.some((c) => c.startsWith('insert')) && used.w.calls.http.length === 0, 'N16 a used stack is refused BEFORE any write or API call');

// Private proof write: 0700 dir owned by us, O_EXCL, mode 0600; refuses a group/world-accessible dir and a second write.
const T = mkdtempSync(path.join(tmpdir(), 'pca-pair-')); chmodSync(T, 0o700);
writeProof(T, p.proof);
const f = path.join(T, 'stack-proof.json');
{ const fd = openSync(f, 'r'); try { ok((fstatSync(fd).mode & 0o777) === 0o600 && JSON.parse(readFileSync(fd, 'utf8')).stack_id === NONCE, 'W1 proof written 0600 in the private dir'); } finally { closeSync(fd); } }
let second; try { writeProof(T, p.proof); second = 'wrote'; } catch (e) { second = e.code; }
ok(second === 'PAIR_E_PROOF_EXISTS', 'W2 a second proof write refuses (O_EXCL), never overwrites');
const U = mkdtempSync(path.join(tmpdir(), 'pca-pair-')); chmodSync(U, 0o755);
let wide; try { writeProof(U, p.proof); wide = 'wrote'; } catch (e) { wide = e.code; }
ok(wide === 'PAIR_E_PRIVATE_DIR', 'W3 a non-private dir is refused');

// Guards: only the explicit pre-pairing call skips the proof; the default (and the Playwright config) always requires it.
const env = { PUBLIC_ACCEPT_STACK_PROOF: '', PUBLIC_ACCEPT_RUN_ID: RUN };
ok(runGuards(env).some((e) => e.startsWith('PUBLIC_CATALOG_E_NO_STACK_PROOF')), 'G1 default guards require the proof');
ok(!runGuards(env, { requireProof: false }).some((e) => e.includes('STACK_PROOF')), 'G2 pre-pairing guards skip only the proof');
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
