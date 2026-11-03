// ABOUTME: BA-R1/BA-R2 (EXECUTABLE, no injection): a section reorder made with the keyboard and a lesson reorder made with
// ABOUTME: the pointer are stored with dense positions 0..n-1, sent as exactly one RPC, and rendered in that order after reload.
import type { Page } from '@playwright/test';
import { test, expect } from './guarded-test';
import { A, route } from './ids';
import { storedSections, storedLessons, shownSectionTitles, sectionCard, shownLessonTitles } from './helpers';
import { expectCalls } from './observe';
import { shot } from './shot';

const sectionTitle = (id: string) => A.sections.find((s) => s.id === id)!.title;
const lessonTitle = (id: string) => A.lessons.find((l) => l.id === id)!.title;
const sameSet = (a: string[], b: string[]) => expect([...a].sort()).toEqual([...b].sort());
const suffix = (p: string) => p.replace('ba-', '') as '1440' | '768' | '390';

/**
 * DIAGNOSTIC for R1 (reads only; changes no timing before the drop): what dnd-kit itself announced for the drop of `moving`
 * in its live regions (its default onDragEnd text), reduced to one fixed word. The ids are this fixture's section ids.
 */
async function r1Drop(page: Page, moving: string, target: string): Promise<'DROP_TARGET' | 'DROP_SELF' | 'DROP_OTHER' | 'DROP_NONE' | 'NO_DROP'> {
  const texts = await page.locator('[id^="DndLiveRegion"]').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  const pre = `Draggable item ${moving} was dropped`;
  const t = texts.find((x) => x.startsWith(pre));
  if (t === undefined) return 'NO_DROP';
  if (t === `${pre}.`) return 'DROP_NONE';
  if (t === `${pre} over droppable area ${target}`) return 'DROP_TARGET';
  if (t === `${pre} over droppable area ${moving}`) return 'DROP_SELF';
  return 'DROP_OTHER';
}

test('BA-R1 section reorder is stored and survives reload', async ({ page }, info) => {
  const curriculum = route.curriculum(A.course);
  let before: string[] = [];
  await test.step('before_state', async () => {
    await page.goto(curriculum);
    before = await storedSections(page, A.course);
    sameSet(before, A.sections.map((s) => s.id));
    await expect.poll(() => shownSectionTitles(page)).toEqual(before.map(sectionTitle));
  });
  const expected = [before[1], before[0], ...before.slice(2)];
  await test.step('ui_reorder', async () => {
    // Move the first section down one place with the keyboard sensor (Space, ArrowDown, Space): exactly one RPC.
    // Interaction unchanged. On failure only, the error is one fixed code: BA_R1_E_<request verdict>_<dnd-kit drop
    // announcement>_<window scrolled or not>, so the cause is named without any free text.
    const [moving, target] = [before[0], before[1]];
    let handle: ReturnType<Page['getByRole']>;
    try { handle = (await sectionCard(page, sectionTitle(moving))).getByRole('button', { name: 'Reorder section' }); }
    catch { throw new Error('BA_R1_E_LOCATE'); }
    let scrollBefore = 0;
    try {
      await expectCalls(page, { method: 'POST', path: '/rest/v1/rpc/reorder_modules' }, async () => {
        await handle.focus();
        scrollBefore = await page.evaluate(() => window.scrollY);
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
      }, { count: 1, status: [200, 204] });
    } catch (e) {
      const m = e instanceof Error ? /^BA_OBS_E_([A-Z_]+)$/.exec(e.message) : null;
      const drop = await r1Drop(page, moving, target).catch(() => 'NO_DROP' as const);
      const scrolled = (await page.evaluate(() => window.scrollY).catch(() => scrollBefore)) !== scrollBefore ? 'SCROLLED' : 'STILL';
      throw new Error(`BA_R1_E_${m ? m[1] : 'OTHER'}_${drop}_${scrolled}`);
    }
  });
  await test.step('db_settled', async () => {
    await expect.poll(() => storedSections(page, A.course)).toEqual(expected);
  });
  await test.step('after_reload', async () => {
    await page.reload();
    await expect.poll(() => shownSectionTitles(page)).toEqual(expected.map(sectionTitle));
    expect(await storedSections(page, A.course)).toEqual(expected);
  });
  await test.step('screenshot', () => shot(page, info, `ba_r1_${suffix(info.project.name)}`, curriculum));
});

test('BA-R2 lesson reorder is stored and survives reload', async ({ page }, info) => {
  const curriculum = route.curriculum(A.course);
  const section = A.sections[0];
  const members = A.lessons.filter((l) => l.section === 0).map((l) => l.id);
  let before: string[] = [];
  await test.step('before_state', async () => {
    await page.goto(curriculum);
    before = await storedLessons(page, section.id);
    sameSet(before, members);
    await expect.poll(async () => shownLessonTitles(await sectionCard(page, section.title))).toEqual(before.map(lessonTitle));
  });
  const expected = [before[1], before[0], ...before.slice(2)];
  await test.step('ui_reorder', async () => {
    // Drag the first row's handle below the second row, both inside this section's card: exactly one RPC.
    const card = await sectionCard(page, section.title);
    const from = await card.getByRole('listitem').nth(0).getByRole('button', { name: 'Reorder lesson' }).boundingBox();
    const to = await card.getByRole('listitem').nth(1).boundingBox();
    if (!from || !to) throw new Error('BA_R2_E_LAYOUT');
    await expectCalls(page, { method: 'POST', path: '/rest/v1/rpc/reorder_content_items' }, async () => {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2, to.y + to.height - 2, { steps: 12 });
      await page.mouse.up();
    }, { count: 1, status: [200, 204] });
  });
  await test.step('db_settled', async () => {
    await expect.poll(() => storedLessons(page, section.id)).toEqual(expected);
  });
  await test.step('after_reload', async () => {
    await page.reload();
    await expect.poll(async () => shownLessonTitles(await sectionCard(page, section.title))).toEqual(expected.map(lessonTitle));
    expect(await storedLessons(page, section.id)).toEqual(expected);
  });
  await test.step('screenshot', () => shot(page, info, `ba_r2_${suffix(info.project.name)}`, curriculum));
});
