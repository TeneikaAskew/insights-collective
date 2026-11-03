// ABOUTME: BA-K1 (EXECUTABLE, no injection; T-18): "Copy from another course" lists exactly the instructor's courses, makes
// ABOUTME: exactly one new course with the source's sections, lessons and lesson text, opens it, keeps it after reload, source unchanged.
import { test, expect } from './guarded-test';
import { copiedTitle, route, INSTRUCTOR_ID, PROJECTS, S } from './ids';
import { rest, recordCopiedCourse, copiedBefore, sectionCard, shownLessonTitles } from './helpers';
import { shot } from './shot';
import type { Page } from '@playwright/test';

/** A test-side read (Node fetch as the signed-in instructor); anything but a 200 array is a fixed error. */
async function read(page: Page, query: string): Promise<any[]> {
  const r = await rest(page, query);
  if (r.status !== 200 || !Array.isArray(r.body)) throw new Error('BA_K1_E_READ');
  return r.body;
}
const idsWithTitle = async (page: Page, title: string) =>
  (await read(page, `courses?select=id&title=eq.${encodeURIComponent(title)}`)).map((r) => r.id).sort();

/** A course's stored outline: [section title, position, [[lesson title, type, position, content], ...]], in stored order. */
async function storedOutline(page: Page, course: string) {
  const mods = await read(page, `modules?select=id,title,position&course_id=eq.${course}&order=position.asc,id.asc`);
  const items = await read(page, `content_items?select=id,module_id,title,type,position,content&course_id=eq.${course}&order=position.asc,id.asc`);
  return {
    outline: mods.map((m) => [m.title, m.position, items.filter((i) => i.module_id === m.id).map((i) => [i.title, i.type, i.position, i.content])]),
    items,
  };
}
const EXPECTED = S.sections.map((s, si) => [
  s.title, s.position, S.lessons.filter((l) => l.section === si).map((l) => [l.title, l.type, l.position, l.content]),
]);

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
    expect((await storedOutline(page, S.course)).outline, 'the source is exactly the seed').toEqual(EXPECTED);
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
    expect(id).not.toBe(S.course);
    recordCopiedCourse(project, id);
  });
  await test.step('db_settled', async () => {
    expect(await idsWithTitle(page, title), 'exactly one new course').toEqual([...before, id].sort());
    expect(await read(page, `courses?select=id,instructor_id,title,published&id=eq.${id}`)).toEqual([{ id, instructor_id: INSTRUCTOR_ID, title, published: false }]);
    const copy = await storedOutline(page, id);
    expect(copy.outline, 'sections, lessons, types, positions and lesson text equal the source').toEqual(EXPECTED);
    const ids = copy.items.map((i) => i.id);
    expect(ids.some((x) => S.lessons.some((l) => l.id === x)), 'new rows, not the source rows').toBe(false);
    const quiz = copy.items.find((i) => i.type === 'quiz');
    const essay = copy.items.find((i) => i.type === 'assignment');
    expect((await read(page, `quizzes?select=content_item_id&content_item_id=eq.${quiz.id}`)).length, 'the quiz lesson has its quiz row').toBe(1);
    expect((await read(page, `assignments?select=content_item_id,course_id&content_item_id=eq.${essay.id}`)), 'the essay lesson has its assignment row').toEqual([{ content_item_id: essay.id, course_id: id }]);
    expect((await storedOutline(page, S.course)).outline, 'the source is unchanged').toEqual(EXPECTED);
  });
  const curriculum = route.curriculum(id);
  const expectRendered = async () => {
    for (const [si, s] of S.sections.entries()) {
      expect(await shownLessonTitles(await sectionCard(page, s.title))).toEqual(S.lessons.filter((l) => l.section === si).map((l) => l.title));
    }
  };
  await test.step('rendered', async () => {
    await page.goto(curriculum);
    await expectRendered();
  });
  await test.step('after_reload', async () => {
    await page.reload();
    await expectRendered();
    expect(await idsWithTitle(page, title)).toEqual([...before, id].sort());
  });
  await test.step('screenshot', () => shot(page, info, `ba_k1_${project.replace('ba-', '')}`, curriculum));
});
