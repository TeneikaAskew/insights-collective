// ABOUTME: Own temp-root lifecycle for lane test harnesses: one fresh 0700 mkdtemp root per invocation, removed in a bounded
// ABOUTME: finally only if it is still that exact directory; the primary failure is never masked by a cleanup failure.
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** The exact root this invocation created: path plus the dev/ino of the directory mkdtemp made. */
function identity(d) { const s = fs.lstatSync(d); return { dev: s.dev, ino: s.ino }; }

/** Removes `d` only if it is still a real directory (not a symlink) with the recorded dev/ino. Never another path. */
export function removeExactRoot(d, id) {
  let s;
  try { s = fs.lstatSync(d); } catch (e) { if (e && e.code === 'ENOENT') return; throw e; }
  if (!s.isDirectory() || s.isSymbolicLink() || s.dev !== id.dev || s.ino !== id.ino) {
    throw Object.assign(new Error('OWN_ROOT_E_IDENTITY'), { code: 'OWN_ROOT_E_IDENTITY' });
  }
  fs.rmSync(d, { recursive: true, force: true });
}

/**
 * Runs `fn(root)` with a fresh private root `<tmpdir>/<prefix>XXXXXX` (0700), then removes exactly that root whatever happens.
 * - fn fails: its error is rethrown as the SAME object; a cleanup failure is only attached as `cleanupError` and reported
 *   through `onSecondary` (default: one CLEANUP_SECONDARY line on stderr).
 * - fn passes and cleanup fails: the cleanup error is thrown, not swallowed.
 * `remove` is injectable for the controls only.
 */
export async function withOwnRoot(prefix, fn, { remove = removeExactRoot, onSecondary } = {}) {
  if (!/^[a-z][a-z0-9-]{2,30}-$/.test(prefix)) throw new Error('OWN_ROOT_E_PREFIX');
  const root = fs.mkdtempSync(path.join(tmpdir(), prefix));
  const id = identity(root);
  let failed = false, primary;
  try {
    fs.chmodSync(root, 0o700);
    return await fn(root);
  } catch (e) {
    failed = true; primary = e; throw e;
  } finally {
    try { remove(root, id); } catch (c) {
      if (!failed) throw c;
      const line = `CLEANUP_SECONDARY root=${path.basename(root)} code=${(c && c.code) || 'unknown'}`;
      if (onSecondary) onSecondary(line); else console.error(line);
      if (primary && typeof primary === 'object') { try { Object.defineProperty(primary, 'cleanupError', { value: c, enumerable: true }); } catch { /* the primary stays as thrown */ } }
    }
  }
}
