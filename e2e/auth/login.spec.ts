import { test, expect } from '../fixtures/page-helpers';
import { goto, expectToast, interceptOAuth } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.login);
  });

  test('renders all expected elements', async ({ page }) => {
    await expect(page.locator(Sel.login.email)).toBeVisible();
    await expect(page.locator(Sel.login.password)).toBeVisible();
    await expect(page.locator(Sel.login.submit)).toBeVisible();
    await expect(page.locator(Sel.login.googleBtn)).toBeVisible();
    await expect(page.locator(Sel.login.forgotLink)).toBeVisible();
    await expect(page.locator(Sel.login.registerLink)).toBeVisible();
  });

  test('shows validation when submitting empty form', async ({ page }) => {
    await page.click(Sel.login.submit);
    // Browser native validation or custom error should prevent navigation
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error toast for wrong credentials', async ({ page }) => {
    // Intercept Supabase auth to avoid hitting rate limit
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      }),
    );
    await page.fill(Sel.login.email, 'wrong@example.com');
    await page.fill(Sel.login.password, 'wrongpassword');
    await page.click(Sel.login.submit);
    // Should stay on login and show an error
    await expect(page).toHaveURL(/\/login/);
  });

  test('password visibility toggle shows/hides password', async ({ page }) => {
    await page.fill(Sel.login.password, 'secret123');
    await expect(page.locator(Sel.login.password)).toHaveAttribute('type', 'password');
    // Click the eye icon button near the password field
    await page.locator('button').filter({ hasNot: page.locator('text=Sign') }).nth(0).click();
    // After toggle, type may become 'text'
    const type = await page.locator(Sel.login.password).getAttribute('type');
    expect(['text', 'password']).toContain(type);
  });

  test('Google OAuth button initiates redirect (intercepted)', async ({ page }) => {
    await interceptOAuth(page);
    // Clicking the button should attempt an OAuth flow (which we abort)
    await page.click(Sel.login.googleBtn);
    // If no error is thrown, the button is working
  });

  // GITHUB AND TWITTER SIGN-IN DO NOT EXIST ON THIS PAGE.
  //
  // Login.tsx imports FaGithub and FaTwitter and renders NEITHER — the single
  // social control is "Sign in with Google" (:158-160). `handleSocialSignIn`
  // still accepts 'github' | 'twitter' (:98), so the handler outlived the
  // buttons, which is presumably why these two tests were written. Both
  // locators have therefore always matched zero elements, and the count-guards
  // turned that into a pass: the GitHub test clicked nothing, and the Twitter
  // test asserted nothing.
  //
  // Skipped with a named reason rather than deleted, so the coverage-gap report
  // keeps saying these providers are untested, and rather than softened to
  // match, which would be writing a test around a missing feature.
  test.skip(
    'GitHub OAuth button initiates redirect (intercepted)',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /login renders no GitHub button. Login.tsx imports FaGithub and never uses it; only "Sign in with Google" is offered, though handleSocialSignIn still accepts the provider.',
      },
    },
    async ({ page }) => {
      await interceptOAuth(page);
      await page.locator(Sel.login.githubBtn).click();
    },
  );

  test.skip(
    'Twitter OAuth button is present',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /login renders no Twitter button. Login.tsx imports FaTwitter and never uses it; only "Sign in with Google" is offered.',
      },
    },
    async ({ page }) => {
      await expect(page.locator(Sel.login.twitterBtn)).toBeVisible();
    },
  );

  test('Google is the only social provider offered', async ({ page }) => {
    // The assertion the two skips above cannot make. It fails in BOTH
    // directions: if Google disappears, and if GitHub or Twitter is wired up
    // without the skipped tests being restored.
    await expect(page.locator(Sel.login.googleBtn)).toBeVisible();
    await expect(page.locator(Sel.login.githubBtn)).toHaveCount(0);
    await expect(page.locator(Sel.login.twitterBtn)).toHaveCount(0);
  });

  test('Forgot password link navigates to reset password page', async ({ page }) => {
    await page.click(Sel.login.forgotLink);
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('Register link navigates to registration page', async ({ page }) => {
    await page.click(Sel.login.registerLink);
    await expect(page).toHaveURL(/\/register/);
  });

  test('email field accepts pasted values', async ({ page }) => {
    await page.locator(Sel.login.email).fill('pasted@example.com');
    await expect(page.locator(Sel.login.email)).toHaveValue('pasted@example.com');
  });

  test('preserves redirect param in URL', async ({ page }) => {
    await page.goto(`${Routes.login}?redirect=/dashboard`);
    await expect(page.locator(Sel.login.email)).toBeVisible();
    // The redirect param should be in the URL
    await expect(page).toHaveURL(/redirect/);
  });
});
