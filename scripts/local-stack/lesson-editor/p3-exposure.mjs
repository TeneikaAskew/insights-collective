// ABOUTME: Preflight P3 for the lesson-editor fixture: the API answers for THIS database (users, courses, served tables).
// ABOUTME: Import-free on purpose (the self-test loads mutated copies from data: URLs, so no file is written for a control).
//
// The exposure root (GET /rest/v1/, PostgREST's OpenAPI view) is read with the SERVICE key. PostgREST lists only the tables
// the requesting role holds privileges on, and anon deliberately holds none on public.quiz_questions (the answer key is
// hidden, 20260728000000_hide_quiz_answer_key.sql; snapshot 05_triggers_grants.sql). Reading the root as anon therefore
// refused a correct stack (E1 run 41676587739, source diagnosis le-e1-diag-r1). Nothing is granted to anon to pass: P3
// checks that PostgREST serves this database's tables, which is a service-role question. Read-only; GET requests only.

/** Tables the fixture and the app depend on; each must exist in the database AND be served by PostgREST. */
export const REQUIRED = Object.freeze(['content_items', 'courses', 'modules', 'quizzes', 'quiz_questions', 'profiles', 'user_roles']);

/** Headers for the exposure root: the service role (never anon, never a weakened grant). */
export const rootHeaders = (keys) => ({ apikey: keys.service, Authorization: `Bearer ${keys.service}` });

/**
 * Runs P3 with the given request function (api-http.mjs `request` in preflight, an in-process fake in the self-test).
 * db: { users: number, courses: number, tables: string[] } read from the database beforehand.
 * Returns { ok: true, line } or { ok: false, reason } with a fixed-shape reason (counts only, never response bodies).
 */
export async function runP3({ request, API, keys, db }) {
  const svc = { apikey: keys.service, Authorization: `Bearer ${keys.service}` };
  let users, courses, root;
  try {
    users = await request(API, 'GET', '/auth/v1/admin/users?page=1&per_page=1', { headers: svc });
    courses = await request(API, 'GET', '/rest/v1/courses?select=id&limit=1', { headers: { ...svc, Prefer: 'count=exact' } });
    root = await request(API, 'GET', '/rest/v1/', { headers: rootHeaders(keys) });
  } catch {
    return { ok: false, reason: 'P3: request failed (detail withheld)' };
  }
  if (users.status !== 200 || courses.status !== 200 || root.status !== 200) return { ok: false, reason: `P3: HTTP ${users.status}/${courses.status}/${root.status}` };
  const apiUsers = Number(users.headers.get('x-total-count') ?? users.json?.total ?? NaN);
  const apiCourses = Number((courses.headers.get('content-range') ?? '').split('/')[1]);
  if (apiUsers !== db.users) return { ok: false, reason: `P3: GoTrue reports ${apiUsers} users, the database ${db.users}` };
  if (apiCourses !== db.courses) return { ok: false, reason: `P3: PostgREST reports ${apiCourses} courses, the database ${db.courses}` };
  const defs = Object.keys(root.json?.definitions ?? {});
  const exposed = db.tables.filter((t) => defs.includes(t));
  const lacking = REQUIRED.filter((t) => !db.tables.includes(t) || !defs.includes(t));
  if (lacking.length) return { ok: false, reason: `P3: ${lacking.length} fixture table(s) not both in the database and exposed by PostgREST` };
  if (!db.tables.length || exposed.length < Math.ceil(db.tables.length * 0.9)) return { ok: false, reason: `P3: PostgREST exposes ${exposed.length}/${db.tables.length} of this database's public tables` };
  return { ok: true, line: `P3 API matches DB: users ${db.users}, courses ${db.courses}, ${exposed.length}/${db.tables.length} public tables exposed (service-role view)` };
}
