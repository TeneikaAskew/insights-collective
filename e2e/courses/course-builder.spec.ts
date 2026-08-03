import { test, expect } from '../fixtures/page-helpers';
import { expectRedirectToLogin, goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Builder (Instructor)', () => {
  const builderUrl = Routes.courseBuilder();

  test('renders course builder interface', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(builderUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  // The builder for a PUBLISHED course, so the control reads "Unpublish".
  // `Sel.builder.publishToggle` was '#publish-toggle', an id this page has never
  // rendered — the count-guard around it meant the test passed on nothing.
  test('publish control is present', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(
      page.getByRole('button', { name: /^(Unpublish|Publish)$/ }),
    ).toBeVisible();
  });

  // Targets the shell's Preview link by data-onboarding, not by text. The old
  // `button:has-text("Preview")` matched SetupGuideView's separate "Preview
  // curriculum" BUTTON — a different control on a different view — so this test
  // was green for the wrong reason and would have broken the moment the builder
  // opened on a tab without that button.
  test('preview link is visible', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(page.locator(Sel.builder.previewBtn)).toBeVisible();
  });

  // The title is not an inline contenteditable — it is behind an "Edit title"
  // action. `Sel.builder.titleField` looked for '[contenteditable="true"]',
  // which this page has none of, so "course title field is editable" asserted
  // nothing and clicked nothing.
  test('course title can be edited', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(page.getByRole('heading', { name: 'Introduction to Data Science' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit title' })).toBeVisible();
  });

  // Same story: there is no "Add Module" button. Curriculum is edited through
  // its own action, which is what this test is really about.
  test('curriculum can be edited', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(page.getByRole('button', { name: 'Edit curriculum' })).toBeVisible();
  });

  test('curriculum tree shows module list', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(
      page.locator('[class*="CurriculumTree"], [class*="curriculum"], aside').first(),
    ).toBeVisible();
  });

  test('new course builder route renders without error', async ({ page }) => {
    // May redirect to a new course builder page
    await page.goto(Routes.newCourseBuilder);
    await waitForPageLoad(page);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  // RENAMED to what it actually does. The old title said "member user", but the
  // body built a context with no storageState at all — a signed-OUT visitor.
  // While this was skipped the discrepancy cost nothing; now that PR 8 has
  // wrapped the route in ProtectedRoute and the test runs, a name that
  // describes the wrong actor would send the next reader looking for a
  // role check that isn't here.
  //
  // The hand-built context is replaced by a describe-scoped `test.use`, so the
  // page stays under the console-error fixture — a browser.newContext() page
  // escapes it (the lesson from #48).
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated visitor is redirected away from the builder', async ({ page }) => {
      await page.goto(builderUrl);
      await expectRedirectToLogin(page);
    });
  });
});
