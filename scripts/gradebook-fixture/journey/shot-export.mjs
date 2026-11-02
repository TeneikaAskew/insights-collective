// ABOUTME: Screenshot export for the journey adapter (UNRUN proposal): the only way a PNG leaves the run. Accepts only the 16
// ABOUTME: allowlisted names, each with its matching clean scan record, and re-encodes every PNG with its critical chunks only.
//
//   node shot-export.mjs <private shot dir> <private session dir> <pairing proof file> <export dir (must not exist)>
//
// For every entry of the shot dir (anything else refuses):
//   * names: <allowlisted>.png and <allowlisted>.scan.json, in pairs; nothing else
//   * each file read on one O_NOFOLLOW|O_NONBLOCK handle: regular, this uid, exact 0600, bounded size, bounded read,
//     no growth; closed in finally
//   * scan record: exact keys {name, sha256, verdict, scans}; verdict "clean", scans 2, sha256 of the PNG bytes as read
//   * PNG: signature, every chunk CRC checked, IHDR first (sane size/depth/colour type), IDAT contiguous, IEND last with
//     nothing after it; ancillary chunks (tEXt, iTXt, zTXt, eXIf, tIME, ...) are DROPPED, unknown critical chunks refuse
//   * the re-encoded bytes must not contain this run's nonce or the carrier prefix (belt and braces: text chunks are gone)
// Output: <export dir>/<name>.png (0600) and, on stdout, one "SHOT <name> sha256=<hex> bytes=<n> width=<w> height=<h>" line
// per exported shot in allowlist order, then "SHOTS <n> of 16". Any refusal: "run-journey refused: SHOT_E_*", exit 3.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SHOT_NAMES, assertShotDir } from '../../../e2e/gradebook-roles/journey/shot-core.mjs';
import { assertPairingProof, PAIRING_PREFIX } from '../../../e2e/gradebook-roles/journey/pairing-proof.mjs';

export class ShotError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'ShotError'; }
}
const MAX_PNG = 16 * 1024 * 1024;
const MAX_SCAN = 512;
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRITICAL = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);
const COLOR_DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

/** One handle: no-follow, non-blocking open; same-fd type/owner/mode/size; bounded read; growth refused; finally close. */
export function readHandle(file, max, { uid = typeof process.getuid === 'function' ? process.getuid() : -1, io = fs } = {}) {
  let fd;
  try { fd = io.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0)); }
  catch { throw new ShotError('SHOT_E_OPEN'); }
  let err = null, buf = null;
  try {
    const st = io.fstatSync(fd);
    if (!st.isFile()) err = 'SHOT_E_TYPE';
    else if ((st.mode & 0o777) !== 0o600 || (uid >= 0 && st.uid !== uid)) err = 'SHOT_E_MODE';
    else if (st.size < 1 || st.size > max) err = 'SHOT_E_SIZE';
    else {
      const cap = Buffer.alloc(max + 1);
      let n = 0;
      for (;;) {
        const r = io.readSync(fd, cap, n, cap.length - n, null);
        if (r === 0) break;
        n += r;
        if (n > max) { err = 'SHOT_E_SIZE'; break; }
      }
      if (!err && n !== st.size) err = 'SHOT_E_GROWTH';
      if (!err) buf = Buffer.from(cap.subarray(0, n));
    }
  } catch { err = err ?? 'SHOT_E_READ'; }
  finally { try { io.closeSync(fd); } catch { err = err ?? 'SHOT_E_CLOSE'; } }
  if (err) throw new ShotError(err);
  return buf;
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/**
 * Parse and re-encode: keep IHDR, PLTE, IDAT, IEND exactly (CRCs verified), drop every ancillary chunk.
 * @param {Buffer} buf @returns {{ png: Buffer, width: number, height: number }}
 */
export function sanitizePng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8 + 25 + 12 || !buf.subarray(0, 8).equals(SIG)) throw new ShotError('SHOT_E_PNG_SIG');
  const kept = [SIG];
  let off = 8, i = 0, width = 0, height = 0, sawIdat = false, idatClosed = false, ended = false;
  while (off < buf.length) {
    if (ended) throw new ShotError('SHOT_E_PNG_TRAILING');
    if (off + 12 > buf.length) throw new ShotError('SHOT_E_PNG_TRUNCATED');
    const len = buf.readUInt32BE(off);
    if (len > 0x7fffffff || off + 12 + len > buf.length) throw new ShotError('SHOT_E_PNG_TRUNCATED');
    const type = buf.toString('latin1', off + 4, off + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new ShotError('SHOT_E_PNG_CHUNK');
    const body = buf.subarray(off + 8, off + 8 + len);
    if (crc32(buf.subarray(off + 4, off + 8 + len)) !== buf.readUInt32BE(off + 8 + len)) throw new ShotError('SHOT_E_PNG_CRC');
    const whole = buf.subarray(off, off + 12 + len);
    if (i === 0) {
      if (type !== 'IHDR' || len !== 13) throw new ShotError('SHOT_E_PNG_IHDR');
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const depth = body[8], color = body[9];
      if (width < 1 || height < 1 || width > 20000 || height > 60000 || !(COLOR_DEPTHS[color] ?? []).includes(depth)
        || body[10] !== 0 || body[11] !== 0 || body[12] > 1) throw new ShotError('SHOT_E_PNG_IHDR');
      kept.push(whole);
    } else if (type === 'IHDR') throw new ShotError('SHOT_E_PNG_IHDR');
    else if (type === 'IDAT') {
      if (idatClosed) throw new ShotError('SHOT_E_PNG_IDAT');
      sawIdat = true; kept.push(whole);
    } else {
      if (sawIdat) idatClosed = true;
      if (type === 'IEND') { if (len !== 0 || !sawIdat) throw new ShotError('SHOT_E_PNG_IEND'); ended = true; kept.push(whole); }
      else if (type === 'PLTE') { if (sawIdat || len % 3 !== 0 || len === 0) throw new ShotError('SHOT_E_PNG_CHUNK'); kept.push(whole); }
      else if (CRITICAL.has(type) || (type.charCodeAt(0) & 0x20) === 0) throw new ShotError('SHOT_E_PNG_CHUNK'); // unknown critical
      // ancillary (lower-case first letter): dropped, never copied
    }
    off += 12 + len; i++;
  }
  if (!ended) throw new ShotError('SHOT_E_PNG_IEND');
  const png = Buffer.concat(kept);
  // The image data must inflate (a real image, not an arbitrary payload in IDAT framing), within a bounded size.
  try {
    const idat = Buffer.concat(kept.filter((c) => c !== SIG && c.toString('latin1', 4, 8) === 'IDAT').map((c) => c.subarray(8, c.length - 4)));
    zlib.inflateSync(idat, { maxOutputLength: 512 * 1024 * 1024 });
  } catch { throw new ShotError('SHOT_E_PNG_DATA'); }
  return { png, width, height };
}

const SCAN_KEYS = 'name,scans,sha256,verdict';
/**
 * @param {{ shotDir: string, sessionDir: string, proofFile: string, exportDir: string, uid?: number, io?: typeof fs }} o
 * @returns {string[]} the manifest lines
 */
export function exportShots(o) {
  const shotDir = assertShotDirSafe(o.shotDir, o.uid);
  let proof;
  try { proof = assertPairingProof(o.proofFile, { sessionDir: o.sessionDir, uid: o.uid }); } catch { throw new ShotError('SHOT_E_PROOF'); }
  const forbidden = [Buffer.from(proof.stack_id), Buffer.from(PAIRING_PREFIX)];
  if (typeof o.exportDir !== 'string' || !path.isAbsolute(o.exportDir) || fs.existsSync(o.exportDir)) throw new ShotError('SHOT_E_EXPORT_DIR');
  let entries;
  try { entries = fs.readdirSync(shotDir); } catch { throw new ShotError('SHOT_E_DIR'); }
  const allowed = new Set(SHOT_NAMES.flatMap((n) => [`${n}.png`, `${n}.scan.json`]));
  if (entries.some((e) => !allowed.has(e))) throw new ShotError('SHOT_E_UNKNOWN_FILE');
  const present = SHOT_NAMES.filter((n) => entries.includes(`${n}.png`) || entries.includes(`${n}.scan.json`));
  if (present.some((n) => !entries.includes(`${n}.png`) || !entries.includes(`${n}.scan.json`))) throw new ShotError('SHOT_E_UNPAIRED');
  const out = [];
  for (const name of present) {
    const raw = readHandle(path.join(shotDir, `${name}.png`), MAX_PNG, { uid: o.uid, io: o.io });
    const recBytes = readHandle(path.join(shotDir, `${name}.scan.json`), MAX_SCAN, { uid: o.uid, io: o.io });
    let rec;
    try { rec = JSON.parse(recBytes.toString('utf8')); } catch { throw new ShotError('SHOT_E_SCAN_RECORD'); }
    if (!rec || typeof rec !== 'object' || Array.isArray(rec) || Object.keys(rec).sort().join(',') !== SCAN_KEYS
      || rec.name !== name || rec.verdict !== 'clean' || rec.scans !== 2 || typeof rec.sha256 !== 'string') throw new ShotError('SHOT_E_SCAN_RECORD');
    if (createHash('sha256').update(raw).digest('hex') !== rec.sha256) throw new ShotError('SHOT_E_SCAN_MISMATCH');
    const { png, width, height } = sanitizePng(raw);
    if (forbidden.some((f) => png.includes(f))) throw new ShotError('SHOT_E_NONCE_IN_PNG');
    out.push({ name, png, width, height });
  }
  try { fs.mkdirSync(o.exportDir, { mode: 0o700 }); } catch { throw new ShotError('SHOT_E_EXPORT_DIR'); }
  const lines = [];
  for (const s of out) {
    const p = path.join(o.exportDir, `${s.name}.png`);
    try { fs.writeFileSync(p, s.png, { mode: 0o600, flag: 'wx' }); } catch { throw new ShotError('SHOT_E_EXPORT_WRITE'); }
    lines.push(`SHOT ${s.name} sha256=${createHash('sha256').update(s.png).digest('hex')} bytes=${s.png.length} width=${s.width} height=${s.height}`);
  }
  lines.push(`SHOTS ${out.length} of ${SHOT_NAMES.length}`);
  return lines;
}
function assertShotDirSafe(dir, uid) { try { return assertShotDir(dir, uid); } catch { throw new ShotError('SHOT_E_DIR'); } }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [shotDir, sessionDir, proofFile, exportDir] = process.argv.slice(2);
    if (!exportDir) throw new ShotError('SHOT_E_USAGE');
    console.log(exportShots({ shotDir, sessionDir, proofFile, exportDir }).join('\n'));
  } catch (e) {
    console.log(`run-journey refused: ${e instanceof ShotError ? e.code : 'SHOT_E_UNCLASSIFIED'}`);
    process.exit(3);
  }
}
