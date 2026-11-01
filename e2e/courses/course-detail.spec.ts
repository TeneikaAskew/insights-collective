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

  // The page has a breadcrumb, and has had one since at least 2025-10-05 (the clone's history boundary). The earlier
  // skip recorded "no breadcrumb" because it measured only `a[href="/courses"]`: for a signed-in user the "Courses"
  // crumb goes to /enrolled-courses (CourseDetail.tsx: `isAuthenticated ? "/enrolled-courses" : "/courses"`), so that
  // locator could never match here. This runs in signed-in projects only; the signed-out target (/courses) is NOT
  // exercised.
  test('breadcrumb: current course is the page crumb; Courses goes to My Courses and Back returns', async ({ page }) => {
    await goto(page, courseUrl);
    const crumbs = page.getByRole('navigation', { name: 'breadcrumb' }).filter({ visible: true });
    await expect(crumbs).toHaveCount(1);
    const title = (await page.locator('h1:visible').first().textContent())?.trim() ?? '';
    expect(title).not.toBe('');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(title);
    const courses = crumbs.getByRole('link', { name: 'Courses', exact: true });
    await expect(courses).toHaveAttribute('href', '/enrolled-courses');

    await courses.click();
    await expect(page).toHaveURL(/\/enrolled-courses$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My Courses' }).filter({ visible: true })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${courseUrl}$`));
    await expect(page.getByRole('navigation', { name: 'breadcrumb' }).filter({ visible: true })
      .locator('[aria-current="page"]')).toHaveText(title);
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, courseUrl);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
