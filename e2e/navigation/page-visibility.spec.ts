import { Page } from '@playwright/test';
import { test, expect, waitForPageLoad } from '../fixtures/page-helpers';

/**
 * Enforcement tests for the VisibilityGate: a page hidden via
 * page_visibility must not merely be covered up — it must never mount,
 * which means none of its data requests may fire.
 *
 * The page_visibility GET is stubbed at the network layer so these tests
 * control visibility without writing to the shared database.
 */

interface VisibilityRow {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
}

async function stubVisibility(page: Page, rows: VisibilityRow[]): Promise<void> {
  await page.route('**/rest/v1/page_visibility*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
      return;
    }
    await route.continue();
  });
}

const hiddenBlog: VisibilityRow[] = [
  {
    id: 'e2e-vis-blog',
    page_path: '/blog',
    page_name: 'Blog',
    visible_to_users: false,
    visible_to_instructors: false,
  },
];

function trackRequests(page: Page, urlPart: string): string[] {
  const hits: string[] = [];
  page.on('request', request => {
    if (request.url().includes(urlPart)) {
      hits.push(request.url());
    }
  });
  return hits;
}

test.describe('Page visibility enforcement', () => {
  test('hidden page shows Coming Soon and its data requests never fire', async ({ page }) => {
    await stubVisibility(page, hiddenBlog);
    const blogRequests = trackRequests(page, '/rest/v1/blog_posts');

    await page.goto('/blog');
    await waitForPageLoad(page);

    await expect(page.getByTestId('coming-soon')).toBeVisible();
    await expect(page.getByText('Coming Soon')).toBeVisible();
    // The real proof: the Blog page never mounted, so it never queried
    expect(blogRequests).toHaveLength(0);
  });

  test('hiding a section hides its subtree (detail pages inherit)', async ({ page }) => {
    await stubVisibility(page, hiddenBlog);
    const blogRequests = trackRequests(page, '/rest/v1/blog_posts');

    await page.goto('/blog/some-post-slug');
    await waitForPageLoad(page);

    await expect(page.getByTestId('coming-soon')).toBeVisible();
    expect(blogRequests).toHaveLength(0);
  });

  test('a visible page renders normally', async ({ page }) => {
    await stubVisibility(page, [
      { ...hiddenBlog[0], visible_to_users: true, visible_to_instructors: true },
    ]);

    await page.goto('/blog');
    await waitForPageLoad(page);

    await expect(page.getByTestId('coming-soon')).toHaveCount(0);
  });

  test('pages without visibility rows default to visible', async ({ page }) => {
    await stubVisibility(page, []);

    await page.goto('/blog');
    await waitForPageLoad(page);

    await expect(page.getByTestId('coming-soon')).toHaveCount(0);
  });

  test('auth surfaces are never gated', async ({ browser }) => {
    // Signed out, in a context of its own.
    //
    // This file runs under chromium-member, and Login.tsx redirects an
    // authenticated visitor to wherever they came from. So /login never showed
    // its form here and the email assertion was racing the redirect — it read
    // as flaky, then failed outright. The claim being made is about a
    // signed-out visitor, so the test now uses one.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    try {
      // Even with every row hidden, /login must render its form.
      await stubVisibility(page, hiddenBlog);

      await page.goto('/login');
      await waitForPageLoad(page);

      await expect(page.getByTestId('coming-soon')).toHaveCount(0);
      await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('Coming Soon offers a way back to the dashboard', async ({ page }) => {
    await stubVisibility(page, hiddenBlog);

    await page.goto('/blog');
    await waitForPageLoad(page);

    await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
  });
});
