#!/usr/bin/env node
// ABOUTME: Public-catalog JOB step: turns this job's own SUPABASE_DB_URL into the lane's input pair, a canonical
// ABOUTME: password-free loopback DSN (stdout) and a one-line 0600 pgpass file in a private 0700 dir. Nothing else printed.
//
// Planning reuses the qualified scripts/gradebook-fixture/journey/private-psql.mjs planPsql (imported unchanged): strict
// in-process local-DSN check, plain -h/-p/-U/-d parts, escaped pgpass line. The DSN is read from the environment only.
//
// CLI: pc-job-dsn.mjs <private dir>   -> writes <private dir>/pgpass (O_EXCL, 0600); stdout: postgresql://user@host:port/db
// Failure: "pc-job-dsn refused: <CODE>" on stderr, exit 3 (usage 2). No DSN, password or pgpass content is ever printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planPsql } from '../gradebook-fixture/journey/private-psql.mjs';

export class JobDsnError extends Error { constructor(code) { super(code); this.code = code; } }
const LOOP = new Set(['127.0.0.1', 'localhost']);

/** Pure: { dsn, passLine } from a DSN string; refuses non-loopback, IPv6 literals and password-less DSNs. */
export function planDsn(dsn, env = {}) {
  let plan;
  try { plan = planPsql(dsn, env); } catch { throw new JobDsnError('PCDSN_E_DSN'); }
  const at = (flag) => plan.argv[plan.argv.indexOf(flag) + 1];
  const host = at('-h'), port = at('-p'), user = at('-U'), db = at('-d');
  if (!LOOP.has(host)) throw new JobDsnError('PCDSN_E_HOST');
  if (!/^[a-z_][a-z0-9_]*$/.test(user) || !/^[a-z_][a-z0-9_]*$/.test(db) || !/^\d{1,5}$/.test(port)) throw new JobDsnError('PCDSN_E_SHAPE');
  if (!/^[^\n]+\n$/.test(plan.passLine)) throw new JobDsnError('PCDSN_E_NO_PASSWORD');
  return { dsn: `postgresql://${user}@${host}:${port}/${db}`, passLine: plan.passLine };
}

function assertPrivateDir(dir) {
  let st; try { st = fs.lstatSync(dir); } catch { throw new JobDsnError('PCDSN_E_PRIVATE_DIR'); }
  const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
  if (st.isSymbolicLink() || !st.isDirectory() || (st.mode & 0o777) !== 0o700 || (uid >= 0 && st.uid !== uid)) throw new JobDsnError('PCDSN_E_PRIVATE_DIR');
}

export function writePassfile(dir, passLine) {
  assertPrivateDir(dir);
  const file = path.join(fs.realpathSync(dir), 'pgpass');
  let fd;
  try { fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
  catch { throw new JobDsnError('PCDSN_E_PASSFILE'); }
  try { fs.writeSync(fd, passLine); fs.fchmodSync(fd, 0o600); } finally { fs.closeSync(fd); }
  return file;
}

const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const [dir] = process.argv.slice(2);
  if (!dir) { console.error('pc-job-dsn refused: PCDSN_E_USAGE'); process.exit(2); }
  try {
    const { dsn, passLine } = planDsn(process.env.SUPABASE_DB_URL, process.env);
    writePassfile(dir, passLine);
    console.log(dsn);
  } catch (e) { console.error(`pc-job-dsn refused: ${e instanceof JobDsnError ? e.code : 'PCDSN_E_UNEXPECTED'}`); process.exit(3); }
}
