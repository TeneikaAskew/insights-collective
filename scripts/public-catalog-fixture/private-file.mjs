// ABOUTME: The one reader for private inputs (stack proof, DB passfile, hermetic provenance): the c74986bc opened-handle pattern.
// ABOUTME: open O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_NOCTTY, then fstat THAT descriptor, then a bounded read. A FIFO cannot stall it.
//
// Rules, all decided on the opened descriptor (a path swapped after any earlier check changes nothing):
//   regular file; link count 1; owned by this uid; mode exactly 0600 (when `private`); size <= max; read loop bounded by max.
// Errors are fixed codes with a short reason; no file content is ever included.
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';

export const PF = { OPEN: 'OPEN', TYPE: 'TYPE', LINKS: 'LINKS', OWNER: 'OWNER', MODE: 'MODE', SIZE: 'SIZE', READ: 'READ' };
export const OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK | constants.O_NOCTTY;

/** Pure stat rules, testable without chown. */
export function assessStat(st, uid, { privateMode = true, max }) {
  if (!st.isFile()) return PF.TYPE;
  if (st.nlink !== 1) return PF.LINKS;
  if (st.uid !== uid) return PF.OWNER;
  if (privateMode && (st.mode & 0o7777) !== 0o600) return PF.MODE;
  if (st.size > max) return PF.SIZE;
  return null;
}

/** Returns { buf } or { error: one of PF }. */
export function readPrivateFile(file, { max, privateMode = true, uid = process.getuid() }) {
  let fd;
  try { fd = openSync(file, OPEN_FLAGS); } catch { return { error: PF.OPEN }; }
  try {
    let st; try { st = fstatSync(fd); } catch { return { error: PF.READ }; }
    const bad = assessStat(st, uid, { privateMode, max }); if (bad) return { error: bad };
    const buf = Buffer.alloc(max + 1); let n = 0;
    for (;;) {
      let r; try { r = readSync(fd, buf, n, buf.length - n, null); } catch { return { error: PF.READ }; }
      if (r === 0) break;
      n += r; if (n > max) return { error: PF.SIZE };
    }
    return { buf: buf.subarray(0, n) };
  } finally { closeSync(fd); }
}
