import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Blog Management', () => {
  test('renders admin blog page', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminBlog);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('blog post list renders with its tabs and posts', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    // Posts are CARDS, not a table — measured 0 <table> and 0 tbody rows — so
    // the old locator could only have matched on its [class*="blog"] and
    // [class*="post"] alternatives, which also match the page wrapper. It could
    // not tell a rendered list from an empty one.
    for (const tab of ['Posts', 'Categories', 'Analytics', 'Settings']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    // The stat tile and the list have to agree: a non-zero Total Posts with no
    // post rendered is the failure this replaces.
    await expect(page.getByRole('heading', { name: 'Total Posts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What Is Data Science?' })).toBeVisible();
  });

  test('create new blog post button is visible', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    await expect(page.getByRole('button', { name: 'New Post' })).toBeVisible();
  });

  test('the posts panel offers its sort controls', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    const panel = page.getByRole('tabpanel').filter({ visible: true }).first();
    await expect(panel).toBeVisible();
    for (const sort of ['Title', 'Views', 'Date']) {
      await expect(panel.getByRole('button', { name: sort })).toBeVisible();
    }
  });

  // What I could NOT establish, stated rather than guessed at.
  //
  // The original test looked for `button:has-text("Edit")`, `a:has-text("Edit")`
  // and `a[href*="edit"]`. None of them match anything on this page, so it never
  // asserted a thing. Replacing it needs a locator for the real control, and
  // three attempts at one all failed on measurement:
  //   - filtering `div` by a post heading resolves to the innermost wrapper,
  //     which contains no buttons;
  //   - the visible Posts tab panel contains EXACTLY 3 buttons — the Title /
  //     Views / Date sort controls asserted above — so there are no per-post
  //     controls inside it;
  //   - the page does carry ~10 unnamed icon buttons, one per post by count,
  //     but they sit outside the panel and nothing distinguishes them from
  //     other icon buttons in the shell.
  //
  // Any locator I could write here would be positional and would pass for the
  // wrong reason, which is the defect this whole sweep is removing. A testid on
  // the control settles it in one line — an app change, not a test one.
  test.skip(
    'edit blog post control is reachable',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'Needs a testid: /admin/blog has no Edit link or labeled Edit button, and the per-post icon controls cannot be targeted without a positional selector that would pass for the wrong reason.',
      },
    },
    async ({ page }) => {
      await goto(page, Routes.adminBlog);
      await expect(page.getByTestId('blog-post-edit').first()).toBeVisible();
    },
  );

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    await expect(page.getByRole('heading', { name: 'Blog Management' })).toBeVisible();
  });
});
