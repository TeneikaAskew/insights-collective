#!/usr/bin/env node
// ABOUTME: Password-free psql entry for the gradebook-journey JOB's own callers (D1 sysid read, local-preseed, seed-auth),
// ABOUTME: routed through the qualified scripts/gradebook-fixture/journey/private-psql.mjs (imported unchanged, blob-pinned).
//
// Why: these job steps used to put the full DSN on psql's argv and seed-auth put the synthetic password on `psql -v`
// argv; argv is world-readable through /proc, and raw psql stderr went to the step log. Here:
//   - the DSN comes from SUPABASE_DB_URL in the environment only (strictly checked in-process by the pinned shared parser);
//   - psql gets -X -q -At -w and plain -h/-p/-U/-d argv; the password goes to a fresh 0600 passfile in the private dir
//     (an empty one when passwordless, so libpq never reads ~/.pgpass), removed after the call;
//   - SQL, and the seed-auth password, arrive on stdin; the child env has neither SUPABASE_DB_URL nor E2E_TEST_PASSWORD;
//   - psql stdout and stderr are kept in the private 0700 dir only. Nothing raw is printed: success prints one fixed line,
//     failure prints only "gb-job-psql refused: <CODE>" on stderr (stdout may be a pipe) and exits 3 (usage 2).
// The SQL files are the frozen ones (local-preseed.sql, auth-fixtures.sql), included by absolute path, byte-unchanged.
//
// CLI:  gb-job-psql.mjs sysid     <private dir>   -> stdout: exactly the cluster's system_identifier digits, one line
//       gb-job-psql.mjs preseed   <private dir>   -> applies scripts/local-db/local-preseed.sql
//       gb-job-psql.mjs seed-auth <private dir>   -> applies scripts/local-stack/auth-fixtures.sql with e2e.password bridged
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { includeScript, runPsql } from '../gradebook-fixture/journey/private-psql.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PRESEED = path.join(ROOT, 'scripts/local-db/local-preseed.sql');
export const AUTH_SQL = path.join(ROOT, 'scripts/local-stack/auth-fixtures.sql');
const SECRET_ENV = ['SUPABASE_DB_URL', 'E2E_TEST_PASSWORD', 'E2E_MEMBER_PASSWORD', 'E2E_ADMIN_PASSWORD', 'E2E_INSTRUCTOR_PASSWORD'];

export class JobPsqlError extends Error { constructor(code) { super(code); this.code = code; } }

/** psql `\set` value: single-quoted, with backslash and quote escaped as psql documents. No line breaks or NUL. */
export function psqlQuote(v) {
  if (typeof v !== 'string' || v.length === 0 || /[\r\n\0]/.test(v)) throw new JobPsqlError('GBP_E_SECRET');
  return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/** The exact stdin for seed-auth: the password variable, the unchanged seed-auth.sh preamble, then the frozen file. */
export function seedAuthScript(password, src = AUTH_SQL) {
  return `\\set e2e_password ${psqlQuote(password)}\n`
    + "select set_config('e2e.password', :'e2e_password', false) is not null as e2e_password_bridged \\gset\n"
    + includeScript(src);
}

const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function readable(f) {
  let st; try { st = fs.statSync(f); } catch { return false; }
  try { fs.accessSync(f, fs.constants.R_OK); } catch { return false; }
  return st.isFile() && st.size > 0;
}
/** Child env: the parent env minus every secret-bearing name (private-psql strips the PG* names and the DSN itself). */
function childEnv(env) {
  const e = {}; for (const [k, v] of Object.entries(env)) if (!SECRET_ENV.includes(k)) e[k] = v; return e;
}

export async function main(argv, env = process.env, out = (l) => console.log(l)) {
  const [cmd, priv] = argv;
  if (!['sysid', 'preseed', 'seed-auth'].includes(cmd) || !priv || argv.length !== 2) throw new JobPsqlError('GBP_E_USAGE');
  const dsn = env.SUPABASE_DB_URL;
  if (!dsn) throw new JobPsqlError('GBP_E_DSN');
  const run = async (script) => {
    try { return await runPsql({ script, privDir: priv, dsn, env: childEnv(env), psqlBin: env.GB_JOB_PSQL_BIN || undefined }); }
    catch (e) { throw new JobPsqlError(e && typeof e.code === 'string' && /^PSQL_E_[A-Z_]+$/.test(e.code) ? `GBP_${e.code}` : 'GBP_E_PSQL'); }
  };
  if (cmd === 'sysid') {
    const lines = await run('select system_identifier from pg_control_system();\n');
    if (lines.length !== 1 || !/^\d{1,20}$/.test(lines[0])) throw new JobPsqlError('GBP_E_SYSID');
    out(lines[0]);
    return;
  }
  if (cmd === 'preseed') {
    if (!readable(PRESEED)) throw new JobPsqlError('GBP_E_SQL_FILE');
    await run(includeScript(PRESEED));
    out(`gb-job-psql: applied scripts/local-db/local-preseed.sql sha256 ${sha(PRESEED)} (psql output kept private)`);
    return;
  }
  // seed-auth: the same preconditions as scripts/local-stack/seed-auth.sh (its target guard runs in the job step first).
  if (!env.E2E_TEST_PASSWORD) throw new JobPsqlError('GBP_E_SECRET');
  if (!readable(AUTH_SQL)) throw new JobPsqlError('GBP_E_SQL_FILE');
  await run(seedAuthScript(env.E2E_TEST_PASSWORD));
  out(`gb-job-psql: applied scripts/local-stack/auth-fixtures.sql sha256 ${sha(AUTH_SQL)} with e2e.password bridged on stdin (psql output kept private)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then(() => process.exit(0), (e) => {
    const code = e instanceof JobPsqlError ? e.code : 'GBP_E_UNCLASSIFIED';
    console.error(`gb-job-psql refused: ${code}`);
    process.exit(code === 'GBP_E_USAGE' ? 2 : 3);
  });
}
