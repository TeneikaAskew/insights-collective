import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';

// Public portfolio is accessible WITHOUT authentication. This file runs in
// chromium-public, which has no storageState, so the hand-built
// browser.newContext() in every test was buying nothing — and a page made that
// way escapes the console-error fixture, which instruments only the injected
// `page`. They are gone; the project provides the signed-out state.
test.describe('Public Portfolio View', () => {
  // Pinned to the seeded fixture rather than Routes.publicPortfolio(), whose
  // URL is overridable via E2E_TEST_PORTFOLIO_URL. Every assertion below names
  // this page's own title, description and skills, so an externally
  // provisioned portfolio would fail the suite while working perfectly. Same
  // reasoning as blog-post and survey-page: the URL and the content are one
  // fixture and have to travel together.
  const publicUrl = '/portfolio/e2e-member';

  test('renders public portfolio without authentication', async ({ page }) => {
    await goto(page, publicUrl);
    // The fixture portfolio by name. "body is not empty" was equally true of
    // the "Portfolio not found" screen and of a crash that left the shell up.
    await expect(page.getByRole('heading', { name: 'E2E Portfolio' })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(publicUrl);
    await waitForPageLoad(page);
    await expect(page.getByRole('heading', { name: 'E2E Portfolio' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('portfolio content renders', async ({ page }) => {
    await goto(page, publicUrl);
    // MEASURED: this page renders NO <main>, no [role="main"], and nothing
    // whose class contains "portfolio" — PortfolioLayoutRenderer emits plain
    // divs. So the old locator matched zero elements and the count-guard
    // turned that into a pass. (CSS attribute matching is case-sensitive, so
    // the [class*="Portfolio"] alternative was dead for a second reason.)
    // What the page does render is the portfolio's own headings and content.
    await expect(page.getByRole('heading', { name: 'E2E Portfolio' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skills & Technologies' })).toBeVisible();
    await expect(page.getByText('Fixture portfolio page for the editor spec.')).toBeVisible();
  });

  test('page does not show app sidebar navigation', async ({ page }) => {
    await goto(page, publicUrl);
    // Wait for the page proper before asserting an absence, or this passes
    // against a blank document for the wrong reason.
    await expect(page.getByRole('heading', { name: 'E2E Portfolio' })).toBeVisible();
    await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
  });

  test('not found page renders for unknown portfolio URL', async ({ page }) => {
    await goto(page, '/portfolio/definitely-does-not-exist-99999');
    // PublicPortfolioView.tsx:59. Asserted by name so this test can tell the
    // not-found screen from the error screen directly above it in that file —
    // "body is not empty" could not, and a failed read rendering as "not found"
    // is exactly the confusion that component was changed to avoid.
    await expect(page.getByRole('heading', { name: 'Portfolio not found' })).toBeVisible();
  });
});
