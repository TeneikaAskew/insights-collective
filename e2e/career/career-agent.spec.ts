import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

// The career agent and career pathway were merged into one page —
// /career-agent now redirects to /career-pathway.
test.describe('Career Agent (redirect)', () => {
  test('redirects to the merged career pathway page', async ({ page }) => {
    await goto(page, Routes.careerAgent);
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/career-pathway/);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('sidebar is visible after redirect', async ({ page }) => {
    await goto(page, Routes.careerAgent);
    await waitForPageLoad(page);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
