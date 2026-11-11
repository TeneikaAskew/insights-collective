#!/usr/bin/env node
// ABOUTME: Pinnable served-app gate for fixture adapters: re-runs the reviewed hermetic verify (hermetic-dist.mjs) on the
// ABOUTME: product build and the TEST-SERVED copy, then checks the live app origin serves exactly that copy's index.html.
//
// It adds no rule of its own: the verdict is computed live, each call, from the same two checks the runner's step 7
// performs (hermetic-dist verify, then the served index byte comparison). A flag, file or env value never stands in.
//   product build : <repo>/dist (fixed, next to this module's repository root)
//   served copy   : $HERMETIC_SERVED_DIR (absolute; set by the runner job that made it); must pass verify against dist
//   app origin    : strict http loopback origin passed by the caller; GET / must return 200 with bytes equal to the copy
// verifyServedApp({ appOrigin }) resolves { ok: true } or { ok: false, code } with a fixed code; it never throws.
// CLI: served-app-check.mjs <app origin>  -> one fixed line, exit 0 or 3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from './hermetic-dist.mjs';

export const CODES = Object.freeze(['SA_OK', 'SA_INPUT', 'SA_SERVED_DIR', 'SA_HERMETIC', 'SA_FETCH', 'SA_STATUS', 'SA_BYTES']);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):([0-9]{2,5})$/;
const MAX_INDEX = 1 << 20;

export async function verifyServedApp({ appOrigin, servedDir = process.env.HERMETIC_SERVED_DIR, productDist = path.join(ROOT, 'dist'), fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const m = ORIGIN.exec(String(appOrigin ?? ''));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 65535) return { ok: false, code: 'SA_INPUT' };
  if (typeof servedDir !== 'string' || !path.isAbsolute(servedDir)) return { ok: false, code: 'SA_SERVED_DIR' };
  let want;
  try {
    verify(productDist, servedDir);
    want = fs.readFileSync(path.join(servedDir, 'index.html'));
  } catch { return { ok: false, code: 'SA_HERMETIC' }; }
  let res;
  try { res = await fetchImpl(`${appOrigin}/`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) }); }
  catch { return { ok: false, code: 'SA_FETCH' }; }
  if (!res || res.status !== 200) return { ok: false, code: 'SA_STATUS' };
  const got = await readBounded(res.body, MAX_INDEX);
  if (got === 'SA_FETCH' || got === 'SA_BYTES') return { ok: false, code: got };
  if (!got.equals(want)) return { ok: false, code: 'SA_BYTES' };
  return { ok: true };
}

/** Reads at most `max` bytes; one byte more cancels the stream and yields SA_BYTES. Never buffers past the cap. */
async function readBounded(body, max) {
  if (!body || typeof body.getReader !== 'function') return 'SA_FETCH';
  const reader = body.getReader();
  const parts = []; let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > max) { await reader.cancel().catch(() => {}); return 'SA_BYTES'; }
      parts.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } catch { return 'SA_FETCH'; } finally { try { reader.releaseLock(); } catch { /* already released */ } }
  return Buffer.concat(parts, n);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  verifyServedApp({ appOrigin: process.argv[2] }).then((r) => {
    console.log(`served-app ${r.ok ? 'SA_OK' : r.code}`);
    process.exit(r.ok ? 0 : 3);
  }, () => { console.log('served-app SA_INPUT'); process.exit(3); });
}
