// ABOUTME: Exports the public lane's screenshots from the private shot dir to evidence through the QUALIFIED #148 export
// ABOUTME: primitives (readHandle, sanitizePng; imported blob-pinned): exactly 4 fixed names, all validated before any output.
//
// CLI: node shot-export.mjs <private shot dir> <evidence screenshots dir (must not exist)> <evidence manifest file (must not exist)>
// For each of the 4 names the shot dir holds EITHER <name>.png + <name>.scan.json OR <name>.withheld.json; nothing else.
//   * every file is read by #148 readHandle: one O_NOFOLLOW|O_NONBLOCK handle; on that same fd regular, this uid, exact 0600,
//     bounded size, bounded read, no growth; closed in finally. This lane adds, on that same fd, a single-link refusal.
//   * scan record: exact keys {name, scans, sha256, verdict, window} = name, 2, sha256 of the ORIGINAL PNG bytes as read, "clean",
//     "same-document-unchanged". Withheld record: exact keys {name, reason, withheld: true} with a known reason.
//   * PNG: #148 sanitizePng (signature, every CRC, IHDR first, contiguous inflatable IDAT, IEND last, nothing trailing; ancillary
//     chunks dropped, unknown critical chunks refused). Its RESULT bytes are what is hashed and exported. This is NOT a pixel
//     decode/re-encode and NOT pixel-secret detection; privacy rests on the #148 capture window (shot-core).
//   * dimensions from the sanitized IHDR: width exactly the name's viewport width; height at least its viewport height (the
//     qualified capture is full-page, so the height is the document height, never less than the viewport).
// Manifest grammar (shared job contract, #157 ffe64d82): one line per name, `SHOT <name> <sha256 of the exported bytes>` or
// `WITHHELD <name> <REASON>`, nothing else; the screenshots dir holds exactly the SHOT PNGs (0600, dir 0700).
// Exit 0: all 4 exported. Exit 1: any withheld (the clean ones are exported); the run fails. Exit 2: anything malformed,
// absent or extra; NOTHING is written. Output is one fixed code.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkHelperPins, SHOT_CORE_PINS } from './helper-pins.mjs';
import { PUBLIC_SHOT_PLAN, PUBLIC_SHOT_NAMES, PUBLIC_WITHHELD_REASONS, assertShotDir, ShotError } from './shot-plan.mjs';

const MAX_PNG = 16 * 1024 * 1024;
const MAX_RECORD = 512;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fail = (code) => { throw new ShotError(code); };
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Pin-check, then import the #148 export primitives (its CLI does not run on import: it guards on its own argv[1]). */
export async function loadExportCore(root = ROOT) {
  if (checkHelperPins(root, SHOT_CORE_PINS).length) fail('PUBLIC_SHOT_E_CORE_PIN');
  const m = await import(pathToFileURL(path.join(root, 'scripts/gradebook-fixture/journey/shot-export.mjs')).href);
  return { readHandle: m.readHandle, sanitizePng: m.sanitizePng };
}

/** #148 readHandle plus a single-link check on the SAME fd it opened (its fstat is observed, nothing is reopened). */
function readOne(core, file, max, uid, io) {
  let st = null;
  const watched = { ...io, fstatSync: (fd) => { st = io.fstatSync(fd); return st; } };
  let buf;
  try { buf = core.readHandle(file, max, { uid, io: watched }); } catch (e) { fail(`PUBLIC_${/^SHOT_E_[A-Z_]+$/.test(e?.code ?? '') ? e.code : 'SHOT_E_READ'}`); }
  if (!st || st.nlink !== 1) fail('PUBLIC_SHOT_E_LINKS');
  return buf;
}
const parse = (buf, keys) => {
  let r; try { r = JSON.parse(buf.toString('utf8')); } catch { fail('PUBLIC_SHOT_E_RECORD'); }
  if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).sort().join() !== keys) fail('PUBLIC_SHOT_E_RECORD');
  return r;
};

/** Validate the whole shot dir; nothing is written here. */
export function collectShots(core, dir, { uid = process.getuid(), io = fs } = {}) {
  assertShotDir(dir, uid);
  const entries = fs.readdirSync(dir).sort();
  const want = new Set(); const shots = []; const withheld = [];
  for (const name of PUBLIC_SHOT_NAMES) {
    const has = (s) => entries.includes(`${name}${s}`);
    if (has('.withheld.json')) {
      if (has('.png') || has('.scan.json')) fail('PUBLIC_SHOT_E_BOTH');
      want.add(`${name}.withheld.json`);
      const r = parse(readOne(core, path.join(dir, `${name}.withheld.json`), MAX_RECORD, uid, io), 'name,reason,withheld');
      if (r.name !== name || r.withheld !== true || !PUBLIC_WITHHELD_REASONS.includes(r.reason)) fail('PUBLIC_SHOT_E_RECORD');
      withheld.push({ name, reason: r.reason });
      continue;
    }
    if (!has('.png') || !has('.scan.json')) fail('PUBLIC_SHOT_E_MISSING');
    want.add(`${name}.png`); want.add(`${name}.scan.json`);
    const original = readOne(core, path.join(dir, `${name}.png`), MAX_PNG, uid, io);
    const rec = parse(readOne(core, path.join(dir, `${name}.scan.json`), MAX_RECORD, uid, io), 'name,scans,sha256,verdict,window');
    if (rec.name !== name || rec.sha256 !== sha(original) || rec.verdict !== 'clean' || rec.scans !== 2 || rec.window !== 'same-document-unchanged') fail('PUBLIC_SHOT_E_RECORD');
    let out;
    try { out = core.sanitizePng(original); } catch (e) { fail(`PUBLIC_${/^SHOT_E_[A-Z_]+$/.test(e?.code ?? '') ? e.code : 'SHOT_E_PNG'}`); }
    const plan = PUBLIC_SHOT_PLAN[name];
    if (out.width !== plan.width || out.height < plan.height) fail('PUBLIC_SHOT_E_DIMENSIONS');
    shots.push({ name, png: out.png, sha256: sha(out.png) });
  }
  if (entries.length !== want.size || entries.some((e) => !want.has(e))) fail('PUBLIC_SHOT_E_EXTRA');
  return { shots, withheld };
}

export async function exportShots(dir, outDir, manifest, opts = {}) {
  if (!path.isAbsolute(outDir) || !path.isAbsolute(manifest) || fs.existsSync(outDir) || fs.existsSync(manifest)) fail('PUBLIC_SHOT_E_OUT');
  const core = opts.core ?? await loadExportCore(opts.root);
  const { shots, withheld } = collectShots(core, dir, opts);   // every check above passes before anything is written
  fs.mkdirSync(outDir, { mode: 0o700 }); fs.chmodSync(outDir, 0o700);
  for (const s of shots) {
    const fd = fs.openSync(path.join(outDir, `${s.name}.png`), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeSync(fd, s.png); fs.fchmodSync(fd, 0o600); } finally { fs.closeSync(fd); }
  }
  const lines = [...shots.map((s) => `SHOT ${s.name} ${s.sha256}`), ...withheld.map((w) => `WITHHELD ${w.name} ${w.reason}`)];
  fs.writeFileSync(manifest, `${lines.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
  return withheld.length ? 1 : 0;
}

const isMain = (() => { try { return !!process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); } catch { return false; } })();
if (isMain) {
  const [dir, outDir, manifest, ...rest] = process.argv.slice(2);
  let rc;
  try {
    if (!dir || !outDir || !manifest || rest.length) fail('PUBLIC_SHOT_E_USAGE');
    rc = await exportShots(dir, outDir, manifest);
    console.log(rc === 0 ? 'PUBLIC_SHOT_EXPORT_OK' : 'PUBLIC_SHOT_E_WITHHELD');
  } catch (e) { console.log(e instanceof ShotError ? e.code : 'PUBLIC_SHOT_E_UNCLASSIFIED'); rc = 2; }
  process.exit(rc);
}
