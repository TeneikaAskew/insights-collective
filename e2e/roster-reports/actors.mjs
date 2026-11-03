// ABOUTME: The three shared local actors (scripts/local-db/local-preseed.sql) and the ONE telemetry sink the request policy
// ABOUTME: writes to. The sink is a file-write writer kept at this path for review; security.yml's fs-write gate flags it.
//
// Sink contract (every rule below is checked on each append; any failure throws one fixed RR_SINK_E_* code):
//   path    exactly <RR_SESSION_DIR>/policy.jsonl, where RR_SESSION_DIR is absolute and physical (realpath equals itself),
//           named .../rr-run.XXXXXXXXXX/session (run.sh's mktemp shape), and both it and its rr-run parent are real
//           directories (not links), owned by this uid, mode 0700. No env var names the file itself.
//   file    pre-created EMPTY by run.sh (0600). The sink never creates, truncates, renames or removes it: it opens with
//           O_WRONLY|O_APPEND|O_NOFOLLOW|O_NONBLOCK and no O_CREAT, then checks THAT SAME descriptor (fstat): regular file,
//           mode 0600, owned by this uid, nlink 1, size + line <= MAX_BYTES. The line is appended through the same fd,
//           and the fd is always closed. Pattern reused from scripts/e2e/stack-ownership.mjs readRecord (same-descriptor
//           open with O_NOFOLLOW|O_NONBLOCK, fstat on that fd, type/mode/owner/size checks, always close), write side.
//   record  exactly {"rpc","actor","status"}; each value must be an OWN key of a null-prototype enum map (Object.hasOwn),
//           so 'constructor', 'toString', '__proto__' and every other inherited name are refused.
//   cleanup the sink removes nothing; run.sh deletes the whole private parent after the witness, verifies absence
//           (rr-private.txt), keeps its EXIT trap, and the job's always() step removes rr-run.?????????? again.
import fs from 'node:fs';
import path from 'node:path';

const enumOf = (...names) => Object.freeze(Object.assign(Object.create(null), Object.fromEntries(names.map((n) => [n, true]))));
export const RPCS = enumOf('log_security_event');
export const ACTORS = enumOf('admin', 'instructor', 'member', 'unknown');
export const STATUSES = enumOf('success', 'failed', 'pending');
export const SINK_BASENAME = 'policy.jsonl';
export const MAX_BYTES = 256 * 1024;
export const SINK_CODES = Object.freeze(['RR_SINK_E_RECORD', 'RR_SINK_E_ROOT', 'RR_SINK_E_OPEN', 'RR_SINK_E_FILE', 'RR_SINK_E_SIZE', 'RR_SINK_E_WRITE']);

const ACTOR_IDS = Object.freeze(Object.assign(Object.create(null), {
  'e2e00000-0000-4000-8000-000000000001': 'admin',
  'e2e00000-0000-4000-8000-000000000002': 'instructor',
  'e2e00000-0000-4000-8000-000000000003': 'member',
}));
export const actorOf = (id) => (typeof id === 'string' && Object.hasOwn(ACTOR_IDS, id) ? ACTOR_IDS[id] : 'unknown');

const fail = (code) => { throw new Error(code); };
const isEnum = (map, v) => typeof v === 'string' && Object.hasOwn(map, v);
const uidOk = (st) => typeof process.getuid !== 'function' || st.uid === process.getuid();
const privateDir = (d) => {
  let st;
  try { st = fs.lstatSync(d); } catch { return false; }
  return st.isDirectory() && !st.isSymbolicLink() && (st.mode & 0o777) === 0o700 && uidOk(st);
};

/** The one sink path, or a fixed RR_SINK_E_ROOT. Exported for setup and the selftest; nothing else names the file. */
export function sinkPath(env = process.env) {
  const d = env.RR_SESSION_DIR;
  if (typeof d !== 'string' || !path.isAbsolute(d) || path.basename(d) !== 'session' || !/^rr-run\.[A-Za-z0-9]{10}$/.test(path.basename(path.dirname(d)))) fail('RR_SINK_E_ROOT');
  let real;
  try { real = fs.realpathSync(d); } catch { fail('RR_SINK_E_ROOT'); }
  if (real !== d || !privateDir(d) || !privateDir(path.dirname(d))) fail('RR_SINK_E_ROOT');
  return path.join(d, SINK_BASENAME);
}

/** Append exactly one validated record through one checked descriptor. */
export function appendTelemetry(rec, env = process.env) {
  if (!rec || typeof rec !== 'object' || !isEnum(RPCS, rec.rpc) || !isEnum(ACTORS, rec.actor) || !isEnum(STATUSES, rec.status)) fail('RR_SINK_E_RECORD');
  const line = Buffer.from(`${JSON.stringify({ rpc: rec.rpc, actor: rec.actor, status: rec.status })}\n`, 'utf8');
  const p = sinkPath(env);
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK); }
  catch { fail('RR_SINK_E_OPEN'); }
  try {
    let st;
    try { st = fs.fstatSync(fd); } catch { fail('RR_SINK_E_FILE'); }
    if (!st.isFile() || (st.mode & 0o777) !== 0o600 || !uidOk(st) || st.nlink !== 1) fail('RR_SINK_E_FILE');
    if (st.size + line.length > MAX_BYTES) fail('RR_SINK_E_SIZE');
    try { fs.appendFileSync(fd, line); } catch { fail('RR_SINK_E_WRITE'); }
  } finally { fs.closeSync(fd); }
}
