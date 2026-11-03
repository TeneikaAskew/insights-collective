#!/usr/bin/env node
// ABOUTME: Builder-authoring screenshot export (UNRUN): the only way a PNG leaves the run. Same rules as the gradebook
// ABOUTME: journey's shot-export.mjs (its readHandle and sanitizePng reused unchanged), for the builder's own 13 names.
//
//   ba-shots.mjs <private shot dir> <private session dir> <pairing proof file> <export dir (must not exist)>
// Entries: <name>.png + <name>.scan.json pairs or <name>.withheld.json alone, names from ids.mjs SHOT_NAMES; anything else
// refuses. Records are validated exactly; the PNG keeps critical chunks only (NOT a pixel re-encode); the exported bytes
// must not hold the pairing nonce or carrier prefix. Output lines follow the shared staging grammar:
//   SHOT name=<n> sha256=<hex> bytes=<n> width=<w> height=<h>
//   WITHHELD name=<n> reason=<R> [before=.. shot=.. after=.. final=.. marks=<0-3> sum=<EQ|NE>]   (MUTATED only)
//   NOT_TAKEN name=<n>          (the test never reached the shot)
//   SHOTS captured=<n> withheld=<n> not_taken=<n> planned=13
// Any refusal: "ba-shots refused: BA_SHOT_E_*", exit 3.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readHandle, sanitizePng } from '../gradebook-fixture/journey/shot-export.mjs';
import { WITHHELD_REASONS, assertShotDir, diagSuffix } from '../../e2e/gradebook-roles/journey/shot-core.mjs';
import { assertPairingProof, PAIRING_PREFIX } from '../../e2e/gradebook-roles/journey/pairing-proof.mjs';
import { SHOT_NAMES } from './ids.mjs';

const MAX_PNG = 16 * 1024 * 1024;
const MAX_REC = 512;
const SCAN_KEYS = 'name,scans,sha256,verdict,window';
class BaShotError extends Error { constructor(code) { super(code); this.code = code; } }
const guard = (code, fn) => { try { return fn(); } catch { throw new BaShotError(code); } };

/** shot-core's MUTATED diag, revalidated by its own diagSuffix, re-spelt in the staging grammar. */
export function diagWords(diag) {
  const s = diagSuffix(diag);
  if (s === null) return null;
  if (s === 'diag=NA') return 'diag=NA';
  const m = s.match(/^BEFORE_SAMPLE=(\S+) SCREENSHOT=(\S+) AFTER_SAMPLE=(\S+) FINAL=(\S+) marks=([0-3]) sum=(EQ|NE)$/);
  if (!m) return null;
  const d = (x) => x.replaceAll('/', '.');
  return `before=${d(m[1])} shot=${d(m[2])} after=${d(m[3])} final=${d(m[4])} marks=${m[5]} sum=${m[6]}`;
}

export function exportBaShots(o) {
  const shotDir = guard('BA_SHOT_E_DIR', () => assertShotDir(o.shotDir, o.uid));
  const proof = guard('BA_SHOT_E_PROOF', () => assertPairingProof(o.proofFile, { sessionDir: o.sessionDir, uid: o.uid }));
  const forbidden = [Buffer.from(proof.stack_id), Buffer.from(PAIRING_PREFIX)];
  if (typeof o.exportDir !== 'string' || !path.isAbsolute(o.exportDir) || fs.existsSync(o.exportDir)) throw new BaShotError('BA_SHOT_E_EXPORT_DIR');
  const entries = guard('BA_SHOT_E_DIR', () => fs.readdirSync(shotDir));
  const allowed = new Set(SHOT_NAMES.flatMap((n) => [`${n}.png`, `${n}.scan.json`, `${n}.withheld.json`]));
  if (entries.some((e) => !allowed.has(e))) throw new BaShotError('BA_SHOT_E_UNKNOWN_FILE');
  const has = (n, ext) => entries.includes(`${n}${ext}`);
  const out = [];
  for (const name of SHOT_NAMES) {
    const w = has(name, '.withheld.json'), p = has(name, '.png'), r = has(name, '.scan.json');
    if (!w && !p && !r) { out.push({ name, notTaken: true }); continue; }
    if (w ? (p || r) : !(p && r)) throw new BaShotError('BA_SHOT_E_UNPAIRED');
    if (w) {
      const rec = guard('BA_SHOT_E_WITHHELD_RECORD', () => JSON.parse(readHandle(path.join(shotDir, `${name}.withheld.json`), MAX_REC, { uid: o.uid }).toString('utf8')));
      const keys = rec && typeof rec === 'object' && !Array.isArray(rec) ? Object.keys(rec).sort().join(',') : '';
      const withDiag = keys === 'diag,name,reason,withheld' && rec.reason === 'MUTATED';
      if ((keys !== 'name,reason,withheld' && !withDiag) || rec.name !== name || rec.withheld !== true || !WITHHELD_REASONS.includes(rec.reason)) throw new BaShotError('BA_SHOT_E_WITHHELD_RECORD');
      const words = withDiag ? diagWords(rec.diag) : '';
      if (words === null) throw new BaShotError('BA_SHOT_E_WITHHELD_RECORD');
      out.push({ name, withheld: rec.reason, words });
      continue;
    }
    const raw = guard('BA_SHOT_E_READ', () => readHandle(path.join(shotDir, `${name}.png`), MAX_PNG, { uid: o.uid }));
    const rec = guard('BA_SHOT_E_SCAN_RECORD', () => JSON.parse(readHandle(path.join(shotDir, `${name}.scan.json`), MAX_REC, { uid: o.uid }).toString('utf8')));
    if (!rec || typeof rec !== 'object' || Array.isArray(rec) || Object.keys(rec).sort().join(',') !== SCAN_KEYS || rec.name !== name
      || rec.verdict !== 'clean' || rec.scans !== 2 || rec.window !== 'same-document-unchanged' || typeof rec.sha256 !== 'string') throw new BaShotError('BA_SHOT_E_SCAN_RECORD');
    if (createHash('sha256').update(raw).digest('hex') !== rec.sha256) throw new BaShotError('BA_SHOT_E_SCAN_MISMATCH');
    const { png, width, height } = guard('BA_SHOT_E_PNG', () => sanitizePng(raw));
    if (forbidden.some((f) => png.includes(f))) throw new BaShotError('BA_SHOT_E_NONCE_IN_PNG');
    out.push({ name, png, width, height });
  }
  guard('BA_SHOT_E_EXPORT_DIR', () => fs.mkdirSync(o.exportDir, { mode: 0o700 }));
  const lines = [];
  for (const s of out) {
    if (s.notTaken) { lines.push(`NOT_TAKEN name=${s.name}`); continue; }
    if (s.withheld) { lines.push(`WITHHELD name=${s.name} reason=${s.withheld}${s.words ? ` ${s.words}` : ''}`); continue; }
    guard('BA_SHOT_E_EXPORT_WRITE', () => fs.writeFileSync(path.join(o.exportDir, `${s.name}.png`), s.png, { mode: 0o600, flag: 'wx' }));
    lines.push(`SHOT name=${s.name} sha256=${createHash('sha256').update(s.png).digest('hex')} bytes=${s.png.length} width=${s.width} height=${s.height}`);
  }
  const n = (k) => out.filter(k).length;
  lines.push(`SHOTS captured=${n((x) => x.png)} withheld=${n((x) => x.withheld)} not_taken=${n((x) => x.notTaken)} planned=${SHOT_NAMES.length}`);
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [shotDir, sessionDir, proofFile, exportDir] = process.argv.slice(2);
    if (!exportDir) throw new BaShotError('BA_SHOT_E_USAGE');
    console.log(exportBaShots({ shotDir, sessionDir, proofFile, exportDir }).join('\n'));
  } catch (e) {
    console.log(`ba-shots refused: ${e instanceof BaShotError ? e.code : 'BA_SHOT_E_UNCLASSIFIED'}`);
    process.exit(3);
  }
}
