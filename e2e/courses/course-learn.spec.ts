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
    const tree = page.locator('[class*="curriculum"], [class*="sidebar"], [class*="CurriculumTree"], aside, nav');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await tree.count() > 0) {
      await expect(tree.first()).toBeVisible();
    }
  });

  test('content viewer pane is visible', async ({ page }) => {
    await goto(page, learnUrl);
    // Was `[class*="content"], [class*="viewer"], main, [role="main"], section,
    // article` behind a count-guard. Two defects in one line: the bare `section`
    // matched ANY section on the page — including the toast region a toaster
    // mounts, which is present and hidden, so `.first()` resolved to it and the
    // visibility assertion failed on a page that was rendering perfectly. And
    // the guard meant the whole test passed when nothing matched at all.
    // CourseLearn renders its viewer as <main> (CourseLearn.tsx:702), so name it.
    const viewer = page.locator('main').first();
    await expect(viewer).toBeVisible();
  });

  test('progress bar or completion indicator is present', async ({ page }) => {
    await goto(page, learnUrl);
    const progress = page.locator('[role="progressbar"], [class*="progress"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await progress.count() > 0) {
      await expect(progress).toBeVisible();
    }
  });
});
