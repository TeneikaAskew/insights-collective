#!/usr/bin/env node
// ABOUTME: Learner-quiz mode: verifies a VENDORED, integrity-pinned dependency closure for score-quiz BEFORE the Edge runtime
// ABOUTME: boots, so the runtime resolves every module from local files and has nothing to fetch. Fails closed on any gap.
//
// Usage: edge-deps.mjs verify <closure dir> <reviewed PINS.sha256 sha256> <entry URL>...
// The closure directory is produced OUTSIDE this job by a separately reviewed acquisition (for example a vendoring tool on a
// machine allowed to reach deno.land and esm.sh) and committed with:
//   PINS.sha256       "<sha256>  <relative path>" for EVERY file in the closure except PINS.sha256 itself
//   import_map.json   {"imports": {...}, "scopes"?: {...}}; every target is a relative path to a pinned file in the closure
// Checks (all before any runtime starts):
//   - PINS.sha256 itself hashes to the REVIEWED value given on the command line (pinned in the workflow, so editing both the
//     closure and PINS.sha256 still fails);
//   - the file set equals the pinned set exactly (no missing, extra, symlink or special file) and every hash matches;
//   - every entry URL (the served function's remote imports) is an exact key of "imports";
//   - every import-map target and scope target resolves inside the closure to a pinned file;
//   - every static import/export-from, side-effect import and dynamic import() in every pinned module resolves to a pinned
//     file: relative specifiers directly, absolute URLs only through an exact or prefix import-map entry. A bare, root-relative
//     ("/x"), node:, npm:, jsr:, data: or unmapped URL specifier, or a dynamic import() with a non-literal argument, is refused.
// This proves the module graph is CLOSED and pinned. It does NOT prove the Supabase Edge runtime honours the import map: that is
// a property of the pinned runtime image, verified only on a real run (see README, E1).
// Exit: 0 ok; 10 usage; 11 closure missing/unreadable; 12 file set differs; 13 hash mismatch; 14 import map invalid;
// 15 entry not mapped; 16 unresolved or forbidden specifier; 17 io error. Messages are fixed text plus closure-relative paths.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

class E extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const sha = (b) => createHash('sha256').update(b).digest('hex');
const MOD = /\.(m?js|ts|mts|jsx|tsx)$/;

function walk(root) {
  const out = [];
  const go = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name), rel = path.relative(root, abs).split(path.sep).join('/');
      if (e.isSymbolicLink()) throw new E(12, `symlink in closure: ${rel}`);
      if (e.isDirectory()) go(abs); else if (e.isFile()) out.push(rel); else throw new E(12, `special file in closure: ${rel}`);
    }
  };
  go(root);
  return out.sort();
}

/** Every module specifier in a source text. Non-literal dynamic import() is reported as null. */
export function specifiers(src) {
  const out = [];
  const text = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
  for (const m of text.matchAll(/(?:^|[;\s}])(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g)) out.push(m[2]);
  for (const m of text.matchAll(/(?:^|[;\s])import\s*(['"])([^'"]+)\1/g)) out.push(m[2]);
  for (const m of text.matchAll(/\bimport\s*\(\s*([^)]*?)\s*[,)]/g)) {
    const lit = m[1].match(/^(['"])([^'"]+)\1$/);
    out.push(lit ? lit[2] : null);
  }
  return out;
}

export function verify(dir, pinsSha, entries) {
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new E(11, 'closure directory missing');
  let pinsText, map;
  try { pinsText = fs.readFileSync(path.join(dir, 'PINS.sha256'), 'utf8'); } catch { throw new E(11, 'PINS.sha256 missing or unreadable'); }
  if (!/^[0-9a-f]{64}$/.test(pinsSha ?? '')) throw new E(10, 'reviewed PINS.sha256 hash must be 64 hex');
  if (sha(pinsText) !== pinsSha) throw new E(13, 'PINS.sha256 does not match the reviewed hash');
  const pins = new Map();
  for (const line of pinsText.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^([0-9a-f]{64}) {2}([A-Za-z0-9@._+~\/-]+)$/);
    if (!m || m[2].split('/').some((s) => s === '..' || s === '.' || s === '') || pins.has(m[2])) throw new E(12, 'PINS.sha256 line malformed or duplicate');
    pins.set(m[2], m[1]);
  }
  const files = walk(dir).filter((f) => f !== 'PINS.sha256');
  const pinned = [...pins.keys()].sort();
  if (JSON.stringify(files) !== JSON.stringify(pinned)) throw new E(12, `closure file set differs from PINS.sha256 (${files.length} files, ${pinned.length} pins)`);
  for (const f of files) if (sha(fs.readFileSync(path.join(dir, f))) !== pins.get(f)) throw new E(13, `hash mismatch: ${f}`);
  if (!pins.has('import_map.json')) throw new E(14, 'import_map.json is not pinned');
  try { map = JSON.parse(fs.readFileSync(path.join(dir, 'import_map.json'), 'utf8')); } catch { throw new E(14, 'import_map.json does not parse'); }
  const imports = map.imports ?? {};
  if (typeof imports !== 'object' || Array.isArray(imports)) throw new E(14, 'import_map.json "imports" is not an object');
  const keys = Object.keys(map).filter((k) => !['imports', 'scopes'].includes(k));
  if (keys.length) throw new E(14, 'import_map.json has keys other than imports/scopes');

  // A map target is a relative path from the map's own location; it must land on a pinned file (or, for a prefix entry, a dir).
  const inClosure = (rel) => {
    const norm = path.posix.normalize(rel);
    return norm.startsWith('../') || norm === '..' || path.posix.isAbsolute(norm) ? null : norm;
  };
  const checkTargets = (obj, where) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string' || !/^\.\.?\//.test(v)) throw new E(14, `${where} target for ${k} is not a relative path`);
      const t = inClosure(v);
      if (t === null) throw new E(14, `${where} target for ${k} leaves the closure`);
      if (k.endsWith('/') !== v.endsWith('/')) throw new E(14, `${where} entry ${k} mixes prefix and exact forms`);
      if (!k.endsWith('/') && !pins.has(t)) throw new E(14, `${where} target for ${k} is not a pinned file`);
    }
  };
  checkTargets(imports, 'imports');
  const scopes = map.scopes ?? {};
  for (const [s, obj] of Object.entries(scopes)) checkTargets(obj, `scope ${s}`);
  for (const e of entries) if (!Object.prototype.hasOwnProperty.call(imports, e)) throw new E(15, `entry not mapped exactly: ${e}`);

  // Resolution of an absolute URL through the map: exact key, else the longest prefix key.
  const viaMap = (url) => {
    if (Object.prototype.hasOwnProperty.call(imports, url) && !url.endsWith('/')) return inClosure(imports[url]);
    let best = null;
    for (const k of Object.keys(imports)) if (k.endsWith('/') && url.startsWith(k) && (!best || k.length > best.length)) best = k;
    return best ? inClosure(imports[best] + url.slice(best.length)) : null;
  };
  // Every pinned module's specifiers must land on pinned files. Entry modules are the exact map targets.
  let modules = 0, edges = 0;
  for (const f of files) {
    if (!MOD.test(f)) continue;
    modules += 1;
    for (const s of specifiers(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      edges += 1;
      if (s === null) throw new E(16, `non-literal dynamic import() in ${f}`);
      let target;
      if (/^\.\.?\//.test(s)) target = inClosure(path.posix.join(path.posix.dirname(f), s));
      else if (/^https?:\/\//.test(s)) target = viaMap(s);
      else throw new E(16, `forbidden specifier kind in ${f} (bare, root-relative or scheme)`);
      if (target === null || !pins.has(target)) throw new E(16, `unresolved specifier in ${f}`);
    }
  }
  return { files: files.length, modules, edges, entries: entries.length, pins_sha256: sha(pinsText) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, dir, pinsSha, ...entries] = process.argv.slice(2);
  try {
    if (cmd !== 'verify' || !dir || entries.length === 0) throw new E(10, 'usage: edge-deps.mjs verify <closure dir> <reviewed PINS.sha256 sha256> <entry URL>...');
    const r = verify(dir, pinsSha, entries);
    console.log(`EDGE-DEPS verify ok: ${r.files} pinned files, ${r.modules} modules, ${r.edges} specifiers all resolved inside the closure, ${r.entries} entries mapped; PINS.sha256 sha256 ${r.pins_sha256}`);
  } catch (e) {
    const code = e instanceof E ? e.code : 17;
    console.log(`EDGE-DEPS REFUSED [${code}]: ${e instanceof E ? e.message : 'io error'}`);
    process.exit(code);
  }
}
