// ABOUTME: The assignment submission page, driven against a fixture assignment
// ABOUTME: that offers all three submission types so every tab really renders.
//
// WHY THESE ASSERTIONS ARE UNCONDITIONAL NOW
//
// Every test here used to sit behind `if (await x.count() > 0)`, which passes
// whether or not the element exists. That was hiding something specific rather
// than being merely lax: the assignment these specs deep-linked to
// (19d80f57-…) has `submission_types = ['file_upload']`, so the Text Entry and
// Website URL tabs correctly never rendered. Three tests named after three
// submission types were exercising none of them, and would have gone on doing
// so if the page had stopped rendering tabs altogether.
//
// seed.sql now creates "Submission Formats Exercise" offering all three, and
// asserts on it, so a database without that fixture fails loudly at seed time
// instead of quietly here.

import { test, expect } from '../fixtures/page-helpers';
import { expectRedirectToLogin, goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes, TestIds } from '../helpers/route-helpers';

test.describe('Assignment Submission', () => {
  // The all-types fixture, not the file-upload-only production row.
  const submitUrl = Routes.assignmentSubmit(
    TestIds.courseId,
    TestIds.moduleId,
    TestIds.assignmentAllTypesContentItemId,
  );

  test('renders submission page', async ({ page }) => {
    await goto(page, submitUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(submitUrl);
    await waitForPageLoad(page);
    // The assignment is seeded, so the load must actually finish — a spinner
    // that never resolves is the failure this test exists to catch. The old
    // version tolerated a permanent spinner as long as <body> was non-empty,
    // which every rendered error page also satisfies.
    await expect(page.getByRole('heading', { name: 'Submission Formats Exercise' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('submission type tabs are present', async ({ page }) => {
    await goto(page, submitUrl);
    await expect(page.locator('[role="tablist"]').first()).toBeVisible();
  });

  test('Text Entry tab renders textarea/editor', async ({ page }) => {
    await goto(page, submitUrl);
    const textTab = page.locator(Sel.assignment.textEntryTab);
    await expect(textTab).toBeVisible();
    await textTab.click();
    // The editor is lazily imported now, so it arrives after the click rather
    // than with the page. toBeVisible() polls, which is the wait.
    await expect(page.locator('[contenteditable], textarea').first()).toBeVisible();
  });

  test('Website URL tab renders URL input', async ({ page }) => {
    await goto(page, submitUrl);
    const urlTab = page.locator(Sel.assignment.websiteUrlTab);
    await expect(urlTab).toBeVisible();
    await urlTab.click();

    const urlInput = page.locator(Sel.assignment.urlInput);
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://github.com/example/project');
    await expect(urlInput).toHaveValue('https://github.com/example/project');
  });

  test('File Upload tab renders dropzone', async ({ page }) => {
    await goto(page, submitUrl);
    const fileTab = page.locator(Sel.assignment.fileUploadTab);
    await expect(fileTab).toBeVisible();
    await fileTab.click();

    await expect(
      page.locator('[class*="dropzone"], [class*="upload"], input[type="file"]').first(),
    ).toBeVisible();
  });

  test('Submit Assignment button is present', async ({ page }) => {
    await goto(page, submitUrl);
    await expect(page.locator(Sel.assignment.submitBtn)).toBeVisible();
  });

  test('Cancel button navigates back', async ({ page }) => {
    await goto(page, submitUrl);
    const cancelBtn = page.locator(Sel.assignment.cancelBtn);
    await expect(cancelBtn).toBeVisible();

    // The test is named for the navigation, so assert the navigation. It only
    // ever checked that the button was visible.
    //
    // The destination is /learn, not the /modules/:moduleId the link points at:
    // that route is a CourseLearnRedirect (App.tsx), so the module URL is a
    // waypoint by design and never the resting place. Asserting on it would be
    // asserting on a URL the app is built never to stay at.
    await cancelBtn.click();
    await expect(page).toHaveURL(new RegExp(`/courses/${TestIds.courseId}/learn`));
  });

  test('assignment title/description is displayed', async ({ page }) => {
    await goto(page, submitUrl);
    // The seeded title, not "the first heading on the page" — which the course
    // chrome satisfies on its own.
    await expect(
      page.getByRole('heading', { name: 'Submission Formats Exercise' }),
    ).toBeVisible();
  });

  // The body is rewritten, not just unskipped, because as written it could not
  // pass even with the guard in place: it waited for `domcontentloaded` and
  // then read the URL once. That fires before React has mounted, let alone
  // redirected, so it raced ProtectedRoute and lost — measured, the URL was
  // still .../submit at that instant.
  //
  // expectRedirectToLogin polls the URL and then the form, which is the wait
  // the original was missing. The hand-built context is gone too: this file
  // runs in chromium-member, so a describe-scoped `test.use` gives the
  // signed-out state while keeping the page under the console-error fixture.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user is redirected', async ({ page }) => {
      await page.goto(submitUrl);
      await expectRedirectToLogin(page);
    });
  });
});
