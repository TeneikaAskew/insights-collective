#!/usr/bin/env node
// ABOUTME: READ-ONLY preflight run BEFORE the first GoTrue admin POST: fresh synthetic stack, app/API/DB pointing at the same
// ABOUTME: stack, and the T-09 queue guard installed with an empty queue. Any failed probe fails closed; nothing is written.
// Usage: preflight.mjs <api origin> <app origin> <db url> <anon key file> <service key file>
//   env LE_ALLOW_SHIM=1 accepts the T-09 LOCAL-SHIM queue (plain PostgreSQL self-test only; the integrated job never sets it).
// Checks, each labelled:
//   P1 database (read-only transaction): only synthetic accounts; no le-* persona yet; no ed170000-* fixture row; C1 absent.
//   P2 queue guard: net.http_request_queue exists, trigger t09_drop_http_request is on it and enabled, the queue is empty,
//      local_evidence.egress_attempts exists. A LOCAL-SHIM queue is refused unless LE_ALLOW_SHIM=1.
//   P3 API <-> DB: GoTrue's admin user total and PostgREST's exact public.courses count (service key, GET only) equal the
//      database's, and PostgREST serves the fixture tables and >= 90% of the database's public tables, read from the
//      OpenAPI root with the SERVICE key (p3-exposure.mjs; anon holds no privilege on quiz_questions by design, so an anon
//      root omits it). (Consistency, not identity: two
//      empty stacks would agree; the loopback origins and ports are the identity.)
//   P4 app -> API: the served app's entry bundle names exactly this API origin and no hosted *.supabase.co project.
// psql stderr and HTTP bodies are never printed; only labels, counts and exit statuses. Exit status = the refusing check:
// 20 INPUT, 21 P1, 22 P2, 23 P3_HTTP, 24 P3_COUNT, 25 P3_TABLES, 26 P4, 27 UNEXPECTED (preflight-codes.mjs).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiOrigin, readSecretFile, request } from '../t09/api-http.mjs';
import { checkDsn, childEnv, writePassfile } from './pgconn.mjs';
import { runP3 } from './p3-exposure.mjs';
import { PREFLIGHT_EXIT } from './preflight-codes.mjs';

// Private passfile (pgconn.mjs rule): the DSN in psql's argv is password-free; the secret path is only in the child env.
let PF_DIR = '';
const dropPassfile = () => {
  if (PF_DIR) rmSync(PF_DIR, { recursive: true, force: true });
  PF_DIR = '';
};
process.on('exit', dropPassfile);
// fail(code, detail): the detail line stays private (run.sh output); the exit status names the check (preflight-codes.mjs),
// and run.sh maps ONLY that status to one public fixed code. An unknown code exits as UNEXPECTED.
const fail = (code, m) => {
  console.log(`FAIL le-preflight: ${m}`);
  process.exit(PREFLIGHT_EXIT[code] ?? PREFLIGHT_EXIT.LE_PRE_E_UNEXPECTED);
};
// Uncaught errors (e.g. from a JSON or fs call) are never printed: their text can carry child output.
process.on('uncaughtException', () => fail('LE_PRE_E_UNEXPECTED', 'unexpected error (detail withheld)'));
process.on('unhandledRejection', () => fail('LE_PRE_E_UNEXPECTED', 'unexpected error (detail withheld)'));
const ok = (m) => console.log(`ok le-preflight ${m}`);

const [rawApi, rawApp, db, anonFile, serviceFile] = process.argv.slice(2);
if (!rawApi || !rawApp || !db || !anonFile || !serviceFile) {
  console.error('usage: preflight.mjs <api origin> <app origin> <db url> <anon key file> <service key file>');
  process.exit(PREFLIGHT_EXIT.LE_PRE_E_INPUT);
}
let API, APP, anon, service;
try {
  API = apiOrigin(rawApi);
  APP = apiOrigin(rawApp);
} catch {
  fail('LE_PRE_E_INPUT', 'origin refused (strict loopback origin required)');
}
{
  const c = checkDsn(db);
  if (!c.ok) fail('LE_PRE_E_INPUT', `database URL refused: ${c.reason}`);
}
try {
  PF_DIR = mkdtempSync(path.join(os.tmpdir(), 'le-pf-'));
  writePassfile(db, path.join(PF_DIR, 'pgpass'));
} catch (e) {
  const fixed = e instanceof Error && /^(LE_DB_PASSWORD_FILE |an external PGPASSWORD)/.test(e.message);
  fail('LE_PRE_E_INPUT', fixed ? e.message : 'database password file refused (detail withheld)');
}
try {
  anon = readSecretFile(anonFile, 'anon key');
  service = readSecretFile(serviceFile, 'service key');
} catch {
  fail('LE_PRE_E_INPUT', 'key file refused (mode-600 regular file required)');
}

/** One read-only SQL query; returns trimmed stdout. stderr is withheld (byte count only). */
function sql(code, label, query) {
  const env = childEnv(path.join(PF_DIR, 'pgpass'));
  try {
    return execFileSync('psql', [db, '-w', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', 'begin read only', '-c', query, '-c', 'commit'], {
      env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    }).trim();
  } catch (e) {
    fail(code, `${label}: psql exited ${e.status ?? 'signal'} (stderr withheld: ${Buffer.byteLength(e.stderr ?? '')} bytes)`);
  }
}
const SYNTH = `email is null or (email !~ '^(le|t09)-[a-z0-9]+-[0-9a-f]{8}@local\\.test$' and email not in
  ('e2e-admin@insightscollective.org','e2e-instructor@insightscollective.org','e2e-member@insightscollective.org'))`;

// P1
const p1 = sql('LE_PRE_E_P1', 'P1', `select json_build_object(
  'nonsynthetic', (select count(*) from auth.users where ${SYNTH}),
  'le_personas', (select count(*) from auth.users where email ~ '^le-'),
  'fixture_rows', (select count(*) from public.content_items where id::text like 'ed170000-%')
                + (select count(*) from public.courses where id::text like 'ed170000-%'))`);
let f1;
try {
  f1 = JSON.parse(p1);
} catch {
  fail('LE_PRE_E_P1', 'P1: unexpected probe output');
}
if (f1.nonsynthetic !== 0) fail('LE_PRE_E_P1', `P1: ${f1.nonsynthetic} non-synthetic account(s); not the isolated stack`);
if (f1.le_personas !== 0) fail('LE_PRE_E_P1', `P1: ${f1.le_personas} le-* persona(s) already exist; the fixture runs once per fresh stack`);
if (f1.fixture_rows !== 0) fail('LE_PRE_E_P1', 'P1: fixture rows already exist; the fixture runs once per fresh stack');
ok('P1 fresh synthetic stack: 0 non-synthetic accounts, no le-* persona, no fixture row');

// P2
const p2 = sql('LE_PRE_E_P2', 'P2', `select json_build_object(
  'queue', to_regclass('net.http_request_queue') is not null,
  'shim', to_regprocedure('net._t09_local_shim_marker()') is not null,
  'guard', (select tgenabled::text from pg_trigger where tgrelid = to_regclass('net.http_request_queue')
              and tgname = 't09_drop_http_request' and not tgisinternal),
  'evidence', to_regclass('local_evidence.egress_attempts') is not null)`);
let f2;
try {
  f2 = JSON.parse(p2);
} catch {
  fail('LE_PRE_E_P2', 'P2: unexpected probe output');
}
if (!f2.queue) fail('LE_PRE_E_P2', 'P2: net.http_request_queue missing; the T-09 PRE guard has not run on this stack');
if (f2.shim && process.env.LE_ALLOW_SHIM !== '1') fail('LE_PRE_E_P2', 'P2: LOCAL-SHIM queue found without LE_ALLOW_SHIM=1 (never accepted on the real stack)');
if (!f2.guard || !['O', 'A'].includes(f2.guard)) fail('LE_PRE_E_P2', `P2: guard trigger t09_drop_http_request absent or disabled (${f2.guard ?? 'absent'})`);
if (!f2.evidence) fail('LE_PRE_E_P2', 'P2: local_evidence.egress_attempts missing');
const queued = sql('LE_PRE_E_P2', 'P2 queue', `select count(*) from net.http_request_queue`);
if (queued !== '0') fail('LE_PRE_E_P2', `P2: net.http_request_queue holds ${queued} row(s)`);
ok(`P2 queue guard installed (${f2.guard === 'A' ? 'ENABLE ALWAYS' : 'ENABLE ORIGIN'}), queue empty${f2.shim ? ' [LOCAL-SHIM]' : ''}`);

// P3
const dbUsers = Number(sql('LE_PRE_E_P3_COUNT', 'P3 users', `select count(*) from auth.users`));
const dbCourses = Number(sql('LE_PRE_E_P3_COUNT', 'P3 courses', `select count(*) from public.courses`));
const dbTables = sql('LE_PRE_E_P3_TABLES', 'P3 tables', `select coalesce(string_agg(tablename, ',' order by tablename), '') from pg_tables where schemaname = 'public'`)
  .split(',').filter(Boolean);
const p3 = await runP3({ request, API, keys: { anon, service }, db: { users: dbUsers, courses: dbCourses, tables: dbTables } });
if (!p3.ok) fail(`LE_PRE_E_${p3.code}`, p3.reason);
ok(p3.line);

// P4 (the app's entry bundle; no credentials sent to the app origin)
let html;
try {
  html = await request(APP, 'GET', '/', {});
} catch {
  fail('LE_PRE_E_P4', 'P4: request failed (detail withheld)');
}
if (html.status !== 200) fail('LE_PRE_E_P4', `P4: app HTTP ${html.status}`);
const srcs = [...html.text.matchAll(/<script[^>]+type="module"[^>]+src="(\/[^"]+\.js)"/g), ...html.text.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="(\/[^"]+\.js)"/g)]
  .map((m) => m[1]).filter((s, i, a) => a.indexOf(s) === i).slice(0, 20);
if (!srcs.length) fail('LE_PRE_E_P4', 'P4: no module entry in the served app');
let namesApi = false, hosted = false;
for (const s of srcs) {
  let r;
  try {
    r = await request(APP, 'GET', s, {});
  } catch {
    fail('LE_PRE_E_P4', 'P4: request failed (detail withheld)');
  }
  if (r.status !== 200) fail('LE_PRE_E_P4', `P4: bundle HTTP ${r.status}`);
  if (r.text.includes(API)) namesApi = true;
  if (/[a-z0-9]{20}\.supabase\.co/.test(r.text)) hosted = true;
}
if (hosted) fail('LE_PRE_E_P4', 'P4: the served app names a hosted *.supabase.co project');
if (!namesApi) fail('LE_PRE_E_P4', `P4: the served app does not name ${API}`);
ok(`P4 app at ${APP} is built against ${API} (${srcs.length} entry file(s) read)`);
console.log('PASS le-preflight: read-only; nothing was written and no GoTrue admin POST was made');
