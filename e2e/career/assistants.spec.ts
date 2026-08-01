import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import { stopAtGuard } from '../helpers/visibility-helpers';

// Every test in this file passed while /assistants was switched off, because
// ComingSoon satisfies all of them: it renders inside AppLayout so `main` and
// the sidebar are present, its "Coming Soon" h2 satisfies `h1, h2`, it has no
// spinners, and the three count-guards matched nothing and no-op'd. Seven green
// tests, none of them about assistants.
//
// stopAtGuard asks the live configuration which render is correct and asserts
// the gate when the section is hidden. Neither branch passes by default, and
// restoring the section turns the content assertions back on with no code
// change here.
test.describe('Assistants', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.assistants);
  });

  test('renders assistants page', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.assistants);
    await waitForPageLoad(page);
    // True of the gate and of the page alike, so it needs no branch.
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('assistant cards are visible', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    // The count-guard here was never needed: the page renders from the static
    // allAssistants list (src/data/assistantData.ts, 14 entries), not from
    // seeded data, so "no cards" is a defect rather than a data gap.
    const cards = page.locator('[class*="Card"], article, [class*="assistant"]');
    await expect(cards.first()).toBeVisible();
  });

  test('tabs filter assistants by category', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    const tabs = page.locator('[role="tab"]');
    await expect(tabs.first()).toBeVisible();
    await tabs.first().click();
    // The old version clicked and then asserted nothing at all, so it could not
    // tell a working filter from one that blanked the list.
    await expect(
      page.locator('[class*="Card"], article, [class*="assistant"]').first(),
    ).toBeVisible();
  });

  test('Launch button navigates to assistant interface', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    const launchBtn = page
      .locator('button:has-text("Launch"), button:has-text("Start"), a:has-text("Launch")')
      .first();
    await expect(launchBtn).toBeVisible();
  });

  test('page heading is visible', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    // Deliberately NOT guarded: the sidebar belongs to AppLayout, which wraps
    // the gate as well as the page, so this claim holds either way.
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
