// ABOUTME: BA-R1/BA-R2 (EXECUTABLE, no injection): a section reorder made with the keyboard and a lesson reorder made
// ABOUTME: with the pointer are stored, and survive a reload. Order-agnostic, so it runs in every viewport project.
import { test, expect } from './guarded-test';
import { A, route } from './ids';
import { storedSections, storedLessons, shownSectionTitles } from './helpers';

const titleOf = (id: string) => A.sections.find((s) => s.id === id)!.title;

test('BA-R1 section reorder is stored and survives reload', async ({ page }) => {
  await page.goto(route.curriculum(A.course));
  const before = await storedSections(page, A.course);
  await expect.poll(() => shownSectionTitles(page)).toEqual(before.map(titleOf));
  // Move the first section down one place with the keyboard sensor (Space, ArrowDown, Space).
  const handle = page.getByRole('button', { name: 'Reorder section' }).filter({ visible: true }).first();
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  const expected = [before[1], before[0], ...before.slice(2)];
  await expect.poll(() => storedSections(page, A.course)).toEqual(expected);
  await page.reload();
  await expect.poll(() => shownSectionTitles(page)).toEqual(expected.map(titleOf));
});

test('BA-R2 lesson reorder is stored and survives reload', async ({ page }) => {
  const section = A.sections[0].id;
  await page.goto(route.curriculum(A.course));
  const before = await storedLessons(page, section);
  const title = (id: string) => A.lessons.find((l) => l.id === id)!.title;
  const firstRow = page.getByText(title(before[0]), { exact: true }).filter({ visible: true });
  const secondRow = page.getByText(title(before[1]), { exact: true }).filter({ visible: true });
  const handles = page.getByRole('button', { name: 'Reorder lesson' }).filter({ visible: true });
  const from = await handles.nth(0).boundingBox();
  const to = await secondRow.boundingBox();
  if (!from || !to) throw new Error('BA_R2_E_LAYOUT');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height, { steps: 12 });
  await page.mouse.up();
  const expected = [before[1], before[0], ...before.slice(2)];
  await expect.poll(() => storedLessons(page, section)).toEqual(expected);
  await page.reload();
  await expect(firstRow).toBeVisible();
  await expect.poll(() => storedLessons(page, section)).toEqual(expected);
});
