import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';

test.describe('Blog Post', () => {
  // Pinned to the seeded fixture rather than Routes.blogPost(), whose slug is
  // overridable via E2E_TEST_BLOG_SLUG. Every assertion below names this post's
  // own title and body, so pointing the suite at another post could only fail
  // it. The slug and the content are one fixture.
  const blogUrl = '/blog/test-blog-post';

  // BEFORE THIS BATCH, ALL OF THESE DESCRIBED THE NOT-FOUND SCREEN.
  // Routes.blogSlug defaults to 'test-blog-post' and no such row existed, so
  // /blog/test-blog-post rendered BlogPost.tsx:162 — an <h1>Blog post not
  // found</h1> and a "Back to Blog" button. The title assertion passed on those
  // four words; the two count-guards sat on locators for an article and a back
  // link, one of which the not-found page happens to have. seed.sql now
  // provisions the post, so these assert the real page.
  //
  // The hand-built browser.newContext() in every test is also gone. This file
  // runs in chromium-public, which already has no storageState, so the extra
  // context bought nothing — and a page created that way escapes the
  // console-error fixture, which instruments only the injected `page`.

  test('renders blog post page', async ({ page }) => {
    await goto(page, blogUrl);
    await expect(page.locator('main')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(blogUrl);
    await waitForPageLoad(page);
    await expect(page.getByRole('heading', { name: 'E2E Fixture Blog Post' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('blog post title is visible', async ({ page }) => {
    await goto(page, blogUrl);
    // The seeded title, not "the first h1 or h2" — that was satisfied by
    // "Blog post not found".
    await expect(page.getByRole('heading', { name: 'E2E Fixture Blog Post' })).toBeVisible();
  });

  test('blog post content renders', async ({ page }) => {
    await goto(page, blogUrl);
    // The <article> wrapper (BlogPost.tsx:184) exists only on the found path,
    // and the seeded body inside it. The old locator ended in a bare `p`, which
    // the not-found screen also has.
    const article = page.locator('article');
    await expect(article).toBeVisible();
    await expect(article).toContainText('This paragraph exists so the article body is not empty.');
    await expect(article).toContainText('A second paragraph, so content assertions have something to match.');
  });

  test('invalid blog slug renders gracefully (not blank page)', async ({ page }) => {
    await goto(page, '/blog/this-slug-does-not-exist-12345');
    // Now that a valid slug renders a real post, the not-found screen is worth
    // asserting by name: "body is not empty" was equally true of both, so it
    // could not tell them apart.
    await expect(page.getByRole('heading', { name: 'Blog post not found' })).toBeVisible();
  });

  test('edit button is NOT visible for unauthenticated user', async ({ page }) => {
    await goto(page, blogUrl);
    // Only meaningful now that the post actually renders — on the not-found
    // screen there was no post to offer an edit control for, so this passed
    // without testing anything.
    await expect(page.getByRole('heading', { name: 'E2E Fixture Blog Post' })).toBeVisible();
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit Post"), a[href*="edit"]');
    await expect(editBtn).toHaveCount(0);
  });

  test('back link to blog list is present', async ({ page }) => {
    await goto(page, blogUrl);
    // The post page's own back link (BlogPost.tsx:179), matched by role and
    // name. The old locator's `a[href*="/blog"]` alternative would also have
    // been satisfied by any other /blog/... link on the page.
    const backLink = page.getByRole('link', { name: 'Back to Blog' });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/blog');
  });
});
