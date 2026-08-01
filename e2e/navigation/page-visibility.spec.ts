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

  // Signed OUT, deliberately.
  //
  // This is what made the test flaky. It ran under chromium-member, whose
  // storageState is a signed-in member, while asserting that the login FORM is
  // visible — and Login.tsx navigates authenticated users off /login as soon as
  // isAuthenticated resolves. So it passed only inside the window before
  // AuthProvider finished restoring the session from storage, and failed once the
  // restore won that race. Nothing about the assertion was wrong; the browser it
  // ran in was.
  //
  // Signed out via test.use rather than `browser.newContext()`, and that part is
  // load-bearing: the console-error fixture attaches its listeners to the
  // INJECTED `page` (console-errors.fixture.ts — `async ({ page }, use)` then
  // page.on('console'|'pageerror')). A hand-built context creates a page the
  // fixture never sees, so /login could start throwing on every load and this
  // test would still pass. Overriding storageState removes the session and
  // nothing else, keeping the page instrumented.
  //
  // Fixing the timing instead — waiting longer, or racing the redirect — would
  // only have made a signed-in browser assert a signed-out expectation more
  // reliably.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('auth surfaces are never gated', async ({ page }) => {
      // Even with every row hidden, /login must render.
      await stubVisibility(page, hiddenBlog);

      await page.goto('/login');
      await waitForPageLoad(page);

      await expect(page.getByTestId('coming-soon')).toHaveCount(0);
      await expect(
        page.locator('input[type="email"], input[name="email"]').first(),
      ).toBeVisible();
    });
  });

  test('Coming Soon offers a way back to the dashboard', async ({ page }) => {
    await stubVisibility(page, hiddenBlog);

    await page.goto('/blog');
    await waitForPageLoad(page);

    await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
  });
});
