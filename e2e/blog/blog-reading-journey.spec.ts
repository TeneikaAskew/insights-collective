import { test, expect } from '@playwright/test';
import { Routes } from '../helpers/route-helpers';

/**
 * The public reading journey: find the blog, browse it, open a post, read it,
 * and get back to the index.
 *
 * This exists because /blog had no route at all — the listing page was built
 * but never registered, so every "Back to Blog" link on a post landed on
 * NotFound. These tests fail loudly if that regresses.
 *
 * Plain @playwright/test (not the console-errors fixture) so a noisy unrelated
 * console warning cannot fail the journey.
 */
test.describe('Public blog reading journey', () => {
  test('/blog resolves to the blog index, not the 404 page', async ({ page }) => {
    await page.goto(Routes.blog, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // REGRESSION: this route did not exist, so /blog rendered NotFound.
    await expect(page.getByText('Oops! Page not found')).toHaveCount(0);

    // One of the Blog page's own states must be on screen. Listing all three
    // keeps the test meaningful whether or not the environment can reach the
    // database — what it proves is that the Blog component mounted.
    await expect(
      page
        .getByText(
          /Data Blueprint Series|No articles found matching your criteria|Failed to load blog articles/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('the index either lists posts or shows an honest empty state', async ({ page }) => {
    await page.goto(Routes.blog, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const postLinks = page.locator('a[href^="/blog/"]');
    const count = await postLinks.count();

    if (count === 0) {
      // No posts is legitimate; a blank screen is not. One of the page's real
      // states must be showing.
      await expect(
        page
          .getByText(
            /No articles found matching your criteria|Failed to load blog articles/i,
          )
          .first(),
      ).toBeVisible();
    } else {
      await expect(postLinks.first()).toBeVisible();
    }
  });

  test('a reader can open a post from the index and return', async ({ page }) => {
    await page.goto(Routes.blog, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const postLinks = page.locator('a[href^="/blog/"]');
    test.skip(await postLinks.count() === 0, 'No published posts available to open');

    const href = await postLinks.first().getAttribute('href');
    await postLinks.first().click();
    await page.waitForURL(`**${href}`, { timeout: 15_000 });

    // The post itself renders.
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('404');

    // And the way back works — the link that used to 404.
    const back = page.locator('a[href="/blog"]').first();
    if (await back.count() > 0) {
      await back.click();
      await page.waitForURL('**/blog', { timeout: 15_000 });
      await expect(page.locator('body')).not.toContainText('404');
    }
  });

  test('drafts are never listed publicly', async ({ page }) => {
    await page.goto(Routes.blog, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // The listing queries status='published'; a "Draft" badge appearing here
    // would mean unpublished content leaked to anonymous readers.
    await expect(page.getByText(/^Draft$/)).toHaveCount(0);
  });
});
