#!/usr/bin/env node
// ABOUTME: Fake-input controls for the integration consumers: avatar-fixture provenance binding (served-provenance.mjs) and the
// ABOUTME: D1 ownership consumer (d1-ownership.mjs). No stack, no browser, no network.
//
// Usage: node integration-controls.mjs [path to a real #154 stack-ownership.mjs]   With the path, the D1 section also drives the
// REAL shared verifyRecord against temp record files (positive, other bootstrap, other sysid). Prints ALL PASS / N FAILED.
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyAvatarProvenance, loadProvenance, expectedHash, AVATAR_LABEL, AVATAR_SUBS, AVATAR_ASSETS, LABEL } from '../served-provenance.mjs';
import { ownershipFailures, EXPECTED_BOOTSTRAP_SHA256 } from '../d1-ownership.mjs';

let bad = 0;
const ok = (cond, name) => { if (!cond) bad++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); };
const h = (s) => createHash('sha256').update(String(s)).digest('hex');
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- avatar provenance ----
const CHUNK = 'assets/index-CH88G3cR.js';
const hermetic = { label: LABEL, served_index_sha256: h('served-index'), product_manifest_sha256: h('manifest'),
  files: { 'index.html': h('product-index'), [CHUNK]: h('chunk-0'), 'assets/other.js': h('other') } };
const chain = [h('chunk-0'), h('chunk-1'), h('chunk-2'), h('chunk-3')];
const avatar = { label: AVATAR_LABEL, hermetic: { served_index_sha256: hermetic.served_index_sha256, product_manifest_sha256: hermetic.product_manifest_sha256 },
  substitutions: AVATAR_SUBS.map((s, i) => ({ from: s.from, to: s.to, count: 1, file: CHUNK, sha256_before: chain[i], sha256_after: chain[i + 1] })),
  assets: { ...AVATAR_ASSETS }, source_maps_unchanged: [] };

const pos = applyAvatarProvenance(hermetic, avatar);
ok(!pos.error && pos.prov.files[CHUNK] === chain[3], 'avatar P1 chained subs bind the chunk to the LAST after only');
ok(!pos.error && Object.entries(AVATAR_ASSETS).every(([k, v]) => pos.prov.files[k] === v), 'avatar P2 the three assets bind to the hardcoded sha256');
ok(!pos.error && pos.prov.served_index_sha256 === hermetic.served_index_sha256 && pos.prov.files['assets/other.js'] === hermetic.files['assets/other.js'], 'avatar P3 index and untouched files keep their hermetic pins');
ok(!pos.error && expectedHash(pos.prov, '/AVATAR-PROVENANCE.json') === null && expectedHash(pos.prov, '/HERMETIC-PROVENANCE.json') === null, 'avatar P4 neither provenance file is ever bound');
ok(!pos.error && expectedHash(pos.prov, '/hermetic-avatars/avatar-fixture-20.svg') === AVATAR_ASSETS['hermetic-avatars/avatar-fixture-20.svg'] && expectedHash(pos.prov, `/${CHUNK}`) === chain[3], 'avatar P5 expectedHash serves the fixture map');
ok(hermetic.files[CHUNK] === chain[0], 'avatar P6 the input hermetic map is not mutated');

const neg = (name, mutate, code) => { const a = clone(avatar); const hm = clone(hermetic); mutate(a, hm); const r = applyAvatarProvenance(hm, a); ok(r.error === code, `avatar ${name} -> ${code} (got ${r.error ?? 'OK'})`); };
neg('N1 label', (a) => { a.label = 'x'; }, 'AVATAR_LABEL');
neg('N2 hermetic index differs', (a) => { a.hermetic.served_index_sha256 = h('other'); }, 'AVATAR_HERMETIC_INDEX');
neg('N3 hermetic manifest differs', (a) => { a.hermetic.product_manifest_sha256 = h('other'); }, 'AVATAR_HERMETIC_MANIFEST');
neg('N4 hermetic manifest absent', (a, hm) => { delete hm.product_manifest_sha256; delete a.hermetic.product_manifest_sha256; }, 'AVATAR_HERMETIC_MANIFEST');
neg('N5 two substitutions', (a) => { a.substitutions.pop(); }, 'AVATAR_SUB_COUNT');
neg('N6 reordered (13 before 20)', (a) => { [a.substitutions[1], a.substitutions[2]] = [a.substitutions[2], a.substitutions[1]]; }, 'AVATAR_SUB_SHAPE');
neg('N7 count 2', (a) => { a.substitutions[0].count = 2; }, 'AVATAR_SUB_SHAPE');
neg('N8 target index.html', (a, hm) => { for (const s of a.substitutions) s.file = 'index.html'; a.substitutions[0].sha256_before = hm.files['index.html']; }, 'AVATAR_SUB_TARGET');
neg('N9 target a .map file', (a) => { a.substitutions[0].file = 'assets/index-CH88G3cR.js.map'; }, 'AVATAR_SUB_TARGET');
neg('N10 target outside the hermetic files', (a) => { for (const s of a.substitutions) s.file = 'assets/new.js'; }, 'AVATAR_SUB_UNPINNED_FILE');
neg('N11 first before is not the hermetic pin', (a) => { a.substitutions[0].sha256_before = h('forged'); }, 'AVATAR_SUB_CHAIN');
neg('N12 broken middle link (per-sub rule would pass it)', (a) => { a.substitutions[1].sha256_before = chain[0]; }, 'AVATAR_SUB_CHAIN');
neg('N13 asset hash from the file, not the pin', (a) => { a.assets['hermetic-avatars/avatar-fixture-11.svg'] = h('forged'); }, 'AVATAR_ASSET_HASH');
neg('N14 extra asset', (a) => { a.assets['hermetic-avatars/extra.svg'] = h('x'); }, 'AVATAR_ASSET_SET');
neg('N15 asset path already in hermetic files', (a, hm) => { hm.files['hermetic-avatars/avatar-fixture-13.svg'] = h('x'); }, 'AVATAR_ASSET_COLLISION');

// loadProvenance: the fixture is an explicit choice both ways.
const T = mkdtempSync(path.join(tmpdir(), 'pca-int-'));
const dir = (name, withAvatar) => { const d = path.join(T, name); mkdirSync(d); writeFileSync(path.join(d, 'HERMETIC-PROVENANCE.json'), JSON.stringify(hermetic)); if (withAvatar) writeFileSync(path.join(d, 'AVATAR-PROVENANCE.json'), JSON.stringify(avatar)); return d; };
const dPlain = dir('plain', false); const dFix = dir('fixture', true);
ok(!loadProvenance(dPlain, { avatar: false }).error, 'load L1 plain hermetic copy, fixture off: OK');
ok(loadProvenance(dFix, { avatar: false }).error === 'AVATAR_UNEXPECTED', 'load L2 fixture copy with the fixture off: refused');
ok(loadProvenance(dPlain, { avatar: true }).error === 'AVATAR_OPEN', 'load L3 fixture on, no AVATAR-PROVENANCE: refused');
const l4 = loadProvenance(dFix, { avatar: true });
ok(!l4.error && l4.prov.files[CHUNK] === chain[3], 'load L4 fixture on, valid provenance: fixture map');

// ---- D1 consumer ----
const REC = { run_id: '41', run_attempt: '1', pg_system_identifier: '7300000000000000001', api_origin: 'http://127.0.0.1:54321', app_origin: 'http://127.0.0.1:4173', bootstrap_sha256: EXPECTED_BOOTSTRAP_SHA256 };
const base = { file: '/x', runId: '41', runAttempt: '1', liveSystemIdentifier: REC.pg_system_identifier, apiOrigin: REC.api_origin, appOrigin: REC.app_origin };
let seen;
const fake = (ret) => (file, opts) => { seen = opts; return typeof ret === 'function' ? ret() : ret; };
const okRet = { ok: true, code: 'SO_OK', record: { ...REC } };
ok(ownershipFailures({ ...base, verifyRecord: fake(okRet) }).length === 0, 'D1 P1 verified record: no failure');
ok(seen && seen.expectedBootstrapSha256 === EXPECTED_BOOTSTRAP_SHA256, 'D1 P2 the reviewed bootstrap digest is always passed to the shared verifier');
for (const code of ['SO_ABSENT', 'SO_MODE', 'SO_RUN_MISMATCH', 'SO_SYSID_MISMATCH', 'SO_ORIGIN_MISMATCH', 'SO_BOOTSTRAP_MISMATCH', 'SO_INPUT']) {
  ok(ownershipFailures({ ...base, verifyRecord: fake({ ok: false, code }) })[0] === `PUBLIC_CATALOG_E_D1_${code}`, `D1 N ${code} is a refusal`);
}
ok(ownershipFailures({ ...base, verifyRecord: fake({ ok: true, code: 'weird' }) })[0] === 'PUBLIC_CATALOG_E_D1_MODULE', 'D1 N odd code is a module refusal');
ok(ownershipFailures({ ...base, verifyRecord: fake(() => { throw new Error('x'); }) })[0] === 'PUBLIC_CATALOG_E_D1_MODULE', 'D1 N verifier throws: refusal');
ok(ownershipFailures({ ...base, verifyRecord: null })[0] === 'PUBLIC_CATALOG_E_D1_MODULE', 'D1 N no verifier: refusal');
ok(ownershipFailures({ ...base, runAttempt: undefined, verifyRecord: fake(okRet) })[0] === 'PUBLIC_CATALOG_E_D1_NO_ATTEMPT', 'D1 N attempt unset: refused before the verifier');
ok(ownershipFailures({ ...base, liveSystemIdentifier: '', verifyRecord: fake(okRet) })[0] === 'PUBLIC_CATALOG_E_D1_LIVE_READ', 'D1 N empty live read: refused');
for (const [k, v, code] of [['run_attempt', '2', 'RECORD_RUN'], ['app_origin', 'http://127.0.0.1:9', 'RECORD_ORIGIN'], ['bootstrap_sha256', 'f'.repeat(64), 'RECORD_BOOTSTRAP'], ['pg_system_identifier', '1', 'RECORD_SYSID']]) {
  ok(ownershipFailures({ ...base, verifyRecord: fake({ ok: true, code: 'SO_OK', record: { ...REC, [k]: v } }) })[0] === `PUBLIC_CATALOG_E_D1_${code}`, `D1 N ok but record ${k} differs: lane re-check refuses`);
}

// Real shared module (optional): temp record files through the real verifyRecord.
const realPath = process.argv[2];
if (realPath) {
  const mod = await import(pathToFileURL(path.resolve(realPath)).href);
  const rec = (over) => { const f = path.join(T, `rec-${Math.random().toString(16).slice(2)}.json`); writeFileSync(f, JSON.stringify(mod.buildRecord({ runId: '41', runAttempt: '1', systemIdentifier: REC.pg_system_identifier, apiOrigin: REC.api_origin, appOrigin: REC.app_origin, bootstrapSha256: EXPECTED_BOOTSTRAP_SHA256, ...over }))); chmodSync(f, 0o600); return f; };
  ok(ownershipFailures({ ...base, file: rec({}), verifyRecord: mod.verifyRecord }).length === 0, 'D1 REAL positive record verifies through ea39300d');
  ok(ownershipFailures({ ...base, file: rec({ bootstrapSha256: 'a'.repeat(64) }), verifyRecord: mod.verifyRecord })[0] === 'PUBLIC_CATALOG_E_D1_SO_BOOTSTRAP_MISMATCH', 'D1 REAL other bootstrap: SO_BOOTSTRAP_MISMATCH');
  ok(ownershipFailures({ ...base, file: rec({}), liveSystemIdentifier: '99', verifyRecord: mod.verifyRecord })[0] === 'PUBLIC_CATALOG_E_D1_SO_SYSID_MISMATCH', 'D1 REAL other cluster: SO_SYSID_MISMATCH');
  const wide = rec({}); chmodSync(wide, 0o644);
  ok(ownershipFailures({ ...base, file: wide, verifyRecord: mod.verifyRecord })[0] === 'PUBLIC_CATALOG_E_D1_SO_MODE', 'D1 REAL mode 0644: SO_MODE');
}
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
