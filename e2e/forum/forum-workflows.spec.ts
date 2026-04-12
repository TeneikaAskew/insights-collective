import { test, expect } from '../fixtures/page-helpers';
import { goto, expectToast } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Forum Workflows', () => {
  test('new thread dialog validates required fields before creation', async ({ page }) => {
    await goto(page, Routes.forum);

    await page.click('button:has-text("New Thread")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.click('[role="dialog"] button:has-text("Create Thread")');
    await expectToast(page, 'Please fill in all fields');
  });

  test('member can create a thread from the forum list dialog', async ({ page }) => {
    await goto(page, Routes.forum);

    await page.click('button:has-text("New Thread")');
    await page.fill('#thread-title', 'Playwright coverage follow-up');
    await page.locator('[role="dialog"] button[role="combobox"]').click();
    await page.click('[role="option"]:has-text("Data Engineering")');
    await page.fill('#thread-content', 'Adding a workflow-level regression test for forum posting.');
    await page.click('[role="dialog"] button:has-text("Create Thread")');

    await expectToast(page, 'Thread created successfully');
  });
});
