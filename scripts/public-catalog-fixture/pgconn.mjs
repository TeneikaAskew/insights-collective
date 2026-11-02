// ABOUTME: Canonical password-free DSN plus a private pgpass file for psql -w. The password never appears in argv, env or output.
// ABOUTME: `node pgconn.mjs check` validates both and prints only a fixed code; run.sh then calls psql with the canonical DSN.
import { readPrivateFile } from './private-file.mjs';

const LOOP = new Set(['127.0.0.1', 'localhost', '[::1]']);
export const DB = { DSN: 'PUBLIC_CATALOG_E_DB_DSN', PASSFILE: 'PUBLIC_CATALOG_E_DB_PASSFILE', ENV: 'PUBLIC_CATALOG_E_DB_ENV' };

/** postgresql://USER@LOOPBACK:PORT/DB exactly: no password, no query, no fragment. */
export function canonicalDsn(raw) {
  let u; try { u = new URL(String(raw ?? '')); } catch { return { error: `${DB.DSN}: not a URL` }; }
  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') return { error: `${DB.DSN}: scheme` };
  if (u.password) return { error: `${DB.DSN}: the DSN must not carry a password (use PUBLIC_ACCEPT_DB_PASSFILE)` };
  if (!/^[a-z_][a-z0-9_]*$/.test(u.username) || !LOOP.has(u.hostname) || !/^\d+$/.test(u.port)) return { error: `${DB.DSN}: user@loopback:port required` };
  if (u.search || u.hash || !/^\/[a-z_][a-z0-9_]*$/.test(u.pathname)) return { error: `${DB.DSN}: bare /database only` };
  return { dsn: `postgresql://${u.username}@${u.hostname}:${u.port}${u.pathname}` };
}

export function checkDb(env = process.env, uid = process.getuid()) {
  const errors = [];
  for (const k of ['PGPASSWORD', 'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGUSER', 'PGDATABASE']) {
    if (k in env) errors.push(`${DB.ENV}: ${k} must be unset (the canonical DSN and passfile are the only inputs)`);
  }
  const c = canonicalDsn(env.PUBLIC_ACCEPT_DB_URL); if (c.error) errors.push(c.error);
  else if (c.dsn !== env.PUBLIC_ACCEPT_DB_URL) errors.push(`${DB.DSN}: PUBLIC_ACCEPT_DB_URL must already be canonical`);
  const f = env.PUBLIC_ACCEPT_DB_PASSFILE;
  if (!f) errors.push(`${DB.PASSFILE}: unset`);
  else {
    const r = readPrivateFile(f, { max: 4096, privateMode: true, uid });
    if (r.error) errors.push(`${DB.PASSFILE}: ${r.error}`);
    else if (!/^[^\n]+\n?$/.test(r.buf.toString('utf8'))) errors.push(`${DB.PASSFILE}: must hold exactly one pgpass line`);
    r.buf?.fill(0);
  }
  return errors;
}

if (process.argv[1]?.endsWith('pgconn.mjs') && process.argv[2] === 'check') {
  const e = checkDb(); if (e.length) { for (const x of e) console.error(x.split(':')[0]); process.exit(2); }
  console.log('PUBLIC_CATALOG_DB_OK');
}
