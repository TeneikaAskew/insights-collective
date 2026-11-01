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
//      database's, and PostgREST's exposed table set equals the database's public tables. (Consistency, not identity: two
//      empty stacks would agree; the loopback origins and ports are the identity.)
//   P4 app -> API: the served app's entry bundle names exactly this API origin and no hosted *.supabase.co project.
// psql stderr and HTTP bodies are never printed; only labels, counts and exit statuses.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiOrigin, readSecretFile, request } from '../t09/api-http.mjs';
import { checkDsn, childEnv, writePassfile } from './pgconn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Private passfile (pgconn.mjs rule): the DSN in psql's argv is password-free; the secret path is only in the child env.
let PF_DIR = '';
const dropPassfile = () => {
  if (PF_DIR) rmSync(PF_DIR, { recursive: true, force: true });
  PF_DIR = '';
};
process.on('exit', dropPassfile);
const fail = (m) => {
  console.log(`FAIL le-preflight: ${m}`);
  process.exit(1);
};
// Uncaught errors (e.g. from a JSON or fs call) are never printed: their text can carry child output.
process.on('uncaughtException', () => fail('unexpected error (detail withheld)'));
const ok = (m) => console.log(`ok le-preflight ${m}`);

const [rawApi, rawApp, db, anonFile, serviceFile] = process.argv.slice(2);
if (!rawApi || !rawApp || !db || !anonFile || !serviceFile) {
  console.error('usage: preflight.mjs <api origin> <app origin> <db url> <anon key file> <service key file>');
  process.exit(2);
}
let API, APP, anon, service;
try {
  API = apiOrigin(rawApi);
  APP = apiOrigin(rawApp);
} catch {
  fail('origin refused (strict loopback origin required)');
}
{
  const c = checkDsn(db);
  if (!c.ok) fail(`database URL refused: ${c.reason}`);
}
try {
  PF_DIR = mkdtempSync(path.join(os.tmpdir(), 'le-pf-'));
  writePassfile(db, path.join(PF_DIR, 'pgpass'));
} catch (e) {
  const fixed = e instanceof Error && /^(LE_DB_PASSWORD_FILE |an external PGPASSWORD)/.test(e.message);
  fail(fixed ? e.message : 'database password file refused (detail withheld)');
}
try {
  anon = readSecretFile(anonFile, 'anon key');
  service = readSecretFile(serviceFile, 'service key');
} catch {
  fail('key file refused (mode-600 regular file required)');
}

/** One read-only SQL query; returns trimmed stdout. stderr is withheld (byte count only). */
function sql(label, query) {
  const env = childEnv(path.join(PF_DIR, 'pgpass'));
  try {
    return execFileSync('psql', [db, '-w', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', 'begin read only', '-c', query, '-c', 'commit'], {
      env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    }).trim();
  } catch (e) {
    fail(`${label}: psql exited ${e.status ?? 'signal'} (stderr withheld: ${Buffer.byteLength(e.stderr ?? '')} bytes)`);
  }
}
const SYNTH = `email is null or (email !~ '^(le|t09)-[a-z0-9]+-[0-9a-f]{8}@local\\.test$' and email not in
  ('e2e-admin@insightscollective.org','e2e-instructor@insightscollective.org','e2e-member@insightscollective.org'))`;

// P1
const p1 = sql('P1', `select json_build_object(
  'nonsynthetic', (select count(*) from auth.users where ${SYNTH}),
  'le_personas', (select count(*) from auth.users where email ~ '^le-'),
  'fixture_rows', (select count(*) from public.content_items where id::text like 'ed170000-%')
                + (select count(*) from public.courses where id::text like 'ed170000-%'))`);
let f1;
try {
  f1 = JSON.parse(p1);
} catch {
  fail('P1: unexpected probe output');
}
if (f1.nonsynthetic !== 0) fail(`P1: ${f1.nonsynthetic} non-synthetic account(s); not the isolated stack`);
if (f1.le_personas !== 0) fail(`P1: ${f1.le_personas} le-* persona(s) already exist; the fixture runs once per fresh stack`);
if (f1.fixture_rows !== 0) fail('P1: fixture rows already exist; the fixture runs once per fresh stack');
ok('P1 fresh synthetic stack: 0 non-synthetic accounts, no le-* persona, no fixture row');

// P2
const p2 = sql('P2', `select json_build_object(
  'queue', to_regclass('net.http_request_queue') is not null,
  'shim', to_regprocedure('net._t09_local_shim_marker()') is not null,
  'guard', (select tgenabled::text from pg_trigger where tgrelid = to_regclass('net.http_request_queue')
              and tgname = 't09_drop_http_request' and not tgisinternal),
  'evidence', to_regclass('local_evidence.egress_attempts') is not null)`);
let f2;
try {
  f2 = JSON.parse(p2);
} catch {
  fail('P2: unexpected probe output');
}
if (!f2.queue) fail('P2: net.http_request_queue missing; the T-09 PRE guard has not run on this stack');
if (f2.shim && process.env.LE_ALLOW_SHIM !== '1') fail('P2: LOCAL-SHIM queue found without LE_ALLOW_SHIM=1 (never accepted on the real stack)');
if (!f2.guard || !['O', 'A'].includes(f2.guard)) fail(`P2: guard trigger t09_drop_http_request absent or disabled (${f2.guard ?? 'absent'})`);
if (!f2.evidence) fail('P2: local_evidence.egress_attempts missing');
const queued = sql('P2 queue', `select count(*) from net.http_request_queue`);
if (queued !== '0') fail(`P2: net.http_request_queue holds ${queued} row(s)`);
ok(`P2 queue guard installed (${f2.guard === 'A' ? 'ENABLE ALWAYS' : 'ENABLE ORIGIN'}), queue empty${f2.shim ? ' [LOCAL-SHIM]' : ''}`);

// P3
const dbUsers = Number(sql('P3 users', `select count(*) from auth.users`));
const dbCourses = Number(sql('P3 courses', `select count(*) from public.courses`));
const dbTables = sql('P3 tables', `select coalesce(string_agg(tablename, ',' order by tablename), '') from pg_tables where schemaname = 'public'`)
  .split(',').filter(Boolean);
const svc = { apikey: service, Authorization: `Bearer ${service}` };
let users, courses, root;
try {
  users = await request(API, 'GET', '/auth/v1/admin/users?page=1&per_page=1', { headers: svc });
  courses = await request(API, 'GET', '/rest/v1/courses?select=id&limit=1', { headers: { ...svc, Prefer: 'count=exact' } });
  root = await request(API, 'GET', '/rest/v1/', { headers: { apikey: anon } });
} catch (e) {
  fail('P3: request failed (detail withheld)');
}
if (users.status !== 200 || courses.status !== 200 || root.status !== 200) fail(`P3: HTTP ${users.status}/${courses.status}/${root.status}`);
const apiUsers = Number(users.headers.get('x-total-count') ?? users.json?.total ?? NaN);
const apiCourses = Number((courses.headers.get('content-range') ?? '').split('/')[1]);
if (apiUsers !== dbUsers) fail(`P3: GoTrue reports ${apiUsers} users, the database ${dbUsers}`);
if (apiCourses !== dbCourses) fail(`P3: PostgREST reports ${apiCourses} courses, the database ${dbCourses}`);
const defs = Object.keys(root.json?.definitions ?? {});
const exposed = dbTables.filter((t) => defs.includes(t));
const REQUIRED = ['content_items', 'courses', 'modules', 'quizzes', 'quiz_questions', 'profiles', 'user_roles'];
const lacking = REQUIRED.filter((t) => !dbTables.includes(t) || !defs.includes(t));
if (lacking.length) fail(`P3: ${lacking.length} fixture table(s) not both in the database and exposed by PostgREST`);
if (!dbTables.length || exposed.length < Math.ceil(dbTables.length * 0.9)) fail(`P3: PostgREST exposes ${exposed.length}/${dbTables.length} of this database's public tables`);
ok(`P3 API matches DB: users ${dbUsers}, courses ${dbCourses}, ${exposed.length}/${dbTables.length} public tables exposed`);

// P4 (the app's entry bundle; no credentials sent to the app origin)
let html;
try {
  html = await request(APP, 'GET', '/', {});
} catch {
  fail('P4: request failed (detail withheld)');
}
if (html.status !== 200) fail(`P4: app HTTP ${html.status}`);
const srcs = [...html.text.matchAll(/<script[^>]+type="module"[^>]+src="(\/[^"]+\.js)"/g), ...html.text.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="(\/[^"]+\.js)"/g)]
  .map((m) => m[1]).filter((s, i, a) => a.indexOf(s) === i).slice(0, 20);
if (!srcs.length) fail('P4: no module entry in the served app');
let namesApi = false, hosted = false;
for (const s of srcs) {
  let r;
  try {
    r = await request(APP, 'GET', s, {});
  } catch {
    fail('P4: request failed (detail withheld)');
  }
  if (r.status !== 200) fail(`P4: bundle HTTP ${r.status}`);
  if (r.text.includes(API)) namesApi = true;
  if (/[a-z0-9]{20}\.supabase\.co/.test(r.text)) hosted = true;
}
if (hosted) fail('P4: the served app names a hosted *.supabase.co project');
if (!namesApi) fail(`P4: the served app does not name ${API}`);
ok(`P4 app at ${APP} is built against ${API} (${srcs.length} entry file(s) read)`);
console.log('PASS le-preflight: read-only; nothing was written and no GoTrue admin POST was made');
