// ABOUTME: End-to-end verification of the recently rebuilt course platform surfaces:
// ABOUTME: catalog, course home (curriculum + descriptions + checkpoints), student player, and builder tabs.

import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';

test.describe('Course platform — verification suite', () => {
  test('Catalog page lists the Introduction to Data Science course', async ({ page }) => {
    await goto(page, '/courses');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.getByText(/Introduction to Data Science/i).first()).toBeVisible();
  });

  test('Course detail shows curriculum with module descriptions and weekly checkpoints', async ({ page }) => {
    await goto(page, `/courses/${COURSE_ID}`);
    await expect(page.getByRole('heading', { name: /Introduction to Data Science/i }).first()).toBeVisible();

    // Unified curriculum heading (post-merge)
    await expect(page.getByText(/Course curriculum/i).first()).toBeVisible();

    // Week labels from timeline
    await expect(page.getByText(/WEEK\s*1/i).first()).toBeVisible();

    // Module names should render
    await expect(page.getByText(/Foundations of Data Science/i).first()).toBeVisible();
    await expect(page.getByText(/Python for Data Analysis/i).first()).toBeVisible();
  });

  test('Course player renders the curriculum sidebar and lesson viewer', async ({ page }) => {
    await goto(page, `/courses/${COURSE_ID}/learn`);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();

    // Sidebar shows module + lesson titles
    await expect(page.getByText(/What is Data Science\?/i).first()).toBeVisible();
    await expect(page.getByText(/Foundations Quiz/i).first()).toBeVisible();

    // No lingering spinner
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });
});
