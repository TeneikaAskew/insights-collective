// ABOUTME: BA-D1/BA-D2 (EXECUTABLE, no injection; ba-1440 only, the rows exist once). D1: an applied UI delete removes the
// ABOUTME: lesson. D2: a lesson removed out of band after load makes the UI delete match zero rows: refused, item stays.
import { test, expect } from './guarded-test';
import { A, route } from './ids';
import { rest } from './helpers';

const onlyAt1440 = () => test.skip(test.info().project.name !== 'ba-1440', 'one-shot rows; covered once at 1440');

async function deleteLessonInUi(page: any, title: string) {
  const row = page.locator('div').filter({ has: page.getByText(title, { exact: true }) }).filter({ visible: true }).last();
  await row.getByRole('button', { name: 'Lesson actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).or(page.getByRole('button', { name: 'Delete', exact: true })).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'Delete lesson' }).click();
}

test('BA-D1 an applied delete removes the lesson, in the UI and in storage', async ({ page }) => {
  onlyAt1440();
  await page.goto(route.curriculum(A.course));
  await expect(page.getByText(A.deletable.title, { exact: true }).filter({ visible: true })).toBeVisible();
  await deleteLessonInUi(page, A.deletable.title);
  await expect(page.getByText(A.deletable.title, { exact: true }).filter({ visible: true })).toHaveCount(0);
  expect((await rest(page, `content_items?select=id&id=eq.${A.deletable.id}`)).body).toEqual([]);
});

test('BA-D2 a delete that matches zero rows is refused and the lesson stays on screen', async ({ page }) => {
  onlyAt1440();
  await page.goto(route.curriculum(A.course));
  const row = page.getByText(A.vanishing.title, { exact: true }).filter({ visible: true });
  await expect(row).toBeVisible();
  // Out of band, as the same instructor: the row goes; the open builder still lists it.
  const gone = await rest(page, `content_items?id=eq.${A.vanishing.id}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  expect(gone.status).toBe(200);
  expect(gone.body.map((r: any) => r.id)).toEqual([A.vanishing.id]);
  await deleteLessonInUi(page, A.vanishing.title);
  await expect(page.getByText('Lesson not deleted').filter({ visible: true }).first()).toBeVisible();
  await expect(row).toBeVisible();
  // After a reload the stored truth (gone) is shown.
  await page.reload();
  await expect(page.getByText(A.vanishing.title, { exact: true }).filter({ visible: true })).toHaveCount(0);
});
