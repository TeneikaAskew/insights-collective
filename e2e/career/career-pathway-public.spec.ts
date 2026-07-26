import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

// Runs unauthenticated (chromium-public project). The merged page renders its
// own sign-in wall rather than bouncing to /login, so the marketing copy stays
// visible to logged-out visitors.
test.describe('Career Pathway (signed out)', () => {
  test('shows the sign-in wall instead of the coach', async ({ page }) => {
    await goto(page, Routes.careerPathway);

    await expect(page.getByTestId('career-pathway-signin')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('coach-panel')).toHaveCount(0);
    await expect(page.getByTestId('report-canvas')).toHaveCount(0);

    const signIn = page.getByRole('link', { name: /sign in to continue/i });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', /redirect=%2Fcareer-pathway/);
  });

  test('the retired career-agent route still lands on the pathway wall', async ({ page }) => {
    await goto(page, Routes.careerAgent);

    await expect(page).toHaveURL(/\/career-pathway/);
    await expect(page.getByTestId('career-pathway-signin')).toBeVisible({ timeout: 20_000 });
  });
});
