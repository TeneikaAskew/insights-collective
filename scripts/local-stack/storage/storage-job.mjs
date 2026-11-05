#!/usr/bin/env node
// ABOUTME: gradebook-journey job entry for the Storage composition: s0 private input, s1 preflight, s2 mirror, s3 verify,
// ABOUTME: s4 probes. All SQL goes through the qualified private-psql route (DSN from the environment, 0600 passfile).
//
// CLI: storage-job.mjs s0 <priv dir>                     private input -> private pins.tsv + mirror.sql (no DSN, no psql)
//      storage-job.mjs s1 <priv dir>                     capture STOCK; S1 preconditions vs LIVE pins     (read-only)
//      storage-job.mjs s2 <priv dir>                     apply the private mirror in one transaction (sha256 pinned)
//      storage-job.mjs s3 <priv dir>                     capture; compare with STOCK(s1) + LIVE policies and limits (read-only)
//      storage-job.mjs s4 <priv dir> <run id> <attempt>  each probe rolls back; after EACH: residue 0 and the S3 catalog again
// <priv dir> must be an existing private 0700 directory owned by the job (checked before any read or write in it). s0 is
// the ONLY mode that reads the private input (env STORAGE_METADATA_JSON, bound to that one workflow step); every other
// mode refuses if the variable is present. s0 checks the input's byte length and sha256, converts it in memory, and
// writes pins.tsv and mirror.sql at 0600 (O_EXCL|O_NOFOLLOW) only after both equal the reviewed digests; the input itself
// is never written. S1 to S4 read those two files through readPrivate and re-verify both digests. The S1 capture is kept
// there for S3/S4 and removed with it. Prints fixed lines only (digests and PASS/FAIL, never a policy name, predicate,
// limit or count from the input); failure prints "storage-job refused: <CODE>" and exits 3.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPsql, includeScript } from '../../gradebook-fixture/journey/private-psql.mjs';
import { StorageError, parsePins, stockPreconditions, expectedAfterMirror, compareInventory, residueSql, residueVerdict, probePrefix } from './storage-core.mjs';
import { build, LIVE_PINS_SHA256, MIRROR_SHA256 } from './gen-mirror.mjs';
import { convert, SOURCE_SHA256, SOURCE_BYTES } from './live-pins.mjs';
import { probeScripts, probeVerdict, PROBE_PINS_SHA256 } from './probes.mjs';
import { readHandle } from '../../gradebook-fixture/journey/shot-export.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CAPTURE_SQL = path.join(HERE, 'capture.sql');
export const INPUT_ENV = 'STORAGE_METADATA_JSON';
export const PINS_FILE = 'pins.tsv';
export const MIRROR_FILE = 'mirror.sql';
/** Reviewed digests (public). Injectable only so the selftest can run on a synthetic input. */
export const PINNED = Object.freeze({ sourceSha: SOURCE_SHA256, sourceBytes: SOURCE_BYTES, pinsSha: LIVE_PINS_SHA256, mirrorSha: MIRROR_SHA256 });
export const EGRESS_VERIFY_SQL = path.resolve(HERE, '..', 't09', 'egress-verify.sql');
export const IDENTITIES_SQL = path.resolve(HERE, '..', '..', 'local-db', 'identities.sql');
const SECRET_ENV = ['STORAGE_METADATA_JSON', 'SUPABASE_DB_URL', 'E2E_TEST_PASSWORD', 'E2E_MEMBER_PASSWORD', 'E2E_ADMIN_PASSWORD', 'E2E_INSTRUCTOR_PASSWORD'];
const refuse = (c) => { throw new StorageError(c); };
const sha = (b) => createHash('sha256').update(b).digest('hex');

export const MAX_PRIVATE_READ = 1024 * 1024;

/** The private dir: an existing 0700 directory this process owns, not a symlink. Checked before any read or write in it. */
export function assertPrivateDir(dir) {
  let st;
  try { st = fs.lstatSync(dir); } catch { refuse('ST_E_PRIVATE_DIR'); }
  const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
  if (st.isSymbolicLink() || !st.isDirectory() || (st.mode & 0o777) !== 0o700 || (uid >= 0 && st.uid !== uid)) refuse('ST_E_PRIVATE_DIR');
  return fs.realpathSync(dir);
}

/**
 * A private child file, read through the qualified shot-export readHandle (imported unchanged): one O_NOFOLLOW|O_NONBLOCK
 * handle; same-fd regular file, this uid, exact 0600, 1..MAX bytes, bounded read, growth refused. Codes map to ST_E_PRIVATE_*.
 */
export function readPrivate(dir, name, io) {
  try { return readHandle(path.join(dir, name), MAX_PRIVATE_READ, io ? { io } : {}).toString('utf8'); }
  catch (e) { refuse(`ST_E_PRIVATE_${e && typeof e.code === 'string' && /^SHOT_E_[A-Z]+$/.test(e.code) ? e.code.slice(7) : 'READ'}`); }
}

function childEnv(env) { const e = {}; for (const [k, v] of Object.entries(env)) if (!SECRET_ENV.includes(k)) e[k] = v; return e; }

/** Writes one new private file: O_EXCL|O_NOFOLLOW, exact 0600, in the already validated private dir. */
function writePrivate(dir, name, text) {
  let fd;
  try { fd = fs.openSync(path.join(dir, name), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
  catch { refuse('ST_E_PRIVATE_WRITE'); }
  try { fs.writeSync(fd, text); fs.fchmodSync(fd, 0o600); } catch { refuse('ST_E_PRIVATE_WRITE'); } finally { fs.closeSync(fd); }
}

/** s0: the private input to private pins and mirror. Nothing derived from the input is printed except the three digests. */
export function s0(dir, env, pinned = PINNED) {
  const raw = env[INPUT_ENV];
  if (typeof raw !== 'string' || raw.length === 0) refuse('ST_E_INPUT_ABSENT');
  const buf = Buffer.from(raw, 'utf8');
  const { text } = convert(buf, { expectSha: pinned.sourceSha, expectBytes: pinned.sourceBytes }); // bytes, sha, shape
  const r = build(text, pinned); // pins sha, mirror shape and mirror sha
  writePrivate(dir, PINS_FILE, text);
  writePrivate(dir, MIRROR_FILE, r.sql);
  return `S0 PASS input sha256 ${pinned.sourceSha} bytes verified; pins sha256 ${pinned.pinsSha}; mirror sha256 ${pinned.mirrorSha} (both private 0600; input not written)`;
}

/** Pinned inputs from the private dir: pins and mirror re-read through readPrivate, both digests re-verified, probes bound. */
export function loadPinned(dir, pinned = PINNED) {
  if (PROBE_PINS_SHA256 !== LIVE_PINS_SHA256) refuse('ST_E_PROBE_PINS');
  const text = readPrivate(dir, PINS_FILE);
  const r = build(text, pinned); // refuses unless the pins and the regenerated mirror equal the reviewed digests
  if (readPrivate(dir, MIRROR_FILE) !== r.sql) refuse('ST_E_GENERATED_DRIFT');
  return { live: r.live, mirrorSql: r.sql, mirrorSha: pinned.mirrorSha };
}

export async function main(argv, env = process.env, out = (l) => console.log(l), psql = runPsql, pinned = PINNED) {
  const [cmd, priv, runId, attempt] = argv;
  const want = { s0: 2, s1: 2, s2: 2, s3: 2, s4: 4 }[cmd];
  if (!want || argv.length !== want || !priv) refuse('ST_E_USAGE');
  if (cmd === 's0') { out(s0(assertPrivateDir(priv), env, pinned)); return; }
  if (Object.prototype.hasOwnProperty.call(env, INPUT_ENV)) refuse('ST_E_INPUT_SCOPE'); // the input is bound to s0 only
  const dsn = env.SUPABASE_DB_URL;
  if (!dsn) refuse('ST_E_DSN');
  const dir = assertPrivateDir(priv); // parent validated first, before any read, write or psql call
  const run = async (script) => {
    try { return await psql({ script, privDir: priv, dsn, env: childEnv(env), psqlBin: env.GB_JOB_PSQL_BIN || undefined }); }
    catch (e) { refuse(e && typeof e.code === 'string' && /^PSQL_E_[A-Z_]+$/.test(e.code) ? `ST_${e.code}` : 'ST_E_PSQL'); }
  };
  const capture = async () => parsePins(`${(await run(includeScript(CAPTURE_SQL))).join('\n')}\n`);
  const STOCK = 'storage-s1-stock.tsv', IDS = 'storage-s1-public-identities.txt';
  const stockFile = path.join(dir, STOCK);
  const idsFile = path.join(dir, IDS);
  const publicIds = async () => `${(await run(includeScript(IDENTITIES_SQL))).sort().join('\n')}\n`;
  const { live, mirrorSql, mirrorSha } = loadPinned(dir, pinned);

  if (cmd === 's1') {
    const lines = await run(includeScript(CAPTURE_SQL));
    const text = `${lines.join('\n')}\n`;
    const stock = parsePins(text);
    out(stockPreconditions(live, stock));
    const ids = await publicIds();
    fs.writeFileSync(stockFile, text, { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(idsFile, ids, { mode: 0o600, flag: 'wx' });
    out(`S1 stock capture sha256 ${sha(text)}; public identities n=${ids.trimEnd().split('\n').length} sha256 ${sha(ids)} (both kept private for S3/S4); live pins sha256 ${pinned.pinsSha}`);
    return;
  }
  const stock = parsePins(readPrivate(dir, STOCK));
  const expected = expectedAfterMirror(live, stock);
  if (cmd === 's2') {
    stockPreconditions(live, await capture()); // re-checked immediately before the write
    await run(mirrorSql); // the verified text itself (sent on stdin), not a re-read of the file
    out(`S2 PASS mirror sha256 ${mirrorSha} applied in one transaction (course bucket limits=3)`);
    await run(includeScript(EGRESS_VERIFY_SQL, { stage: 'app' })); // read-only; raises on any deviation
    out('S2 PRE guard re-verified (egress-verify stage=app) PASS');
    return;
  }
  if (cmd === 's3') {
    const idsBefore = readPrivate(dir, IDS); // both private reads happen before any psql call of this step
    const r = compareInventory(expected, await capture());
    out(`S3 ${r.line}`);
    if (!r.pass) refuse('ST_E_S3');
    const same = (await publicIds()) === idsBefore;
    out(`S3 public identities ${same ? 'UNCHANGED PASS' : 'CHANGED FAIL'}`);
    if (!same) refuse('ST_E_S3_PUBLIC');
    return;
  }
  // s4
  const prefix = probePrefix(runId, attempt);
  let fails = 0;
  for (const p of probeScripts(runId, attempt, live)) {
    let lines;
    try { lines = await run(p.script); } catch { lines = null; }
    const v = probeVerdict(p, lines);
    out(v.line);
    if (!v.ok) fails++;
    out(`S4 ${p.id} ${residueVerdict(await run(residueSql(prefix)))}`);
    const c = compareInventory(expected, await capture());
    out(`S4 ${p.id} CATALOG ${c.line}`);
    if (!c.pass) refuse('ST_E_S4_CATALOG');
  }
  out(`S4 ${fails === 0 ? 'PASS' : 'FAIL'} cases=8 failed=${fails} (policy behaviour on this stack only; residue counted in storage.objects only; the HTTP 400 cause stays unproven)`);
  if (fails) refuse('ST_E_S4');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then(() => process.exit(0), (e) => {
    console.error(`storage-job refused: ${e instanceof StorageError ? e.code : 'ST_E_UNCLASSIFIED'}`);
    process.exit(e instanceof StorageError && e.code === 'ST_E_USAGE' ? 2 : 3);
  });
}
