// ABOUTME: BA-K1 (K1 run only) helpers: complete stored-outline reads, every visible section card in rendered order, and
// ABOUTME: the private copied-course records (the same exclusive 0600 writer and bounded reader the created records use).
import type { Page } from '@playwright/test';
import path from 'node:path';
import { writePrivateFile } from '../gradebook-roles/journey/private-dir.mjs';
import { readBounded, createdId } from '../../scripts/builder-authoring-fixture/summary.mjs';
import { storedOutlineProblems, renderedProblems, k1Error } from '../../scripts/builder-authoring-fixture/k1-oracle.mjs';
import { rest, shownLessonTitles } from './helpers';
import { PROJECTS } from './ids';

/** A test-side read (Node fetch as the signed-in instructor); anything but a 200 array is the fixed READ error. */
export async function read(page: Page, query: string): Promise<any[]> {
  const r = await rest(page, query);
  if (r.status !== 200 || !Array.isArray(r.body)) throw new Error('BA_K1_E_READ');
  return r.body;
}

/** Every module and every content row of `course`, plus every content row on those modules (whatever its course). */
async function outlineRows(page: Page, course: string) {
  const mods = await read(page, `modules?select=id,course_id,title,position&course_id=eq.${course}`);
  const itemsByCourse = await read(page, `content_items?select=id,course_id,module_id,title,type,position,content&course_id=eq.${course}`);
  const itemsByModule = mods.length === 0 ? [] : await read(page,
    `content_items?select=id,course_id,module_id,title,type,position,content&module_id=in.(${mods.map((m) => m.id).join(',')})`);
  return { mods, itemsByCourse, itemsByModule };
}

/** Refuses (fixed BA_K1_E_<word>) unless the course's complete stored outline is exactly `expected`; returns its rows. */
export async function assertStoredOutline(page: Page, course: string, expected: unknown[]) {
  const rows = await outlineRows(page, course);
  const p = storedOutlineProblems(rows, expected);
  if (p.length) throw k1Error(p);
  return rows;
}

/** Every visible section card's title, in rendered order (one per visible section reorder handle; no title filter). */
export async function allShownSectionTitles(page: Page): Promise<string[]> {
  const out: string[] = [];
  for (const handle of await page.getByRole('button', { name: 'Reorder section' }).filter({ visible: true }).all()) {
    out.push((await handle.locator('xpath=ancestor::div[.//h3][1]').getByRole('heading', { level: 3 }).first().innerText()).trim());
  }
  return out;
}

/** Refuses unless the visible sections are exactly the expected ones, in order, each with exactly its lessons in order. */
export async function assertRendered(page: Page, expected: [string, number, [string, ...unknown[]][]][]) {
  const sections = await allShownSectionTitles(page);
  const lessons: string[][] = [];
  for (const handle of await page.getByRole('button', { name: 'Reorder section' }).filter({ visible: true }).all()) {
    lessons.push(await shownLessonTitles(handle.locator('xpath=ancestor::div[.//ul or .//*[normalize-space()="No lessons yet. Add one below."]][1]')));
  }
  const p = renderedProblems(sections, lessons, expected);
  if (p.length) throw k1Error(p);
}

const runDir = () => { const d = process.env.BA_RUN_DIR; if (!d || !path.isAbsolute(d)) throw new Error('BA_E_NO_RUN_DIR'); return d; };

/** Exclusive 0600 record of the course this project's copy made (written once the id is known). */
export function recordCopiedCourse(project: string, id: string) {
  writePrivateFile(runDir(), `copied-${project}.json`, JSON.stringify({ id }));
}

/** Copy ids recorded by every project that ran before `project` (bounded reads; each must be present and exact). */
export function copiedBefore(project: string): string[] {
  const idx = PROJECTS.indexOf(project);
  if (idx < 0) throw new Error('BA_E_PROJECT');
  return PROJECTS.slice(0, idx).map((p) => {
    const id = createdId(readBounded(path.join(runDir(), `copied-${p}.json`), 64));
    if (!id) throw new Error('BA_E_COPIED_RECORD');
    return id;
  });
}
