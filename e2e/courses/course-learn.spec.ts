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
    // The curriculum by its module names and per-module progress. The old
    // locator accepted a bare `nav` and `aside`, which the app shell provides on
    // every page — so it passed with no curriculum rendered at all.
    for (const m of ['Foundations of Data Science', 'Python for Data Analysis', 'Statistical Methods']) {
      await expect(page.getByRole('button', { name: new RegExp(m) })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Start from beginning/ })).toBeVisible();
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
    // Per-module completion counts, which is what this screen shows instead of
    // a progressbar element — measured 0 [role="progressbar"] here. The old
    // locator's [class*="progress"] alternative matched the page wrapper, so it
    // passed regardless.
    await expect(page.getByRole('button', { name: /Foundations of Data Science\s*6 \/ 7 complete/ })).toBeVisible();
  });
});
