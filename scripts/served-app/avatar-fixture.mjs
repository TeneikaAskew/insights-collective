#!/usr/bin/env node
// ABOUTME: Separately pinned TEST-SERVED avatar fixture for isolated public-UI checks: on top of a VERIFIED hermetic copy
// ABOUTME: (hermetic-dist.mjs, unchanged), replace the three exact i.pravatar.cc URLs with three fixed local SVGs. Verified.
//
// Why: the home page's CommunityShowcase hotlinks i.pravatar.cc, so a browser that refuses every foreign origin before send
// cannot load `/` cleanly. The refusal is NOT relaxed and no foreign origin is allowed; instead a second, declared
// derivation of the TEST-SERVED copy points those three image URLs at local files. It does not touch hermetic-dist.mjs.
//
// Labels (never interchangeable):
//   product build      = `npm run build` output, untouched
//   hermetic copy      = hermetic-dist.mjs output (product minus the editor CDN line), verified here first
//   avatar-fixture copy = this tool's output: hermetic copy with exactly SUBSTITUTIONS applied. NOT production bytes.
// What it does NOT show: the product's real avatar provider integration (i.pravatar.cc) stays UNVERIFIED, and so does the
// AvatarFallback (initial) path, which a successful local image load never exercises. Layout: each fixture is a 150x150
// square SVG, like the provider's 150 px square image, inside the same h-10 w-10 Avatar box.
//
// Directories: the out dir must be canonically disjoint from the product dist and the hermetic copy. Each input is resolved
// with realpath; the out dir's existing parent is resolved with realpath (so a symlinked or `..` alias cannot hide nesting).
// Neither may equal or contain the other. make() checks this before deriving or creating anything; verify() checks it too.
// Rules: every `from` string occurs exactly once across the non-.map files of the hermetic copy, in one assets/*.js chunk
// (never index.html, so served_index_sha256 never changes); afterwards no
// non-.map file contains "pravatar"; source maps (.map) are copied byte-identical (not fetched by the page; they still
// describe the product source). The SVG bytes are pinned by sha256 below.
//
// Usage:
//   avatar-fixture.mjs make   <product dist> <hermetic copy> <out dir (must not exist)>
//   avatar-fixture.mjs verify <product dist> <hermetic copy> <out dir>
// Exit codes are fixed: 0 ok, 20 usage, 21 hermetic copy not verified, 22 substitution count != 1, 23 residual provider
// reference, 24 out dir exists, 25 file set differs, 26 byte differs, 27 provenance missing or inconsistent, 28 fixture
// asset pin mismatch, 29 io error, 30 out dir not canonically disjoint from both inputs (or its parent is missing). Messages are fixed strings plus relative paths; no file content is printed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify as verifyHermetic } from './hermetic-dist.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LABEL = 'TEST-SERVED AVATAR FIXTURE: hermetic copy with the three CommunityShowcase i.pravatar.cc URLs replaced by fixed local SVGs; NOT production bytes; product avatar provider integration and the AvatarFallback path UNVERIFIED';
export const SUBSTITUTIONS = Object.freeze([
  { from: 'https://i.pravatar.cc/150?img=11', to: '/hermetic-avatars/avatar-fixture-11.svg', asset: 'avatars/avatar-fixture-11.svg', sha256: '701b973409c1a035128f674787c79922ad5bfa713c000e2e54b490c27dc863c4' },
  { from: 'https://i.pravatar.cc/150?img=20', to: '/hermetic-avatars/avatar-fixture-20.svg', asset: 'avatars/avatar-fixture-20.svg', sha256: '4afb4812c4753904a4ad84b0b84b186c8483704febcc27780526af359fe557ee' },
  { from: 'https://i.pravatar.cc/150?img=13', to: '/hermetic-avatars/avatar-fixture-13.svg', asset: 'avatars/avatar-fixture-13.svg', sha256: 'ff48716bdc32cbfa4d8713fdeeb19b9f9c2a0c8ff32376efc72f55726b239447' },
]);
const PROVENANCE = 'AVATAR-PROVENANCE.json';
const RESIDUAL = 'pravatar';

class ContractError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const isMap = (f) => f.endsWith('.map');

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new ContractError(25, `symlink not allowed: ${path.relative(root, abs)}`);
      if (e.isDirectory()) walk(abs); else if (e.isFile()) out.push(path.relative(root, abs).split(path.sep).join('/'));
      else throw new ContractError(25, `unsupported entry: ${path.relative(root, abs)}`);
    }
  };
  walk(root);
  return out.sort();
}

const within = (a, b) => a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);

/** Canonical out path: realpath of the existing parent + basename (make), or realpath of the dir itself (verify). */
function canonicalOut(outDir, mustExist) {
  const abs = path.resolve(outDir);
  if (mustExist) { try { return fs.realpathSync(abs); } catch { throw new ContractError(30, 'out dir cannot be resolved'); } }
  const base = path.basename(abs);
  if (!base || base === '.' || base === '..') throw new ContractError(30, 'out dir has no usable name');
  let parent;
  try { parent = fs.realpathSync(path.dirname(abs)); } catch { throw new ContractError(30, 'out dir parent must already exist'); }
  return path.join(parent, base);
}

/** Refuse unless the out dir is disjoint from both inputs after canonical resolution. Nothing is created or changed. */
export function assertDisjoint(productDist, hermeticDir, outDir, mustExist) {
  const out = canonicalOut(outDir, mustExist);
  for (const [label, dir] of [['product dist', productDist], ['hermetic copy', hermeticDir]]) {
    let real;
    try { real = fs.realpathSync(path.resolve(dir)); } catch { throw new ContractError(30, `${label} cannot be resolved`); }
    if (within(out, real) || within(real, out)) throw new ContractError(30, `out dir is not disjoint from the ${label}`);
  }
  return out;
}

function countOf(buf, needle) { let n = 0; let i = buf.indexOf(needle); while (i >= 0) { n += 1; i = buf.indexOf(needle, i + needle.length); } return n; }

/** Fixture asset bytes, each checked against its pinned sha256. */
export function assets() {
  return SUBSTITUTIONS.map((s) => {
    const buf = fs.readFileSync(path.join(HERE, s.asset));
    if (sha256(buf) !== s.sha256) throw new ContractError(28, `fixture asset differs from its pin: ${s.asset}`);
    return { served: s.to.slice(1), buf };
  });
}

/** The exact derivation, computed in memory from a verified hermetic copy: Map(relative path -> bytes) plus provenance. */
export function derive(productDist, hermeticDir) {
  let base;
  try { base = verifyHermetic(productDist, hermeticDir); } catch { throw new ContractError(21, 'hermetic copy does not verify against the product build'); }
  const files = listFiles(hermeticDir);
  const out = new Map(files.map((f) => [f, fs.readFileSync(path.join(hermeticDir, f))]));
  const subs = [];
  for (const s of SUBSTITUTIONS) {
    const needle = Buffer.from(s.from, 'utf8');
    const hits = files.filter((f) => !isMap(f)).map((f) => [f, countOf(out.get(f), needle)]).filter(([, n]) => n > 0);
    const total = hits.reduce((a, [, n]) => a + n, 0);
    if (total !== 1) throw new ContractError(22, `substitution source must occur exactly once outside source maps (found ${total})`);
    const [file] = hits[0];
    // Only a hashed JS chunk may change; index.html (whose hash the hermetic contract fixes) or any other file refuses.
    if (!/^assets\/[^/]+\.js$/.test(file)) throw new ContractError(22, `substitution target is not an assets/*.js chunk: ${file}`);
    const before = out.get(file);
    const i = before.indexOf(needle);
    const after = Buffer.concat([before.subarray(0, i), Buffer.from(s.to, 'utf8'), before.subarray(i + needle.length)]);
    out.set(file, after);
    subs.push({ from: s.from, to: s.to, count: 1, file, sha256_before: sha256(before), sha256_after: sha256(after) });
  }
  for (const f of files) if (!isMap(f) && out.get(f).includes(RESIDUAL)) throw new ContractError(23, `provider reference remains in ${f}`);
  for (const a of assets()) {
    if (out.has(a.served)) throw new ContractError(25, `fixture path already present: ${a.served}`);
    out.set(a.served, a.buf);
  }
  const prov = {
    label: LABEL,
    hermetic: { served_index_sha256: base.served_index_sha256, product_manifest_sha256: base.product_manifest_sha256 },
    substitutions: subs,
    assets: Object.fromEntries(SUBSTITUTIONS.map((s) => [s.to.slice(1), s.sha256])),
    // Consumers bind THESE final per-file hashes; the per-substitution sha256_after values are intermediates when several
    // substitutions land in the same chunk.
    final_files: Object.fromEntries([...new Set(subs.map((x) => x.file))].sort().map((f) => [f, sha256(out.get(f))])),
    source_maps_unchanged: files.filter(isMap),
    unverified: ['product avatar provider integration (i.pravatar.cc)', 'AvatarFallback initial path'],
  };
  return { out, prov };
}

export function make(productDist, hermeticDir, outDir) {
  let present = true;
  try { fs.lstatSync(outDir); } catch { present = false; }
  if (present) throw new ContractError(24, 'out dir already exists');
  assertDisjoint(productDist, hermeticDir, outDir, false);
  const { out, prov } = derive(productDist, hermeticDir);
  fs.mkdirSync(outDir, { recursive: false });
  for (const [f, buf] of out) {
    const dst = path.join(outDir, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, buf);
  }
  fs.writeFileSync(path.join(outDir, PROVENANCE), JSON.stringify(prov, null, 2) + '\n');
  return prov;
}

export function verify(productDist, hermeticDir, outDir) {
  assertDisjoint(productDist, hermeticDir, outDir, true);
  const { out, prov } = derive(productDist, hermeticDir);
  const want = [...out.keys(), PROVENANCE].sort();
  const got = listFiles(outDir);
  if (JSON.stringify(want) !== JSON.stringify(got)) throw new ContractError(25, 'out file set differs from the exact derivation');
  for (const [f, buf] of out) if (!buf.equals(fs.readFileSync(path.join(outDir, f)))) throw new ContractError(26, `byte differs: ${f}`);
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(outDir, PROVENANCE), 'utf8')); } catch { throw new ContractError(27, 'provenance unreadable'); }
  if (JSON.stringify(p) !== JSON.stringify(prov)) throw new ContractError(27, 'provenance does not match the derivation');
  return prov;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, a, b, c] = process.argv.slice(2);
  try {
    if (!['make', 'verify'].includes(cmd) || !a || !b || !c) throw new ContractError(20, 'usage: avatar-fixture.mjs make|verify <product dist> <hermetic copy> <out dir>');
    const p = cmd === 'make' ? make(a, b, c) : verify(a, b, c);
    console.log(`AVATAR-FIXTURE ${cmd} ok: ${p.substitutions.length} substitutions (${p.substitutions.map((s) => `${s.file} ${s.sha256_before.slice(0, 12)}->${s.sha256_after.slice(0, 12)}`).join(', ')}); final ${Object.entries(p.final_files).map(([f, h]) => `${f} ${h}`).join(', ')}; ${Object.keys(p.assets).length} pinned assets; ${p.source_maps_unchanged.length} source map(s) unchanged`);
    console.log(LABEL);
  } catch (e) {
    const code = e instanceof ContractError ? e.code : 29;
    console.error(`AVATAR-FIXTURE REFUSED [${code}]: ${e instanceof ContractError ? e.message : 'io error'}`);
    process.exit(code);
  }
}
