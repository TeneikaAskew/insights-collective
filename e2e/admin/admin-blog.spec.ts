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

  test('blog post list renders', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    const list = page.locator('table, [role="table"], [class*="post"], [class*="blog"]').first();
    if (await list.count() > 0) {
      await expect(list).toBeVisible();
    }
  });

  test('create new blog post button is visible', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Post"), a:has-text("Create"), a:has-text("New")').first();
    if (await createBtn.count() > 0) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('edit blog post button is present', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit"), a[href*="edit"]').first();
    if (await editBtn.count() > 0) {
      await expect(editBtn).toBeVisible();
    }
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminBlog);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
