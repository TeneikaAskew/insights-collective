import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Page', () => {
  // Pinned to the seeded fixture rather than Routes.surveyPage(), whose slug is
  // overridable via E2E_TEST_SURVEY_SLUG. Every assertion below names this
  // form's own title, section and placeholders, so pointing the suite at an
  // externally provisioned survey could only fail it. The slug and the content
  // are one fixture; they have to travel together.
  const FIXTURE_SLUG = 'e2e-fixture-survey';
  const surveyUrl = `/survey/${FIXTURE_SLUG}`;

  // Both of these asserted only that <body> is non-empty — true of the "Form Not
  // Found" screen this route used to render, and true of every error page. They
  // also went flaky once the fixture started rendering a real form, because
  // "any content" resolves before the form does. Asserting the seeded title
  // fixes both problems at once: it is a real check AND a real wait.
  test('renders survey page for valid slug', async ({ page }) => {
    await goto(page, surveyUrl);
    await expect(page.getByRole('heading', { name: 'E2E Fixture Survey' })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(surveyUrl);
    await waitForPageLoad(page);
    await expect(page.getByRole('heading', { name: 'E2E Fixture Survey' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('survey form fields render', async ({ page }) => {
    await goto(page, surveyUrl);
    // The seeded form by name, then its two fields. The old locator accepted the
    // FIRST input on the page, which is the Navbar's site-search box — so it was
    // green on the "Form Not Found" screen this fixture used to render.
    await expect(page.getByRole('heading', { name: 'E2E Fixture Survey' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
    await expect(page.getByPlaceholder(/Enter what are you hoping to learn/i)).toBeVisible();
  });

  test('submit button is present', async ({ page }) => {
    await goto(page, surveyUrl);
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
  });

  test('required field validation triggers on empty submit', async ({ page }) => {
    await goto(page, surveyUrl);
    // "Your name" is required in the seeded structure, so submitting empty must
    // NOT navigate. The old test asserted the URL was unchanged even when it had
    // clicked nothing — on a not-found page there was no submit button at all,
    // so the URL trivially stayed put and the test passed without exercising
    // validation once.
    await page.getByRole('button', { name: 'Submit' }).click();
    // Assert the message validation itself renders. "URL unchanged" and "the
    // input is still there" are BOTH true when the submit handler no-ops, or
    // when empty data reaches onSubmit and the insert throws and is caught
    // without navigating — so neither one establishes that validation ran.
    // SurveyField sets `required: "This field is required"` and FormMessage
    // renders it, so this text appears only on the path being tested.
    await expect(page.getByText('This field is required')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${surveyUrl}$`));
    // And the form is still on screen rather than replaced by a confirmation.
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  });
});
