import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Management (Instructor)', () => {
  const mgmtUrl = Routes.courseManagement();

  test('renders course management page', async ({ page }) => {
    await goto(page, mgmtUrl);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(mgmtUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  // This route renders the course BUILDER, whose sections are buttons in a rail
  // — "Setup guide", "Curriculum", "Design templates", "Certificates",
  // "Information", "Settings". Measured: 0 [role="tab"] on the page, so all
  // three tests below asked for tabs that do not exist and their count-guards
  // reported that as passing.
  const SECTIONS = ['Setup guide', 'Curriculum', 'Design templates', 'Certificates', 'Information', 'Settings'];

  test('the builder section rail is present', async ({ page }) => {
    await goto(page, mgmtUrl);
    for (const name of SECTIONS) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
  });

  test('the course being managed is named', async ({ page }) => {
    await goto(page, mgmtUrl);
    await expect(
      page.getByRole('heading', { name: 'Introduction to Data Science' }),
    ).toBeVisible();
  });

  // Students and Assignments are not sections of this screen. The rail offers
  // "Students" only as a COMING SOON placeholder, and assignments are reached
  // through Curriculum — so the two tests named for those tabs were asserting
  // navigation this page does not have.
  test('students management is still a placeholder', async ({ page }) => {
    await goto(page, mgmtUrl);
    // Asserted rather than skipped, because the placeholder is the real current
    // behavior and this fails the day it becomes a working section — which is
    // when the test above it should grow a Students case.
    const students = page.getByRole('button', { name: /Students/ });
    await expect(students).toBeVisible();
    // Case-insensitive: the DOM says "Coming soon" and CSS uppercases it, so
    // innerText and textContent disagree. toContainText reads textContent.
    await expect(students).toContainText(/coming soon/i);
  });
});
