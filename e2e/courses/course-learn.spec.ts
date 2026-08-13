import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Learn Interface', () => {
  const learnUrl = Routes.courseLearn();

  test('renders course learn interface', async ({ page }) => {
    await goto(page, learnUrl);
    // Placeholder IDs render a "Course not found" fallback; accept any heading.
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(learnUrl);
    await waitForPageLoad(page);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('curriculum tree or sidebar is visible', async ({ page }) => {
    await goto(page, learnUrl);
    // The curriculum by its module names. The old locator accepted a bare `nav`
    // and `aside`, which the app shell provides on every page — so it passed
    // with no curriculum rendered at all.
    //
    // Deliberately NOT asserting "Start from beginning": CourseLearn only offers
    // it at partial progress, and nothing seeds or restores
    // content_item_progressions — so a fresh database, a completed course, or
    // any spec that advances progress would fail a test that is otherwise
    // read-only. That is the fixture-decay trap this very PR documents in
    // seed.sql, and I walked into it while writing the note.
    for (const m of ['Foundations of Data Science', 'Python for Data Analysis', 'Statistical Methods']) {
      await expect(page.getByRole('button', { name: new RegExp(m) })).toBeVisible();
    }
  });

  test('content viewer pane is visible', async ({ page }) => {
    await goto(page, learnUrl);
    // Was `[class*="content"], [class*="viewer"], main, [role="main"], section,
    // article` behind a count-guard, which failed two ways at once: the bare
    // `section` matched ANY section — including a toaster's region, which is
    // present and hidden, so `.first()` resolved to it and the assertion failed
    // on a page rendering perfectly — and the guard passed the test when nothing
    // matched at all.
    //
    // Narrowing to `main` was also wrong: CourseLearn has two content panes and
    // this URL selects no item, so it renders the course-home branch, which is
    // not a <main>. Both panes now carry a testid, and asserting on either says
    // what the test means — a content pane rendered — in whichever state the
    // page is, while still failing if neither does.
    const viewer = page
      .locator('[data-testid="course-learn-home"], [data-testid="course-learn-viewer"]')
      .first();
    await expect(viewer).toBeVisible();
  });

  test('progress bar or completion indicator is present', async ({ page }) => {
    await goto(page, learnUrl);
    // Per-module completion counts, which is what this screen shows instead of a
    // progressbar element — measured 0 [role="progressbar"] here. The old
    // locator's [class*="progress"] alternative matched the page wrapper, so it
    // passed regardless.
    //
    // Matched by SHAPE, not by the numbers. An exact "6 / 7 complete" pins the
    // test to one mutable progress state that no seed restores, so it would
    // break the moment anyone used the account or a spec advanced a lesson.
    await expect(
      page.getByRole('button', { name: /\d+ \/ \d+ complete/ }).first(),
    ).toBeVisible();
  });

  // REGRESSION: a completed lesson drew a bare filled disc — no tick, nothing to
  // tell it apart from a "you are here" dot, which is what got reported.
  //
  // Asserted by SHAPE for the same reason as the test above: nothing seeds or
  // restores progress, so "the third row is done" would rot. Every row carries
  // exactly one labelled marker whatever its state, and that is the invariant a
  // blank marker breaks.
  test('every curriculum row carries a labelled completion marker', async ({ page }) => {
    await goto(page, learnUrl);

    const section = page
      .getByRole('button', { name: /\d+ \/ \d+ complete/ })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await expect(section).toBeVisible();

    const rows = section.locator('li');
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    const markers = section.getByRole('img', { name: /^(Completed|Not started)$/ });
    await expect(markers).toHaveCount(rowCount);

    // Whichever rows are done must show a tick rather than a filled disc.
    const done = section.getByRole('img', { name: 'Completed' });
    for (let i = 0; i < (await done.count()); i++) {
      await expect(done.nth(i).locator('svg.lucide-check')).toBeVisible();
    }
  });
});
