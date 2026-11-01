#!/usr/bin/env node
// ABOUTME: Password-free database connection rule for the lesson-editor lane: the DSN in argv carries no secret, and the password
// ABOUTME: reaches psql only through a private 0600 passfile named in the CHILD environment. External PGPASSWORD is refused.
//
// Accepted DSN, exactly: postgresql://<user>@<loopback host>:<port>/<db>   (no password, no query, one host, explicit port).
// It must also pass the shared strict parser scripts/local-db/assert-local-dsn.mjs.
// Password: env LE_DB_PASSWORD_FILE, a regular non-symlink file with no group/other permission bits, one line. When it is
// unset (a trust-auth throwaway cluster) the child still gets an EMPTY private passfile, so ~/.pgpass is never consulted.
//
//   pgconn.mjs check <dsn>                 exit 0 or 1 with a fixed reason (the DSN is never echoed)
//   pgconn.mjs passfile <dsn> <out file>   writes the libpq passfile for exactly this host:port:db:user, mode 0600
// Importable: checkDsn(dsn) -> { ok, reason, parts }, childEnv(passfile) -> env for a psql child.
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDsn } from '../../local-db/assert-local-dsn.mjs';

const LIBPQ_ENV = ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT', 'PGPASSFILE', 'PGPASSWORD', 'PGUSER', 'PGDATABASE'];
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

export function checkDsn(dsn) {
  if (typeof dsn !== 'string' || !/^postgresql:\/\//.test(dsn)) return { ok: false, reason: 'DSN must be a postgresql:// URI' };
  let u;
  try {
    u = new URL(dsn);
  } catch {
    return { ok: false, reason: 'DSN does not parse' };
  }
  if (u.password !== '' || /:[^@/]*@/.test(dsn.slice('postgresql://'.length).split('/')[0])) return { ok: false, reason: 'DSN carries a password (use LE_DB_PASSWORD_FILE)' };
  if (u.search || u.hash) return { ok: false, reason: 'DSN query parameters are refused' };
  if (!u.port) return { ok: false, reason: 'DSN needs an explicit port' };
  const user = decodeURIComponent(u.username);
  const db = decodeURIComponent(u.pathname.slice(1));
  if (!NAME.test(user) || !NAME.test(db)) return { ok: false, reason: 'DSN user and database must be plain names' };
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return { ok: false, reason: 'database is not loopback' };
  const canonical = `postgresql://${user}@${u.hostname}:${u.port}/${db}`;
  if (canonical !== dsn) return { ok: false, reason: 'DSN is not in canonical form' };
  const shared = assertLocalDsn(dsn, {});
  if (!shared.ok) return { ok: false, reason: 'database is not loopback' };
  return { ok: true, reason: '', parts: { host: u.hostname.replace(/^\[|\]$/g, ''), port: u.port, db, user } };
}

/** Reads the password file with the private-file rule; never returns or throws its content. */
function readPassword(file) {
  if (!path.isAbsolute(file)) throw new Error('LE_DB_PASSWORD_FILE must be an absolute path');
  const l = lstatSync(file, { throwIfNoEntry: false });
  if (!l || !l.isFile() || l.isSymbolicLink()) throw new Error('LE_DB_PASSWORD_FILE must be a regular file');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if ((st.mode & 0o077) !== 0) throw new Error('LE_DB_PASSWORD_FILE must not be readable by group or others (mode 600)');
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) throw new Error('LE_DB_PASSWORD_FILE must be owned by this user');
    const pw = readFileSync(fd, 'utf8').replace(/\r?\n$/, '');
    if (!pw || /[\r\n]/.test(pw)) throw new Error('LE_DB_PASSWORD_FILE must hold exactly one non-empty line');
    return pw;
  } finally {
    closeSync(fd);
  }
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

export function writePassfile(dsn, out, env = process.env) {
  if ('PGPASSWORD' in env) throw new Error('an external PGPASSWORD is refused; use LE_DB_PASSWORD_FILE (mode 600)');
  const c = checkDsn(dsn);
  if (!c.ok) throw new Error(c.reason);
  const line = env.LE_DB_PASSWORD_FILE
    ? `${esc(c.parts.host)}:${c.parts.port}:${esc(c.parts.db)}:${esc(c.parts.user)}:${esc(readPassword(env.LE_DB_PASSWORD_FILE))}\n`
    : '';
  writeFileSync(out, line, { mode: 0o600, flag: 'wx' });
}

/** Environment for a psql child: libpq overrides and any PGPASSWORD removed; the private passfile is the only secret path. */
export function childEnv(passfile, env = process.env) {
  const out = { ...env };
  for (const k of LIBPQ_ENV) delete out[k];
  out.PGPASSFILE = passfile;
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dsn, out] = process.argv.slice(2);
  try {
    if (cmd === 'check') {
      if ('PGPASSWORD' in process.env) throw new Error('an external PGPASSWORD is refused; use LE_DB_PASSWORD_FILE (mode 600)');
      const c = checkDsn(dsn);
      if (!c.ok) throw new Error(c.reason);
    } else if (cmd === 'passfile' && out) {
      writePassfile(dsn, out);
    } else {
      console.log('usage: pgconn.mjs check <dsn> | passfile <dsn> <out file>');
      process.exit(2);
    }
  } catch (e) {
    // Every message above is a fixed string of this module; anything else (an fs error) is reported generically.
    const fixed = e instanceof Error && /^(DSN |database is not loopback|LE_DB_PASSWORD_FILE |an external PGPASSWORD)/.test(e.message);
    console.log(`FAIL le-pgconn: ${fixed ? e.message : 'connection setup failed (detail withheld)'}`);
    process.exit(1);
  }
}
