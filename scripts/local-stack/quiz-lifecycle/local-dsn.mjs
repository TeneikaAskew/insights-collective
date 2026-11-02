#!/usr/bin/env node
// ABOUTME: Strict local DSN handling for the quiz lifecycle tooling: assert-local-dsn first, then a URI-only, canonical
// ABOUTME: split into a password-free connection URI (safe for argv) and the password (for PGPASSWORD, never argv).
//
// Usage (bash):  printf '%s' "$DSN" | node local-dsn.mjs split          -> line 1: password-free URI, line 2: password
//                printf '%s' "$DSN" | node local-dsn.mjs derive <db>    -> same, for database <db>; the input must be a
//                                                                         canonical maintenance URI (database "postgres")
// The DSN is read from STDIN only, so it never appears in this process's argv.
// Exit 0 on success, 2 on refusal (reason on stderr; the DSN and password are never printed in a refusal).
// Importable: splitLocalDsn(dsn, env), deriveScratch(maintenanceDsn, db, env).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDsn } from '../../local-db/assert-local-dsn.mjs';

const NAME = /^[a-z_][a-z0-9_]{0,62}$/;          // PostgreSQL identifier we create or read, lower-case, unquoted-safe
const USER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const HOSTS = new Set(['127.0.0.1', 'localhost']);

export function splitLocalDsn(dsn, env = process.env) {
  if (typeof dsn !== 'string' || !dsn) return { ok: false, reason: 'DSN is empty' };
  const a = assertLocalDsn(dsn, env);
  if (!a.ok) return { ok: false, reason: `assert-local-dsn refused: ${a.reason}` };
  if (!/^postgres(ql)?:\/\//.test(dsn)) return { ok: false, reason: 'only the URI form is accepted here' };
  let u;
  try { u = new URL(dsn); } catch { return { ok: false, reason: 'URI does not parse' }; }
  if (u.search || u.hash) return { ok: false, reason: 'URI query or fragment is refused' };
  if (!HOSTS.has(u.hostname)) return { ok: false, reason: 'host is not 127.0.0.1 or localhost' };
  if (!/^[0-9]{1,5}$/.test(u.port)) return { ok: false, reason: 'an explicit numeric port is required' };
  const user = decodeURIComponent(u.username);
  const db = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!USER.test(user)) return { ok: false, reason: 'user name is not a plain identifier' };
  if (!NAME.test(db)) return { ok: false, reason: 'database name is not a plain identifier' };
  // Cross-check: the strict libpq parser and the URL parser must agree on the endpoint.
  if (a.host !== u.hostname || String(a.port) !== u.port || a.database !== db || a.user !== user) {
    return { ok: false, reason: 'parsers disagree about the endpoint' };
  }
  return { ok: true, host: u.hostname, port: u.port, user, db, password: decodeURIComponent(u.password),
           uri: `postgresql://${user}@${u.hostname}:${u.port}/${db}` };
}

export function deriveScratch(maintenanceDsn, db, env = process.env) {
  const s = splitLocalDsn(maintenanceDsn, env);
  if (!s.ok) return s;
  if (s.db !== 'postgres') return { ok: false, reason: 'maintenance DSN must name database "postgres"' };
  if (!NAME.test(db || '')) return { ok: false, reason: 'derived database name is not a plain identifier' };
  return { ...s, db, uri: `postgresql://${s.user}@${s.host}:${s.port}/${db}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, db] = process.argv.slice(2);
  let input = '';
  try { input = readFileSync(0, 'utf8'); } catch { input = ''; }
  const r = mode === 'split' && db === undefined ? splitLocalDsn(input)
    : mode === 'derive' ? deriveScratch(input, db) : { ok: false, reason: 'usage' };
  if (!r.ok) { process.stderr.write(`local-dsn refused: ${r.reason}\n`); process.exit(2); }
  process.stdout.write(`${r.uri}\n${r.password}\n`);
}
