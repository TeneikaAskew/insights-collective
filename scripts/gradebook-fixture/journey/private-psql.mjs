// ABOUTME: Password-free psql for the journey adapter (UNRUN proposal): the DSN is checked in-process by the shared strict
// ABOUTME: parser, the password goes to a private 0600 passfile, psql gets -w and plain -h/-p/-U/-d argv, raw stderr stays private.
//
// The DSN is NEVER on any command line (argv is world-readable through /proc). It is read from the environment only,
// validated by the qualified scripts/local-db/assert-local-dsn.mjs (imported, unchanged, pinned), and split into:
//   argv:      -X -q -At -w -v ON_ERROR_STOP=1 -h <host> -p <port> -U <user> -d <db> -f -   (no password, no conninfo)
//   passfile:  ALWAYS a fresh 0600 file in a private 0700 dir, removed in finally: one line "host:port:db:user:password",
//              or EMPTY for a passwordless DSN, so libpq never falls back to an ambient ~/.pgpass (or a PGPASSFILE override)
// SQL arrives on stdin. stdout is returned to the caller (filtered by it); stderr is written ONLY to a private raw file.
// Errors are fixed codes: PSQL_E_*.
//
// CLI (run-journey.sh): node private-psql.mjs run <private dir> <sql file> <raw out file>
//   stdout of psql goes to <raw out file> (which must be inside the private dir). Prints nothing on success, and only
//   "run-journey refused: PSQL_E_<CODE>" on failure.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertLocalDsn, parseLibpqDsn } from '../../local-db/assert-local-dsn.mjs';

export class PsqlError extends Error {
  /** @param {string} code */
  constructor(code) { super(code); this.code = code; this.name = 'PsqlError'; }
}

const PLAIN = /^[A-Za-z0-9_.-]{1,63}$/;
const STRIP = ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT', 'PGPASSFILE', 'PGPASSWORD', 'PGUSER', 'PGDATABASE', 'PGOPTIONS', 'PGSSLMODE'];

/** The password exactly as libpq would read it, for the two grammars the shared parser accepts (it never returns it). */
function passwordOf(dsn) {
  const raw = dsn.trim();
  if (/^postgres(ql)?:\/\//i.test(raw)) {
    const m = raw.match(/^postgres(?:ql)?:\/\/([^@/?]*)@/i);
    if (!m) return null;
    const i = m[1].indexOf(':');
    if (i < 0) return null;
    try { return decodeURIComponent(m[1].slice(i + 1)); } catch { throw new PsqlError('PSQL_E_DSN'); }
  }
  const t = raw.split(/\s+/).find((x) => x.startsWith('password='));
  return t ? t.slice('password='.length) : null;
}
const passEscape = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

/**
 * Pure planning step (fakes drive it): strict in-process DSN check, then password-free argv and a passfile line.
 * @param {string|undefined} dsn @param {Record<string,string|undefined>} env
 * @returns {{ argv: string[], passLine: string, env: Record<string,string> }}
 */
export function planPsql(dsn, env = process.env) {
  const g = assertLocalDsn(String(dsn ?? ''), env);
  if (!g.ok) throw new PsqlError('PSQL_E_DSN');
  const p = parseLibpqDsn(String(dsn));
  const host = p.host, port = String(p.port ?? '5432'), db = p.database ?? 'postgres', user = p.user ?? 'postgres';
  // -d/-U values must stay plain names: psql would expand a "=" or URI value in -d into a whole conninfo.
  if (!PLAIN.test(db) || !PLAIN.test(user) || !/^\d{1,5}$/.test(port) || !(host === '127.0.0.1' || host === 'localhost' || host === '::1')) throw new PsqlError('PSQL_E_DSN_SHAPE');
  // Self-check: a password-free conninfo built from these parts must parse to the same target.
  const back = parseLibpqDsn(`host=${host} port=${port} dbname=${db} user=${user}`);
  if (!back.ok || back.host !== host || String(back.port) !== port || back.database !== db || back.user !== user) throw new PsqlError('PSQL_E_DSN_SHAPE');
  const pw = p.hasPassword ? passwordOf(String(dsn)) : null;
  if (p.hasPassword && (pw === null || /[\r\n]/.test(pw))) throw new PsqlError('PSQL_E_DSN');
  const childEnv = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && !STRIP.includes(k) && k !== 'SUPABASE_DB_URL') childEnv[k] = String(v);
  return {
    argv: ['-X', '-q', '-At', '-w', '-v', 'ON_ERROR_STOP=1', '-h', host, '-p', port, '-U', user, '-d', db, '-f', '-'],
    passLine: pw === null ? '' : `${passEscape(host)}:${port}:${passEscape(db)}:${passEscape(user)}:${passEscape(pw)}\n`,
    env: childEnv,
  };
}

/** A private 0700 dir that this process owns (not a symlink). */
function assertPrivate(dir) {
  let st;
  try { st = fs.lstatSync(dir); } catch { throw new PsqlError('PSQL_E_PRIVATE_DIR'); }
  const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
  if (st.isSymbolicLink() || !st.isDirectory() || (st.mode & 0o777) !== 0o700 || (uid >= 0 && st.uid !== uid)) throw new PsqlError('PSQL_E_PRIVATE_DIR');
  return fs.realpathSync(dir);
}

/**
 * Run one script. stdout lines are returned; stderr is appended to <privDir>/psql-stderr.log (0600) and never returned.
 * @param {{ script: string, privDir: string, dsn?: string, env?: Record<string,string|undefined>, psqlBin?: string }} o
 * @returns {Promise<string[]>}
 */
export async function runPsql(o) {
  const env = o.env ?? process.env;
  const plan = planPsql(o.dsn ?? env.SUPABASE_DB_URL, env);
  const dir = assertPrivate(o.privDir);
  let passFile = null;
  try {
    // Always an explicit private passfile (empty when passwordless): with PGPASSFILE set, libpq never reads ~/.pgpass.
    passFile = path.join(dir, `pgpass-${randomBytes(8).toString('hex')}`);
    let fd;
    try { fd = fs.openSync(passFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
    catch { passFile = null; throw new PsqlError('PSQL_E_PASSFILE'); }
    try { if (plan.passLine) fs.writeSync(fd, plan.passLine); fs.fchmodSync(fd, 0o600); } catch { throw new PsqlError('PSQL_E_PASSFILE'); } finally { fs.closeSync(fd); }
    plan.env.PGPASSFILE = passFile;
    const errLog = path.join(dir, 'psql-stderr.log');
    const { status, out, err } = await new Promise((resolve) => {
      let child;
      try { child = spawn(o.psqlBin ?? 'psql', plan.argv, { env: plan.env, stdio: ['pipe', 'pipe', 'pipe'] }); }
      catch { resolve({ status: -1, out: '', err: '' }); return; }
      const so = [], se = [];
      child.stdout.on('data', (b) => so.push(b)); child.stderr.on('data', (b) => se.push(b));
      child.on('error', () => resolve({ status: -1, out: '', err: Buffer.concat(se).toString('utf8') }));
      child.on('close', (code) => resolve({ status: code, out: Buffer.concat(so).toString('utf8'), err: Buffer.concat(se).toString('utf8') }));
      child.stdin.on('error', () => {});
      child.stdin.end(o.script);
    });
    if (err) { try { fs.appendFileSync(errLog, err, { mode: 0o600 }); } catch { /* raw diagnostics are best effort */ } }
    if (status !== 0) throw new PsqlError('PSQL_E_EXIT');
    return out.split('\n').filter(Boolean);
  } finally {
    if (passFile) { try { fs.rmSync(passFile, { force: true }); } catch { /* the private parent is removed by the runner's trap */ } }
  }
}

/** psql script input that includes one SQL file by absolute path (no quotes or spaces allowed in it). */
export function includeScript(file, vars = {}) {
  if (!/^\/[A-Za-z0-9_./-]+$/.test(file)) throw new PsqlError('PSQL_E_SCRIPT');
  let s = '';
  for (const [k, v] of Object.entries(vars)) {
    if (!/^[a-z_]+$/.test(k) || !/^[A-Za-z0-9:_-]+$/.test(v)) throw new PsqlError('PSQL_E_SCRIPT');
    s += `\\set ${k} '${v}'\n`;
  }
  return `${s}\\i ${file}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, privDir, sqlFile, outFile] = process.argv.slice(2);
  (async () => {
    if (cmd !== 'run' || !privDir || !sqlFile || !outFile) throw new PsqlError('PSQL_E_USAGE');
    const dir = assertPrivate(privDir);
    if (path.dirname(path.resolve(outFile)) !== dir) throw new PsqlError('PSQL_E_OUT_NOT_PRIVATE');
    const lines = await runPsql({ script: includeScript(path.resolve(sqlFile)), privDir: dir });
    try { fs.writeFileSync(outFile, lines.join('\n') + (lines.length ? '\n' : ''), { mode: 0o600, flag: 'wx' }); } catch { throw new PsqlError('PSQL_E_OUT_WRITE'); }
  })().then(() => process.exit(0), (e) => {
    console.log(`run-journey refused: ${e && typeof e.code === 'string' && /^PSQL_E_[A-Z_]+$/.test(e.code) ? e.code : 'PSQL_E_UNCLASSIFIED'}`);
    process.exit(3);
  });
}
