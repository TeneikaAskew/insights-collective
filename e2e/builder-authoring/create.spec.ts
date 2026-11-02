// ABOUTME: BA-C1 (EXECUTABLE, no injection): the wizard's scratch path creates exactly one course, owned by the
// ABOUTME: instructor, with its starter section and lesson; the id is recorded privately for manifest cleanup.
import { test, expect } from './guarded-test';
import { createdTitle, route, INSTRUCTOR_ID } from './ids';
import { rest, recordCreatedCourse } from './helpers';

test('BA-C1 scratch creation makes one complete course and opens it', async ({ page }, info) => {
  const title = createdTitle(process.env.BA_NONCE as string);
  const before = (await rest(page, `courses?select=id&title=eq.${encodeURIComponent(title)}`)).body.length;
  await page.goto(route.newCourse);
  await page.getByPlaceholder('Give it a name').fill(title);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Start from scratch').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create course' }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/builder/);
  const id = new URL(page.url()).pathname.split('/')[2];
  recordCreatedCourse(info.project.name, id);
  const course = (await rest(page, `courses?select=id,instructor_id,title,published&id=eq.${id}`)).body;
  expect(course).toEqual([{ id, instructor_id: INSTRUCTOR_ID, title, published: false }]);
  expect((await rest(page, `courses?select=id&title=eq.${encodeURIComponent(title)}`)).body.length).toBe(before + 1);
  const mods = (await rest(page, `modules?select=id,title&course_id=eq.${id}`)).body;
  expect(mods.map((m: any) => m.title)).toEqual(['Section 1']);
  const items = (await rest(page, `content_items?select=title,type&module_id=eq.${mods[0].id}`)).body;
  expect(items).toEqual([{ title: 'Introduction', type: 'page' }]);
});
