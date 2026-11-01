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

  // Students and Reports are working sections (IC-LMS-04/05). Students WAS a
  // "Coming soon" placeholder and an older test pinned that; the roster
  // (StudentsView) and Reports (ReportsView) replaced it.
  //
  // Generic contract: holds for ANY course, empty or not. The load must resolve,
  // the error state must not render, and exactly one of roster / empty state is
  // shown. When the roster renders, its Enrolled figure equals its row count.
  test('Students opens a real roster, never the placeholder or the error state', async ({ page }) => {
    await goto(page, mgmtUrl);
    const students = page.getByRole('button', { name: /^Students/ });
    await expect(students).toBeVisible();
    await expect(students).not.toContainText(/coming soon/i);
    await students.click();
    await expect(page).toHaveURL(/view=students/);
    await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading students' })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("Couldn't load students")).toHaveCount(0);
    const roster = page.getByRole('list', { name: 'Enrolled students' });
    const empty = page.getByText('No students yet');
    await expect(roster.or(empty)).toBeVisible();
    if (await empty.isVisible()) {
      await expect(roster).toHaveCount(0);
      await expect(page.locator('dt', { hasText: /^Enrolled$/ })).toHaveCount(0);
      return;
    }
    const rows = await roster.getByRole('listitem').count();
    const enrolled = page.locator('dt', { hasText: /^Enrolled$/ }).locator('xpath=following-sibling::dd[1]');
    await expect(enrolled).toHaveText(String(rows));
  });

  // Fixture-specific: the reference course (TestIds.courseId) has the e2e member
  // enrolled by e2e/fixtures/seed.sql step 1, so an empty roster HERE means the
  // seed precondition failed or the roster query broke. This is not a claim
  // about empty courses (the generic test covers those), and the count is not an
  // exact fixture count: other enrollments on this course are not run-owned.
  test('reference course: roster is non-empty and Reports shows the same Enrolled count', async ({ page }) => {
    await goto(page, mgmtUrl);
    await page.getByRole('button', { name: /^Students/ }).click();
    await expect(page.getByRole('status', { name: 'Loading students' })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText('No students yet')).toHaveCount(0);
    const list = page.getByRole('list', { name: 'Enrolled students' });
    await expect(list).toBeVisible();
    const rows = await list.getByRole('listitem').count();
    expect(rows).toBeGreaterThan(0);

    const reports = page.getByRole('button', { name: /^Reports/ });
    await expect(reports).not.toContainText(/coming soon/i);
    await reports.click();
    await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Couldn't load reports")).toHaveCount(0);
    const kpi = page.locator('dt', { hasText: /^Enrolled$/ }).locator('xpath=following-sibling::dd[1]');
    await expect(kpi).toHaveText(String(rows));
    await expect(page.getByRole('heading', { name: 'Module progression' })).toBeVisible();
  });
});
