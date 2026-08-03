import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Confirmation', () => {
  // SurveyConfirmation.tsx is a static page — no data, no fetch — so every
  // assertion here can be unconditional. The count-guards were never about
  // missing seed data; they were hiding two locators that pointed at the wrong
  // things. Contexts are the injected `page` now: this file runs in
  // chromium-public, which is already signed out, and a hand-built context
  // escapes the console-error fixture.

  test('renders confirmation page', async ({ page }) => {
    await goto(page, Routes.surveyConfirmation);
    await expect(page.locator('main')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.surveyConfirmation);
    await waitForPageLoad(page);
    await expect(page.getByText('Submission Successful!')).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('thank-you or success message is visible', async ({ page }) => {
    await goto(page, Routes.surveyConfirmation);
    // The card's own title and description (SurveyConfirmation.tsx:20-23).
    // The old locator was a chain of bare `:has-text(...)` with no tag
    // qualifier, which matches every ANCESTOR of a match up to <html> — so one
    // occurrence of "success" anywhere on the page, in any wrapper, satisfied
    // it. `.first()` then resolved to <html> itself.
    await expect(page.getByText('Submission Successful!')).toBeVisible();
    await expect(page.getByText('Thank you for completing the form.')).toBeVisible();
  });

  test('control to return home is present and works', async ({ page }) => {
    await goto(page, Routes.surveyConfirmation);
    // "Back to Home" is a <Button onClick={() => navigate('/')}> — NOT an
    // anchor (SurveyConfirmation.tsx:29-31). So the old locator's a[href="/"]
    // could only ever match the sidebar logo, which is on every page of the
    // app and would have kept this test green with the card entirely absent.
    const home = page.getByRole('button', { name: 'Back to Home' });
    await expect(home).toBeVisible();
    await home.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the slug variant offers a way back to that survey', async ({ page }) => {
    await goto(page, Routes.surveyConfirmationSlug('e2e-fixture-survey'));
    // The second button renders only when the route carries a slug
    // (SurveyConfirmation.tsx:32-36), so the two routes are not
    // interchangeable — the bare one above must NOT show it.
    const again = page.getByRole('button', { name: 'Submit Another Response' });
    await expect(again).toBeVisible();
    await again.click();
    await expect(page).toHaveURL(/\/survey\/e2e-fixture-survey$/);
  });

  test('the bare route offers no submit-again control', async ({ page }) => {
    await goto(page, Routes.surveyConfirmation);
    await expect(page.getByText('Submission Successful!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Another Response' })).toHaveCount(0);
  });
});
