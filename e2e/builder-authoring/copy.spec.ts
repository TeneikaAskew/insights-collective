// ABOUTME: BA-K1 (K1 run only, playwright.builder-authoring-k1.config.ts; T-18): "Copy from another course" lists exactly the
// ABOUTME: instructor's courses and makes exactly one complete copy, opens it and keeps it complete after reload; source unchanged.
import { test, expect } from './guarded-test';
import { copiedTitle, route, INSTRUCTOR_ID, PROJECTS, S } from './ids';
import { read, assertStoredOutline, assertRendered, recordCopiedCourse, copiedBefore } from './k1-helpers';
import { k1Error } from '../../scripts/builder-authoring-fixture/k1-oracle.mjs';
import { shot } from './shot';
import type { Page } from '@playwright/test';

const idsWithTitle = async (page: Page, title: string) =>
  (await read(page, `courses?select=id&title=eq.${encodeURIComponent(title)}`)).map((r) => r.id).sort();

/** S as seeded: [section title, position, [[lesson title, type, position, content], ...]]. */
const EXPECTED = S.sections.map((s, si) => [
  s.title, s.position, S.lessons.filter((l) => l.section === si).map((l) => [l.title, l.type, l.position, l.content]),
]) as [string, number, [string, string, number, string][]][];

/** The copy, complete: its outline is exactly S's, every row is new, and each quiz/assignment lesson has its own row. */
async function assertCompleteCopy(page: Page, id: string) {
  const { mods, itemsByCourse } = await assertStoredOutline(page, id, EXPECTED);
  const sourceIds = new Set([...S.sections.map((s) => s.id), ...S.lessons.map((l) => l.id)]);
  if ([...mods, ...itemsByCourse].some((r) => sourceIds.has(r.id))) throw k1Error(['NOT_NEW']);
  for (const it of itemsByCourse) {
    if (it.type === 'quiz') {
      const q = await read(page, `quizzes?select=content_item_id,module_id&content_item_id=eq.${it.id}`);
      if (JSON.stringify(q) !== JSON.stringify([{ content_item_id: it.id, module_id: it.module_id }])) throw k1Error(['CHILD']);
    } else if (it.type === 'assignment') {
      const a = await read(page, `assignments?select=content_item_id,course_id,module_id&content_item_id=eq.${it.id}`);
      if (JSON.stringify(a) !== JSON.stringify([{ content_item_id: it.id, course_id: id, module_id: it.module_id }])) throw k1Error(['CHILD']);
    }
  }
}
/** S unchanged: its complete outline is still exactly the seed (the run's witness also compares its whole rows). */
async function assertSourceUnchanged(page: Page) {
  try { await assertStoredOutline(page, S.course, EXPECTED); } catch { throw k1Error(['SOURCE']); }
}
/** The rendered curriculum, polled until it settles: exactly S's sections in order, each with exactly its lessons. */
const rendered = async (page: Page) => {
  await expect.poll(async () => { try { await assertRendered(page, EXPECTED); return 'ok'; } catch (e) { return (e as Error).message; } },
    { message: 'the visible sections and lessons are exactly the copy' }).toBe('ok');
};

test('BA-K1 copy from another course makes one complete copy, opens it, keeps it after reload and leaves the source unchanged', async ({ page }, info) => {
  const project = info.project.name;
  const title = copiedTitle(process.env.BA_NONCE as string); // the same nonce in every project
  let before: string[] = [];
  let id = '';
  await test.step('before_state', async () => {
    const recorded = copiedBefore(project).sort();
    expect(recorded.length, 'one copy per earlier project').toBe(PROJECTS.indexOf(project));
    before = await idsWithTitle(page, title);
    expect(before, 'the stored set is exactly what the earlier projects recorded').toEqual(recorded);
    await assertSourceUnchanged(page);
  });
  await test.step('ui_copy', async () => {
    const mine = (await read(page, `courses?select=title&instructor_id=eq.${INSTRUCTOR_ID}`)).map((c) => c.title || 'Untitled course').sort();
    await page.goto(route.newCourse);
    await page.getByPlaceholder('Give it a name').fill(title);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Copy from another course').click();
    const select = page.getByLabel('Course to copy');
    await expect(select).toBeEnabled();
    const options = (await select.locator('option').allInnerTexts()).map((t) => t.trim());
    expect(options[0]).toBe('Choose a course');
    expect(options.slice(1).sort(), 'the picker lists exactly my courses').toEqual(mine);
    await expect(page.getByRole('button', { name: 'Continue' }), 'no course chosen: cannot continue').toBeDisabled();
    await select.selectOption({ label: S.title });
    const wanted = [...S.sections.map((s) => s.title), ...S.lessons.map((l) => l.title)].sort();
    await expect.poll(async () => {
      const values: string[] = [];
      for (const f of await page.locator('input[type="text"], input:not([type])').filter({ visible: true }).all()) values.push(await f.inputValue());
      return values.filter((v) => wanted.includes(v)).sort();
    }, { message: 'the outline editor shows the source sections and lessons' }).toEqual(wanted);
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Review and create')).toBeVisible();
    await page.getByRole('button', { name: 'Create course' }).click();
    await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/builder$/);
    id = new URL(page.url()).pathname.split('/')[2];
    if (id === S.course) throw k1Error(['NOT_NEW']);
    recordCopiedCourse(project, id);
  });
  await test.step('db_settled', async () => {
    expect(await idsWithTitle(page, title), 'exactly one new course').toEqual([...before, id].sort());
    const c = await read(page, `courses?select=id,instructor_id,title,published&id=eq.${id}`);
    if (JSON.stringify(c) !== JSON.stringify([{ id, instructor_id: INSTRUCTOR_ID, title, published: false }])) throw k1Error(['COURSE']);
    await assertCompleteCopy(page, id);
    await assertSourceUnchanged(page);
  });
  const curriculum = route.curriculum(id);
  await test.step('rendered', async () => {
    await page.goto(curriculum);
    await rendered(page);
  });
  await test.step('after_reload', async () => {
    await page.reload();
    await rendered(page);
    // the complete stored state again, not only the ids: the copy's outline, its rows and children, and the source
    expect(await idsWithTitle(page, title)).toEqual([...before, id].sort());
    await assertCompleteCopy(page, id);
    await assertSourceUnchanged(page);
  });
  await test.step('screenshot', () => shot(page, info, `ba_k1_${project.replace('ba-', '')}`, curriculum));
});
