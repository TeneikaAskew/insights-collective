#!/usr/bin/env node
// ABOUTME: Standalone controls for pgconn.mjs readPassword (no database, no network, no browser): regular, symlink, FIFO,
// ABOUTME: directory, mode, size and content cases, plus path replacement between the path check and the open.
// Usage: pgconn-selftest.mjs [pgconn.mjs path]   (default: the lane's own copy)
//   env LE_PGCONN_CONTROL=blocking-open runs every case against a COPY of pgconn.mjs with the pre-fix open (blocking, no
//   isFile on the opened handle); the FIFO and replacement cases must then FAIL (hang into the bounded timeout).
// Each case runs in its own child process with a 3 s timeout, so a hang is a recorded FAIL, never a stalled run. A random
// marker sits in every password file; no output may contain it except the one positive's length report.
import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANE = path.resolve(HERE, '..');
const ROOT = path.resolve(LANE, '../../..');
const TMP = mkdtempSync(path.join(os.tmpdir(), 'le-pgconn-st-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
let target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(LANE, 'pgconn.mjs');

const control = process.env.LE_PGCONN_CONTROL ?? '';
if (control) {
  if (control !== 'blocking-open') {
    console.log('unknown LE_PGCONN_CONTROL');
    process.exit(2);
  }
  // Mirror tree so the copy's relative import of the shared DSN parser resolves; the checked-in file is never changed.
  const m = path.join(TMP, 'mirror');
  mkdirSync(path.join(m, 'scripts/local-stack/lesson-editor'), { recursive: true });
  mkdirSync(path.join(m, 'scripts/local-db'), { recursive: true });
  cpSync(path.join(ROOT, 'scripts/local-db/assert-local-dsn.mjs'), path.join(m, 'scripts/local-db/assert-local-dsn.mjs'));
  const src = readFileSync(target, 'utf8');
  const open = ' | constants.O_NONBLOCK | constants.O_NOCTTY';
  const isFile = "    if (!st.isFile()) throw new Error('LE_DB_PASSWORD_FILE must be a regular file');\n";
  if (src.split(open).length !== 2 || src.split(isFile).length !== 2) {
    console.log('control: the pre-fix mutation did not match exactly once');
    process.exit(2);
  }
  target = path.join(m, 'scripts/local-stack/lesson-editor/pgconn.mjs');
  writeFileSync(target, src.replace(open, '').replace(isFile, ''));
  console.log('CONTROL blocking-open: cases below use a copy with the pre-fix open (blocking, no fstat isFile)');
}

const MARK = `PWMARK${randomBytes(6).toString('hex')}`;
const f = (name) => path.join(TMP, name);
const reg = (name, body = `${MARK}\n`, mode = 0o600) => {
  writeFileSync(f(name), body, { mode });
  chmodSync(f(name), mode);
  return f(name);
};
const fifo = (name) => {
  execFileSync('mkfifo', ['-m', '600', f(name)]);
  return f(name);
};

// Child: import the target, call readPassword (optionally replacing the path after the path check), report a fixed result.
const CHILD = `
const [file, replace, fifoPath, linkTarget] = process.argv.slice(1);
const { readPassword } = await import(process.env.LE_ST_TARGET); // via env: argv[1] must not name the module (its CLI guard)
const { renameSync, symlinkSync, unlinkSync } = await import('node:fs');
const hooks = replace === 'none' ? {} : { afterPathCheck: () => {
  unlinkSync(file);
  if (replace === 'fifo') renameSync(fifoPath, file); else symlinkSync(linkTarget, file);
} };
try {
  const pw = readPassword(file, hooks);
  console.log('OK length ' + pw.length);
} catch (e) {
  console.log('REFUSED ' + (e instanceof Error ? e.message : 'non-error'));
}
`;
function run(file, replace = 'none', extra = []) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD, file, replace, ...extra], {
    encoding: 'utf8', timeout: 3000, env: { ...process.env, LE_ST_TARGET: target },
  });
  return { out: `${r.stdout ?? ''}${r.stderr ?? ''}`, timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM', status: r.status };
}

let pass = 0, fail = 0;
const say = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) pass++; else fail++;
};
const refused = (r, text) => !r.timedOut && r.out.startsWith('REFUSED ') && r.out.includes(text) && !r.out.includes(MARK);

// Positive
{
  const r = run(reg('ok'));
  say('K1 a regular 0600 one-line file owned by this user is read (length only reported)', !r.timedOut && r.out.trim() === `OK length ${MARK.length}`);
}
// Path-type negatives
symlinkSync(reg('real'), f('link'));
say('K2 a symlink is refused', refused(run(f('link')), 'must be a regular file'));
say('K3 a FIFO is refused promptly (no hang)', refused(run(fifo('pipe')), 'must be a regular file'));
mkdirSync(f('dir'), { mode: 0o700 });
say('K4 a directory is refused', refused(run(f('dir')), 'must be a regular file'));
say('K5 a missing file is refused', refused(run(f('absent')), 'must be a regular file'));
say('K6 a relative path is refused', refused(run('relative/pw'), 'absolute path'));
// Replacement between the path check and the open (the race the opened-handle check closes)
{
  const r = run(reg('swap-fifo'), 'fifo', [fifo('pipe2'), '']);
  say('K7 regular replaced by a FIFO after the path check: refused promptly from the opened handle', refused(r, 'must be a regular file'));
}
{
  const r = run(reg('swap-link'), 'link', ['', reg('other')]);
  say('K8 regular replaced by a symlink after the path check: refused by the no-follow open', refused(r, 'symlink refused'));
}
// Mode, content and size negatives
say('K9 a group/other-readable file is refused', refused(run(reg('m644', `${MARK}\n`, 0o644)), 'mode 600'));
say('K10 an empty file is refused', refused(run(reg('empty', '')), 'one non-empty line'));
say('K11 two lines are refused', refused(run(reg('two', `${MARK}\n${MARK}\n`)), 'one non-empty line'));
say('K12 an oversize file is refused', refused(run(reg('big', `${MARK}${'x'.repeat(5000)}\n`)), 'too large'));
// The CLI path fails closed with a fixed message and no marker, also for a FIFO
{
  const r = spawnSync(process.execPath, [target, 'passfile', 'postgresql://postgres@127.0.0.1:5432/postgres', f('out-pgpass')], {
    encoding: 'utf8', timeout: 3000, env: { ...process.env, LE_DB_PASSWORD_FILE: fifo('pipe3') },
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  say('K13 pgconn.mjs passfile with a FIFO password file fails closed, fixed message, no output file', r.status === 1 && /^FAIL le-pgconn: LE_DB_PASSWORD_FILE /.test(out) && !out.includes(MARK) && spawnSync('test', ['-e', f('out-pgpass')]).status !== 0);
}

console.log(`le pgconn-selftest: ${pass} passed, ${fail} failed (LOCAL: files, FIFOs and symlinks in a private temp dir; no database, network or browser)`);
process.exit(fail === 0 ? 0 : 1);
