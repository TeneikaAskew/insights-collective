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

  // Assignments are reached through Curriculum, not a rail section. Students WAS a
  // "Coming soon" placeholder, and this test used to pin that; commit 7390521 wired
  // the real roster (StudentsView), so the honest assertion is now the inverse.
  test('the Students section opens the real course roster', async ({ page }) => {
    await goto(page, mgmtUrl);
    const students = page.getByRole('button', { name: /Students/ });
    await expect(students).toBeVisible();
    await expect(students).not.toContainText(/coming soon/i);
    await students.click();
    await expect(page).toHaveURL(/view=students/);
    await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();
    // The view has four honest states. Loading must resolve; whichever of the
    // other three renders is data-dependent, so accept any — but never none.
    await expect(page.getByRole('status', { name: 'Loading students' })).toHaveCount(0, { timeout: 15_000 });
    const roster = page.getByRole('list', { name: 'Enrolled students' });
    const empty = page.getByText('No students yet');
    const failed = page.getByText("Couldn't load students");
    await expect(roster.or(empty).or(failed)).toBeVisible();
  });
});
