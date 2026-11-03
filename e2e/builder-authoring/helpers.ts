// ABOUTME: Helpers for builder-authoring specs: stored rows through the loopback API as the signed-in instructor (the
// ABOUTME: server's truth), rendered order scoped to one section card, and the private created-course records.
import { expect, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { BINDING } from './guarded-test';
import { writePrivateFile } from '../gradebook-roles/journey/private-dir.mjs';
import { readBounded, createdId } from '../../scripts/builder-authoring-fixture/summary.mjs';
import { PROJECTS } from './ids';

async function token(page: Page): Promise<string> {
  const state = await page.context().storageState();
  for (const o of state.origins) for (const e of o.localStorage) {
    if (e.name === 'supabase.auth.token') return JSON.parse(e.value).access_token;
  }
  throw new Error('BA_E_NO_SESSION');
}

/** A test-side REST call (Node fetch, not the page): never counted as an app request by observe.ts. */
export async function rest(page: Page, pathAndQuery: string, init: RequestInit = {}) {
  const t = await token(page);
  const res = await fetch(`${BINDING.api.origin}/rest/v1/${pathAndQuery}`, {
    ...init, redirect: 'error',
    headers: { apikey: BINDING.anonKey, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

type Placed = { id: string; position: number };

/** Ids in stored order; refuses unless the positions are exactly 0..n-1 (no ties, gaps or nulls hidden by the sort). */
const READ_CODE = { modules: 'BA_E_READ_MODULES', content_items: 'BA_E_READ_CONTENT_ITEMS' } as const;
export async function storedOrder(page: Page, table: 'modules' | 'content_items', filter: string): Promise<string[]> {
  const r = await rest(page, `${table}?select=id,position&${filter}&order=position.asc,id.asc`);
  if (r.status !== 200 || !Array.isArray(r.body)) throw new Error(READ_CODE[table]);
  const rows = r.body as Placed[];
  expect(rows.map((x) => x.position), `${table} positions are exactly 0..n-1`).toEqual(rows.map((_, i) => i));
  return rows.map((x) => x.id);
}
export const storedSections = (page: Page, course: string) => storedOrder(page, 'modules', `course_id=eq.${course}`);
export const storedLessons = (page: Page, module: string) => storedOrder(page, 'content_items', `module_id=eq.${module}`);

/** Fixture section titles in the order the curriculum view shows them (visible presentation only). */
export async function shownSectionTitles(page: Page): Promise<string[]> {
  return (await page.getByRole('heading', { level: 3 }).filter({ visible: true }).filter({ hasText: /^B[AB] Section / }).allInnerTexts()).map((t) => t.trim());
}

/** The one visible section card whose heading is exactly `title`: the nearest ancestor div that holds its lesson list or
 *  its empty state, and that holds exactly one section reorder handle. */
export async function sectionCard(page: Page, title: string): Promise<Locator> {
  const heading = page.getByRole('heading', { level: 3, name: title, exact: true }).filter({ visible: true });
  await expect(heading, 'exactly one visible section with this title').toHaveCount(1);
  const card = heading.locator('xpath=ancestor::div[.//ul or .//*[normalize-space()="No lessons yet. Add one below."]][1]');
  await expect(card.getByRole('button', { name: 'Reorder section' }), 'the card holds exactly one section').toHaveCount(1);
  return card;
}

/** Lesson titles in rendered order inside one section card (each row's title button). */
export async function shownLessonTitles(card: Locator): Promise<string[]> {
  const out: string[] = [];
  for (const li of await card.getByRole('listitem').filter({ visible: true }).all()) {
    out.push((await li.getByRole('button').nth(1).innerText()).trim());
  }
  return out;
}

/** The one visible lesson row (li) whose title button is exactly `title`. */
export async function lessonRow(page: Page, title: string): Promise<Locator> {
  const row = page.getByRole('listitem').filter({ visible: true }).filter({ has: page.getByRole('button', { name: title, exact: true }) });
  await expect(row, 'exactly one visible lesson row with this title').toHaveCount(1);
  return row;
}

const runDir = () => { const d = process.env.BA_RUN_DIR; if (!d || !path.isAbsolute(d)) throw new Error('BA_E_NO_RUN_DIR'); return d; };

/** Exclusive 0600 record of the course this project's wizard created (written once the id is known). */
export function recordCreatedCourse(project: string, id: string) {
  writePrivateFile(runDir(), `created-${project}.json`, JSON.stringify({ id }));
}

/** Ids recorded by every project that ran before `project` (bounded reads; each must be present and exact). */
export function createdBefore(project: string): string[] {
  const idx = PROJECTS.indexOf(project);
  if (idx < 0) throw new Error('BA_E_PROJECT');
  return PROJECTS.slice(0, idx).map((p) => {
    const id = createdId(readBounded(path.join(runDir(), `created-${p}.json`), 64));
    if (!id) throw new Error('BA_E_CREATED_RECORD');
    return id;
  });
}
