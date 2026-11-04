// ABOUTME: Reads a path only if it is a regular file (symlinks followed), checking and reading through ONE descriptor
// ABOUTME: so the file checked is the file read. Never blocks on a FIFO; skips only conditions that mean "not a file".
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';

/**
 * O_NONBLOCK: opening a FIFO read-only with no writer returns at once on Linux instead of waiting for one; fstat then
 * reports it as not a regular file. It has no effect on reads of regular files.
 * Skipped (returns null): missing path or broken symlink (ENOENT), symlink loop (ELOOP), a socket or a device with no
 * driver (ENXIO), and every node fstat does not call a regular file (directory, FIFO, socket, block/char device), or a
 * file larger than maxBytes. Any other error (permission, I/O) is thrown: a scan must not pass by skipping files it
 * could not read.
 */
export function readRegularFile(path: string, maxBytes: number): Buffer | null {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ELOOP' || code === 'ENXIO') return null;
    throw e;
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > maxBytes) return null;
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}
