import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Certificate', () => {
  const certUrl = Routes.certificate();

  test('renders certificate page', async ({ page }) => {
    await goto(page, certUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(certUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('the certificate page states its requirement', async ({ page }) => {
    await goto(page, certUrl);
    // The member has NOT completed the reference course, so what this route
    // renders is the locked state — and that is worth asserting precisely,
    // because the old locator could not tell it from the unlocked one. Its
    // bare `:has-text("complete")` also matched every ancestor up to <html>.
    await expect(page.getByRole('heading', { name: 'Course certificate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Course Certification' })).toBeVisible();
    await expect(
      page.getByText('Finish every required lesson and assignment to unlock your certificate.'),
    ).toBeVisible();
    // Deliberately NOT asserting the completion percentage the page shows
    // beside this: it moves whenever any spec touches the member's progress.
  });

  // The download control only exists once the course is complete, and the
  // shared member never completes it — certificate-generation.spec.ts runs the
  // completion journey on a SEPARATE account precisely so this member's
  // certificate state stays constant for everyone else.
  test.skip(
    'download or print button is present if completed',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'Seed gap by design: the shared member has not completed the reference course, so /certificate renders the locked state and offers no Download/Print. Completion is exercised by journeys/certificate-generation.spec.ts on the e2e-journeys account.',
      },
    },
    async ({ page }) => {
      await goto(page, certUrl);
      await expect(page.getByRole('button', { name: /Download|Print/ })).toBeVisible();
    },
  );
});
