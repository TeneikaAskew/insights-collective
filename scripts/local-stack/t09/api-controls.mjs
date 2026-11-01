#!/usr/bin/env node
// ABOUTME: T-09 API tier (plan v2 sections 3 and 4): learner/staff writes through the REST API with real persona JWTs, each
// ABOUTME: asserted by status AND a database witness of persisted state, progress, certificates and notifications.
//
// Usage: api-controls.mjs seed-legacy|run OLD|NEW
// Env:   T09_API_URL (loopback), T09_ANON_KEY_FILE, T09_PERSONA_FILE (0600, from personas.sh), SUPABASE_DB_URL (loopback),
//        T09_HISTORY_SQL (history-hash.sql path, for the certificate re-check after every trigger-firing case)
// Roles of each call, never mixed: a PERSONA call is the tested operation; database `setup`, `witness` and `maintenance`
// statements run as the trusted local postgres session and are never counted as a tested operation. No service-role
// HTTP call is made at all.
// Output: one line per case, PASS/FAIL (and INVALID for an infrastructure error), never a token, key or DSN.
//   NEW: every case must PASS.
//   OLD: cases marked old:'fail' must FAIL behaviourally (the pre-T-09 hole reproduces; `ref` names the SQL-tier check that
//        fails on OLD), every other case must PASS. An infrastructure error is INVALID in either mode and fails the run.
// Not exercised: the score-quiz Edge Function (functions are not served); finalized attempts are written as maintenance
// and labelled "fixture-finalized (finalizer not exercised)".
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [phase, MODE] = process.argv.slice(2);
if (!['seed-legacy', 'run'].includes(phase) || !['OLD', 'NEW'].includes(MODE)) { console.error('usage: api-controls.mjs seed-legacy|run OLD|NEW'); process.exit(2); }
const env = (k) => { const v = process.env[k]; if (!v) { console.error(`api-controls: ${k} is required`); process.exit(2); } return v; };
const db = new URL(env('SUPABASE_DB_URL'));
if (!['127.0.0.1', 'localhost'].includes(db.hostname)) { console.error('api-controls: database must be loopback'); process.exit(2); }
const personaFile = env('T09_PERSONA_FILE');
if ((statSync(personaFile).mode & 0o077) !== 0) { console.error('api-controls: persona file must be mode 600'); process.exit(2); }
const P = JSON.parse(readFileSync(personaFile, 'utf8'));
for (const k of ['A', 'B', 'I', 'J', 'ADMIN']) if (!P[k]?.id || !P[k]?.token) { console.error(`api-controls: persona ${k} missing`); process.exit(2); }

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

// Fixed fixture ids. Legacy courses LA..LD are seeded BEFORE the history window; C, D, E after the migrations.
const id = (s) => `7b000000-0000-4000-8000-${s.padStart(12, '0')}`;
const F = {
  C: id('c00'), CM: id('c01'), CP: id('c02'), CA: id('c03'), CQ: id('c04'), CH: id('c05'), CHA: id('c06'),
  aCA: id('d03'), aCH: id('d06'), aCU: id('d07'), qC: id('e04'), qCq: id('f04'),
  D: id('a00'), DM: id('a01'), DP: id('a02'), DA: id('a03'), DQ: id('a04'), aDA: id('b03'), qD: id('b04'), qDq: id('b05'),
  E: id('900'), EM: id('901'), EP: id('902'), EA: id('903'), aEA: id('904'),
};
const L = {}; // legacy courses: <X>, <X>M, <X>P page, <X>I assessed item, a<X> assignment / q<X> quiz
for (const [k, base] of [['LA', 0x100], ['LB', 0x200], ['LC', 0x300], ['LD', 0x400]]) {
  const h = (o) => id((base + o).toString(16));
  L[k] = { C: h(0), M: h(1), P: h(2), I: h(3), a: h(4), q: h(5), qq: h(6) };
}
const { A, B, I, J, ADMIN } = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.id]));

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
psql(`begin;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (${lit(F.C)}, 'T-09 API course C', 's', 'General', 'beginner', ${lit(I)}, true),
  (${lit(F.D)}, 'T-09 API course D', 's', 'General', 'beginner', ${lit(J)}, true),
  (${lit(F.E)}, 'T-09 API course E (assignment-only)', 's', 'General', 'beginner', ${lit(I)}, true);
insert into public.modules (id, course_id, title, position, published) values (${lit(F.CM)}, ${lit(F.C)}, 'CM', 1, true), (${lit(F.DM)}, ${lit(F.D)}, 'DM', 1, true), (${lit(F.EM)}, ${lit(F.E)}, 'EM', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (${lit(F.CP)}, ${lit(F.C)}, ${lit(F.CM)}, 'page', 'CP', 1, true), (${lit(F.CA)}, ${lit(F.C)}, ${lit(F.CM)}, 'assignment', 'CA', 2, true),
  (${lit(F.CQ)}, ${lit(F.C)}, ${lit(F.CM)}, 'quiz', 'CQ', 3, true), (${lit(F.CH)}, ${lit(F.C)}, ${lit(F.CM)}, 'page', 'CH hidden', 4, false),
  (${lit(F.CHA)}, ${lit(F.C)}, ${lit(F.CM)}, 'assignment', 'CHA hidden', 5, false),
  (${lit(F.DP)}, ${lit(F.D)}, ${lit(F.DM)}, 'page', 'DP', 1, true), (${lit(F.DA)}, ${lit(F.D)}, ${lit(F.DM)}, 'assignment', 'DA', 2, true),
  (${lit(F.DQ)}, ${lit(F.D)}, ${lit(F.DM)}, 'quiz', 'DQ', 3, true),
  (${lit(F.EP)}, ${lit(F.E)}, ${lit(F.EM)}, 'page', 'EP', 1, true), (${lit(F.EA)}, ${lit(F.E)}, ${lit(F.EM)}, 'assignment', 'EA', 2, true);
insert into public.assignments (id, content_item_id, course_id, title, points) values
  (${lit(F.aCA)}, ${lit(F.CA)}, ${lit(F.C)}, 'CA', 10), (${lit(F.aCH)}, ${lit(F.CHA)}, ${lit(F.C)}, 'CHA', 10), (${lit(F.aCU)}, null, ${lit(F.C)}, 'CU unlinked', 10),
  (${lit(F.aDA)}, ${lit(F.DA)}, ${lit(F.D)}, 'DA', 10), (${lit(F.aEA)}, ${lit(F.EA)}, ${lit(F.E)}, 'EA', 10);
insert into public.quizzes (id, content_item_id, title, allowed_attempts) values (${lit(F.qC)}, ${lit(F.CQ)}, 'CQ', 0), (${lit(F.qD)}, ${lit(F.DQ)}, 'DQ', 0);
insert into public.quiz_questions (id, quiz_id, question_text, question_type, correct_answer, points, position) values
  (${lit(F.qCq)}, ${lit(F.qC)}, 'Q1', 'multiple_choice', '"a"', 1, 1), (${lit(F.qDq)}, ${lit(F.qD)}, 'Q1', 'multiple_choice', '"a"', 1, 1);
insert into public.enrollments (user_id, course_id) values (${lit(A)}, ${lit(F.C)}), (${lit(B)}, ${lit(F.C)}), (${lit(A)}, ${lit(F.E)});
commit;`);

// ---------------------------------------------------------------- HTTP (tested operations only)
const API = env('T09_API_URL').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API)) { console.error('api-controls: API must be loopback http'); process.exit(2); }
const ANON = readFileSync(env('T09_ANON_KEY_FILE'), 'utf8').trim();
async function rest(who, method, path, body, prefer = 'return=representation') {
  const headers = { apikey: ANON, Authorization: `Bearer ${P[who].token}`, 'Content-Type': 'application/json', Prefer: prefer };
  let r;
  try {
    r = await fetch(`${API}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  } catch (e) { throw Object.assign(new Error(`HTTP ${method} ${path.split('?')[0]} failed: ${e.name}`), { infra: true }); }
  const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (r.status >= 500 || r.status === 404 || r.status === 401) throw Object.assign(new Error(`HTTP ${r.status} on ${method} ${path.split('?')[0]} (infrastructure, not behaviour)`), { infra: true });
  return { status: r.status, rows: Array.isArray(json) ? json.length : (json && r.status < 300 ? 1 : 0), range: r.headers.get('content-range') || '-', code: json?.code };
}
const say = (r) => `HTTP ${r.status}${r.code ? ' ' + r.code : ''} range ${r.range}`;

// ---------------------------------------------------------------- witness and maintenance helpers
const W = {
  sub: (u, a) => n(`select count(*) from public.assignment_submissions where user_id = ${lit(u)} and assignment_id = ${lit(a)}`),
  subState: (u, a) => q1(`select coalesce(string_agg(coalesce(workflow_state, 'NULL'), ','), 'none') from public.assignment_submissions where user_id = ${lit(u)} and assignment_id = ${lit(a)}`),
  prog: (u, i) => n(`select count(*) from public.content_item_progressions where user_id = ${lit(u)} and content_item_id = ${lit(i)}`),
  done: (u, i) => n(`select count(*) from public.content_item_progressions where user_id = ${lit(u)} and content_item_id = ${lit(i)} and workflow_state in ('read','completed','graded')`) > 0,
  certs: (u, c) => n(`select count(*) from public.certificates where user_id = ${lit(u)} and course_id = ${lit(c)}`),
  notes: (u) => n(`select count(*) from public.notifications where user_id = ${lit(u)}`),
  quiz: (u, qz) => q1(`select coalesce(string_agg(workflow_state || ':' || (finished_at is not null)::text, ','), 'none') from public.quiz_submissions where user_id = ${lit(u)} and quiz_id = ${lit(qz)}`),
};
const M = { // maintenance (postgres session): resets and fixture-only writes, never a tested operation
  reset: () => psql(`begin;
delete from public.certificates where user_id in (${lit(A)}, ${lit(B)}) and course_id in (${lit(F.C)}, ${lit(F.D)}, ${lit(F.E)});
delete from public.content_item_progressions where user_id in (${lit(A)}, ${lit(B)}) and content_item_id in (select id from public.content_items where course_id in (${lit(F.C)}, ${lit(F.D)}, ${lit(F.E)}));
delete from public.quiz_submission_answers where quiz_submission_id in (select id from public.quiz_submissions where quiz_id in (${lit(F.qC)}, ${lit(F.qD)}));
delete from public.quiz_submissions where quiz_id in (${lit(F.qC)}, ${lit(F.qD)});
delete from public.assignment_submissions where assignment_id in (${lit(F.aCA)}, ${lit(F.aCH)}, ${lit(F.aCU)}, ${lit(F.aDA)}, ${lit(F.aEA)});
commit;`),
  submission: (u, a, state = 'submitted', ts = true) => psql(`insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (${lit(a)}, ${lit(u)}, ${ts ? 'now()' : 'null'}, 'online_text_entry', 'fixture', ${state === null ? 'null' : lit(state)});`),
  progress: (u, i, s) => psql(`insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (${lit(u)}, ${lit(i)}, ${lit(s)});`),
  // fixture-finalized (finalizer not exercised): the database function score-quiz calls, as service_role in a database
  // session; the score-quiz Edge Function itself is not served, so it is not exercised.
  finalizeQuiz: (u, qz) => psql(`begin; set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.finalize_quiz_submission((select id from public.quiz_submissions where user_id = ${lit(u)} and quiz_id = ${lit(qz)} order by attempt desc limit 1), 1, 30);
commit;`),
};
const histSql = env('T09_HISTORY_SQL');
const certcheck = () => psql('', ['-v', 'action=certcheck', '-f', histSql]);

// ---------------------------------------------------------------- the cases (plan v2 sections 3 and 4)
const sub = (u, a, state = 'submitted', ts = true) => ({ assignment_id: a, user_id: u, submission_type: 'online_text_entry', body: 'api', workflow_state: state, submitted_at: ts ? new Date().toISOString() : null });
const prog = (u, i, s) => ({ user_id: u, content_item_id: i, workflow_state: s });
const cases = [];
const c = (cid, ref, old, fn) => cases.push({ cid, ref, old, fn });

// Assignment submissions
c('S1 A cannot submit to foreign course D; no notification to D\'s instructor', '08 F1+F4', 'fail', async () => {
  const j0 = W.notes(J); const r = await rest('A', 'POST', 'assignment_submissions', sub(A, F.aDA));
  return { ok: W.sub(A, F.aDA) === 0 && W.notes(J) === j0, d: `${say(r)}; witness subs=${W.sub(A, F.aDA)} J-notes delta=${W.notes(J) - j0}` };
});
c('S2 A cannot submit to a hidden assignment in enrolled C', '08 F2', 'fail', async () => {
  const r = await rest('A', 'POST', 'assignment_submissions', sub(A, F.aCH)); return { ok: W.sub(A, F.aCH) === 0, d: `${say(r)}; witness subs=${W.sub(A, F.aCH)}` };
});
c('S3 A cannot submit on behalf of B', '08 F3', 'pass', async () => {
  const r = await rest('A', 'POST', 'assignment_submissions', sub(B, F.aCA)); return { ok: W.sub(B, F.aCA) === 0, d: `${say(r)}; witness B subs=${W.sub(B, F.aCA)}` };
});
c('S4 positive: A submits own visible assignment CA', '08 P1', 'pass', async () => {
  const r = await rest('A', 'POST', 'assignment_submissions', sub(A, F.aCA)); return { ok: r.status === 201 && W.sub(A, F.aCA) === 1, d: `${say(r)}; witness subs=${W.sub(A, F.aCA)}` };
});
c('S5 positive: A submits own unlinked assignment of C', '08 P3', 'pass', async () => {
  const r = await rest('A', 'POST', 'assignment_submissions', sub(A, F.aCU)); return { ok: r.status === 201 && W.sub(A, F.aCU) === 1, d: `${say(r)}; witness subs=${W.sub(A, F.aCU)}` };
});
c('S6 submission identity pin: A cannot move own submission CA -> CU', '06 R1b / 08 P8', 'fail', async () => {
  M.submission(A, F.aCA); const r = await rest('A', 'PATCH', `assignment_submissions?user_id=eq.${A}&assignment_id=eq.${F.aCA}`, { assignment_id: F.aCU });
  return { ok: W.sub(A, F.aCA) === 1 && W.sub(A, F.aCU) === 0, d: `${say(r)}; witness CA=${W.sub(A, F.aCA)} CU=${W.sub(A, F.aCU)}` };
});
// Progress
c('G1 A cannot write progress on a page of foreign course D', '08 F5', 'fail', async () => {
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, F.DP, 'read')); return { ok: W.prog(A, F.DP) === 0, d: `${say(r)}; witness rows=${W.prog(A, F.DP)}` };
});
c('G2 A cannot write progress on a hidden item of C', '08 F6', 'fail', async () => {
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, F.CH, 'read')); return { ok: W.prog(A, F.CH) === 0, d: `${say(r)}; witness rows=${W.prog(A, F.CH)}` };
});
c('G3 A cannot write progress for B', '08 F8', 'pass', async () => {
  const r = await rest('A', 'POST', 'content_item_progressions', prog(B, F.CP, 'read')); return { ok: W.prog(B, F.CP) === 0, d: `${say(r)}; witness B rows=${W.prog(B, F.CP)}` };
});
c('G4 positive: A marks own visible page CP read (POST)', '08 P4 analogue', 'pass', async () => {
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, F.CP, 'read')); return { ok: r.status === 201 && W.done(A, F.CP), d: `${say(r)}; witness done=${W.done(A, F.CP)}` };
});
c('G5 positive: UPSERT (merge-duplicates) of own CP row', 'plan v2 s3', 'pass', async () => {
  M.progress(A, F.CP, 'read');
  const r = await rest('A', 'POST', 'content_item_progressions?on_conflict=user_id,content_item_id', prog(A, F.CP, 'completed'), 'return=representation,resolution=merge-duplicates');
  return { ok: r.status < 300 && W.prog(A, F.CP) === 1 && q1(`select workflow_state from public.content_item_progressions where user_id = ${lit(A)} and content_item_id = ${lit(F.CP)}`) === 'completed', d: `${say(r)}; witness rows=${W.prog(A, F.CP)}` };
});
c('G6 UPSERT cannot write progress into foreign course D (valid submission pre-seeded)', '08 F5 (upsert)', 'fail', async () => {
  M.submission(A, F.aDA);
  const r = await rest('A', 'POST', 'content_item_progressions?on_conflict=user_id,content_item_id', prog(A, F.DA, 'completed'), 'return=representation,resolution=merge-duplicates');
  return { ok: W.prog(A, F.DA) === 0, d: `${say(r)}; witness rows=${W.prog(A, F.DA)} (evidence pre-seeded, so only access can refuse)` };
});
c('G7 PATCH visible->foreign: own CP row cannot move onto D', '08 F7', 'fail', async () => {
  M.progress(A, F.CP, 'read'); const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${F.CP}`, { content_item_id: F.DP });
  return { ok: W.prog(A, F.DP) === 0 && W.prog(A, F.CP) === 1, d: `${say(r)}; witness CP=${W.prog(A, F.CP)} DP=${W.prog(A, F.DP)}` };
});
c('G8 PATCH on hidden: own row on hidden CH cannot change state', '09 T1', 'fail', async () => {
  M.progress(A, F.CH, 'read'); const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${F.CH}`, { workflow_state: 'completed' });
  const s = q1(`select workflow_state from public.content_item_progressions where user_id = ${lit(A)} and content_item_id = ${lit(F.CH)}`);
  return { ok: s === 'read', d: `${say(r)}; witness state=${s}` };
});
c('G9 PATCH hidden->visible: own CH row cannot move onto visible CP', '09 T2', 'fail', async () => {
  M.progress(A, F.CH, 'read'); const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${F.CH}`, { content_item_id: F.CP });
  return { ok: W.prog(A, F.CP) === 0 && W.prog(A, F.CH) === 1, d: `${say(r)}; witness CH=${W.prog(A, F.CH)} CP=${W.prog(A, F.CP)}` };
});
c('G10 retarget: own COMPLETED CA row cannot become completion of unattempted quiz CQ', '05 R1c', 'fail', async () => {
  M.submission(A, F.aCA); M.progress(A, F.CA, 'completed');
  const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${F.CA}`, { content_item_id: F.CQ });
  return { ok: !W.done(A, F.CQ), d: `${say(r)}; witness CQ done=${W.done(A, F.CQ)}` };
});
c('G11 preserved: a done row may still change state on its own item (completed -> read)', '05 P3', 'pass', async () => {
  M.progress(A, F.CP, 'completed'); const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${F.CP}`, { workflow_state: 'read' });
  const s = q1(`select workflow_state from public.content_item_progressions where user_id = ${lit(A)} and content_item_id = ${lit(F.CP)}`);
  return { ok: s === 'read', d: `${say(r)}; witness state=${s}` };
});
// Staff grading
c('K1 positive: instructor I grades B\'s submission in C (10-point assignment, grade 7)', '08 P5', 'pass', async () => {
  M.submission(B, F.aCA);
  const r = await rest('I', 'PATCH', `assignment_submissions?user_id=eq.${B}&assignment_id=eq.${F.aCA}`, { grade: '7', workflow_state: 'graded', graded_at: new Date().toISOString() });
  const g = q1(`select grade || '|' || workflow_state from public.assignment_submissions where user_id = ${lit(B)} and assignment_id = ${lit(F.aCA)}`);
  return { ok: /^7(\.0+)?\|graded$/.test(g), d: `${say(r)}; witness ${g}` };
});
c('K2 unrelated instructor J cannot grade B\'s submission; row unchanged', '08 P6', 'pass', async () => {
  M.submission(B, F.aCA);
  const r = await rest('J', 'PATCH', `assignment_submissions?user_id=eq.${B}&assignment_id=eq.${F.aCA}`, { grade: '9', workflow_state: 'graded' });
  const g = q1(`select coalesce(grade::text, 'NULL') || '|' || workflow_state from public.assignment_submissions where user_id = ${lit(B)} and assignment_id = ${lit(F.aCA)}`);
  return { ok: g === 'NULL|submitted', d: `${say(r)}; witness ${g}` };
});
c('K3 admin positive: ADMIN reads B\'s submission in C', 'plan v2 s3 (admin)', 'pass', async () => {
  M.submission(B, F.aCA); const r = await rest('ADMIN', 'GET', `assignment_submissions?user_id=eq.${B}&assignment_id=eq.${F.aCA}&select=id`);
  return { ok: r.status === 200 && r.rows === 1, d: `${say(r)}; rows=${r.rows}` };
});
// Quiz
c('Q1 positive: start_quiz_attempt for A in C', '03', 'pass', async () => {
  const r = await rest('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC });
  return { ok: r.status === 200 && W.quiz(A, F.qC) !== 'none', d: `${say(r)}; witness ${W.quiz(A, F.qC)}` };
});
c('Q2 start_quiz_attempt for A in foreign D is refused', '03', 'pass', async () => {
  const r = await rest('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qD }); return { ok: W.quiz(A, F.qD) === 'none', d: `${say(r)}; witness ${W.quiz(A, F.qD)}` };
});
c('Q3 a started-only attempt does not complete CQ; no certificate', '04 A1/A2', 'fail', async () => {
  await rest('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC });
  M.submission(A, F.aCA); M.progress(A, F.CA, 'completed'); M.progress(A, F.CP, 'read');
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, F.CQ, 'completed'));
  return { ok: !W.done(A, F.CQ) && W.certs(A, F.C) === 0, d: `${say(r)}; witness CQ done=${W.done(A, F.CQ)} certs=${W.certs(A, F.C)}` };
});
c('Q4 A cannot forge finalization (workflow_state complete, finished_at) of own attempt', '04 B1', 'fail', async () => {
  await rest('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC });
  const r = await rest('A', 'PATCH', `quiz_submissions?user_id=eq.${A}&quiz_id=eq.${F.qC}`, { workflow_state: 'complete', finished_at: new Date().toISOString() });
  const w = W.quiz(A, F.qC); return { ok: !/^complete:true/.test(w), d: `${say(r)}; witness ${w}` };
});
c('Q5 A cannot move own attempt to B (identity pinned or denied)', '05 R2d', 'pass', async () => {
  await rest('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC });
  const r = await rest('A', 'PATCH', `quiz_submissions?user_id=eq.${A}&quiz_id=eq.${F.qC}`, { user_id: B });
  return { ok: W.quiz(B, F.qC) === 'none' && W.quiz(A, F.qC) !== 'none', d: `${say(r)}; witness A=${W.quiz(A, F.qC)} B=${W.quiz(B, F.qC)}` };
});
c('Q6 positive: fixture-finalized (finalizer not exercised) attempt lets A complete CQ; exactly one certificate', '04 C2/C3', 'pass', async () => {
  await rest('A', 'POST', 'rpc/start_quiz_attempt', { p_quiz_id: F.qC }); M.finalizeQuiz(A, F.qC);
  M.submission(A, F.aCA); M.progress(A, F.CA, 'completed'); M.progress(A, F.CP, 'read');
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, F.CQ, 'completed'));
  return { ok: W.done(A, F.CQ) && W.certs(A, F.C) === 1, d: `${say(r)}; witness CQ done=${W.done(A, F.CQ)} certs=${W.certs(A, F.C)}` };
});
// Section 4: final-evidence matrix in assignment-only course E; each case on its own reset fixture
const finishE = async (label, state, ts, expectDone) => {
  const s = await rest('A', 'POST', 'assignment_submissions', sub(A, F.aEA, state, ts));
  const p1 = await rest('A', 'POST', 'content_item_progressions', prog(A, F.EP, 'read'));
  const p2 = await rest('A', 'POST', 'content_item_progressions', prog(A, F.EA, 'completed'));
  const done = W.done(A, F.EA), certs = W.certs(A, F.E);
  return { ok: expectDone ? done && certs === 1 : !done && certs === 0, d: `${label}: submit ${say(s)}, page ${p1.status}, complete ${say(p2)}; witness EA done=${done} certs=${certs}` };
};
c('E1 positive: submitted + submitted_at completes EA; exactly one certificate', '09 R1', 'pass', () => finishE('submitted+ts', 'submitted', true, true));
c('E2 negative: submitted + NULL submitted_at is not final evidence', '02 (draft, null ts)', 'pass', () => finishE('submitted, null ts', 'submitted', false, false));
c('E3 negative: timestamped UNSUBMITTED is not final evidence', '09 N1', 'fail', () => finishE('unsubmitted+ts', 'unsubmitted', true, false));
c('E4 negative: timestamped DRAFT is not final evidence', '09 N2', 'fail', () => finishE('draft+ts', 'draft', true, false));
c('E5 negative: timestamped other state is not final evidence', '09 N3', 'fail', () => finishE('pending_review+ts', 'pending_review', true, false));
c('E6 negative: timestamped NULL state is not final evidence', '09 N4', 'fail', () => finishE('NULL state+ts', null, true, false));
c('E7 positive: legitimate own finalization (unsubmitted -> submitted) then completion', '09 P3', 'pass', async () => {
  M.submission(A, F.aEA, 'unsubmitted', true);
  const r = await rest('A', 'PATCH', `assignment_submissions?user_id=eq.${A}&assignment_id=eq.${F.aEA}`, { workflow_state: 'submitted', submitted_at: new Date().toISOString() });
  await rest('A', 'POST', 'content_item_progressions', prog(A, F.EP, 'read'));
  const p = await rest('A', 'POST', 'content_item_progressions', prog(A, F.EA, 'completed'));
  return { ok: W.subState(A, F.aEA) === 'submitted' && W.done(A, F.EA) && W.certs(A, F.E) === 1, d: `finalize ${say(r)}, complete ${say(p)}; witness state=${W.subState(A, F.aEA)} certs=${W.certs(A, F.E)}` };
});
c('E8 negative: A cannot promote own submission to graded', '09 N5', 'fail', async () => {
  M.submission(A, F.aEA, 'unsubmitted', true);
  const r = await rest('A', 'PATCH', `assignment_submissions?user_id=eq.${A}&assignment_id=eq.${F.aEA}`, { workflow_state: 'graded' });
  await rest('A', 'POST', 'content_item_progressions', prog(A, F.EA, 'completed'));
  return { ok: W.subState(A, F.aEA) !== 'graded' && !W.done(A, F.EA), d: `${say(r)}; witness state=${W.subState(A, F.aEA)} EA done=${W.done(A, F.EA)}` };
});
// E9 OLD expectation: 'fail'. The OLD guard requires submitted_at, so it REFUSES this legitimate staff-graded row; the r5
// predicate (graded, or submitted with a timestamp) accepts it. Unlike the other expectations, this one has no SQL-tier
// counterpart (09 P1 grades a TIMESTAMPED submission): it was first OBSERVED on the LOCAL-SHIM OLD run, then confirmed
// against the r5 predicate's definition. Disclosed in the export README.
c('E9 positive: staff-graded score 0 with submitted_at STILL NULL is final evidence; exactly one certificate', 'r5 predicate (no SQL-tier twin; OLD refusal observed)', 'fail', async () => {
  M.submission(A, F.aEA, 'unsubmitted', false);
  const g = await rest('I', 'PATCH', `assignment_submissions?user_id=eq.${A}&assignment_id=eq.${F.aEA}`, { grade: '0', score: 0, workflow_state: 'graded', graded_at: new Date().toISOString() });
  await rest('A', 'POST', 'content_item_progressions', prog(A, F.EP, 'read'));
  const p = await rest('A', 'POST', 'content_item_progressions', prog(A, F.EA, 'completed'));
  const ts = q1(`select coalesce(submitted_at::text, 'NULL') from public.assignment_submissions where user_id = ${lit(A)} and assignment_id = ${lit(F.aEA)}`);
  return { ok: W.subState(A, F.aEA) === 'graded' && ts === 'NULL' && W.done(A, F.EA) && W.certs(A, F.E) === 1, d: `grade ${say(g)}, complete ${say(p)}; witness state=${W.subState(A, F.aEA)} submitted_at=${ts} certs=${W.certs(A, F.E)}` };
});
// Legacy-invalid rows seeded before the history window (courses LA..LD); each its own course, so no carry-over
c('L1 assignment-only legacy-invalid: a genuine page completion issues no NEW certificate', '09 L1 / 08 L1', 'fail', async () => {
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, L.LA.P, 'read')); return { ok: W.certs(A, L.LA.C) === 0, d: `${say(r)}; witness certs=${W.certs(A, L.LA.C)}` };
});
c('L2 page-update no-op on a legacy-invalid course issues no NEW certificate', '09 R2/L2', 'fail', async () => {
  const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${L.LB.P}`, { workflow_state: 'read' }); return { ok: W.certs(A, L.LB.C) === 0, d: `${say(r)}; witness certs=${W.certs(A, L.LB.C)}` };
});
c('L3 assignment no-op on the legacy-invalid done row issues no NEW certificate', '09 L2 / 08 L2', 'fail', async () => {
  const r = await rest('A', 'PATCH', `content_item_progressions?user_id=eq.${A}&content_item_id=eq.${L.LC.I}`, { workflow_state: 'completed' }); return { ok: W.certs(A, L.LC.C) === 0, d: `${say(r)}; witness certs=${W.certs(A, L.LC.C)}` };
});
c('L4 invalid-quiz-only legacy (started-only attempt + done row): a page completion issues no NEW certificate', '02 [T-09] started-only', 'fail', async () => {
  const r = await rest('A', 'POST', 'content_item_progressions', prog(A, L.LD.P, 'read')); return { ok: W.certs(A, L.LD.C) === 0, d: `${say(r)}; witness certs=${W.certs(A, L.LD.C)}` };
});
c('L5 legacy rows preserved (no rewrite): every legacy done row and staged submission still present', '09 L3', 'pass', async () => {
  const d = n(`select count(*) from public.content_item_progressions where user_id = ${lit(A)} and content_item_id in (${Object.values(L).map((x) => lit(x.I)).join(', ')}) and workflow_state = 'completed'`);
  const s = n(`select count(*) from public.assignment_submissions where user_id = ${lit(A)} and assignment_id in (${[L.LA.a, L.LB.a, L.LC.a].map(lit).join(', ')}) and workflow_state = 'unsubmitted'`);
  return { ok: d === 4 && s === 3, d: `witness legacy done rows=${d}/4 staged submissions=${s}/3` };
});

// ---------------------------------------------------------------- run
let bad = 0;
const results = { pass: 0, fail: 0, invalid: 0, oldReproduced: 0 };
for (const k of cases) {
  let ok, d;
  try {
    if (!k.cid.startsWith('L')) M.reset();
    ({ ok, d } = await k.fn());
    certcheck();                                     // protected history re-checked after every trigger-firing case
  } catch (e) {
    console.log(`INVALID ${k.cid} [${k.ref}] (${e.infra ? 'infrastructure' : 'error'}): ${e.message}`); results.invalid++; bad++; continue;
  }
  const want = MODE === 'NEW' ? 'pass' : k.old;
  if ((want === 'pass') === ok) {
    if (want === 'fail') { results.oldReproduced++; console.log(`PASS ${k.cid} [${k.ref}] OLD hole reproduced as expected: ${d}`); }
    else console.log(`PASS ${k.cid} [${k.ref}]: ${d}`);
    results.pass++;
  } else {
    console.log(`FAIL ${k.cid} [${k.ref}] expected ${want === 'pass' ? 'the protected outcome' : 'the OLD hole to reproduce'}: ${d}`); results.fail++; bad++;
  }
}
console.log(`== api-controls ${MODE}: ${cases.length} cases, ${results.pass} as expected (${results.oldReproduced} OLD holes reproduced), ${results.fail} unexpected, ${results.invalid} INVALID; protected certificates re-checked after every case`);
process.exit(bad ? 1 : 0);
