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
    // The rendered DATE, which is what this test is named for. The old locator
    // led with a bare :has-text with no tag qualifier — matching every ancestor
    // up to <html>, so the word "date" anywhere passed — and my first
    // replacement asserted two card headings instead, which would stay green
    // with the date gone.
    //
    // Matched by shape rather than by a literal: seed.sql sets the event to
    // CURRENT_DATE + 30, so the exact string moves every day. formatDate
    // renders e.g. "Wednesday, September 2, 2026".
    await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
    await expect(
      page.getByText(
        /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \w+ \d{1,2}, \d{4}/,
      ).first(),
    ).toBeVisible();
  });

  // The control is "Register for Event", which is why the old locator's
  // Register / RSVP / Attend :has-text alternatives all missed — none of them
  // is a prefix of it in the way those selectors needed.
  //
  // I got here in two wrong steps worth recording. First I read a TRUNCATED
  // probe button list and concluded no register control existed at all. Then,
  // with the fixture still aged into the past, the page offered "Join Event" —
  // so the label itself depends on whether the event is upcoming. Fixing the
  // stale seed date changed the control, which is exactly why the seed and the
  // assertion had to be fixed together.
  test('the registration panel offers a way to register', async ({ page }) => {
    await goto(page, eventUrl);
    await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register for Event' })).toBeVisible();
  });


  test('back to events link is present', async ({ page }) => {
    await goto(page, eventUrl);
    await expect(page.getByRole('button', { name: 'Back to Events' })).toBeVisible();
  });
});
