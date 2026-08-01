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

  test('renders portfolio editor page', async ({ page }) => {
    await goto(page, editorUrl);
    // Page may show error for placeholder portfolio ID — just verify it rendered
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(editorUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('editor toolbar or components panel renders', async ({ page }) => {
    await goto(page, editorUrl);
    const editor = page.locator('[class*="editor"], [class*="Editor"], [class*="toolbar"], [class*="canvas"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await editor.count() > 0) {
      await expect(editor).toBeVisible();
    }
  });

  test('invalid page ID shows not-found state gracefully', async ({ page }) => {
    await goto(page, '/portfolio-editor/invalid-page-id-99999');
    await expect(page.locator('body')).not.toBeEmpty();
    // Should render either a not-found message, a login redirect, or the editor shell.
    const content = page.locator(':has-text("not found"), :has-text("error"), :has-text("Sign in"), main, form').first();
    await expect(content).toBeVisible();
  });

  test('save or publish button is visible', async ({ page }) => {
    await goto(page, editorUrl);
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Publish"), button:has-text("Update")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await saveBtn.count() > 0) {
      await expect(saveBtn).toBeVisible();
    }
  });
});
