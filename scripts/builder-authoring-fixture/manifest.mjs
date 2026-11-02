// ABOUTME: Exact ID manifest and cleanup plan for the builder-authoring lane (UNRUN). Cleanup deletes ONLY manifest ids,
// ABOUTME: only after each one is proven to be this fixture's (owner, course, title marker). Pure: builds SQL text, runs nothing.
import { A, B, INSTRUCTOR_ID, SEEDED_COURSES, SEEDED_MODULES, SEEDED_ITEMS, createdTitle } from './ids.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^[a-z0-9]{8,32}$/;

export class ManifestError extends Error {
  constructor(code) { super(code); this.name = 'ManifestError'; this.code = code; }
}

/**
 * @param {{ nonce: string, createdCourseIds: string[] }} run  createdCourseIds: courses the wizard spec created, read
 *   from the builder URL after each create (the app chooses them client-side). At most 4.
 */
export function buildManifest(run) {
  if (!run || !NONCE.test(String(run.nonce ?? ''))) throw new ManifestError('BA_MANIFEST_E_NONCE');
  const created = [...new Set(run.createdCourseIds ?? [])];
  if (created.length !== (run.createdCourseIds ?? []).length) throw new ManifestError('BA_MANIFEST_E_DUPLICATE');
  if (created.length > 4) throw new ManifestError('BA_MANIFEST_E_TOO_MANY');
  for (const id of created) {
    if (!UUID.test(id)) throw new ManifestError('BA_MANIFEST_E_ID');
    if (SEEDED_COURSES.includes(id)) throw new ManifestError('BA_MANIFEST_E_SEEDED_AS_CREATED');
  }
  return {
    nonce: run.nonce,
    seeded: { courses: [...SEEDED_COURSES], modules: [...SEEDED_MODULES], items: [...SEEDED_ITEMS] },
    created: { courses: created, title: createdTitle(run.nonce) },
  };
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const list = (ids) => ids.map(lit).join(', ');

/**
 * Cleanup SQL: one transaction. First it proves ownership (every created course: instructor = e2e-instructor AND the
 * exact run title; every seeded course: instructor = e2e-instructor and its fixed title), raising before any delete if
 * anything differs. Then it deletes children of exactly those courses and the courses themselves. Nothing else.
 */
export function cleanupSql(manifest) {
  const m = manifest;
  const seededTitles = [[A.course, A.title], [B.course, B.title]];
  const allCourses = [...m.seeded.courses, ...m.created.courses];
  const checks = [
    ...seededTitles.map(([id, t]) => `  if not exists (select 1 from public.courses where id = ${lit(id)} and instructor_id = ${lit(INSTRUCTOR_ID)} and title = ${lit(t)}) then raise exception 'BA_CLEANUP_E_SEEDED_OWNERSHIP'; end if;`),
    ...m.created.courses.map((id) => `  if not exists (select 1 from public.courses where id = ${lit(id)} and instructor_id = ${lit(INSTRUCTOR_ID)} and title = ${lit(m.created.title)}) then raise exception 'BA_CLEANUP_E_CREATED_OWNERSHIP'; end if;`),
    `  if exists (select 1 from public.modules where id in (${list(m.seeded.modules)}) and course_id not in (${list(m.seeded.courses)})) then raise exception 'BA_CLEANUP_E_MODULE_MOVED'; end if;`,
    `  if exists (select 1 from public.content_items where id in (${list(m.seeded.items)}) and course_id not in (${list(m.seeded.courses)})) then raise exception 'BA_CLEANUP_E_ITEM_MOVED'; end if;`,
  ];
  return [
    '\\set ON_ERROR_STOP on',
    'begin;',
    'do $$ begin',
    ...checks,
    'end $$;',
    `delete from public.quizzes where content_item_id in (select id from public.content_items where course_id in (${list(allCourses)}));`,
    `delete from public.assignments where content_item_id in (select id from public.content_items where course_id in (${list(allCourses)}));`,
    `delete from public.content_items where course_id in (${list(allCourses)});`,
    `delete from public.modules where course_id in (${list(allCourses)});`,
    `delete from public.courses where id in (${list(allCourses)});`,
    'commit;',
    '',
  ].join('\n');
}
