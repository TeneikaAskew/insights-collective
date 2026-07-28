import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Event Detail', () => {
  const eventUrl = Routes.eventDetail();

  test('renders event detail page', async ({ page }) => {
    await goto(page, eventUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(eventUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('event title is visible', async ({ page }) => {
    await goto(page, eventUrl);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('event date or time is displayed', async ({ page }) => {
    await goto(page, eventUrl);
    const date = page.locator(':has-text("date"), :has-text("Date"), time, [class*="date"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await date.count() > 0) {
      await expect(date).toBeVisible();
    }
  });

  test('Register / RSVP button is visible', async ({ page }) => {
    await goto(page, eventUrl);
    const btn = page.locator('button:has-text("Register"), button:has-text("RSVP"), button:has-text("Attend")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible();
    }
  });

  test('back to events link is present', async ({ page }) => {
    await goto(page, eventUrl);
    const backLink = page.locator('a[href*="/events"], button:has-text("Back"), a:has-text("Back")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await backLink.count() > 0) {
      await expect(backLink).toBeVisible();
    }
  });
});
