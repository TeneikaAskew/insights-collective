import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Job Description Analyzer', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.jobDescription);
  });

  test('renders job description page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.jobDescription);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('job description textarea accepts a posting', async ({ page }) => {
    // The single textarea on the page, and it keeps what is typed. The old
    // union's `[placeholder*="job"]` alternatives were dead — the placeholders
    // here are sentence-case — and `.first()` over a union resolves in document
    // order, so the test never established which control it had.
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Senior Software Engineer - React, TypeScript, Node.js required');
    await expect(textarea).toHaveValue(/Senior Software Engineer/);
  });

  test('analyze and extract controls are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Analyze Description' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Extract' })).toBeVisible();
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Job Description Analysis' })).toBeVisible();
    // The empty right-hand pane is part of the page's promise, and it is what
    // an outage would silently replace.
    await expect(page.getByRole('heading', { name: 'Your study guide will appear here' })).toBeVisible();
  });
});
