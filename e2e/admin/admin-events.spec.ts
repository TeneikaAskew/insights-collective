import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Events Management', () => {
  test('renders admin events page', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminEvents);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('events table renders with its columns', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    // The events table by its own columns. `[class*="Card"]` in the old union
    // matched nothing (attribute substring matching is case-sensitive), and
    // `.first()` over a union resolves in document order, so the test never
    // established which element it was asserting about.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    for (const column of ['Event', 'Type', 'Date', 'Registrations', 'Actions']) {
      await expect(table.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  test('create event button is present', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    // MEASURED: the control is "Add Event". NONE of the old locator's three
    // alternatives — "Create", "New Event", or an anchor saying "Create" —
    // matches it, so this test has never once looked at the button it names.
    await expect(page.getByRole('button', { name: 'Add Event' })).toBeVisible();
  });

  test('the events and registrations tabs are both offered', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    // exact, because getByRole name matching is a case-insensitive SUBSTRING
    // match by default — and this page also has "Upcoming Events (4)" and
    // "Past Events (7)" tabs, so a bare 'Events' matches three of them.
    await expect(page.getByRole('tab', { name: 'Events', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Registrations', exact: true })).toBeVisible();
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
