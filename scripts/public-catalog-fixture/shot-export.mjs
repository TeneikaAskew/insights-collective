// ABOUTME: Exports the public lane's screenshots from the private shot dir to evidence: exactly the 4 fixed names, each a PNG
// ABOUTME: whose sha256 matches its clean scan record and whose size matches its viewport, or a fixed-reason withheld record.
//
// CLI: node shot-export.mjs <private shot dir> <evidence screenshots dir (must not exist)> <evidence manifest file (must not exist)>
// Manifest grammar (shared job contract, #157 ffe64d82): one line per name, exactly `SHOT <name> <sha256 of the file bytes>` or
// `WITHHELD <name> <REASON>`, nothing else (no blank lines, no comments); the screenshots dir holds exactly the SHOT PNGs.
// Exit 0: all 4 PNGs exported. Exit 1: any shot withheld (clean PNGs are still exported, each withheld name has its line);
// the run fails. Exit 2: anything malformed, absent or extra; NOTHING is exported.
// Output is fixed codes only. PNG dimensions: width equals the viewport width (device scale 1), height is at least the
// viewport height (full-page capture).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PUBLIC_SHOT_PLAN, PUBLIC_SHOT_NAMES, PUBLIC_WITHHELD_REASONS, assertShotDir, ShotError } from './shot-plan.mjs';

const MAX_PNG = 20 * 1024 * 1024;
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fail = (code) => { throw new ShotError(code); };

export function pngSize(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIG) || buf.readUInt32BE(8) !== 13 || buf.toString('latin1', 12, 16) !== 'IHDR') fail('PUBLIC_SHOT_E_PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readRegular(p, max) {
  const st = fs.lstatSync(p);
  if (!st.isFile() || st.nlink !== 1 || st.size > max) fail('PUBLIC_SHOT_E_FILE');
  return fs.readFileSync(p);
}
const json = (buf) => { try { return JSON.parse(buf.toString('utf8')); } catch { return fail('PUBLIC_SHOT_E_RECORD'); } };

/** Validate the whole shot dir. @returns {{ shots: {name,sha256,bytes,width,height,buf}[], withheld: {name,reason}[] }} */
export function collectShots(dir) {
  assertShotDir(dir);
  const entries = fs.readdirSync(dir).sort();
  const want = new Set();
  const shots = [], withheld = [];
  for (const name of PUBLIC_SHOT_NAMES) {
    const has = (s) => entries.includes(`${name}${s}`);
    if (has('.withheld.json')) {
      if (has('.png') || has('.scan.json')) fail('PUBLIC_SHOT_E_BOTH');
      want.add(`${name}.withheld.json`);
      const r = json(readRegular(path.join(dir, `${name}.withheld.json`), 4096));
      if (r.name !== name || r.withheld !== true || !PUBLIC_WITHHELD_REASONS.includes(r.reason) || Object.keys(r).length !== 3) fail('PUBLIC_SHOT_E_RECORD');
      withheld.push({ name, reason: r.reason });
      continue;
    }
    if (!has('.png') || !has('.scan.json')) fail('PUBLIC_SHOT_E_MISSING');
    want.add(`${name}.png`); want.add(`${name}.scan.json`);
    const buf = readRegular(path.join(dir, `${name}.png`), MAX_PNG);
    const rec = json(readRegular(path.join(dir, `${name}.scan.json`), 4096));
    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (rec.name !== name || rec.sha256 !== sha256 || rec.verdict !== 'clean' || rec.scans !== 2 || rec.window !== 'same-document-unchanged') fail('PUBLIC_SHOT_E_RECORD');
    const { width, height } = pngSize(buf);
    const plan = PUBLIC_SHOT_PLAN[name];
    if (width !== plan.width || height < plan.height) fail('PUBLIC_SHOT_E_DIMENSIONS');
    shots.push({ name, sha256, bytes: buf.length, width, height, buf });
  }
  if (entries.length !== want.size || entries.some((e) => !want.has(e))) fail('PUBLIC_SHOT_E_EXTRA');
  return { shots, withheld };
}

export function exportShots(dir, outDir, manifest) {
  if (!path.isAbsolute(outDir) || !path.isAbsolute(manifest) || fs.existsSync(outDir) || fs.existsSync(manifest)) fail('PUBLIC_SHOT_E_OUT');
  const { shots, withheld } = collectShots(dir);          // validates everything before any output exists
  fs.mkdirSync(outDir, { mode: 0o700 });
  for (const s of shots) {
    const fd = fs.openSync(path.join(outDir, `${s.name}.png`), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeSync(fd, s.buf); } finally { fs.closeSync(fd); }
  }
  const lines = [
    ...shots.map((s) => `SHOT ${s.name} ${s.sha256}`),
    ...withheld.map((w) => `WITHHELD ${w.name} ${w.reason}`),
  ];
  fs.writeFileSync(manifest, `${lines.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
  return withheld.length ? 1 : 0;
}

const isMain = (() => { try { return !!process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); } catch { return false; } })();
if (isMain) {
  const [dir, outDir, manifest, ...rest] = process.argv.slice(2);
  let rc;
  try {
    if (!dir || !outDir || !manifest || rest.length) fail('PUBLIC_SHOT_E_USAGE');
    rc = exportShots(dir, outDir, manifest);
    console.log(rc === 0 ? 'PUBLIC_SHOT_EXPORT_OK' : 'PUBLIC_SHOT_E_WITHHELD');
  } catch (e) { console.log(e instanceof ShotError ? e.code : 'PUBLIC_SHOT_E_UNCLASSIFIED'); rc = 2; }
  process.exit(rc);
}
