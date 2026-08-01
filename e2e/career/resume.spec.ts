import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Resume Analyzer', () => {
  test('renders resume page for authenticated user', async ({ page }) => {
    await goto(page, Routes.resume);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.resume);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.resume);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('file upload dropzone is visible', async ({ page }) => {
    await goto(page, Routes.resume);
    const dropzone = page.locator(
      'input[type="file"], [class*="dropzone"], [class*="upload"], :has-text("drag"), :has-text("Drop"), :has-text("Upload")',
    ).first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await dropzone.count() > 0) {
      await expect(dropzone).toBeVisible();
    }
  });

  // Unskipped. "Login wall detection is unreliable in test env" named a symptom
  // and stopped there; the mechanism was in the test, not the app. It waited
  // only for `domcontentloaded`, which for a Vite SPA fires before React has
  // mounted anything (wait-helpers.ts documents exactly this), then read the URL
  // and counted elements against an empty #root. Nothing about the app is
  // unreliable here: Resume.tsx:788 renders <ResumeLoginWall/> whenever
  // isAuthenticated is false, with no async branch to race.
  //
  // The old assertion could not have caught much anyway — `:has-text("Login")`
  // with no tag qualifier matches every ANCESTOR containing the text, up to and
  // including <html>, so a single stray "Log in" anywhere on any page satisfied
  // it. Replaced with the wall's own affordance and the destination it offers,
  // which is what "sees a login wall" actually means.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user sees the resume login wall', async ({ page }) => {
      await goto(page, Routes.resume);

      // /resume has no ProtectedRoute (src/App.tsx:340) — by design it shows a
      // wall in place rather than redirecting, so this must NOT assert a URL
      // change. It asserts the wall, and that the wall's link carries the
      // return path (ResumeLoginWall.tsx:10).
      const signIn = page.getByRole('link', { name: 'Sign In to Continue' });
      await expect(signIn).toBeVisible();
      await expect(signIn).toHaveAttribute('href', '/login?redirect=%2Fresume');
    });
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.resume);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
