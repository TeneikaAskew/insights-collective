// ABOUTME: BA-C1 (EXECUTABLE, no injection): the wizard's scratch path creates exactly one course owned by the instructor,
// ABOUTME: with its starter section and lesson, rendered before and after reload; id sets progress 0->1->2->3 across projects.
import { test, expect } from './guarded-test';
import { createdTitle, route, INSTRUCTOR_ID, PROJECTS } from './ids';
import { rest, recordCreatedCourse, createdBefore, sectionCard, shownLessonTitles } from './helpers';
import { shot } from './shot';

const idsWithTitle = async (page: any, title: string) =>
  ((await rest(page, `courses?select=id&title=eq.${encodeURIComponent(title)}`)).body as Array<{ id: string }>).map((r) => r.id).sort();

test('BA-C1 scratch creation makes one complete course and opens it', async ({ page }, info) => {
  const project = info.project.name;
  const title = createdTitle(process.env.BA_NONCE as string); // the same nonce in every project
  let before: string[] = [];
  let id = '';
  await test.step('before_state', async () => {
    const recorded = createdBefore(project).sort();
    expect(recorded.length, 'one course per earlier project').toBe(PROJECTS.indexOf(project));
    before = await idsWithTitle(page, title);
    expect(before, 'the stored set is exactly what the earlier projects recorded').toEqual(recorded);
  });
  await test.step('ui_create', async () => {
    await page.goto(route.newCourse);
    await page.getByPlaceholder('Give it a name').fill(title);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Start from scratch').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create course' }).click();
    await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/builder$/);
    id = new URL(page.url()).pathname.split('/')[2];
    recordCreatedCourse(project, id);
  });
  await test.step('db_settled', async () => {
    expect(await idsWithTitle(page, title), 'exactly one new course').toEqual([...before, id].sort());
    expect((await rest(page, `courses?select=id,instructor_id,title,published&id=eq.${id}`)).body).toEqual([{ id, instructor_id: INSTRUCTOR_ID, title, published: false }]);
    const mods = (await rest(page, `modules?select=id,title,position&course_id=eq.${id}`)).body;
    expect(mods.map((m: any) => [m.title, m.position])).toEqual([['Section 1', 0]]);
    const items = (await rest(page, `content_items?select=title,type,position&course_id=eq.${id}`)).body;
    expect(items).toEqual([{ title: 'Introduction', type: 'page', position: 0 }]);
  });
  const curriculum = route.curriculum(id);
  await test.step('rendered', async () => {
    await page.goto(curriculum);
    expect(await shownLessonTitles(await sectionCard(page, 'Section 1'))).toEqual(['Introduction']);
  });
  await test.step('after_reload', async () => {
    await page.reload();
    expect(await shownLessonTitles(await sectionCard(page, 'Section 1'))).toEqual(['Introduction']);
    expect(await idsWithTitle(page, title)).toEqual([...before, id].sort());
  });
  await test.step('screenshot', () => shot(page, info, `ba_c1_${project.replace('ba-', '')}`, curriculum));
});
