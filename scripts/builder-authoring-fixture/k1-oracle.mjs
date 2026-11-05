// ABOUTME: BA-K1 (K1 run only) pure oracle: a course's COMPLETE stored outline and the COMPLETE rendered section list,
// ABOUTME: each compared exactly with the expected outline. Returns problem words from codes.mjs K1_PROBLEMS, never values.
//
// expected: [[section title, position, [[lesson title, type, position, content], ...]], ...] in stored order.
// Every returned row must be accounted for: no extra or missing section, no extra or missing lesson, no lesson outside the
// course's sections, no lesson on the course's sections that belongs to another course, no duplicate id.
import { K1_PROBLEMS } from './codes.mjs';

const W = Object.freeze(Object.fromEntries(K1_PROBLEMS.map((w) => [w, w])));
const isRows = (x) => Array.isArray(x) && x.every((r) => r && typeof r === 'object' && typeof r.id === 'string');
const byPlace = (a, b) => (a.position - b.position) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * rows.mods: every module with course_id = the course; rows.itemsByCourse: every content_item with course_id = the course;
 * rows.itemsByModule: every content_item whose module_id is one of those modules (read separately, so a lesson attached to
 * the copy's sections from another course is seen). Returns [] when the outline is exactly `expected`, else the problems.
 */
export function storedOutlineProblems(rows, expected) {
  const { mods, itemsByCourse, itemsByModule } = rows ?? {};
  if (!isRows(mods) || !isRows(itemsByCourse) || !isRows(itemsByModule)) return [W.READ];
  const out = [];
  const lessons = expected.reduce((n, s) => n + s[2].length, 0);
  if (mods.length !== expected.length) out.push(W.MODULE_COUNT);
  if (itemsByCourse.length !== lessons || itemsByModule.length !== lessons) out.push(W.ITEM_COUNT);
  const ids = [...mods.map((m) => m.id), ...itemsByCourse.map((i) => i.id)];
  if (new Set(ids).size !== ids.length || new Set(itemsByModule.map((i) => i.id)).size !== itemsByModule.length) out.push(W.DUPLICATE_ID);
  const modIds = new Set(mods.map((m) => m.id));
  if (itemsByCourse.some((i) => !modIds.has(i.module_id))) out.push(W.ORPHAN);
  const courseItemIds = new Set(itemsByCourse.map((i) => i.id));
  const course = mods[0]?.course_id;
  if (itemsByModule.some((i) => !courseItemIds.has(i.id) || i.course_id !== course) || itemsByCourse.some((i) => !itemsByModule.some((j) => j.id === i.id))
    || mods.some((m) => m.course_id !== course)) out.push(W.LINK);
  const outline = [...mods].sort(byPlace).map((m) => [m.title, m.position,
    itemsByCourse.filter((i) => i.module_id === m.id).sort(byPlace).map((i) => [i.title, i.type, i.position, i.content])]);
  if (JSON.stringify(outline) !== JSON.stringify(expected)) out.push(W.OUTLINE);
  return out;
}

/** shownSections: every visible section card's title, in rendered order; shownLessons: each card's lesson titles. */
export function renderedProblems(shownSections, shownLessons, expected) {
  const out = [];
  if (JSON.stringify(shownSections) !== JSON.stringify(expected.map((s) => s[0]))) out.push(W.RENDER_SECTIONS);
  if (JSON.stringify(shownLessons) !== JSON.stringify(expected.map((s) => s[2].map((l) => l[0])))) out.push(W.RENDER_LESSONS);
  return out;
}

/** The fixed error a spec throws for the first problem (a codes.mjs TEST_ERRORS member). */
export const k1Error = (problems) => new Error(`BA_K1_E_${W[problems[0]] ?? W.READ}`);
