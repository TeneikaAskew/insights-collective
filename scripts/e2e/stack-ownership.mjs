#!/usr/bin/env node
// ABOUTME: Shared-runner stack ownership record (schema v1): the bootstrap WRITES one file naming the run that created
// ABOUTME: the disposable local stack; consumers (e.g. the gradebook adapter) VERIFY it against the run and a live read.
//
// File: $STACK_OWNERSHIP_FILE (the runner sets $RUNNER_TEMP/stack-ownership.json), mode 0600, at most 4 KiB, JSON:
//   { "schema": 1, "run_id": "<digits>", "run_attempt": "<digits>", "pg_system_identifier": "<digits>",
//     "api_origin": "http://127.0.0.1:<port>", "app_origin": "http://127.0.0.1:<port>",
//     "created_at": "<ISO-8601 UTC>", "disposable": true, "bootstrap_sha256": "<64 hex>" }
// No other key is allowed. No DSN, password, key, token or host other than loopback is ever written.
//
// What it proves, and what it does not: run_id/run_attempt tie the stack to THIS workflow run; pg_system_identifier
// (pg_control_system().system_identifier, fixed at initdb) ties it to the cluster this run initialised, so a consumer
// that reads the live identifier through its own guarded DSN and finds a different one is pointed at another cluster.
// `disposable: true` is a DECLARATION by the bootstrap, not a proof; consumers must not treat it as one.
//
// CLI:
//   node stack-ownership.mjs write  <api_origin> <app_origin> <bootstrap_file>   (system identifier on stdin, digits only)
//   node stack-ownership.mjs verify <api_origin> <app_origin>                    (live system identifier on stdin)
// Both read $STACK_OWNERSHIP_FILE and $GITHUB_RUN_ID/$GITHUB_RUN_ATTEMPT (both required). One fixed line; exit 0 or 3.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 1;
export const KEYS = Object.freeze(['schema', 'run_id', 'run_attempt', 'pg_system_identifier', 'api_origin', 'app_origin',
  'created_at', 'disposable', 'bootstrap_sha256']);
export const CODES = Object.freeze(['SO_OK', 'SO_ABSENT', 'SO_MODE', 'SO_SIZE', 'SO_PARSE', 'SO_SCHEMA', 'SO_RUN_MISMATCH',
  'SO_SYSID_MISMATCH', 'SO_ORIGIN_MISMATCH', 'SO_INPUT']);
const MAX_BYTES = 4096;
const DIGITS = /^[0-9]{1,20}$/;
const ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):[0-9]{2,5}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** Structural check of a parsed record. Returns null when valid, else a fixed reason token (never a value). */
export function schemaProblem(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'not_object';
  const keys = Object.keys(r).sort();
  if (keys.length !== KEYS.length || keys.join() !== [...KEYS].sort().join()) return 'keys';
  if (r.schema !== SCHEMA) return 'schema';
  for (const k of ['run_id', 'run_attempt', 'pg_system_identifier']) if (typeof r[k] !== 'string' || !DIGITS.test(r[k])) return k;
  for (const k of ['api_origin', 'app_origin']) {
    if (typeof r[k] !== 'string' || !ORIGIN.test(r[k])) return k;
    const port = Number(r[k].split(':')[2]);
    if (port < 1 || port > 65535) return k;
  }
  if (typeof r.created_at !== 'string' || !ISO.test(r.created_at) || Number.isNaN(Date.parse(r.created_at))) return 'created_at';
  if (r.disposable !== true) return 'disposable';
  if (typeof r.bootstrap_sha256 !== 'string' || !HEX64.test(r.bootstrap_sha256)) return 'bootstrap_sha256';
  return null;
}

export function buildRecord({ runId, runAttempt, systemIdentifier, apiOrigin, appOrigin, bootstrapSha256, createdAt = new Date() }) {
  const r = {
    schema: SCHEMA, run_id: String(runId ?? ''), run_attempt: String(runAttempt ?? ''),
    pg_system_identifier: String(systemIdentifier ?? '').trim(), api_origin: apiOrigin, app_origin: appOrigin,
    created_at: (createdAt instanceof Date ? createdAt : new Date(createdAt)).toISOString(), disposable: true,
    bootstrap_sha256: bootstrapSha256,
  };
  const bad = schemaProblem(r);
  if (bad) throw new Error(`stack-ownership: refused to build (${bad})`);
  return r;
}

/** Reads and parses the file with mode and size limits. Returns { ok, code, reason?, record? }. */
export function readRecord(file) {
  if (!file) return { ok: false, code: 'SO_ABSENT', reason: 'unset' };
  let st;
  try { st = fs.lstatSync(file); } catch { return { ok: false, code: 'SO_ABSENT', reason: 'missing' }; }
  if (!st.isFile()) return { ok: false, code: 'SO_ABSENT', reason: 'not_regular_file' };
  if ((st.mode & 0o777) !== 0o600) return { ok: false, code: 'SO_MODE', reason: 'not_0600' };
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) return { ok: false, code: 'SO_MODE', reason: 'owner' };
  if (st.size > MAX_BYTES) return { ok: false, code: 'SO_SIZE', reason: 'too_large' };
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { ok: false, code: 'SO_PARSE', reason: 'json' }; }
  const bad = schemaProblem(record);
  if (bad) return { ok: false, code: 'SO_SCHEMA', reason: bad };
  return { ok: true, code: 'SO_OK', record };
}

/**
 * Full consumer check: file valid (exactly 0600, owned by the caller), same run AND attempt (both required), the
 * consumer's own bound origins, and the same cluster as a LIVE read. Every expectation is required; none is skipped.
 */
export function verifyRecord(file, { runId, runAttempt, liveSystemIdentifier, apiOrigin, appOrigin }) {
  const r = readRecord(file);
  if (!r.ok) return r;
  if (!DIGITS.test(String(runId ?? ''))) return { ok: false, code: 'SO_INPUT', reason: 'run_id_env' };
  if (!DIGITS.test(String(runAttempt ?? ''))) return { ok: false, code: 'SO_INPUT', reason: 'run_attempt_env' };
  if (!ORIGIN.test(String(apiOrigin ?? '')) || !ORIGIN.test(String(appOrigin ?? ''))) return { ok: false, code: 'SO_INPUT', reason: 'expected_origins' };
  if (r.record.run_id !== String(runId)) return { ok: false, code: 'SO_RUN_MISMATCH', reason: 'run_id' };
  if (r.record.run_attempt !== String(runAttempt)) return { ok: false, code: 'SO_RUN_MISMATCH', reason: 'run_attempt' };
  if (r.record.api_origin !== apiOrigin) return { ok: false, code: 'SO_ORIGIN_MISMATCH', reason: 'api_origin' };
  if (r.record.app_origin !== appOrigin) return { ok: false, code: 'SO_ORIGIN_MISMATCH', reason: 'app_origin' };
  const live = String(liveSystemIdentifier ?? '').trim();
  if (!DIGITS.test(live)) return { ok: false, code: 'SO_INPUT', reason: 'live_system_identifier' };
  if (r.record.pg_system_identifier !== live) return { ok: false, code: 'SO_SYSID_MISMATCH', reason: 'pg_system_identifier' };
  return { ok: true, code: 'SO_OK', record: r.record };
}

export function writeRecord(file, record) {
  if (!file) throw new Error('stack-ownership: STACK_OWNERSHIP_FILE is unset');
  const bad = schemaProblem(record);
  if (bad) throw new Error(`stack-ownership: refused to write (${bad})`);
  // wx: never overwrite an existing record (a second bootstrap in the same job is itself a failure).
  fs.writeFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
}

const line = (code, reason) => `stack-ownership ${code}${reason ? ` reason=${reason}` : ''}`;

async function main(argv) {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const file = process.env.STACK_OWNERSHIP_FILE;
  const [cmd, ...rest] = argv;
  if (cmd === 'write') {
    const [apiOrigin, appOrigin, bootstrapFile] = rest;
    if (!DIGITS.test(stdin)) { console.log(line('SO_INPUT', 'system_identifier_stdin')); return 3; }
    let sha;
    try { sha = crypto.createHash('sha256').update(fs.readFileSync(bootstrapFile)).digest('hex'); }
    catch { console.log(line('SO_INPUT', 'bootstrap_file')); return 3; }
    try {
      writeRecord(file, buildRecord({ runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        systemIdentifier: stdin, apiOrigin, appOrigin, bootstrapSha256: sha }));
    } catch { console.log(line('SO_INPUT', 'build_or_write')); return 3; }
    console.log(line('SO_OK', 'written'));
    return 0;
  }
  if (cmd === 'verify') {
    const [apiOrigin, appOrigin] = rest;
    const r = verifyRecord(file, { runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, liveSystemIdentifier: stdin, apiOrigin, appOrigin });
    console.log(line(r.code, r.ok ? 'verified' : r.reason));
    return r.ok ? 0 : 3;
  }
  console.log(line('SO_INPUT', 'usage'));
  return 3;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main(process.argv.slice(2)).then((c) => process.exit(c), () => { console.log(line('SO_INPUT', 'internal')); process.exit(3); });
}
