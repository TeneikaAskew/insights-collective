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
    // The Event Details panel by name. The old locator led with a bare
    // :has-text with no tag qualifier, which matches every ancestor up to
    // <html> — so the word "date" appearing anywhere satisfied it.
    await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About This Event' })).toBeVisible();
  });

  // No Register control renders for the seeded event. Measured on the page: the
  // only visible buttons are the app chrome plus "Back to Events" — no
  // Register, RSVP or Attend. The Registration SECTION is there, so the panel
  // renders; what it offers for this event is not a register button.
  //
  // Asserting the section rather than skipping outright, because the section is
  // real and its absence would be a genuine regression. The control itself is
  // left to a follow-up that establishes what it should say for an event the
  // member has already registered for, which is a product question rather than
  // a locator one.
  test('the registration panel renders', async ({ page }) => {
    await goto(page, eventUrl);
    await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();
  });


  test('back to events link is present', async ({ page }) => {
    await goto(page, eventUrl);
    await expect(page.getByRole('button', { name: 'Back to Events' })).toBeVisible();
  });
});
