#!/usr/bin/env node
// ABOUTME: Composition-tier fake selftest for the K1-ONLY run's screenshots (needs the #162 gradebook modules): in the K1 suite
// ABOUTME: the plan is exactly the three ba_k1 names; a K1 shot round-trips through the UNCHANGED shot-plan.mjs and ba-shots.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

if (process.env.BA_SUITE !== undefined) throw new Error('run the K1 shot selftest without BA_SUITE; it selects the suite itself');
process.env.BA_SUITE = 'k1';
const { PAIRING_PREFIX, PAIRING_COURSE_ID } = await import('../../../e2e/gradebook-roles/journey/pairing-proof.mjs');
const { decideBaShot, writeBaShot } = await import('../shot-plan.mjs');
const { exportBaShots } = await import('../ba-shots.mjs');
const { LINE } = await import('../summary.mjs');

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };
const NONCE = 'a'.repeat(32);
const secrets = [{ label: 'NONCE', value: NONCE }, { label: 'PREFIX', value: PAIRING_PREFIX }, { label: 'CREDENTIAL', value: 'pw-one' }, { label: 'CREDENTIAL', value: 'pw-two' }, { label: 'CREDENTIAL', value: 'anon-key' }];
const APP = 'http://127.0.0.1:8080', API = 'http://127.0.0.1:54321';
const sample = (url, extra = {}) => ({ url, texts: ['body text', '<html></html>', '', 'title', url], images: [], surfaces: 0, ...extra });
const obsFor = (project, url, over = {}) => ({ project, expectedPath: new URL(url).pathname, expectedSearch: new URL(url).search, appOrigin: APP, apiOrigin: API,
  before: sample(url), after: sample(url), armed: 't', guard: { token: 't', n: 0 }, navigations: 0, incomplete: false, ...over });
// A real 2x1 RGB PNG plus an ancillary tEXt chunk carrying the nonce (the export must drop it).
const crcTable = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from(`k\0${NONCE}`)),
  chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0, 0, 255, 0]))), chunk('IEND', Buffer.alloc(0))]);

// Own-root lifecycle (T 16:23), the same contract as k1-selftest.mjs: a FRESH private root per check, that exact root removed
// whatever happens; if the check fails and the removal fails too, the check's error is rethrown unchanged (PRIMARY) with the
// removal error attached as `cleanupError` and printed as a secondary line. A removal failure after a passing check is not swallowed.
const removeOwnRoot = (d) => fs.rmSync(d, { recursive: true, force: true });
const withOwnRoot = (fn, remove = removeOwnRoot) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-k1-shot-'));
  let failed = false, primary;
  try { fs.chmodSync(d, 0o700); return fn(d); } catch (e) { failed = true; primary = e; throw e; } finally {
    try { remove(d); } catch (c) {
      if (!failed) throw c;
      console.error(`CLEANUP_SECONDARY root=${path.basename(d)} code=${(c && c.code) || 'unknown'}`);
      if (primary && typeof primary === 'object') { try { Object.defineProperty(primary, 'cleanupError', { value: c, enumerable: true }); } catch { /* the primary stays as thrown */ } }
    }
  }
};
const writeProof = (root) => {
  const proofDir = path.join(root, 'proof'); fs.mkdirSync(proofDir, { mode: 0o700 });
  const proof = path.join(proofDir, 'pairing-proof.json');
  fs.writeFileSync(proof, JSON.stringify({ version: 2, stack_id: NONCE, control_course_id: PAIRING_COURSE_ID, db_read: PAIRING_PREFIX + NONCE, api_read: PAIRING_PREFIX + NONCE, journey_rows_before_pairing: 0 }), { mode: 0o600 });
  return proof;
};

ok('K1 suite: write then export through the unchanged exporter; plan is exactly the three K1 names, the rest NOT_TAKEN', () => {
  withOwnRoot((root) => {
  const mk = (d) => { fs.mkdirSync(path.join(root, d), { mode: 0o700 }); return path.join(root, d); };
  const shots = mk('shots'), session = mk('session');
  const proof = writeProof(root);
  const url = `${APP}/courses/c/builder?view=curriculum`;
  assert.equal(writeBaShot(shots, 'ba_k1_1440', PNG, obsFor('ba-1440', url), secrets).written, 'png');
  assert.deepEqual(writeBaShot(shots, 'ba_k1_768', PNG, obsFor('ba-768', url, { navigations: 1 }), secrets), { written: 'withheld', reason: 'NAVIGATED' });
  const lines = exportBaShots({ shotDir: shots, sessionDir: session, proofFile: proof, exportDir: path.join(root, 'export') });
  assert.match(lines[0], /^SHOT name=ba_k1_1440 sha256=[0-9a-f]{64} bytes=\d+ width=2 height=1$/);
  assert.equal(lines[1], 'WITHHELD name=ba_k1_768 reason=NAVIGATED');
  assert.deepEqual(lines.filter((l) => l.startsWith('NOT_TAKEN')), ['NOT_TAKEN name=ba_k1_390']);
  assert.equal(lines.at(-1), 'SHOTS captured=1 withheld=1 not_taken=1 planned=3');
  assert.ok(lines.every((l) => LINE.test(l)));
  const out = fs.readFileSync(path.join(root, 'export', 'ba_k1_1440.png'));
  assert.ok(!out.includes(Buffer.from(NONCE)) && !out.includes(Buffer.from('tEXt')));
  });
});
ok('K1 suite: a K1 shot for the wrong project is PERSONA, and a baseline name is refused outright', () => {
  const url = `${APP}/courses/c/builder?view=curriculum`;
  assert.deepEqual(decideBaShot('ba_k1_390', obsFor('ba-768', url), secrets), { write: false, reason: 'PERSONA' });
  assert.throws(() => decideBaShot('ba_r1_1440', obsFor('ba-1440', url), secrets), /BA_SHOT_E_NAME/);
});
ok('own root: an injected failure after the real proof write is rethrown as itself and the root is removed', () => {
  let seen, thrown; const injected = new Error('BA_K1_E_INJECTED');
  try { withOwnRoot((root) => { seen = root; assert.ok(fs.existsSync(writeProof(root))); throw injected; }); } catch (e) { thrown = e; }
  assert.equal(thrown, injected); assert.equal(thrown.cleanupError, undefined); assert.equal(fs.existsSync(seen), false);
});
ok('own root: when cleanup ALSO fails the PRIMARY is preserved, the cleanup error is secondary; a passing check surfaces it', () => {
  let seen, thrown; const primary = new Error('BA_K1_E_INJECTED'), cleanup = Object.assign(new Error('rm failed'), { code: 'EBUSY' });
  const orig = console.error, lines = []; console.error = (l) => lines.push(String(l));
  try { try { withOwnRoot((root) => { seen = root; writeProof(root); throw primary; }, () => { throw cleanup; }); } catch (e) { thrown = e; } } finally { console.error = orig; }
  assert.equal(thrown, primary); assert.equal(thrown.cleanupError, cleanup);
  assert.deepEqual(lines, [`CLEANUP_SECONDARY root=${path.basename(seen)} code=EBUSY`]);
  removeOwnRoot(seen); assert.equal(fs.existsSync(seen), false);
  assert.throws(() => withOwnRoot((root) => { seen = root; return 'v'; }, () => { throw cleanup; }), (e) => e === cleanup);
  removeOwnRoot(seen); assert.equal(fs.existsSync(seen), false);
});
console.log(`PASS builder-authoring K1 shot selftest (${n} checks)`);
