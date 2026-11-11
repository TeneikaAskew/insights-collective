#!/usr/bin/env node
// ABOUTME: Hermetic served-app contract for isolated browser fixtures: derive a TEST-SERVED copy of an exact production build
// ABOUTME: that differs from it in ONE declared index.html line (Lovable's editor CDN script), and verify that byte for byte.
//
// Why: index.html unconditionally loads https://cdn.gpteng.co/gptengineer.js. A fixture browser that refuses every foreign
// origin before send (the required guard) must then fail on every page. The guard is NOT relaxed; instead the served bytes
// drop that one tag, the change is declared, hashed and verified, and any OTHER foreign request still fails the test.
//
// Labels (never interchangeable):
//   product build  = `npm run build` output of the exact pinned head, untouched (PRODUCT_DIST)
//   test-served    = this tool's output: product build minus exactly REMOVED_LINE in index.html. NOT production bytes.
//
// Usage:
//   hermetic-dist.mjs make   <product dist> <served dir (must not exist)>   -> writes served dir + HERMETIC-PROVENANCE.json
//   hermetic-dist.mjs verify <product dist> <served dir>                     -> exit 0 only if the contract holds
// Exit codes are fixed: 0 ok, 10 usage, 11 removed-line count != 1, 12 residual foreign fetch reference in index.html,
// 13 served dir exists, 14 file set differs, 15 non-index byte differs, 16 index.html is not the exact derivation,
// 17 provenance missing or inconsistent, 18 io error. Messages are fixed strings plus relative paths; no file content is printed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REMOVED_LINE = '<script src="https://cdn.gpteng.co/gptengineer.js" type="module"></script>';
export const LABEL = 'TEST-SERVED MODIFICATION: product build minus the Lovable editor CDN script tag in index.html; NOT production bytes';
const PROVENANCE = 'HERMETIC-PROVENANCE.json';
// Anything index.html would make the browser FETCH from an absolute or protocol-relative URL. <meta content=...> is not fetched.
const FOREIGN_FETCH = /<(?:script|link|img|iframe|source|video|audio|embed|object|base)\b[^>]*\b(?:src|href|data|srcset|poster)\s*=\s*["']?\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i;

class ContractError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new ContractError(14, `symlink not allowed: ${path.relative(root, abs)}`);
      if (e.isDirectory()) walk(abs); else if (e.isFile()) out.push(path.relative(root, abs).split(path.sep).join('/'));
      else throw new ContractError(14, `unsupported entry: ${path.relative(root, abs)}`);
    }
  };
  walk(root);
  return out.sort();
}

/** The one allowed derivation: remove the single line holding exactly REMOVED_LINE (with its indentation and newline). */
export function deriveIndex(srcBuf) {
  const src = srcBuf.toString('utf8');
  const lines = src.split('\n');
  const hits = lines.map((l, i) => (l.trim() === REMOVED_LINE ? i : -1)).filter((i) => i >= 0);
  const occurrences = src.split(REMOVED_LINE).length - 1;
  if (hits.length !== 1 || occurrences !== 1) throw new ContractError(11, `removed line must occur exactly once on its own line (found ${occurrences})`);
  const out = lines.filter((_, i) => i !== hits[0]).join('\n');
  const residual = out.split('\n').findIndex((l) => FOREIGN_FETCH.test(l));
  if (residual >= 0) throw new ContractError(12, `index.html still references a foreign fetch at line ${residual + 1}`);
  return { out: Buffer.from(out, 'utf8'), removedAtLine: hits[0] + 1 };
}

function manifest(root, files) { return Object.fromEntries(files.map((f) => [f, sha256(fs.readFileSync(path.join(root, f)))])); }

export function make(productDist, servedDir) {
  if (fs.existsSync(servedDir)) throw new ContractError(13, 'served dir already exists');
  const files = listFiles(productDist);
  if (!files.includes('index.html')) throw new ContractError(14, 'product dist has no index.html');
  if (files.includes(PROVENANCE)) throw new ContractError(14, 'product dist already carries a provenance file');
  const product = manifest(productDist, files);
  const { out, removedAtLine } = deriveIndex(fs.readFileSync(path.join(productDist, 'index.html')));
  fs.mkdirSync(servedDir, { recursive: false });
  for (const f of files) {
    const dst = path.join(servedDir, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (f === 'index.html') fs.writeFileSync(dst, out); else fs.copyFileSync(path.join(productDist, f), dst);
  }
  const prov = {
    label: LABEL,
    removed_line: REMOVED_LINE,
    removed_at_line: removedAtLine,
    product_manifest_sha256: sha256(JSON.stringify(product)),
    product_index_sha256: product['index.html'],
    served_index_sha256: sha256(out),
    unchanged_files: files.length - 1,
    files: product,
  };
  fs.writeFileSync(path.join(servedDir, PROVENANCE), JSON.stringify(prov, null, 2) + '\n');
  return prov;
}

export function verify(productDist, servedDir) {
  const pFiles = listFiles(productDist);
  const sFiles = listFiles(servedDir).filter((f) => f !== PROVENANCE);
  if (!fs.existsSync(path.join(servedDir, PROVENANCE))) throw new ContractError(17, 'provenance missing');
  if (JSON.stringify(pFiles) !== JSON.stringify(sFiles)) throw new ContractError(14, 'served file set differs from the product build');
  for (const f of pFiles) {
    if (f === 'index.html') continue;
    if (sha256(fs.readFileSync(path.join(productDist, f))) !== sha256(fs.readFileSync(path.join(servedDir, f)))) { throw new ContractError(15, `non-index file differs: ${f}`); }
  }
  const { out } = deriveIndex(fs.readFileSync(path.join(productDist, 'index.html')));
  const served = fs.readFileSync(path.join(servedDir, 'index.html'));
  if (!out.equals(served)) throw new ContractError(16, 'served index.html is not the exact one-line derivation of the product index.html');
  let prov;
  try { prov = JSON.parse(fs.readFileSync(path.join(servedDir, PROVENANCE), 'utf8')); } catch { throw new ContractError(17, 'provenance unreadable'); }
  const product = manifest(productDist, pFiles);
  if (prov.label !== LABEL || prov.removed_line !== REMOVED_LINE || prov.served_index_sha256 !== sha256(served)
      || prov.product_manifest_sha256 !== sha256(JSON.stringify(product)) || prov.product_index_sha256 !== product['index.html']) {
    throw new ContractError(17, 'provenance does not match the product build and served bytes');
  }
  return { files: pFiles.length, served_index_sha256: prov.served_index_sha256, product_manifest_sha256: prov.product_manifest_sha256 };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    if (!['make', 'verify'].includes(cmd) || !a || !b) throw new ContractError(10, 'usage: hermetic-dist.mjs make|verify <product dist> <served dir>');
    const r = cmd === 'make' ? make(a, b) : verify(a, b);
    const s = cmd === 'make'
      ? `HERMETIC make ok: ${r.unchanged_files} files byte-identical, index.html minus line ${r.removed_at_line}; served index sha256 ${r.served_index_sha256}; product manifest sha256 ${r.product_manifest_sha256}`
      : `HERMETIC verify ok: ${r.files} files, only index.html derived; served index sha256 ${r.served_index_sha256}; product manifest sha256 ${r.product_manifest_sha256}`;
    console.log(`${s}\n${LABEL}`);
  } catch (e) {
    const code = e instanceof ContractError ? e.code : 18;
    console.error(`HERMETIC REFUSED [${code}]: ${e instanceof ContractError ? e.message : 'io error'}`);
    process.exit(code);
  }
}
