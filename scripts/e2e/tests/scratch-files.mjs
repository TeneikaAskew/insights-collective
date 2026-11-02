// ABOUTME: Test-only scratch file writer for the stack-ownership controls. Lives under scripts/ so the security
// ABOUTME: workflow's reviewed-write-location guard covers it; writes only inside a caller-supplied mkdtemp directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Writes `content` to <dir>/<name> with an exact mode. `dir` must be inside os.tmpdir(); `name` must be a bare name. */
export function scratchFile(dir, name, content, mode = 0o600) {
  const root = fs.realpathSync(os.tmpdir());
  const real = fs.realpathSync(dir);
  if (!real.startsWith(root + path.sep)) throw new Error('scratchFile: directory is not under the OS temp dir');
  if (name !== path.basename(name) || name === '' || name === '.' || name === '..') throw new Error('scratchFile: bad name');
  const f = path.join(real, name);
  fs.writeFileSync(f, content, { mode, flag: 'wx' });
  fs.chmodSync(f, mode);
  return f;
}
