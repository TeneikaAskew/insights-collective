#!/usr/bin/env node
// ABOUTME: Password-free psql for the #159 narrow-reads tier ONLY, on the qualified private-psql planning (imported unchanged,
// ABOUTME: blob-pinned by tier.sh): DSN from the env, -X -w plain argv, private 0600 passfile, SQL on stdin, raw streams private.
//
// Why not runPsql itself: the tier must see psql's exit status AND its stdout (the OLD matrix exits 3 by design through its
// closing assertion), and runPsql throws without returning stdout on a non-zero exit. So this file reuses planPsql (the
// strict in-process DSN check, the password-free argv, the stripped env and the passfile line) and includeScript exactly,
// and repeats runPsql's passfile and spawn steps with one difference: status, stdout and stderr are each written to a
// private 0600 file instead of being thrown away. Nothing raw is ever printed.
//
// CLI (tier.sh): node nr-psql.mjs <private dir> <STAGE> check
//                node nr-psql.mjs <private dir> <STAGE> run   <sql file>
//                node nr-psql.mjs <private dir> <STAGE> apply <sql file> <apply|rollback|reapply>
//   check: only plans (DSN refusal is the TARGET category); no psql process.
//   run:   \i <file> on stdin.
//   apply: begin; \i <file>; one ledger row (step, version, sha256 of the file); commit. ON_ERROR_STOP is on in argv, so a
//          failure anywhere ends the session before commit and neither the file's changes nor its ledger row persist.
//   Writes <dir>/<STAGE>.status (psql exit code, or -1 if it could not start), <STAGE>.out and <STAGE>.err, all 0600, new.
// Exit: 0 = planned (check) or psql ran (any status, read <STAGE>.status); 2 = DSN refused; 3 = any other refusal.
// Output: nothing on 0; otherwise one line "nr-psql refused: NRP_<CODE>" on stderr.
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { includeScript, planPsql } from '../../gradebook-fixture/journey/private-psql.mjs';

export const VERSION = '20261102000000';
export const STEPS = Object.freeze(['apply', 'rollback', 'reapply']);
const STAGE_RE = /^[A-Z][A-Z0-9_]{0,39}$/;
// The job's synthetic secrets never reach the child (private-psql strips the PG* names and SUPABASE_DB_URL itself).
const SECRET_ENV = ['SUPABASE_DB_URL', 'E2E_TEST_PASSWORD', 'E2E_MEMBER_PASSWORD', 'E2E_ADMIN_PASSWORD', 'E2E_INSTRUCTOR_PASSWORD'];

export class NrPsqlError extends Error { constructor(code) { super(code); this.code = code; this.name = 'NrPsqlError'; } }

const sha256 = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** The exact stdin for a mode. Pure (fakes and tests read it). */
export function scriptFor(mode, file, step) {
  if (mode === 'run') return includeScript(file);
  if (mode !== 'apply' || !STEPS.includes(step)) throw new NrPsqlError('NRP_E_USAGE');
  const s = includeScript(file, { nr_step: step, nr_version: VERSION, nr_sha: sha256(file) });
  const i = s.lastIndexOf('\\i ');
  return `${s.slice(0, i)}begin;\n${s.slice(i)}`
    + "insert into local_evidence.narrow_reads_applied (step, version, sha256) values (:'nr_step', :'nr_version', :'nr_sha');\n"
    + 'commit;\n';
}

function assertPrivate(dir) {
  let st;
  try { st = fs.lstatSync(dir); } catch { throw new NrPsqlError('NRP_E_PRIVATE_DIR'); }
  const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
  if (st.isSymbolicLink() || !st.isDirectory() || (st.mode & 0o777) !== 0o700 || (uid >= 0 && st.uid !== uid)) throw new NrPsqlError('NRP_E_PRIVATE_DIR');
  return fs.realpathSync(dir);
}
const writeNew = (f, s) => fs.writeFileSync(f, s, { mode: 0o600, flag: 'wx' });

export async function main(argv, env = process.env) {
  const [priv, stage, mode, file, step] = argv;
  const want = mode === 'check' ? 3 : mode === 'run' ? 4 : mode === 'apply' ? 5 : -1;
  if (argv.length !== want || !STAGE_RE.test(stage ?? '')) throw new NrPsqlError('NRP_E_USAGE');
  const dir = assertPrivate(priv);
  const childBase = {}; for (const [k, v] of Object.entries(env)) if (!SECRET_ENV.includes(k)) childBase[k] = v;
  let plan;
  try { plan = planPsql(env.SUPABASE_DB_URL, childBase); }
  catch (e) { throw new NrPsqlError(e && /^PSQL_E_DSN/.test(String(e.code)) ? 'NRP_E_TARGET' : 'NRP_E_PLAN'); }
  if (mode === 'check') return;
  const abs = path.resolve(file);
  let fst; try { fst = fs.lstatSync(abs); } catch { throw new NrPsqlError('NRP_E_SQL_FILE'); }
  if (!fst.isFile() || fst.isSymbolicLink()) throw new NrPsqlError('NRP_E_SQL_FILE');
  let script;
  try { script = scriptFor(mode, abs, step); } catch (e) { throw new NrPsqlError(e instanceof NrPsqlError ? e.code : 'NRP_E_SCRIPT'); }
  const base = path.join(dir, stage);
  for (const s of ['.status', '.out', '.err']) if (fs.existsSync(base + s)) throw new NrPsqlError('NRP_E_STAGE_REUSED');

  let passFile = null;
  try {
    // As runPsql: ALWAYS a fresh private passfile (empty when passwordless), so libpq never reads an ambient ~/.pgpass.
    passFile = path.join(dir, `pgpass-${randomBytes(8).toString('hex')}`);
    let fd;
    try { fd = fs.openSync(passFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
    catch { passFile = null; throw new NrPsqlError('NRP_E_PASSFILE'); }
    try { if (plan.passLine) fs.writeSync(fd, plan.passLine); fs.fchmodSync(fd, 0o600); } catch { throw new NrPsqlError('NRP_E_PASSFILE'); } finally { fs.closeSync(fd); }
    // HOME is the private dir too: with -X no psqlrc is read, and nothing ambient under the real HOME is consulted.
    const childEnv = { ...plan.env, PGPASSFILE: passFile, HOME: dir };
    const { status, out, err } = await new Promise((resolve) => {
      let child;
      try { child = spawn('psql', plan.argv, { env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] }); }
      catch { resolve({ status: -1, out: '', err: '' }); return; }
      const so = [], se = [];
      child.stdout.on('data', (b) => so.push(b)); child.stderr.on('data', (b) => se.push(b));
      child.on('error', () => resolve({ status: -1, out: Buffer.concat(so).toString('utf8'), err: Buffer.concat(se).toString('utf8') }));
      child.on('close', (code) => resolve({ status: code === null ? -1 : code, out: Buffer.concat(so).toString('utf8'), err: Buffer.concat(se).toString('utf8') }));
      child.stdin.on('error', () => {});
      child.stdin.end(script);
    });
    try { writeNew(`${base}.out`, out); writeNew(`${base}.err`, err); writeNew(`${base}.status`, `${status}\n`); }
    catch { throw new NrPsqlError('NRP_E_WRITE'); }
  } finally {
    if (passFile) { try { fs.rmSync(passFile, { force: true }); } catch { /* the private parent is removed by tier.sh's trap */ } }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then(() => process.exit(0), (e) => {
    const code = e instanceof NrPsqlError && /^NRP_E_[A-Z_]+$/.test(e.code) ? e.code : 'NRP_E_UNCLASSIFIED';
    console.error(`nr-psql refused: ${code}`);
    process.exit(code === 'NRP_E_TARGET' ? 2 : 3);
  });
}
