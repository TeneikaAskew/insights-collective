// ABOUTME: BA-R1/BA-R2 (EXECUTABLE, no injection): a section reorder made with the keyboard and a lesson reorder made with
// ABOUTME: the pointer are stored with dense positions 0..n-1, sent as exactly one RPC, and rendered in that order after reload.
import type { Page } from '@playwright/test';
import { test, expect } from './guarded-test';
import { A, route } from './ids';
import { storedSections, storedLessons, shownSectionTitles, sectionCard, shownLessonTitles } from './helpers';
import { expectCalls } from './observe';
import { r1Code, r1DropKind, r1ScrollKind } from '../../scripts/builder-authoring-fixture/codes.mjs';
import { r1TraceInstall, r1TraceRead, r1TraceDescription, R1_TRACE_ANNOTATION } from '../../scripts/builder-authoring-fixture/r1-trace.mjs';
import { shot } from './shot';

const sectionTitle = (id: string) => A.sections.find((s) => s.id === id)!.title;
const lessonTitle = (id: string) => A.lessons.find((l) => l.id === id)!.title;
const sameSet = (a: string[], b: string[]) => expect([...a].sort()).toEqual([...b].sort());
const suffix = (p: string) => p.replace('ba-', '') as '1440' | '768' | '390';

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
    // Diagnostic reads never abort or default: a failed read is null and reduces to its UNAVAILABLE word.
    let scrollBefore: unknown = null;
    // Passive trace (DIAGNOSTIC only): installed on the handle BEFORE focus, read and removed in finally, reported as one
    // annotation of fixed words. A failed install or read is NOT_INSTALLED / READ_FAILED; it never changes the result.
    const traceInstalled = await handle.evaluate(r1TraceInstall, { moving, target }, { timeout: 5_000 })
      .then((v) => v === 'INSTALLED').catch(() => false);
    try {
      await expectCalls(page, { method: 'POST', path: '/rest/v1/rpc/reorder_modules' }, async () => {
        await handle.focus();
        scrollBefore = await page.evaluate(() => window.scrollY).catch(() => null);
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
      }, { count: 1, status: [200, 204] });
    } catch (e) {
      const texts = await page.locator('[id^="DndLiveRegion"]')
        .evaluateAll((els) => els.map((el) => el.textContent ?? '')).catch(() => null);
      const scrollAfter = await page.evaluate(() => window.scrollY).catch(() => null);
      throw new Error(r1Code(e instanceof Error ? e.message : null, r1DropKind(texts, moving, target), r1ScrollKind(scrollBefore, scrollAfter)));
    } finally {
      const snap = await page.evaluate(r1TraceRead).catch(() => null);
      info.annotations.push({ type: R1_TRACE_ANNOTATION, description: r1TraceDescription(traceInstalled, snap) });
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
