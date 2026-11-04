#!/usr/bin/env node
// ABOUTME: Equality guard: the official TruffleHog action.yml must still be byte-identical to the vendored copy that
// ABOUTME: scripts/ci/trufflehog-scan.sh mirrors; any upstream change (or a failed fetch) fails until re-reviewed.
//
// Usage: check-trufflehog-action.mjs [--upstream-file <path>]   (the flag is for offline tests; CI fetches UPSTREAM_URL)
// Exit 0 equal and matching the pinned digest; 1 differs; 2 fetch/read failure.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const UPSTREAM_URL = 'https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/action.yml';
export const VENDORED = 'scripts/ci/vendor/trufflehog-action.yml';
export const PINNED_SHA256 = 'c3847cdbebcf469ef336c9b3f32dc6075ed65523e80e661cf404daebd57e5ba9';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

export function compare(vendoredBytes, upstreamBytes) {
  const v = sha(vendoredBytes); const u = sha(upstreamBytes);
  return { equal: v === PINNED_SHA256 && u === PINNED_SHA256, vendored: v, upstream: u };
}

// Compare real paths: a symlinked checkout path must not make the CLI silently skip (and exit 0).
const realOrNull = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const isMain = Boolean(process.argv[1]) && realOrNull(process.argv[1]) === realOrNull(fileURLToPath(import.meta.url));
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const i = process.argv.indexOf('--upstream-file');
  let upstream;
  try {
    upstream = i > 0 ? fs.readFileSync(process.argv[i + 1])
      : Buffer.from(await (await fetch(UPSTREAM_URL, { redirect: 'error' }).then((r) => { if (!r.ok) throw new Error(); return r; })).arrayBuffer());
  } catch { console.log('::error::trufflehog action guard: upstream action.yml could not be read'); process.exit(2); }
  let vendored;
  try { vendored = fs.readFileSync(path.join(root, VENDORED)); } catch { console.log('::error::trufflehog action guard: vendored copy missing'); process.exit(2); }
  const r = compare(vendored, upstream);
  console.log(`trufflehog action guard: pinned=${PINNED_SHA256.slice(0, 12)} vendored=${r.vendored.slice(0, 12)} upstream=${r.upstream.slice(0, 12)} ${r.equal ? 'EQUAL' : 'DIFFERS'}`);
  if (!r.equal) console.log('::error::trufflehog action guard: official action.yml changed; re-review scripts/ci/trufflehog-scan.sh before updating the vendored copy and pin');
  process.exit(r.equal ? 0 : 1);
}
