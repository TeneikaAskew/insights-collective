#!/usr/bin/env node
// ABOUTME: T-09 API tier (plan v2 sections 3 and 4): persona REST calls, each judged by an EXACT case manifest: separately
// ABOUTME: asserted prerequisites, a recognised response class per tested step, and exact persisted state and side effects.
//
// Usage: api-controls.mjs seed-legacy OLD|NEW | run OLD|NEW | manifest
// Env (seed-legacy, run): T09_API_URL (strict loopback origin, api-http.mjs), T09_ANON_KEY_FILE (0600), T09_PERSONA_FILE (0600,
//        from personas.sh), SUPABASE_DB_URL (loopback), T09_HISTORY_SQL (history-hash.sql, certificate re-check after each case)
// Roles of each call, never mixed: a PERSONA call is a tested step or a labelled API prerequisite; database `setup`, `witness`
// and `maintenance` statements run as the trusted local postgres session and are never counted as a tested operation.
// No service-role HTTP call is made.
//
// Response classes (anything else is INVALID, never protection and never an expected OLD outcome):
//   accepted  2xx with >= 1 row             zero-row  2xx with 0 rows (RLS USING filtered)
//   denied    SQLSTATE 42501 (RLS WITH CHECK or privilege)
//   guard     SQLSTATE 23514 with the completion guard's own message ("... must be submitted before it can be marked complete")
//   A 3xx is refused by the client (no redirect is followed). 401/404/5xx, other SQLSTATEs (e.g. 22P02, 23502, PGRST*)
//   and non-JSON errors are INVALID: "some 4xx" is not protection.
// Case outcome:
//   INVALID  a setup witness, an API prerequisite (class or witness) or the transport failed: the case proves nothing in
//            either mode and fails the run. A setup failure is never an expected OLD result.
//   PASS     every tested step's class is in the manifest's set for this mode AND every manifest state key equals the witness.
//            For an OLD hole that means the hole is shown positively (the bad write accepted AND persisted), not inferred
//            from a refusal. A protection counts only when its witness shows the exact unchanged or refused state; a pinned
//            ("accepted") identity write counts only when the witness shows the pinned columns unchanged.
//   FAIL     otherwise.
// `origin` records where each OLD expectation comes from: 'sql-tier' (the named SQL-tier check fails on OLD), 'source' (read
// from the OLD and NEW migration source before any run; no SQL-tier twin), 'observed' (first seen on a LOCAL-SHIM run, then
// checked against source: E9 only), 'same' (no OLD/NEW difference expected).
// Not exercised: the score-quiz Edge Function (functions are not served); finalized attempts are written as maintenance and
// labelled "fixture-finalized (finalizer not exercised)".
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { apiOrigin, readSecretFile, request, RedirectRefused, TargetRefused } from './api-http.mjs';

const [phase, MODE] = process.argv.slice(2);
const MANIFEST = phase === 'manifest';
if (!MANIFEST && (!['seed-legacy', 'run'].includes(phase) || !['OLD', 'NEW'].includes(MODE))) { console.error('usage: api-controls.mjs seed-legacy|run OLD|NEW | manifest'); process.exit(2); }
const PERSONAS = ['A', 'B', 'I', 'J', 'ADMIN', 'HC', 'HG'];
const env = (k) => { const v = process.env[k]; if (!v) { console.error(`api-controls: ${k} is required`); process.exit(2); } return v; };
let db, P, API, ANON;
if (MANIFEST) {
  P = Object.fromEntries(PERSONAS.map((k) => [k, { id: `<${k}>`, token: '' }]));
} else {
  db = new URL(env('SUPABASE_DB_URL'));
  if (!['127.0.0.1', 'localhost'].includes(db.hostname)) { console.error('api-controls: database must be loopback'); process.exit(2); }
  try { API = apiOrigin(env('T09_API_URL')); ANON = readSecretFile(env('T09_ANON_KEY_FILE'), 'anon key'); } catch (e) { console.error(`api-controls: ${e.message}`); process.exit(2); }
  const personaFile = env('T09_PERSONA_FILE');
  if ((statSync(personaFile).mode & 0o077) !== 0) { console.error('api-controls: persona file must be mode 600'); process.exit(2); }
  P = JSON.parse(readFileSync(personaFile, 'utf8'));
  for (const k of PERSONAS) if (!P[k]?.id || !P[k]?.token) { console.error(`api-controls: persona ${k} missing`); process.exit(2); }
}

// ---------------------------------------------------------------- database: setup / witness / maintenance (postgres)
function psql(sql, extra = []) {
  const r = spawnSync('psql', ['-h', db.hostname, '-p', db.port || '5432', '-U', decodeURIComponent(db.username || 'postgres'),
    '-d', db.pathname.slice(1) || 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', ...extra],
  { input: sql, encoding: 'utf8', env: { PATH: process.env.PATH, PGPASSWORD: decodeURIComponent(db.password || '') } });
  if (r.status !== 0) throw Object.assign(new Error(`database step failed: ${(r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || 'psql exit ' + r.status}`), { infra: true });
  return r.stdout.trim();
}
const q1 = (sql) => psql(sql).split('\n').pop();
const n = (sql) => Number(q1(sql));
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

// Fixed fixture ids. Legacy courses LA..LD are seeded BEFORE the history window; C, D, E, G after the migrations.
const id = (s) => `7b000000-0000-4000-8000-${s.padStart(12, '0')}`;
const F = {
  C: id('c00'), CM: id('c01'), CP: id('c02'), CA: id('c03'), CQ: id('c04'), CH: id('c05'), CHA: id('c06'),
  aCA: id('d03'), aCH: id('d06'), aCU: id('d07'), qC: id('e04'), qCq: id('f04'),
  D: id('a00'), DM: id('a01'), DP: id('a02'), DA: id('a03'), DQ: id('a04'), aDA: id('b03'), qD: id('b04'), qDq: id('b05'),
  E: id('900'), EM: id('901'), EP: id('902'), EA: id('903'), aEA: id('904'),
  // G: two accessible quizzes in one enrolled course (Q7 attempt retarget)
  G: id('600'), GM: id('601'), GQ1: id('602'), GQ2: id('603'), qG1: id('604'), qG2: id('605'), qG1q: id('606'), qG2q: id('607'),
};
// Protected-history course H (history-hash.sql): HC holds the legacy certificate, HG has genuine pre-migration history.
const hid = (s) => `7a000000-0000-4000-8000-${s.padStart(12, '0')}`;
const H = { C: hid('c00'), P: hid('c02'), A: hid('c03'), Q: hid('c04'), a: hid('d03'), q: hid('e04') };
const L = {}; // legacy courses: <X>, <X>M, <X>P page, <X>I assessed item, a<X> assignment / q<X> quiz
for (const [k, base] of [['LA', 0x100], ['LB', 0x200], ['LC', 0x300], ['LD', 0x400]]) {
  const h = (o) => id((base + o).toString(16));
  L[k] = { C: h(0), M: h(1), P: h(2), I: h(3), a: h(4), q: h(5), qq: h(6) };
}
const { A, B, I, J, ADMIN, HC, HG } = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.id]));

if (phase === 'seed-legacy') {
  // setup, before the history window: legacy-invalid rows for persona A, as OLD accepted them; then any certificate the
  // OLD issuer granted during seeding is removed (setup, not history), so each later control measures a NEW certificate.
  let sql = 'begin;\n';
  for (const [k, x] of Object.entries(L)) {
    const quiz = k === 'LD';
    sql += `insert into public.courses (id, title, description, category, level, instructor_id, published) values (${lit(x.C)}, ${lit('T-09 legacy ' + k)}, 'synthetic', 'General', 'beginner', ${lit(I)}, true);
insert into public.modules (id, course_id, title, position, published) values (${lit(x.M)}, ${lit(x.C)}, 'M', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (${lit(x.P)}, ${lit(x.C)}, ${lit(x.M)}, 'page', 'P', 1, true), (${lit(x.I)}, ${lit(x.C)}, ${lit(x.M)}, ${quiz ? "'quiz'" : "'assignment'"}, 'I', 2, true);
insert into public.enrollments (user_id, course_id) values (${lit(A)}, ${lit(x.C)});
`;
    if (quiz) {
      sql += `insert into public.quizzes (id, content_item_id, title, allowed_attempts) values (${lit(x.q)}, ${lit(x.I)}, 'Q', 0);
insert into public.quiz_questions (id, quiz_id, question_text, question_type, correct_answer, points, position) values (${lit(x.qq)}, ${lit(x.q)}, 'Q1', 'multiple_choice', '"a"', 1, 1);
insert into public.quiz_submissions (quiz_id, user_id, attempt, workflow_state, started_at) values (${lit(x.q)}, ${lit(A)}, 1, 'pending_review', now() - interval '150 days');
`;
    } else {
      sql += `insert into public.assignments (id, content_item_id, course_id, title, points) values (${lit(x.a)}, ${lit(x.I)}, ${lit(x.C)}, 'I', 10);
insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (${lit(x.a)}, ${lit(A)}, now() - interval '150 days', 'online_text_entry', 'legacy staged', 'unsubmitted');
`;
    }
    sql += `insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (${lit(A)}, ${lit(x.I)}, 'completed');\n`;
    if (k === 'LB' || k === 'LC') sql += `insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (${lit(A)}, ${lit(x.P)}, 'read');\n`;
  }
  sql += `delete from public.certificates where user_id = ${lit(A)} and course_id in (${Object.values(L).map((x) => lit(x.C)).join(', ')});\ncommit;\n`;
  psql(sql);
  const rows = n(`select count(*) from public.content_item_progressions where user_id = ${lit(A)} and content_item_id in (${Object.values(L).map((x) => lit(x.I)).join(', ')}) and workflow_state = 'completed'`);
  if (rows !== 4) { console.log(`FAIL seed-legacy: expected 4 legacy done rows, found ${rows}`); process.exit(1); }
  console.log('PASS seed-legacy (setup, before the history window): 4 legacy-invalid cases for persona A in courses LA..LD, 0 certificates');
  process.exit(0);
}

// ---------------------------------------------------------------- run: current fixtures (setup) after the migrations
if (!MANIFEST) {
  psql(`begin;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (${lit(F.C)}, 'T-09 API course C', 's', 'General', 'beginner', ${lit(I)}, true),
  (${lit(F.D)}, 'T-09 API course D', 's', 'General', 'beginner', ${lit(J)}, true),
  (${lit(F.E)}, 'T-09 API course E (assignment-only)', 's', 'General', 'beginner', ${lit(I)}, true),
  (${lit(F.G)}, 'T-09 API course G (two quizzes)', 's', 'General', 'beginner', ${lit(I)}, true);
insert into public.modules (id, course_id, title, position, published) values (${lit(F.CM)}, ${lit(F.C)}, 'CM', 1, true), (${lit(F.DM)}, ${lit(F.D)}, 'DM', 1, true), (${lit(F.EM)}, ${lit(F.E)}, 'EM', 1, true), (${lit(F.GM)}, ${lit(F.G)}, 'GM', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (${lit(F.CP)}, ${lit(F.C)}, ${lit(F.CM)}, 'page', 'CP', 1, true), (${lit(F.CA)}, ${lit(F.C)}, ${lit(F.CM)}, 'assignment', 'CA', 2, true),
  (${lit(F.CQ)}, ${lit(F.C)}, ${lit(F.CM)}, 'quiz', 'CQ', 3, true), (${lit(F.CH)}, ${lit(F.C)}, ${lit(F.CM)}, 'page', 'CH hidden', 4, false),
  (${lit(F.CHA)}, ${lit(F.C)}, ${lit(F.CM)}, 'assignment', 'CHA hidden', 5, false),
  (${lit(F.DP)}, ${lit(F.D)}, ${lit(F.DM)}, 'page', 'DP', 1, true), (${lit(F.DA)}, ${lit(F.D)}, ${lit(F.DM)}, 'assignment', 'DA', 2, true),
  (${lit(F.DQ)}, ${lit(F.D)}, ${lit(F.DM)}, 'quiz', 'DQ', 3, true),
  (${lit(F.EP)}, ${lit(F.E)}, ${lit(F.EM)}, 'page', 'EP', 1, true), (${lit(F.EA)}, ${lit(F.E)}, ${lit(F.EM)}, 'assignment', 'EA', 2, true),
  (${lit(F.GQ1)}, ${lit(F.G)}, ${lit(F.GM)}, 'quiz', 'GQ1', 1, true), (${lit(F.GQ2)}, ${lit(F.G)}, ${lit(F.GM)}, 'quiz', 'GQ2', 2, true);
insert into public.assignments (id, content_item_id, course_id, title, points) values
  (${lit(F.aCA)}, ${lit(F.CA)}, ${lit(F.C)}, 'CA', 10), (${lit(F.aCH)}, ${lit(F.CHA)}, ${lit(F.C)}, 'CHA', 10), (${lit(F.aCU)}, null, ${lit(F.C)}, 'CU unlinked', 10),
  (${lit(F.aDA)}, ${lit(F.DA)}, ${lit(F.D)}, 'DA', 10), (${lit(F.aEA)}, ${lit(F.EA)}, ${lit(F.E)}, 'EA', 10);
insert into public.quizzes (id, content_item_id, title, allowed_attempts) values (${lit(F.qC)}, ${lit(F.CQ)}, 'CQ', 0), (${lit(F.qD)}, ${lit(F.DQ)}, 'DQ', 0),
  (${lit(F.qG1)}, ${lit(F.GQ1)}, 'GQ1', 0), (${lit(F.qG2)}, ${lit(F.GQ2)}, 'GQ2', 0);
insert into public.quiz_questions (id, quiz_id, question_text, question_type, correct_answer, points, position) values
  (${lit(F.qCq)}, ${lit(F.qC)}, 'Q1', 'multiple_choice', '"a"', 1, 1), (${lit(F.qDq)}, ${lit(F.qD)}, 'Q1', 'multiple_choice', '"a"', 1, 1),
  (${lit(F.qG1q)}, ${lit(F.qG1)}, 'Q1', 'multiple_choice', '"a"', 1, 1), (${lit(F.qG2q)}, ${lit(F.qG2)}, 'Q1', 'multiple_choice', '"a"', 1, 1);
insert into public.enrollments (user_id, course_id) values (${lit(A)}, ${lit(F.C)}), (${lit(B)}, ${lit(F.C)}), (${lit(A)}, ${lit(F.E)}), (${lit(A)}, ${lit(F.G)});
commit;`);
}

// ---------------------------------------------------------------- HTTP (persona calls only), classified
const GUARD_MSG = /must be submitted before it can be marked complete/;
class Invalid extends Error {}
async function rest(who, method, path, body, prefer = 'return=representation') {
  const headers = { apikey: ANON, Authorization: `Bearer ${P[who].token}`, 'Content-Type': 'application/json', Prefer: prefer };
  let r;
  try { r = await request(API, method, `/rest/v1/${path}`, { headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new Invalid(e instanceof RedirectRefused || e instanceof TargetRefused ? e.message : `transport: ${e.message}`); }
  const j = r.json, code = j && !Array.isArray(j) && typeof j === 'object' ? j.code : undefined;
  const range = r.headers.get('content-range') || '-';
  let rows = 0;
  if (r.status >= 200 && r.status < 300) {
    if (Array.isArray(j)) rows = j.length;
    else if (j !== null && j !== undefined) rows = 1;
    else { const m = range.match(/^(\d+)-(\d+)\//); rows = m ? Number(m[2]) - Number(m[1]) + 1 : 0; }
  }
  let cls;
  if (r.status >= 200 && r.status < 300) cls = rows > 0 ? 'accepted' : 'zero-row';
  else if (code === '42501' && (r.status === 401 || r.status === 403)) cls = 'denied';
  else if (code === '23514' && r.status === 400 && GUARD_MSG.test(String(j?.message ?? ''))) cls = 'guard';
  else throw new Invalid(`unrecognised outcome HTTP ${r.status}${code ? ' ' + code : ''} on ${method} ${path.split('?')[0]} (not protection, not an expected result)`);
  return { status: r.status, code, rows, range, cls };
}
const say = (r) => `${r.cls} (HTTP ${r.status}${r.code ? ' ' + r.code : ''}, rows ${r.rows})`;

// ---------------------------------------------------------------- witness and maintenance helpers
const W = {
  sub: (u, a) => n(`select count(*) from public.assignment_submissions where user_id = ${lit(u)} and assignment_id = ${lit(a)}`),
  subState: (u, a) => q1(`select coalesce(string_agg(coalesce(workflow_state, 'NULL'), ','), 'none') from public.assignment_submissions where user_id = ${lit(u)} and assignment_id = ${lit(a)}`),
  subTs: (u, a) => q1(`select coalesce(string_agg(case when submitted_at is null then 'NULL' else 'set' end, ','), 'none') from public.assignment_submissions where user_id = ${lit(u)} and assignment_id = ${lit(a)}`),
  grade: (u, a) => q1(`select coalesce(string_agg(coalesce(trim_scale(grade::numeric)::text, 'NULL') || '|' || coalesce(trim_scale(score::numeric)::text, 'NULL'), ','), 'none') from public.assignment_submissions where user_id = ${lit(u)} and assignment_id = ${lit(a)}`),
  prog: (u, i) => n(`select count(*) from public.content_item_progressions where user_id = ${lit(u)} and content_item_id = ${lit(i)}`),
  progState: (u, i) => q1(`select coalesce(string_agg(workflow_state, ','), 'none') from public.content_item_progressions where user_id = ${lit(u)} and content_item_id = ${lit(i)}`),
  done: (u, i) => n(`select count(*) from public.content_item_progressions where user_id = ${lit(u)} and content_item_id = ${lit(i)} and workflow_state in ('read','completed','graded')`) > 0,
  certs: (u, c) => n(`select count(*) from public.certificates where user_id = ${lit(u)} and course_id = ${lit(c)}`),
  certIdentity: (u, c) => q1(`select coalesce(string_agg(id::text || '|' || coalesce(issued_at::text, 'NULL') || '|' || verification_code || '|' || md5(to_jsonb(x)::text), ',' order by id), 'none') from public.certificates x where user_id = ${lit(u)} and course_id = ${lit(c)}`),
  notes: (u) => n(`select count(*) from public.notifications where user_id = ${lit(u)}`),
  quiz: (u, qz) => q1(`select coalesce(string_agg(workflow_state || ':' || (finished_at is not null)::text, ','), 'none') from public.quiz_submissions where user_id = ${lit(u)} and quiz_id = ${lit(qz)}`),
};
const M = { // maintenance (postgres session): resets and fixture-only writes, never a tested operation
  reset: () => psql(`begin;
delete from public.certificates where user_id in (${lit(A)}, ${lit(B)}) and course_id in (${lit(F.C)}, ${lit(F.D)}, ${lit(F.E)}, ${lit(F.G)});
delete from public.content_item_progressions where user_id in (${lit(A)}, ${lit(B)}) and content_item_id in (select id from public.content_items where course_id in (${lit(F.C)}, ${lit(F.D)}, ${lit(F.E)}, ${lit(F.G)}));
delete from public.quiz_submission_answers where quiz_submission_id in (select id from public.quiz_submissions where quiz_id in (${lit(F.qC)}, ${lit(F.qD)}, ${lit(F.qG1)}, ${lit(F.qG2)}));
delete from public.quiz_submissions where quiz_id in (${lit(F.qC)}, ${lit(F.qD)}, ${lit(F.qG1)}, ${lit(F.qG2)});
delete from public.assignment_submissions where assignment_id in (${lit(F.aCA)}, ${lit(F.aCH)}, ${lit(F.aCU)}, ${lit(F.aDA)}, ${lit(F.aEA)});
commit;`),
  submission: (u, a, state = 'submitted', ts = true) => psql(`insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (${lit(a)}, ${lit(u)}, ${ts ? 'now()' : 'null'}, 'online_text_entry', 'fixture', ${state === null ? 'null' : lit(state)});`),
  progress: (u, i, s) => psql(`insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (${lit(u)}, ${lit(i)}, ${lit(s)});`),
  progressIfAbsent: (u, i, s) => psql(`insert into public.content_item_progressions (user_id, content_item_id, workflow_state) select ${lit(u)}, ${lit(i)}, ${lit(s)} where not exists (select 1 from public.content_item_progressions where user_id = ${lit(u)} and content_item_id = ${lit(i)});`),
  // fixture-finalized (finalizer not exercised): the database function score-quiz calls, as service_role in a database
  // session; the score-quiz Edge Function itself is not served, so it is not exercised.
  finalizeQuiz: (u, qz) => psql(`begin; set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.finalize_quiz_submission((select id from public.quiz_submissions where user_id = ${lit(u)} and quiz_id = ${lit(qz)} order by attempt desc limit 1), 1, 30);
commit;`),
};
const certcheck = () => psql('', ['-v', 'action=certcheck', '-f', env('T09_HISTORY_SQL')]);

// ---------------------------------------------------------------- the manifest (plan v2 sections 3 and 4, review H1-H3)
const PROT = ['zero-row', 'denied', 'guard'];           // a refusal; counts only with its exact witness
const PIN = ['accepted', 'zero-row', 'denied'];         // an identity/state pin: 'accepted' counts only if the witness is unchanged
const OK = ['accepted'];
const sub = (u, a, state = 'submitted', ts = true) => ({ assignment_id: a, user_id: u, submission_type: 'online_text_entry', body: 'api', workflow_state: state, submitted_at: ts ? new Date().toISOString() : null });
const prog = (u, i, s) => ({ user_id: u, content_item_id: i, workflow_state: s });
const pq = (u, i) => `content_item_progressions?user_id=eq.${u}&content_item_id=eq.${i}`;
const sq = (u, a) => `assignment_submissions?user_id=eq.${u}&assignment_id=eq.${a}`;
const qq = (u, qz) => `quiz_submissions?user_id=eq.${u}&quiz_id=eq.${qz}`;
const UPSERT = 'return=representation,resolution=merge-duplicates';
// step: { who, method, path, body, prefer, role: 'prereq'|'tested', expect: {NEW: classes, OLD: classes}, after?: () => {label: [actual, expected]} }
const T = (who, method, path, body, NEW, OLD = NEW, prefer) => ({ role: 'tested', who, method, path, body, prefer, expect: { NEW, OLD } });
const R = (who, method, path, body, after, prefer) => ({ role: 'prereq', who, method, path, body, prefer, expect: { NEW: OK, OLD: OK }, after });
const cases = [];
// c(id, ref, origin, title, { setup: () => {label: [actual, expected]}, steps: [...], witness: () => ({...}), state: {NEW: {...}, OLD: {...}}, reset })
const c = (cid, ref, origin, title, spec) => cases.push({ cid, ref, origin, title, reset: true, ...spec });

// Assignment submissions
c('S1', '08 F1+F4', 'sql-tier', 'A cannot submit to foreign course D; no notification to D\'s instructor', {
  setup: () => { const j0 = W.notes(J); cases.S1j0 = j0; return {}; },
  steps: [T('A', 'POST', 'assignment_submissions', sub(A, F.aDA), PROT, OK)],
  witness: () => ({ subs: W.sub(A, F.aDA), jNotesDelta: W.notes(J) - cases.S1j0 }),
  state: { NEW: { subs: 0, jNotesDelta: 0 }, OLD: { subs: 1, jNotesDelta: 1 } },
});
c('S2', '08 F2', 'sql-tier', 'A cannot submit to a hidden assignment in enrolled C', {
  steps: [T('A', 'POST', 'assignment_submissions', sub(A, F.aCH), PROT, OK)],
  witness: () => ({ subs: W.sub(A, F.aCH) }), state: { NEW: { subs: 0 }, OLD: { subs: 1 } },
});
c('S3', '08 F3', 'same', 'A cannot submit on behalf of B', {
  steps: [T('A', 'POST', 'assignment_submissions', sub(B, F.aCA), PROT)],
  witness: () => ({ bSubs: W.sub(B, F.aCA) }), state: { NEW: { bSubs: 0 }, OLD: { bSubs: 0 } },
});
c('S4', '08 P1', 'same', 'positive: A submits own visible assignment CA', {
  steps: [T('A', 'POST', 'assignment_submissions', sub(A, F.aCA), OK)],
  witness: () => ({ subs: W.sub(A, F.aCA), state: W.subState(A, F.aCA) }), state: { NEW: { subs: 1, state: 'submitted' }, OLD: { subs: 1, state: 'submitted' } },
});
c('S5', '08 P3', 'same', 'positive: A submits own unlinked assignment of C', {
  steps: [T('A', 'POST', 'assignment_submissions', sub(A, F.aCU), OK)],
  witness: () => ({ subs: W.sub(A, F.aCU) }), state: { NEW: { subs: 1 }, OLD: { subs: 1 } },
});
c('S6', '06 R1b / 08 P8', 'sql-tier', 'identity: A cannot move own VISIBLE submission CA -> CU', {
  setup: () => { M.submission(A, F.aCA); return { 'A submission on CA': [W.sub(A, F.aCA), 1] }; },
  steps: [T('A', 'PATCH', sq(A, F.aCA), { assignment_id: F.aCU }, PIN, OK)],
  witness: () => ({ CA: W.sub(A, F.aCA), CU: W.sub(A, F.aCU) }), state: { NEW: { CA: 1, CU: 0 }, OLD: { CA: 0, CU: 1 } },
});
c('S7', 'r4/r5 restrictive UPDATE on the OLD target (no SQL-tier twin)', 'source', 'access: A cannot finalize own submission on a HIDDEN assignment (identity unchanged)', {
  setup: () => { M.submission(A, F.aCH, 'unsubmitted', true); return { 'A unsubmitted row on hidden CHA': [W.subState(A, F.aCH), 'unsubmitted'] }; },
  steps: [T('A', 'PATCH', sq(A, F.aCH), { workflow_state: 'submitted', submitted_at: new Date().toISOString() }, PROT, OK)],
  witness: () => ({ state: W.subState(A, F.aCH), CA: W.sub(A, F.aCA) }), state: { NEW: { state: 'unsubmitted', CA: 0 }, OLD: { state: 'submitted', CA: 0 } },
});
c('S8', '06 R1 identity, from a hidden source row', 'sql-tier', 'identity: A cannot move own HIDDEN submission CHA -> visible CA', {
  setup: () => { M.submission(A, F.aCH, 'unsubmitted', true); return { 'A unsubmitted row on hidden CHA': [W.subState(A, F.aCH), 'unsubmitted'] }; },
  steps: [T('A', 'PATCH', sq(A, F.aCH), { assignment_id: F.aCA }, PIN, OK)],
  witness: () => ({ CH: W.sub(A, F.aCH), CA: W.sub(A, F.aCA) }), state: { NEW: { CH: 1, CA: 0 }, OLD: { CH: 0, CA: 1 } },
});
// Progress
c('G1', '08 F5', 'sql-tier', 'A cannot write progress on a page of foreign course D', {
  steps: [T('A', 'POST', 'content_item_progressions', prog(A, F.DP, 'read'), PROT, OK)],
  witness: () => ({ rows: W.prog(A, F.DP) }), state: { NEW: { rows: 0 }, OLD: { rows: 1 } },
});
c('G2', '08 F6', 'sql-tier', 'A cannot write progress on a hidden item of C', {
  steps: [T('A', 'POST', 'content_item_progressions', prog(A, F.CH, 'read'), PROT, OK)],
  witness: () => ({ rows: W.prog(A, F.CH) }), state: { NEW: { rows: 0 }, OLD: { rows: 1 } },
});
c('G3', '08 F8', 'same', 'A cannot write progress for B', {
  steps: [T('A', 'POST', 'content_item_progressions', prog(B, F.CP, 'read'), PROT)],
  witness: () => ({ bRows: W.prog(B, F.CP) }), state: { NEW: { bRows: 0 }, OLD: { bRows: 0 } },
});
c('G4', '08 P4 analogue', 'same', 'positive: A marks own visible page CP read (POST)', {
  steps: [T('A', 'POST', 'content_item_progressions', prog(A, F.CP, 'read'), OK)],
  witness: () => ({ state: W.progState(A, F.CP) }), state: { NEW: { state: 'read' }, OLD: { state: 'read' } },
});
c('G5', 'plan v2 s3', 'same', 'positive: UPSERT (merge-duplicates) of own CP row', {
  setup: () => { M.progress(A, F.CP, 'read'); return { 'A CP row': [W.progState(A, F.CP), 'read'] }; },
  steps: [T('A', 'POST', 'content_item_progressions?on_conflict=user_id,content_item_id', prog(A, F.CP, 'completed'), OK, OK, UPSERT)],
  witness: () => ({ rows: W.prog(A, F.CP), state: W.progState(A, F.CP) }), state: { NEW: { rows: 1, state: 'completed' }, OLD: { rows: 1, state: 'completed' } },
});
c('G6', '08 F5 (upsert)', 'sql-tier', 'UPSERT cannot write progress into foreign course D (valid submission pre-seeded, so only access can refuse)', {
  setup: () => { M.submission(A, F.aDA); return { 'A final submission on DA': [W.subState(A, F.aDA), 'submitted'] }; },
  steps: [T('A', 'POST', 'content_item_progressions?on_conflict=user_id,content_item_id', prog(A, F.DA, 'completed'), PROT, OK, UPSERT)],
  witness: () => ({ rows: W.prog(A, F.DA) }), state: { NEW: { rows: 0 }, OLD: { rows: 1 } },
});
c('G7', '08 F7', 'sql-tier', 'PATCH visible->foreign: own CP row cannot move onto D', {
  setup: () => { M.progress(A, F.CP, 'read'); return { 'A CP row': [W.progState(A, F.CP), 'read'] }; },
  steps: [T('A', 'PATCH', pq(A, F.CP), { content_item_id: F.DP }, PROT, OK)],
  witness: () => ({ CP: W.prog(A, F.CP), DP: W.prog(A, F.DP) }), state: { NEW: { CP: 1, DP: 0 }, OLD: { CP: 0, DP: 1 } },
});
c('G8', '09 T1', 'sql-tier', 'PATCH on hidden: own row on hidden CH cannot change state', {
  setup: () => { M.progress(A, F.CH, 'read'); return { 'A CH row': [W.progState(A, F.CH), 'read'] }; },
  steps: [T('A', 'PATCH', pq(A, F.CH), { workflow_state: 'completed' }, PROT, OK)],
  witness: () => ({ state: W.progState(A, F.CH) }), state: { NEW: { state: 'read' }, OLD: { state: 'completed' } },
});
c('G9', '09 T2', 'sql-tier', 'PATCH hidden->visible: own CH row cannot move onto visible CP', {
  setup: () => { M.progress(A, F.CH, 'read'); return { 'A CH row': [W.progState(A, F.CH), 'read'] }; },
  steps: [T('A', 'PATCH', pq(A, F.CH), { content_item_id: F.CP }, PROT, OK)],
  witness: () => ({ CH: W.prog(A, F.CH), CP: W.prog(A, F.CP) }), state: { NEW: { CH: 1, CP: 0 }, OLD: { CH: 0, CP: 1 } },
});
c('G10', '05 R1c', 'sql-tier', 'retarget: own COMPLETED CA row cannot become completion of unattempted quiz CQ', {
  setup: () => { M.submission(A, F.aCA); M.progress(A, F.CA, 'completed'); return { 'A final CA submission': [W.subState(A, F.aCA), 'submitted'], 'A CA row': [W.progState(A, F.CA), 'completed'], 'A attempts on CQ': [W.quiz(A, F.qC), 'none'] }; },
  steps: [T('A', 'PATCH', pq(A, F.CA), { content_item_id: F.CQ }, PROT, OK)],
  witness: () => ({ cqDone: W.done(A, F.CQ), CA: W.prog(A, F.CA) }), state: { NEW: { cqDone: false, CA: 1 }, OLD: { cqDone: true, CA: 0 } },
});
c('G11', '05 P3', 'same', 'preserved: a done row may still change state on its own item (completed -> read)', {
  setup: () => { M.progress(A, F.CP, 'completed'); return { 'A CP row': [W.progState(A, F.CP), 'completed'] }; },
  steps: [T('A', 'PATCH', pq(A, F.CP), { workflow_state: 'read' }, OK)],
  witness: () => ({ state: W.progState(A, F.CP) }), state: { NEW: { state: 'read' }, OLD: { state: 'read' } },
});
// Staff grading
c('K1', '08 P5', 'same', 'positive: instructor I grades B\'s submission in C (10-point assignment, grade 7)', {
  setup: () => { M.submission(B, F.aCA); return { 'B final CA submission': [W.subState(B, F.aCA), 'submitted'] }; },
  steps: [T('I', 'PATCH', sq(B, F.aCA), { grade: '7', workflow_state: 'graded', graded_at: new Date().toISOString() }, OK)],
  witness: () => ({ grade: W.grade(B, F.aCA).split('|')[0], state: W.subState(B, F.aCA) }), state: { NEW: { grade: '7', state: 'graded' }, OLD: { grade: '7', state: 'graded' } },
});
c('K2', '08 P6', 'same', 'unrelated instructor J cannot grade B\'s submission; row unchanged', {
  setup: () => { M.submission(B, F.aCA); return { 'B final CA submission': [W.subState(B, F.aCA), 'submitted'] }; },
  steps: [T('J', 'PATCH', sq(B, F.aCA), { grade: '9', workflow_state: 'graded' }, ['zero-row', 'denied'])],
  witness: () => ({ grade: W.grade(B, F.aCA).split('|')[0], state: W.subState(B, F.aCA) }), state: { NEW: { grade: 'NULL', state: 'submitted' }, OLD: { grade: 'NULL', state: 'submitted' } },
});
c('K3', 'plan v2 s3 (admin)', 'same', 'admin positive: ADMIN reads B\'s submission in C', {
  setup: () => { M.submission(B, F.aCA); return { 'B final CA submission': [W.subState(B, F.aCA), 'submitted'] }; },
  steps: [T('ADMIN', 'GET', `${sq(B, F.aCA)}&select=id`, undefined, OK)],
  witness: () => ({ state: W.subState(B, F.aCA) }), state: { NEW: { state: 'submitted' }, OLD: { state: 'submitted' } },
});
// Quiz
const startC = () => R('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC }, () => ({ 'A attempt on CQ started': [W.quiz(A, F.qC), 'pending_review:false'] }));
c('Q1', '03', 'same', 'positive: start_quiz_attempt for A in C', {
  steps: [T('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC }, OK)],
  witness: () => ({ attempt: W.quiz(A, F.qC) }), state: { NEW: { attempt: 'pending_review:false' }, OLD: { attempt: 'pending_review:false' } },
});
c('Q2', '03', 'same', 'start_quiz_attempt for A in foreign D is refused', {
  steps: [T('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qD }, ['denied'])],
  witness: () => ({ attempt: W.quiz(A, F.qD) }), state: { NEW: { attempt: 'none' }, OLD: { attempt: 'none' } },
});
c('Q3', '04 A1/A2', 'sql-tier', 'a started-only attempt does not complete CQ; no certificate', {
  setup: () => { M.submission(A, F.aCA); M.progress(A, F.CA, 'completed'); M.progress(A, F.CP, 'read'); return { 'A CA row': [W.progState(A, F.CA), 'completed'], 'A CP row': [W.progState(A, F.CP), 'read'] }; },
  steps: [startC(), T('A', 'POST', 'content_item_progressions', prog(A, F.CQ, 'completed'), ['guard'], OK)],
  witness: () => ({ cqDone: W.done(A, F.CQ), certs: W.certs(A, F.C) }), state: { NEW: { cqDone: false, certs: 0 }, OLD: { cqDone: true, certs: 1 } },
});
c('Q4', '04 B1', 'sql-tier', 'A cannot forge finalization (workflow_state complete, finished_at) of own attempt', {
  steps: [startC(), T('A', 'PATCH', qq(A, F.qC), { workflow_state: 'complete', finished_at: new Date().toISOString() }, PIN, OK)],
  witness: () => ({ attempt: W.quiz(A, F.qC) }), state: { NEW: { attempt: 'pending_review:false' }, OLD: { attempt: 'complete:true' } },
});
c('Q5', '05 R2d', 'same', 'A cannot move own attempt to B (identity pinned or denied)', {
  steps: [startC(), T('A', 'PATCH', qq(A, F.qC), { user_id: B }, PIN)],
  witness: () => ({ A: W.quiz(A, F.qC), B: W.quiz(B, F.qC) }), state: { NEW: { A: 'pending_review:false', B: 'none' }, OLD: { A: 'pending_review:false', B: 'none' } },
});
c('Q6', '04 C2/C3', 'same', 'positive: fixture-finalized (finalizer not exercised) attempt lets A complete CQ; exactly one certificate', {
  setup: () => { M.submission(A, F.aCA); M.progress(A, F.CA, 'completed'); M.progress(A, F.CP, 'read'); return { 'A CA row': [W.progState(A, F.CA), 'completed'], 'A CP row': [W.progState(A, F.CP), 'read'] }; },
  steps: [R('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC }, () => { M.finalizeQuiz(A, F.qC); return { 'A attempt on CQ fixture-finalized': [W.quiz(A, F.qC), 'complete:true'] }; }),
    T('A', 'POST', 'content_item_progressions', prog(A, F.CQ, 'completed'), OK)],
  witness: () => ({ cqDone: W.done(A, F.CQ), certs: W.certs(A, F.C) }), state: { NEW: { cqDone: true, certs: 1 }, OLD: { cqDone: true, certs: 1 } },
});
c('Q7', '05 R2a/R2c', 'sql-tier', 'retarget: A cannot move a COMPLETED attempt from quiz GQ1 to a second accessible quiz GQ2, nor complete GQ2 with it', {
  steps: [
    R('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qG1 }, () => { M.finalizeQuiz(A, F.qG1); return { 'A attempt on GQ1 fixture-finalized': [W.quiz(A, F.qG1), 'complete:true'], 'A attempts on GQ2': [W.quiz(A, F.qG2), 'none'] }; }),
    T('A', 'PATCH', qq(A, F.qG1), { quiz_id: F.qG2 }, PIN, OK),
    T('A', 'POST', 'content_item_progressions', prog(A, F.GQ2, 'completed'), ['guard'], OK),
  ],
  witness: () => ({ onGQ1: W.quiz(A, F.qG1), onGQ2: W.quiz(A, F.qG2), gq2Done: W.done(A, F.GQ2), certs: W.certs(A, F.G) }),
  state: { NEW: { onGQ1: 'complete:true', onGQ2: 'none', gq2Done: false, certs: 0 }, OLD: { onGQ1: 'none', onGQ2: 'complete:true', gq2Done: true, certs: 0 } },
});
// Section 4: final-evidence matrix in assignment-only course E; each case on its own reset fixture
const subE = (state, ts, stateWant, tsWant) => R('A', 'POST', 'assignment_submissions', sub(A, F.aEA, state, ts), () => ({ 'A EA submission state': [W.subState(A, F.aEA), stateWant], 'A EA submitted_at': [W.subTs(A, F.aEA), tsWant] }));
const pageE = () => R('A', 'POST', 'content_item_progressions', prog(A, F.EP, 'read'), () => ({ 'A EP row': [W.progState(A, F.EP), 'read'] }));
const doneE = (NEW, OLD) => T('A', 'POST', 'content_item_progressions', prog(A, F.EA, 'completed'), NEW, OLD);
const wE = () => ({ eaDone: W.done(A, F.EA), certs: W.certs(A, F.E) });
const YES = { eaDone: true, certs: 1 }, NO = { eaDone: false, certs: 0 };
c('E1', '09 R1', 'same', 'positive: submitted + submitted_at completes EA; exactly one certificate', { steps: [subE('submitted', true, 'submitted', 'set'), pageE(), doneE(OK, OK)], witness: wE, state: { NEW: YES, OLD: YES } });
c('E2', '02 (null ts)', 'same', 'negative: submitted + NULL submitted_at is not final evidence', { steps: [subE('submitted', false, 'submitted', 'NULL'), pageE(), doneE(['guard'], ['guard'])], witness: wE, state: { NEW: NO, OLD: NO } });
c('E3', '09 N1', 'sql-tier', 'negative: timestamped UNSUBMITTED is not final evidence', { steps: [subE('unsubmitted', true, 'unsubmitted', 'set'), pageE(), doneE(['guard'], OK)], witness: wE, state: { NEW: NO, OLD: YES } });
c('E4', '09 N2', 'sql-tier', 'negative: timestamped DRAFT is not final evidence', { steps: [subE('draft', true, 'draft', 'set'), pageE(), doneE(['guard'], OK)], witness: wE, state: { NEW: NO, OLD: YES } });
c('E5', '09 N3', 'sql-tier', 'negative: timestamped other state is not final evidence', { steps: [subE('pending_review', true, 'pending_review', 'set'), pageE(), doneE(['guard'], OK)], witness: wE, state: { NEW: NO, OLD: YES } });
c('E6', '09 N4', 'sql-tier', 'negative: timestamped NULL state is not final evidence', { steps: [subE(null, true, 'NULL', 'set'), pageE(), doneE(['guard'], OK)], witness: wE, state: { NEW: NO, OLD: YES } });
c('E7', '09 P3', 'same', 'positive: legitimate own finalization (unsubmitted -> submitted) then completion', {
  setup: () => { M.submission(A, F.aEA, 'unsubmitted', true); return { 'A EA submission state': [W.subState(A, F.aEA), 'unsubmitted'] }; },
  steps: [T('A', 'PATCH', sq(A, F.aEA), { workflow_state: 'submitted', submitted_at: new Date().toISOString() }, OK), pageE(), doneE(OK, OK)],
  witness: () => ({ state: W.subState(A, F.aEA), ...wE() }), state: { NEW: { state: 'submitted', ...YES }, OLD: { state: 'submitted', ...YES } },
});
c('E8', '09 N5', 'sql-tier', 'negative: A cannot promote own submission to graded, nor complete EA with it', {
  setup: () => { M.submission(A, F.aEA, 'unsubmitted', true); return { 'A EA submission state': [W.subState(A, F.aEA), 'unsubmitted'] }; },
  steps: [T('A', 'PATCH', sq(A, F.aEA), { workflow_state: 'graded' }, PIN, OK), doneE(['guard'], OK)],
  witness: () => ({ state: W.subState(A, F.aEA), ...wE() }), state: { NEW: { state: 'unsubmitted', eaDone: false, certs: 0 }, OLD: { state: 'graded', eaDone: true, certs: 0 } },
});
// E9: the OLD expectation (completion refused) was first OBSERVED on a LOCAL-SHIM OLD run and only then checked against the OLD
// guard's source (it requires submitted_at); it has no SQL-tier twin (09 P1 grades a TIMESTAMPED submission). The staff grade is
// an API PREREQUISITE: unless the witness shows graded + submitted_at NULL + grade 0 + score 0, the case is INVALID in both modes,
// so a refused grading can never stand in for the OLD completion refusal.
c('E9', 'r5 predicate (no SQL-tier twin)', 'observed', 'positive: staff-graded score 0 with submitted_at STILL NULL is final evidence; exactly one certificate', {
  setup: () => { M.submission(A, F.aEA, 'unsubmitted', false); return { 'A EA submission state': [W.subState(A, F.aEA), 'unsubmitted'], 'A EA submitted_at': [W.subTs(A, F.aEA), 'NULL'] }; },
  steps: [R('I', 'PATCH', sq(A, F.aEA), { grade: '0', score: 0, workflow_state: 'graded', graded_at: new Date().toISOString() },
    () => ({ 'EA graded by staff': [W.subState(A, F.aEA), 'graded'], 'EA submitted_at still NULL': [W.subTs(A, F.aEA), 'NULL'], 'EA grade|score': [W.grade(A, F.aEA), '0|0'] })),
  pageE(), doneE(OK, ['guard'])],
  witness: wE, state: { NEW: YES, OLD: NO },
});
// Legacy-invalid rows seeded before the history window (courses LA..LD). The trigger-firing write must itself be ACCEPTED and
// persisted (or the case is INVALID); only then does "no NEW certificate" mean anything.
const legacy = (cid, ref, title, k, item, step, rowWant) => c(cid, ref, 'sql-tier', title, {
  reset: false,
  setup: () => ({ [`A certificates in ${k}`]: [W.certs(A, L[k].C), 0] }),
  steps: [step], witness: () => ({ row: W.progState(A, item), certs: W.certs(A, L[k].C) }),
  state: { NEW: { row: rowWant, certs: 0 }, OLD: { row: rowWant, certs: 1 } },
});
legacy('L1', '09 L1 / 08 L1', 'assignment-only legacy-invalid: a genuine page completion issues no NEW certificate', 'LA', L.LA.P, T('A', 'POST', 'content_item_progressions', prog(A, L.LA.P, 'read'), OK), 'read');
legacy('L2', '09 R2/L2', 'page-update no-op on a legacy-invalid course issues no NEW certificate', 'LB', L.LB.P, T('A', 'PATCH', pq(A, L.LB.P), { workflow_state: 'read' }, OK), 'read');
legacy('L3', '09 L2 / 08 L2', 'assignment no-op on the legacy-invalid done row issues no NEW certificate', 'LC', L.LC.I, T('A', 'PATCH', pq(A, L.LC.I), { workflow_state: 'completed' }, OK), 'completed');
legacy('L4', '02 [T-09] started-only', 'invalid-quiz-only legacy (started-only attempt + done row): a page completion issues no NEW certificate', 'LD', L.LD.P, T('A', 'POST', 'content_item_progressions', prog(A, L.LD.P, 'read'), OK), 'read');
c('L5', '09 L3', 'same', 'legacy rows preserved (no rewrite): every legacy done row and staged submission still present', {
  reset: false, steps: [],
  witness: () => ({
    done: n(`select count(*) from public.content_item_progressions where user_id = ${lit(A)} and content_item_id in (${Object.values(L).map((x) => lit(x.I)).join(', ')}) and workflow_state = 'completed'`),
    staged: n(`select count(*) from public.assignment_submissions where user_id = ${lit(A)} and assignment_id in (${[L.LA.a, L.LB.a, L.LC.a].map(lit).join(', ')}) and workflow_state = 'unsubmitted'`),
  }),
  state: { NEW: { done: 4, staged: 3 }, OLD: { done: 4, staged: 3 } },
});
// Protected history course H, acting as the SAME subjects the history holds (review H3). No reset: these cases touch only H,
// each sets up what it needs (idempotent maintenance) and asserts the certificate identity before and after.
const hcCert = () => W.certIdentity(HC, H.C);
c('H1', 'review H3 (same subject)', 'same', 'HC (legacy certificate holder) marks HP read: the legacy certificate keeps its identity and hash; no second certificate', {
  reset: false,
  setup: () => { cases.H1c = hcCert(); return { 'HC holds exactly one legacy certificate in H': [W.certs(HC, H.C), 1], 'HC HP row absent': [W.progState(HC, H.P), 'none'] }; },
  steps: [T('HC', 'POST', 'content_item_progressions', prog(HC, H.P, 'read'), OK)],
  witness: () => ({ row: W.progState(HC, H.P), certs: W.certs(HC, H.C), certSame: hcCert() === cases.H1c }),
  state: { NEW: { row: 'read', certs: 1, certSame: true }, OLD: { row: 'read', certs: 1, certSame: true } },
});
c('H2', 'review H3 (repeated trigger)', 'same', 'HC repeats a no-op PATCH on HP twice: certificate identity and hash unchanged; still exactly one', {
  reset: false,
  setup: () => { M.progressIfAbsent(HC, H.P, 'read'); cases.H2c = hcCert(); return { 'HC HP row': [W.progState(HC, H.P), 'read'], 'HC certificates': [W.certs(HC, H.C), 1] }; },
  steps: [T('HC', 'PATCH', pq(HC, H.P), { workflow_state: 'read' }, OK), T('HC', 'PATCH', pq(HC, H.P), { workflow_state: 'read' }, OK)],
  witness: () => ({ certs: W.certs(HC, H.C), certSame: hcCert() === cases.H2c }),
  state: { NEW: { certs: 1, certSame: true }, OLD: { certs: 1, certSame: true } },
});
c('H3', '02 guard (same subject, no evidence)', 'same', 'HC cannot complete HA without a submission; legacy certificate unchanged', {
  reset: false,
  setup: () => { cases.H3c = hcCert(); return { 'HC submissions on HA': [W.sub(HC, H.a), 0], 'HC HA row absent': [W.progState(HC, H.A), 'none'] }; },
  steps: [T('HC', 'POST', 'content_item_progressions', prog(HC, H.A, 'completed'), ['guard'])],
  witness: () => ({ haDone: W.done(HC, H.A), certs: W.certs(HC, H.C), certSame: hcCert() === cases.H3c }),
  state: { NEW: { haDone: false, certs: 1, certSame: true }, OLD: { haDone: false, certs: 1, certSame: true } },
});
c('H4', 'review H3 (valid pre-migration history, fresh certificate)', 'same', 'HG completes HQ on genuine pre-migration evidence: exactly one FRESH certificate', {
  reset: false,
  setup: () => ({ 'HG final HA submission (pre-migration)': [W.subState(HG, H.a), 'submitted'], 'HG HA submitted_at': [W.subTs(HG, H.a), 'set'],
    'HG finalized HQ attempt (pre-migration)': [W.quiz(HG, H.q), 'complete:true'], 'HG HP/HA rows': [`${W.progState(HG, H.P)}/${W.progState(HG, H.A)}`, 'read/completed'],
    'HG HQ row absent': [W.progState(HG, H.Q), 'none'], 'HG certificates in H': [W.certs(HG, H.C), 0] }),
  steps: [T('HG', 'POST', 'content_item_progressions', prog(HG, H.Q, 'completed'), OK)],
  witness: () => ({ hqDone: W.done(HG, H.Q), certs: W.certs(HG, H.C) }),
  state: { NEW: { hqDone: true, certs: 1 }, OLD: { hqDone: true, certs: 1 } },
});
c('H5', 'review H3 (repeated trigger on a fresh certificate)', 'same', 'HG repeats a no-op PATCH on HQ twice: the fresh certificate keeps its identity; still exactly one', {
  reset: false,
  setup: () => { M.progressIfAbsent(HG, H.Q, 'completed'); cases.H5c = W.certIdentity(HG, H.C); return { 'HG HQ row': [W.progState(HG, H.Q), 'completed'], 'HG certificates': [W.certs(HG, H.C), 1] }; },
  steps: [T('HG', 'PATCH', pq(HG, H.Q), { workflow_state: 'completed' }, OK), T('HG', 'PATCH', pq(HG, H.Q), { workflow_state: 'completed' }, OK)],
  witness: () => ({ certs: W.certs(HG, H.C), certSame: W.certIdentity(HG, H.C) === cases.H5c }),
  state: { NEW: { certs: 1, certSame: true }, OLD: { certs: 1, certSame: true } },
});

// ---------------------------------------------------------------- manifest
if (MANIFEST) {
  const out = cases.map((k) => ({
    case: k.cid, ref: k.ref, oldExpectationOrigin: k.origin, title: k.title, resetBefore: k.reset,
    steps: k.steps.map((s) => ({ role: s.role, persona: s.who, method: s.method, path: s.path.split('?')[0], expectClass: s.expect })),
    expectState: k.state,
  }));
  console.log(JSON.stringify({ cases: out.length, classes: ['accepted', 'zero-row', 'denied', 'guard'], manifest: out }, null, 1));
  process.exit(0);
}

// ---------------------------------------------------------------- run
const results = { pass: 0, fail: 0, invalid: 0, oldReproduced: 0 };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const k of cases) {
  const log = [];
  let verdict;
  try {
    if (k.reset) M.reset();
    for (const [label, [got, want]] of Object.entries(k.setup ? k.setup() : {})) if (!eq(got, want)) throw new Invalid(`setup witness '${label}' is ${JSON.stringify(got)}, needs ${JSON.stringify(want)}`);
    const testedOk = [];
    for (const s of k.steps) {
      const r = await rest(s.who, s.method, s.path, s.body, s.prefer);
      const want = s.expect[MODE];
      if (s.role === 'prereq') {
        if (!want.includes(r.cls)) throw new Invalid(`API prerequisite ${s.who} ${s.method} ${s.path.split('?')[0]} was ${say(r)}, needs ${want.join('|')}`);
        for (const [label, [got, w]] of Object.entries(s.after ? s.after() : {})) if (!eq(got, w)) throw new Invalid(`prerequisite witness '${label}' is ${JSON.stringify(got)}, needs ${JSON.stringify(w)}`);
        log.push(`prereq ${s.who} ${s.method} ${say(r)}`);
      } else {
        testedOk.push(want.includes(r.cls));
        log.push(`${s.who} ${s.method} ${say(r)}${want.includes(r.cls) ? '' : ` [expected ${want.join('|')}]`}`);
      }
    }
    const w = k.witness(); const ws = k.state[MODE];
    const stateBad = Object.entries(ws).filter(([key, v]) => !eq(w[key], v)).map(([key, v]) => `${key}=${JSON.stringify(w[key])} (expected ${JSON.stringify(v)})`);
    log.push(`witness ${Object.entries(w).map(([key, v]) => `${key}=${JSON.stringify(v)}`).join(' ')}`);
    if (stateBad.length) log.push(`state mismatch: ${stateBad.join(', ')}`);
    certcheck();                                     // protected history re-checked after every case
    verdict = testedOk.every(Boolean) && stateBad.length === 0 ? 'PASS' : 'FAIL';
  } catch (e) {
    verdict = 'INVALID'; log.push(e instanceof Invalid ? e.message : `${e.infra ? 'infrastructure' : 'error'}: ${e.message}`);
  }
  const hole = MODE === 'OLD' && k.origin !== 'same' && !eq(k.state.OLD, k.state.NEW);
  if (verdict === 'PASS') { results.pass++; if (hole) results.oldReproduced++; }
  else if (verdict === 'FAIL') results.fail++; else results.invalid++;
  const tag = verdict === 'PASS' && hole ? ` OLD/NEW difference shown positively (OLD expectation origin: ${k.origin})` : '';
  console.log(`${verdict} ${k.cid} [${k.ref}] ${k.title}${tag}: ${log.join('; ')}`);
}
console.log(`== api-controls ${MODE}: ${cases.length} cases, ${results.pass} as manifested (${results.oldReproduced} OLD/NEW differences shown positively), ${results.fail} FAIL, ${results.invalid} INVALID; protected certificates re-checked after every case`);
process.exit(results.fail || results.invalid ? 1 : 0);
