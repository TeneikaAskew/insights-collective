// ABOUTME: Gate 1 for the journey lane (UNRUN proposal): private directories (fresh, 0700, caller-owned, EMPTY, outside the
// ABOUTME: repo) and private files (exclusive create, no-follow, 0600). Errors are fixed codes only: never a path, value or text.
import fs from 'node:fs';
import path from 'node:path';

export class JourneyGateError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'JourneyGateError'; }
}

/**
 * @param {string|undefined} raw  directory as given by the runner
 * @param {{ repoRoot?: string, uid?: number, gate?: string }} [opts]  gate = code prefix (default JOURNEY_GATE1)
 * @returns {string} the real path
 */
export function assertPrivateDir(raw, opts = {}) {
  const g = opts.gate ?? 'JOURNEY_GATE1';
  const repoRoot = fs.realpathSync(opts.repoRoot ?? process.cwd());
  const uid = opts.uid ?? (typeof process.getuid === 'function' ? process.getuid() : -1);
  if (!raw || !path.isAbsolute(raw)) throw new JourneyGateError(`${g}_E_NOT_ABSOLUTE`);
  let st;
  try { st = fs.lstatSync(raw); } catch { throw new JourneyGateError(`${g}_E_MISSING`); }
  if (st.isSymbolicLink()) throw new JourneyGateError(`${g}_E_SYMLINK`);
  if (!st.isDirectory()) throw new JourneyGateError(`${g}_E_NOT_DIR`);
  let real;
  try { real = fs.realpathSync(raw); } catch { throw new JourneyGateError(`${g}_E_MISSING`); }
  if (real === repoRoot || real.startsWith(repoRoot + path.sep)) throw new JourneyGateError(`${g}_E_INSIDE_REPO`);
  if ((st.mode & 0o777) !== 0o700) throw new JourneyGateError(`${g}_E_MODE`);
  if (uid >= 0 && st.uid !== uid) throw new JourneyGateError(`${g}_E_OWNER`);
  let entries;
  try { entries = fs.readdirSync(real); } catch { throw new JourneyGateError(`${g}_E_UNREADABLE`); }
  if (entries.length !== 0) throw new JourneyGateError(`${g}_E_NOT_EMPTY`);
  return real;
}

/** The session dir: gate 1 rules. Kept as its own name so callers and the static contract can find it. */
export function assertPrivateSessionDir(raw, opts = {}) { return assertPrivateDir(raw, { ...opts, gate: 'JOURNEY_GATE1' }); }

/** Exclusive create, 0600, refusing to follow or replace anything. Every fs failure maps to a fixed code. */
export function writePrivateFile(dir, name, data) {
  if (!/^[a-z0-9-]+\.json$/.test(name)) throw new JourneyGateError('JOURNEY_GATE1_E_FILENAME');
  const p = path.join(dir, name);
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
  catch { throw new JourneyGateError('JOURNEY_GATE1_E_EXCLUSIVE_CREATE'); }
  let failed = null;
  try { fs.writeSync(fd, data); fs.fchmodSync(fd, 0o600); } catch { failed = 'JOURNEY_GATE1_E_WRITE'; }
  try { fs.closeSync(fd); } catch { failed = failed ?? 'JOURNEY_GATE1_E_CLOSE'; }
  if (failed) throw new JourneyGateError(failed);
  let st;
  try { st = fs.lstatSync(p); } catch { throw new JourneyGateError('JOURNEY_GATE1_E_FILE_MODE'); }
  if (!st.isFile() || (st.mode & 0o777) !== 0o600) throw new JourneyGateError('JOURNEY_GATE1_E_FILE_MODE');
  return p;
}

/** Read a private JSON file written by writePrivateFile: regular file, not a symlink, 0600, parseable. */
export function readPrivateJson(dir, name) {
  if (!/^[a-z0-9-]+\.json$/.test(name)) throw new JourneyGateError('JOURNEY_GATE1_E_FILENAME');
  const p = path.join(dir, name);
  let st;
  try { st = fs.lstatSync(p); } catch { throw new JourneyGateError('JOURNEY_GATE1_E_STATE_MISSING'); }
  if (st.isSymbolicLink() || !st.isFile() || (st.mode & 0o777) !== 0o600) throw new JourneyGateError('JOURNEY_GATE1_E_STATE_MODE');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new JourneyGateError('JOURNEY_GATE1_E_STATE_PARSE'); }
}
