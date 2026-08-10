import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Code Practice', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.codePractice);
  });

  test('renders code practice page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.codePractice);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  /**
   * These four sat behind `if (await x.count() > 0)` guards, which pass whether
   * or not the element exists — the branch simply does not run. They were left
   * that way because Monaco was fetched from cdn.jsdelivr.net at runtime and
   * that host is unreachable under the relay, so there was never an editor to
   * assert against. Monaco is bundled now, so each of these can say what it
   * means.
   *
   * Writing them against the real page also retired a stale premise: there is
   * no language selector to find. The only combobox filters job roles, and the
   * language is a badge the challenge itself decides.
   */

  test('code editor (Monaco) renders', async ({ page }) => {
    // The bundled editor, not a CDN copy: if the loader ever reaches for
    // jsdelivr again this is what stops being true.
    await expect(page.locator('.monaco-editor').first()).toBeVisible();
    await expect(page.locator('.monaco-editor textarea').first()).toBeAttached();
  });

  test('the challenge language is stated', async ({ page }) => {
    await expect(page.getByText(/^(Python|JavaScript)$/).first()).toBeVisible();
  });

  test('the solution can be submitted and reset', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Submit Solution/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Reset$/i })).toBeVisible();
  });

  test('a challenge renders rather than a load error', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Code Challenge Practice/i })).toBeVisible();
    // A challenge that failed to load renders this instead, and the panel would
    // otherwise be empty in a way the old `h2, h3` selector still matched.
    await expect(page.getByTestId('challenge-load-error')).toHaveCount(0);
    // The prompt heading is the challenge's own title, so it is whatever the
    // seeded row says — its presence is the assertion, not its wording.
    const headings = page.getByRole('heading');
    expect(await headings.count()).toBeGreaterThan(1);
  });
});
