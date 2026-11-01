#!/usr/bin/env node
// ABOUTME: Real PostgREST checks of the lesson write contract on the ISOLATED LOCAL stack, with real persona JWTs:
// ABOUTME: the version trigger, the conditional write, the NULL fence and RLS zero-row denial. Never the deployed backend.
// Usage: backend-contract.mjs <api origin (loopback)> <anon key file> <personas.json> <out json (absent)>
//   Every request is exactly the shape the app sends (CanvasContentService.conditionalLessonWrite): PATCH content_items
//   ?id=eq.<id>&updated_at=eq.<version> (or updated_at=is.null) with a client updated_at in the body and
//   select=id,title,content,type,published,updated_at, Prefer: return=representation. Only the contract-only lessons
//   K and KN (and a no-op denial attempt on A) are touched. Exit 0 only if every check passes. Labelled LOCAL.
import { existsSync, writeFileSync, statSync } from 'node:fs';
import { apiOrigin, readSecretFile, request } from '../t09/api-http.mjs';

process.on('uncaughtException', () => {
  console.log('FAIL le-contract: unexpected error (detail withheld)');
  process.exit(1);
});
process.on('unhandledRejection', () => {
  console.log('FAIL le-contract: unexpected error (detail withheld)');
  process.exit(1);
});

const K = 'ed170000-0000-4000-8000-0000000000b1';
const KN = 'ed170000-0000-4000-8000-0000000000b2';
const A = 'ed170000-0000-4000-8000-0000000000a1';
const Q = 'ed170000-0000-4000-8000-0000000000a4';
const COLS = 'id,title,content,type,published,updated_at';
const CLIENT_STAMP = '2001-01-01T00:00:00.000Z'; // what a client might send; the trigger must replace it with NOW()

const [rawApi, anonFile, personasFile, out] = process.argv.slice(2);
if (!rawApi || !anonFile || !personasFile || !out) {
  console.error('usage: backend-contract.mjs <api origin> <anon key file> <personas.json> <out json>');
  process.exit(2);
}
const fail = (m) => {
  console.log(`FAIL le-contract: ${m}`);
  process.exit(1);
};
let API, anon, personas;
try {
  API = apiOrigin(rawApi);
  anon = readSecretFile(anonFile, 'anon key');
  if ((statSync(personasFile).mode & 0o077) !== 0) throw new Error('personas file is not mode 600');
  personas = JSON.parse(readSecretFile(personasFile, 'personas'));
} catch {
  fail('anon key or personas file unreadable (detail withheld: a parse error can quote file content)');
}
if (existsSync(out)) fail('output exists (never reused)');
for (const p of ['OWNER', 'OTHER', 'STUDENT']) if (!personas?.[p]?.token) fail(`persona ${p} missing`);

const auth = (p) => ({ apikey: anon, Authorization: `Bearer ${personas[p].token}` });
const enc = encodeURIComponent;
async function read(p, id) {
  const r = await request(API, 'GET', `/rest/v1/content_items?id=eq.${id}&select=${COLS}`, { headers: auth(p) });
  if (r.status !== 200 || !Array.isArray(r.json)) fail(`read ${id} as ${p}: HTTP ${r.status}`);
  return r.json[0] ?? null;
}
async function write(p, id, version, patch) {
  const cond = version === null ? 'updated_at=is.null' : `updated_at=eq.${enc(version)}`;
  const r = await request(API, 'PATCH', `/rest/v1/content_items?id=eq.${id}&${cond}&select=${COLS}`, {
    headers: { ...auth(p), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: CLIENT_STAMP }),
  });
  if (r.status !== 200 || !Array.isArray(r.json)) fail(`write ${id} as ${p}: HTTP ${r.status}`);
  return r.json;
}

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
};

// C1 versioned conditional write: exactly one row; the trigger replaces the client stamp and advances the version.
const k0 = await read('OWNER', K);
if (!k0 || typeof k0.updated_at !== 'string') fail('lesson K missing or has no version');
const w1 = await write('OWNER', K, k0.updated_at, { title: 'K contract 1' });
check('C1 conditional write on the returned version changes exactly 1 row', w1.length === 1, `rows=${w1.length}`);
const k1 = w1[0];
check('C1 returned row is the requested change', k1?.title === 'K contract 1' && k1?.type === 'page');
check('C1 version trigger replaced the client updated_at', k1 && new Date(k1.updated_at).getTime() !== Date.parse(CLIENT_STAMP),
  k1 && `client=${CLIENT_STAMP} stored=${k1.updated_at}`);
check('C1 version advanced', k1 && new Date(k1.updated_at) > new Date(k0.updated_at));
const k1r = await read('OWNER', K);
check('C1 returned row equals the stored row exactly', JSON.stringify(k1r) === JSON.stringify(k1));

// C2 stale version: zero rows, row unchanged (the app turns this into a conflict after its re-read).
const w2 = await write('OWNER', K, k0.updated_at, { title: 'K stale' });
check('C2 stale version changes 0 rows', w2.length === 0, `rows=${w2.length}`);
check('C2 row unchanged after stale write', JSON.stringify(await read('OWNER', K)) === JSON.stringify(k1));

// C3 the returned version is usable as the next condition (string form preserved through JSON).
const w3 = await write('OWNER', K, k1.updated_at, { content: '<p>K contract 3</p>' });
check('C3 next write on the returned version changes 1 row', w3.length === 1);
const k3 = w3[0];

// C4 NULL fence: IS NULL matches once; the trigger then sets a version, so a second IS NULL write matches nothing.
const kn0 = await read('OWNER', KN);
check('C4 KN starts with a NULL version', kn0 && kn0.updated_at === null);
const w4 = await write('OWNER', KN, null, { title: 'KN contract 1' });
check('C4 first IS NULL write changes 1 row', w4.length === 1);
check('C4 trigger set a non-NULL version', w4[0] && w4[0].updated_at !== null && Date.parse(w4[0].updated_at) !== Date.parse(CLIENT_STAMP));
const w5 = await write('OWNER', KN, null, { title: 'KN late duplicate' });
check('C4 second IS NULL write changes 0 rows (fence)', w5.length === 0);
check('C4 KN still holds the first write', (await read('OWNER', KN))?.title === 'KN contract 1');

// C5 RLS: another instructor and a student write 0 rows even with the exact current version; rows unchanged.
const a0 = await read('OWNER', A);
for (const p of ['OTHER', 'STUDENT']) {
  const seen = await read(p, K);
  const vNow = (await read('OWNER', K)).updated_at; // independent of the previous persona's outcome
  const wk = await write(p, K, vNow, { title: `${p} denied` });
  check(`C5 ${p} write with the exact current version changes 0 rows`, wk.length === 0, `rows=${wk.length} canRead=${Boolean(seen)}`);
  const wa = a0 ? await write(p, A, (await read('OWNER', A)).updated_at, { title: `${p} denied` }) : [];
  check(`C5 ${p} write to lesson A changes 0 rows`, wa.length === 0);
}
check('C5 K unchanged after denied writes', JSON.stringify(await read('OWNER', K)) === JSON.stringify(k3));
check('C5 A unchanged after denied writes', JSON.stringify(await read('OWNER', A)) === JSON.stringify(a0));

// C6 the quiz row keeps its type: the write path never sends type, and the stored type is still quiz.
const q0 = await read('OWNER', Q);
check('C6 quiz item is type quiz', q0?.type === 'quiz');

const failed = checks.filter((c) => !c.ok);
writeFileSync(out, JSON.stringify({
  tier: 'LOCAL isolated stack (supabase start + snapshot schema). NOT the deployed backend.',
  api: API, at: new Date().toISOString(), checks,
}, null, 2), { mode: 0o600, flag: 'wx' });
if (failed.length) fail(`${failed.length} check(s) failed`);
console.log(`PASS le-contract: ${checks.length} checks on the LOCAL isolated stack (says nothing about the deployed backend)`);
