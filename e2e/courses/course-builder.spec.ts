import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
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

  test('preview button is visible', async ({ page }) => {
    await goto(page, builderUrl);
    await expect(page.locator(Sel.builder.previewBtn).first()).toBeVisible();
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

  // Body untouched (see the note in course-gradebook.spec.ts). Recorded here as
  // well: the title says "member user" but the body builds a context with no
  // storageState at all, so it describes a signed-OUT visitor. PR 8 decides
  // which of the two it should be; annotating it now at least stops the CI
  // report from listing it as a skip nobody could explain.
  test.skip(
    'member user is redirected away from builder',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'Blocked on PR 8: the course-builder route has no ProtectedRoute. Also mis-titled — the body signs out entirely rather than acting as a member.',
      },
    },
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto(builderUrl);
      const url = p.url();
      expect(url).not.toContain('/builder');
      await ctx.close();
    },
  );
});
