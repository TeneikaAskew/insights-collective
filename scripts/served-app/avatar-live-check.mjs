#!/usr/bin/env node
// ABOUTME: Live binding for the TEST-SERVED avatar-fixture copy: re-runs the pinned avatar-fixture verify (which re-runs the
// ABOUTME: hermetic verify), then proves the loopback app origin serves THAT copy: index, every changed chunk, every fixture SVG.
//
// Why: avatar-fixture.mjs never changes index.html (by rule), so an index comparison alone cannot tell the avatar-fixture
// copy from the plain hermetic copy it was derived from. This check binds the bytes the browser actually receives for each
// file the fixture changed (AVATAR-PROVENANCE final_files) or added (assets) to the verified copy, live, on each call.
// It allows nothing and changes nothing: the origin guard and the product source are untouched. The product's avatar
// provider integration (i.pravatar.cc) and the AvatarFallback path stay UNVERIFIED (the fixture LABEL says so).
//
// checkAvatarLive({ appOrigin, productDist, hermeticDir, servedDir, fetchImpl }) resolves { ok: true, files } or
// { ok: false, code } with a fixed code; it never throws and never returns a path, URL or byte.
// CLI: avatar-live-check.mjs <app origin> <product dist> <hermetic copy> <served copy> -> one fixed line, exit 0 or 3.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify as verifyFixture } from './avatar-fixture.mjs';

export const CODES = Object.freeze(['AL_OK', 'AL_INPUT', 'AL_FIXTURE', 'AL_FETCH', 'AL_STATUS', 'AL_BYTES']);
const ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):([0-9]{2,5})$/;
// Served paths the provenance may name: a hashed JS chunk under assets/, or a fixture SVG under hermetic-avatars/.
const CHUNK = /^assets\/[A-Za-z0-9._-]+\.js$/;
const SVG = /^hermetic-avatars\/avatar-fixture-[0-9]{1,3}\.svg$/;
const MAX = 8 << 20;
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

async function readBounded(body, max) {
  if (!body || typeof body.getReader !== 'function') return 'AL_FETCH';
  const reader = body.getReader();
  const parts = []; let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > max) { await reader.cancel().catch(() => {}); return 'AL_BYTES'; }
      parts.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } catch { return 'AL_FETCH'; } finally { try { reader.releaseLock(); } catch { /* already released */ } }
  return Buffer.concat(parts, n);
}

export async function checkAvatarLive({ appOrigin, productDist, hermeticDir, servedDir, fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  try {
    const m = ORIGIN.exec(String(appOrigin ?? ''));
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 65535) return { ok: false, code: 'AL_INPUT' };
    for (const d of [productDist, hermeticDir, servedDir]) if (typeof d !== 'string' || !path.isAbsolute(d)) return { ok: false, code: 'AL_INPUT' };
    let prov;
    try { prov = verifyFixture(productDist, hermeticDir, servedDir); } catch { return { ok: false, code: 'AL_FIXTURE' }; }
    const finals = Object.entries(prov.final_files ?? {}), assets = Object.entries(prov.assets ?? {});
    if (finals.length < 1 || assets.length < 1 || !finals.every(([f, h]) => CHUNK.test(f) && /^[0-9a-f]{64}$/.test(h))
      || !assets.every(([f, h]) => SVG.test(f) && /^[0-9a-f]{64}$/.test(h))) return { ok: false, code: 'AL_FIXTURE' };
    const real = fs.realpathSync(servedDir);
    const targets = [['index.html', '', sha256(fs.readFileSync(path.join(real, 'index.html')))], ...finals.map(([f, h]) => [f, f, h]), ...assets.map(([f, h]) => [f, f, h])];
    for (const [file, urlPath, want] of targets) {
      // The verified copy on disk must carry the bound hash too (verify already proved it equals the derivation).
      if (sha256(fs.readFileSync(path.join(real, file))) !== want) return { ok: false, code: 'AL_FIXTURE' };
      let res;
      try { res = await fetchImpl(`${appOrigin}/${urlPath}`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) }); }
      catch { return { ok: false, code: 'AL_FETCH' }; }
      if (!res || res.status !== 200) return { ok: false, code: 'AL_STATUS' };
      const got = await readBounded(res.body, MAX);
      if (got === 'AL_FETCH' || got === 'AL_BYTES') return { ok: false, code: got };
      if (sha256(got) !== want) return { ok: false, code: 'AL_BYTES' };
    }
    return { ok: true, files: targets.length };
  } catch { return { ok: false, code: 'AL_FIXTURE' }; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const [appOrigin, productDist, hermeticDir, servedDir] = process.argv.slice(2);
  checkAvatarLive({ appOrigin, productDist, hermeticDir, servedDir }).then((r) => {
    console.log(r.ok ? `avatar-live AL_OK files=${r.files}` : `avatar-live ${r.code}`);
    process.exit(r.ok ? 0 : 3);
  }, () => { console.log('avatar-live AL_INPUT'); process.exit(3); });
}
