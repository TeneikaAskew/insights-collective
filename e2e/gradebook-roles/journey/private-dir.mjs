// ABOUTME: Gate 1 for the journey lane (UNRUN proposal): the session directory must be a fresh, private (0700), caller-owned,
// ABOUTME: EMPTY directory outside the repository, and every session file is created exclusively with mode 0600.
// Errors are fixed codes only: never a path, a value, a token or an exception text.
import fs from 'node:fs';
import path from 'node:path';

export class JourneyGateError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'JourneyGateError'; }
}

/**
 * @param {string|undefined} raw  GB_SESSION_DIR as given by the runner
 * @param {{ repoRoot?: string, uid?: number }} [opts]
 * @returns {string} the real path
 */
export function assertPrivateSessionDir(raw, opts = {}) {
  const repoRoot = fs.realpathSync(opts.repoRoot ?? process.cwd());
  const uid = opts.uid ?? (typeof process.getuid === 'function' ? process.getuid() : -1);
  if (!raw || !path.isAbsolute(raw)) throw new JourneyGateError('JOURNEY_GATE1_E_NOT_ABSOLUTE');
  let st;
  try { st = fs.lstatSync(raw); } catch { throw new JourneyGateError('JOURNEY_GATE1_E_MISSING'); }
  if (st.isSymbolicLink()) throw new JourneyGateError('JOURNEY_GATE1_E_SYMLINK');
  if (!st.isDirectory()) throw new JourneyGateError('JOURNEY_GATE1_E_NOT_DIR');
  const real = fs.realpathSync(raw);
  if (real === repoRoot || real.startsWith(repoRoot + path.sep)) throw new JourneyGateError('JOURNEY_GATE1_E_INSIDE_REPO');
  if ((st.mode & 0o777) !== 0o700) throw new JourneyGateError('JOURNEY_GATE1_E_MODE');
  if (uid >= 0 && st.uid !== uid) throw new JourneyGateError('JOURNEY_GATE1_E_OWNER');
  if (fs.readdirSync(real).length !== 0) throw new JourneyGateError('JOURNEY_GATE1_E_NOT_EMPTY');
  return real;
}

/** Exclusive create, 0600, refusing to follow or replace anything that already exists. */
export function writePrivateFile(dir, name, data) {
  if (!/^[a-z0-9-]+\.json$/.test(name)) throw new JourneyGateError('JOURNEY_GATE1_E_FILENAME');
  const p = path.join(dir, name);
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
  catch { throw new JourneyGateError('JOURNEY_GATE1_E_EXCLUSIVE_CREATE'); }
  try { fs.writeSync(fd, data); fs.fchmodSync(fd, 0o600); } finally { fs.closeSync(fd); }
  if ((fs.lstatSync(p).mode & 0o777) !== 0o600) throw new JourneyGateError('JOURNEY_GATE1_E_FILE_MODE');
  return p;
}
