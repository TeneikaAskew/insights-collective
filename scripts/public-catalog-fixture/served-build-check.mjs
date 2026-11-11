#!/usr/bin/env node
// ABOUTME: PRE check of what is ACTUALLY served: EVERY file in the reviewed hermetic provenance (lazy JS/CSS chunks, imported
// ABOUTME: assets, everything, not only what index.html names) is fetched and must hash to its pin; the served index must hash
// ABOUTME: to served_index_sha256 and reference nothing off-origin or unpinned; the entry bundle must name this stack's API.
//
// Limits: this proves the server returns the pinned bytes for every manifest path. It cannot enumerate extra paths a server might
// also answer; the specs therefore bind every response the browser actually receives (support.ts, expectedHash). Output is
// fixed codes only.
import { runGuards } from './guards.mjs';
import { loadProvenance, sha256, expectedHash } from './served-provenance.mjs';

const fail = (code) => { console.error(`PUBLIC_CATALOG_E_SERVED_${code}`); process.exit(2); };
// Runs in run.sh's `served` step, BEFORE the pairing producer writes the proof, and only issues loopback GETs: the proof is
// therefore not yet required here. Every later consumer (proof gate, Playwright config, anon probe) requires it.
const errors = runGuards(process.env, { requireProof: false }); if (errors.length) { for (const e of errors) console.error(e.split(':')[0]); process.exit(2); }
const base = new URL(process.env.PUBLIC_ACCEPT_BASE_URL).origin; const api = new URL(process.env.PUBLIC_ACCEPT_API_URL).origin;
const { prov, error } = loadProvenance(process.env.PUBLIC_ACCEPT_SERVED_DIR); if (error) fail(error);
const get = async (p) => { let r; try { r = await fetch(`${base}${p}`, { redirect: 'manual' }); } catch { fail('HTTP'); } if (r.status !== 200) fail('HTTP'); return Buffer.from(await r.arrayBuffer()); };

const index = await get('/');
if (sha256(index) !== prov.served_index_sha256) fail('INDEX_HASH');
for (const ref of [...index.toString('utf8').matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1])) {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref)) fail('FOREIGN_REF');
  const want = expectedHash(prov, `/${ref.replace(/^\//, '').split(/[?#]/)[0]}`);
  if (!want || want === prov.served_index_sha256) fail('UNPINNED_ASSET');
}
let checked = 0; let apiNamed = false;
for (const [rel, want] of Object.entries(prov.files)) {
  if (rel === 'index.html') continue; // the product index is replaced by the derived served index (checked above)
  const body = await get(`/${rel.split('/').map(encodeURIComponent).join('/')}`);
  if (sha256(body) !== want) fail('ASSET_HASH');
  if (rel.endsWith('.js') && body.includes(api)) apiNamed = true;
  checked++;
}
if (!checked) fail('NO_ASSETS');
if (!apiNamed) fail('NOT_THIS_STACK');
console.log(`PUBLIC_CATALOG_SERVED_OK manifest_files=${checked}`);
