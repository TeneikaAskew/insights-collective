// ABOUTME: The tweets archive must link out to the account it archives. Checks
// ABOUTME: the href and that it opens safely in a new tab. The LinkedIn archive
// ABOUTME: is covered separately under the admin project — page_visibility hides
// ABOUTME: /teneika-linkedin from users and instructors, so a member session
// ABOUTME: renders Coming Soon there and could never see the link.
import { test, expect } from '../fixtures/page-helpers';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

test.describe('Tweets archive links to its source account', () => {
  test('the handle in the subheading opens the X profile', async ({ page }) => {
    await page.goto(`${BASE}/teneika-tweets`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Teneika's Tweets/i, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    const link = page.getByTestId('twitter-profile-link');
    await expect(link).toBeVisible({ timeout: 15_000 });
    await expect(link).toHaveAttribute('href', 'https://twitter.com/teneikaask_you');
    await expect(link).toHaveAttribute('target', '_blank');
    // rel guards the opened tab against reaching back through window.opener.
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  });
});
