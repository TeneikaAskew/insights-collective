import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Portfolio Editor', () => {
  const editorUrl = Routes.portfolioEditor();

  // Unskipped. The stated reason described the wrong component: the
  // "Portfolio page not found" fallback lives in PortfolioEditorWrapper
  // (src/App.tsx:193-200), which only mounts AFTER <ProtectedRoute> has let the
  // request through (:365-369). A signed-out visitor never reaches it — the
  // guard redirects first — so the not-found fallback could not have been what
  // this test was seeing, and the skip outlived whatever it was written for.
  //
  // Signed out via test.use for the same instrumentation reason as the explorer
  // spec: chromium-member supplies a session, and only the injected `page` is
  // watched for console errors.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto(editorUrl);
      await expectRedirectToLogin(page);
    });
  });

  /**
   * These assertions used to be `expect(body).not.toBeEmpty()` and
   * `if (await x.count() > 0)`. Both pass against the "Portfolio page not
   * found" screen, which is exactly what this route served: the seeded page id
   * is `ffff6666-…`, and `isValidUUID` required RFC 4122 version 1-5, so the
   * fetch was skipped and the wrapper reported the row missing. The spec was
   * green the entire time. Assertions now name the editor.
   */
  test('renders the editor for the seeded page', async ({ page }) => {
    await goto(page, editorUrl);
    await expect(page.getByRole('heading', { name: 'Portfolio Editor' })).toBeVisible();
    await expect(page.getByText('Portfolio page not found.')).toHaveCount(0);
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(editorUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('the editor panels are reachable', async ({ page }) => {
    await goto(page, editorUrl);
    for (const name of ['Profile', 'Layout', 'Projects', 'Live Preview']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
  });

  test('save is offered', async ({ page }) => {
    await goto(page, editorUrl);
    await expect(page.getByRole('button', { name: /^Save/ })).toBeVisible();
  });

  test('a page id that matches nothing shows the not-found state', async ({ page }) => {
    // A well-formed uuid that no row carries — the fetch runs and comes back
    // empty. `invalid-page-id-99999` would exercise the shape guard instead.
    await goto(page, '/portfolio-editor/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Portfolio page not found.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Explorer' })).toBeVisible();
  });

  test('a page id that is not a uuid shows the not-found state', async ({ page }) => {
    // Never reaches the database: the shape guard stops it, because a uuid
    // column answers 22P02 and the editor would show a database error.
    await goto(page, '/portfolio-editor/invalid-page-id-99999');
    await expect(page.getByText('Portfolio page not found.')).toBeVisible();
  });
});
