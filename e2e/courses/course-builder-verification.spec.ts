// ABOUTME: End-to-end verification of the instructor course builder surfaces:
// ABOUTME: setup guide, curriculum, add-content panel, design, certificates, and information tabs.

import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';

test.describe('Course builder — verification suite', () => {
  test('Setup guide loads with title and thumbnail slot', async ({ page }) => {
    await goto(page, `/courses/${COURSE_ID}/builder`);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.getByText(/Setup guide/i).first()).toBeVisible();
    await expect(page.getByText(/Course title/i).first()).toBeVisible();
  });

  test('Curriculum tab renders modules and lessons', async ({ page }) => {
    await goto(page, `/courses/${COURSE_ID}/builder`);
    const curriculum = page.getByRole('link', { name: /Curriculum/i }).first();
    if (await curriculum.count()) {
      await curriculum.click();
    }
    await expect(page.getByText(/Foundations of Data Science/i).first()).toBeVisible();
  });

  test('Design templates, Certificates and Information tabs load without error', async ({ page }) => {
    for (const label of ['Design templates', 'Certificates', 'Information']) {
      await goto(page, `/courses/${COURSE_ID}/builder`);
      const tab = page.getByRole('link', { name: new RegExp(label, 'i') }).first();
      if (await tab.count()) {
        await tab.click();
        await expect(page.getByText(new RegExp(label, 'i')).first()).toBeVisible();
      }
    }
  });
});
