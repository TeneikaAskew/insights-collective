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

  // Students and Reports are working sections (IC-LMS-04/05). The old version of
  // this test asserted Students was a "Coming soon" placeholder, which stopped
  // matching the page once the roster shipped.
  test('Students opens a real roster whose count matches its list', async ({ page }) => {
    await goto(page, mgmtUrl);
    const students = page.getByRole('button', { name: /^Students/ });
    await expect(students).not.toContainText(/coming soon/i);
    await students.click();
    await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading students' })).toHaveCount(0, { timeout: 15_000 });
    // The seeded course has an enrolled member, so the empty state is a failure here.
    const list = page.getByRole('list', { name: 'Enrolled students' });
    await expect(list).toBeVisible();
    const rows = await list.getByRole('listitem').count();
    expect(rows).toBeGreaterThan(0);
    const enrolled = page.locator('dt', { hasText: /^Enrolled$/ }).locator('xpath=following-sibling::dd[1]');
    await expect(enrolled).toHaveText(String(rows));
  });

  test('Reports shows the same enrolled count as Students', async ({ page }) => {
    await goto(page, mgmtUrl);
    await page.getByRole('button', { name: /^Students/ }).click();
    const list = page.getByRole('list', { name: 'Enrolled students' });
    await expect(list).toBeVisible({ timeout: 15_000 });
    const rows = await list.getByRole('listitem').count();

    const reports = page.getByRole('button', { name: /^Reports/ });
    await expect(reports).not.toContainText(/coming soon/i);
    await reports.click();
    await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 });
    const kpi = page.locator('dt', { hasText: /^Enrolled$/ }).locator('xpath=following-sibling::dd[1]');
    await expect(kpi).toHaveText(String(rows));
    await expect(page.getByRole('heading', { name: 'Module progression' })).toBeVisible();
  });
});
