// ABOUTME: BA-D1/BA-D2 (EXECUTABLE, no injection; ba-1440 only, the rows exist once, so ba-768/ba-390 are intentional skips).
// ABOUTME: Each observes the app's own DELETE: D1 returns the target id; D2 (row removed out of band first) returns [] and is refused.
import { test, expect } from './guarded-test';
import type { Page } from '@playwright/test';
import { A, route } from './ids';
import { rest, lessonRow, sectionCard } from './helpers';
import { expectCalls, bodyOf } from './observe';
import { shot } from './shot';

const onlyAt1440 = () => test.skip(test.info().project.name !== 'ba-1440', 'one-shot rows; executed once, in ba-1440');
const deleteCall = (id: string) => ({ method: 'DELETE' as const, path: '/rest/v1/content_items', query: { id: `eq.${id}` } });
const EMPTY = 'No lessons yet. Add one below.';

/** Open the one row's actions, choose Delete inside that row, then confirm in the one dialog this opened. */
async function deleteThroughUi(page: Page, title: string) {
  const row = await lessonRow(page, title);
  await row.getByRole('button', { name: 'Lesson actions' }).click();
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete this lesson?' });
  await expect(dialog).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Delete lesson', exact: true }).click();
}

/** Positive settled control after a reload: the section card of the deleted lesson renders, empty, in the full outline. */
async function settledEmptySection(page: Page, sectionTitle: string) {
  const card = await sectionCard(page, sectionTitle);
  await expect(card.getByText(EMPTY, { exact: true })).toBeVisible();
  for (const l of A.lessons) await expect(page.getByRole('button', { name: l.title, exact: true }).filter({ visible: true })).toHaveCount(1);
}

test('BA-D1 an applied delete removes the lesson, in the UI and in storage', async ({ page }) => {
  onlyAt1440();
  const section = A.sections[A.deletable.section];
  await test.step('before_state', async () => {
    await page.goto(route.curriculum(A.course));
    expect((await rest(page, `content_items?select=id&id=eq.${A.deletable.id}`)).body).toEqual([{ id: A.deletable.id }]);
    await lessonRow(page, A.deletable.title);
  });
  await test.step('ui_delete', async () => {
    const [call] = await expectCalls(page, deleteCall(A.deletable.id), () => deleteThroughUi(page, A.deletable.title), { count: 1, status: [200] });
    expect(await bodyOf(call), 'the app DELETE returned exactly the target row').toEqual([{ id: A.deletable.id }]);
    await expect(page.getByRole('button', { name: A.deletable.title, exact: true }).filter({ visible: true })).toHaveCount(0);
  });
  await test.step('db_readback', async () => {
    const r = await rest(page, `content_items?select=id&id=eq.${A.deletable.id}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
  await test.step('after_reload', async () => {
    await page.reload();
    await settledEmptySection(page, section.title);
    await expect(page.getByRole('button', { name: A.deletable.title, exact: true })).toHaveCount(0);
  });
});

test('BA-D2 a delete that matches zero rows is refused and the lesson stays on screen', async ({ page }, info) => {
  onlyAt1440();
  const curriculum = route.curriculum(A.course);
  const section = A.sections[A.vanishing.section];
  await test.step('before_state', async () => {
    await page.goto(curriculum);
    await lessonRow(page, A.vanishing.title);
  });
  await test.step('out_of_band_delete', async () => {
    // Test-side (Node fetch, not the page), as the same instructor: the row goes while the open builder still lists it.
    const gone = await rest(page, `content_items?id=eq.${A.vanishing.id}&select=id`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    expect(gone.status).toBe(200);
    expect(gone.body).toEqual([{ id: A.vanishing.id }]);
  });
  await test.step('ui_delete_refused', async () => {
    const [call] = await expectCalls(page, deleteCall(A.vanishing.id), () => deleteThroughUi(page, A.vanishing.title), { count: 1, status: [200] });
    expect(await bodyOf(call), 'the app DELETE matched zero rows').toEqual([]);
    await expect(page.getByText('Lesson not deleted', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await lessonRow(page, A.vanishing.title); // still listed: the UI did not drop an item it could not delete
  });
  await test.step('screenshot', () => shot(page, info, 'ba_d2_refused_1440', curriculum));
  await test.step('after_reload', async () => {
    await page.reload();
    await settledEmptySection(page, section.title);
    await expect(page.getByRole('button', { name: A.vanishing.title, exact: true })).toHaveCount(0);
  });
});
