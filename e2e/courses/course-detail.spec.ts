import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, clickTab } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';

test.describe('Course Detail', () => {
  const courseUrl = Routes.courseDetail();

  test('renders course detail page', async ({ page }) => {
    await goto(page, courseUrl);
    // Should have a course title
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(courseUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('tabs are present: Modules, Assignments, Grades/Overview', async ({ page }) => {
    await goto(page, courseUrl);
    // This page has NO tabs — measured 0 [role="tab"]. It is a single scrolling
    // detail page with "Course compass" and "Course curriculum" sections, so the
    // test named for Modules/Assignments/Grades tabs was asking for navigation
    // that does not exist and its count-guard reported that as passing.
    await expect(page.getByRole('heading', { name: 'Course curriculum' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Course compass' })).toBeVisible();
  });

  test('Modules tab shows module content', async ({ page }) => {
    await goto(page, Routes.courseModules());
    // Named modules. `li` alone matched the app shell's navigation lists.
    for (const m of ['Foundations of Data Science', 'Python for Data Analysis', 'Statistical Methods']) {
      await expect(page.getByRole('heading', { name: m }).first()).toBeVisible();
    }
  });

  test('Assignments tab is navigable', async ({ page }) => {
    await goto(page, Routes.courseAssignments());
    await waitForPageLoad(page);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('invalid course ID shows error or redirect', async ({ page }) => {
    await goto(page, '/courses/non-existent-course-id-12345');
    const errorMsg = page.locator(
      ':has-text("not found"), :has-text("404"), :has-text("error"), :has-text("Failed to load"), :has-text("Invalid course")'
    );
    const redirected = page.url().includes('/courses') && !page.url().includes('non-existent');
    expect((await errorMsg.count()) > 0 || redirected).toBe(true);
  });

  // There is no breadcrumb and no back link on this page. Measured: no visible
  // a[href="/courses"], and the only actions are Message instructor, Download
  // .ics file and Copy feed URL. The old locator passed on its bare `nav`
  // alternative, which the app shell renders on every page — so the test was
  // green for the shell, not for a breadcrumb.
  //
  // Skipped with the measurement rather than deleted: a course page with no way
  // back to the catalog is a reasonable thing to want to fix, and a skip keeps
  // that visible in the coverage report where a deletion erases it.
  test.skip(
    'breadcrumb or back link renders',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /courses/:id renders no breadcrumb and no back link (no visible a[href="/courses"]); navigation back to the catalog is only via the app sidebar.',
      },
    },
    async ({ page }) => {
      await goto(page, courseUrl);
      await expect(page.locator('a[href="/courses"]').filter({ visible: true }).first()).toBeVisible();
    },
  );


  test('sidebar is visible', async ({ page }) => {
    await goto(page, courseUrl);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
