#!/usr/bin/env node
// ABOUTME: PRE check of what is ACTUALLY served: the served index.html and every same-origin asset it references must hash to
// ABOUTME: the reviewed hermetic provenance (HERMETIC-PROVENANCE.json, scripts/served-app f169429 contract), and the entry
// ABOUTME: bundle must reference this stack's API origin. A substring match alone is not provenance.
//
// The provenance is read from PUBLIC_ACCEPT_SERVED_DIR through a no-follow descriptor. Output is fixed codes only.
import { createHash } from 'node:crypto';
import { closeSync, constants, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runGuards } from './guards.mjs';

const LABEL = 'TEST-SERVED MODIFICATION: product build minus the Lovable editor CDN script tag in index.html; NOT production bytes';
const fail = (code) => { console.error(`PUBLIC_CATALOG_E_SERVED_${code}`); process.exit(2); };
const errors = runGuards(); if (errors.length) { for (const e of errors) console.error(e.split(':')[0]); process.exit(2); }
const sha = (b) => createHash('sha256').update(b).digest('hex');
const base = new URL(process.env.PUBLIC_ACCEPT_BASE_URL).origin; const api = new URL(process.env.PUBLIC_ACCEPT_API_URL).origin;
const dir = process.env.PUBLIC_ACCEPT_SERVED_DIR; if (!dir) fail('NO_DIR');
let prov; try { const fd = openSync(path.join(dir, 'HERMETIC-PROVENANCE.json'), constants.O_RDONLY | constants.O_NOFOLLOW); prov = JSON.parse(readFileSync(fd, 'utf8')); closeSync(fd); } catch { fail('NO_PROVENANCE'); }
if (prov.label !== LABEL || typeof prov.files !== 'object' || !/^[0-9a-f]{64}$/.test(prov.served_index_sha256 ?? '')) fail('BAD_PROVENANCE');
const get = async (p) => { const r = await fetch(`${base}${p}`, { redirect: 'manual' }); if (r.status !== 200) fail('HTTP'); return Buffer.from(await r.arrayBuffer()); };
const index = await get('/');
if (sha(index) !== prov.served_index_sha256) fail('INDEX_HASH');
const refs = [...index.toString('utf8').matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
let entryHasApi = false; let checked = 0;
for (const ref of refs) {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref)) fail('FOREIGN_REF'); // hermetic index references nothing off-origin
  const rel = ref.replace(/^\//, '').split(/[?#]/)[0];
  if (!Object.hasOwn(prov.files, rel)) fail('UNPINNED_ASSET');
  const body = await get(`/${rel}`);
  if (sha(body) !== prov.files[rel]) fail('ASSET_HASH');
  if (rel.endsWith('.js') && body.includes(api)) entryHasApi = true;
  checked++;
}
if (!checked) fail('NO_ASSETS');
if (!entryHasApi) fail('NOT_THIS_STACK');
console.log(`PUBLIC_CATALOG_SERVED_OK assets=${checked}`);
