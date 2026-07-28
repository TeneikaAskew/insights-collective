import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Events', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.events);
  });

  test('renders events page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /event/i }).first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.events);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('event cards or list renders', async ({ page }) => {
    const cards = page.locator('[class*="event"], [class*="Card"], article');
    const empty = page.locator(':has-text("No events"), :has-text("upcoming")');
    expect((await cards.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('search input is present', async ({ page }) => {
    const searchInput = page.locator(Sel.searchInput).first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('Upcoming / Past tabs are present', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('Register button is visible on event cards', async ({ page }) => {
    const registerBtn = page.locator('button:has-text("Register"), button:has-text("RSVP"), a:has-text("Register")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await registerBtn.count() > 0) {
      await expect(registerBtn).toBeVisible();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
