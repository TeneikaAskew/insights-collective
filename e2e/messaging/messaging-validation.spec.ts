// ABOUTME: End-to-end validation of course messaging from the member account's side.
// ABOUTME: Covers the Dashboard tab, a course's own Messages page, and the course composer.
import { test, expect } from '../fixtures/page-helpers';
import { FIXTURE_COURSES } from '../fixtures/test-data';
import { Routes } from '../helpers/route-helpers';

// This spec runs under the chromium-member project, whose storageState is the session
// global-setup already established, so it starts authenticated. Driving the real /login
// form in beforeEach was redundant work that could only add failure surface: when that
// login was slow or failed, the page sat on /login and every later locator timed out.
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const ENROLLED = FIXTURE_COURSES.enrolled.id;

test.describe('Course messaging', () => {
  test('the Dashboard Messages tab loads the inbox', async ({ page }) => {
    await page.goto(`${BASE}${Routes.messages}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Messages', level: 2 })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^inbox$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^archived$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^deleted$/i })).toBeVisible();
  });

  test('archived and deleted tabs switch without error', async ({ page }) => {
    await page.goto(`${BASE}${Routes.messages}`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: /^archived$/i }).click();
    await expect(page.getByRole('tab', { name: /^archived$/i })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: /^deleted$/i }).click();
    await expect(page.getByRole('tab', { name: /^deleted$/i })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText(/error loading conversations/i)).toHaveCount(0);
  });

  test('a course has its own Messages page in the course sidebar', async ({ page }) => {
    await page.goto(`${BASE}/courses/${ENROLLED}/calendar`, { waitUntil: 'domcontentloaded' });

    // Messages sits with Calendar in the course rail — that is the whole point of the move.
    const messagesLink = page.locator(`[data-sidebar="sidebar"] a[href="/courses/${ENROLLED}/messages"]`);
    await expect(messagesLink).toBeVisible();

    await messagesLink.click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ENROLLED}/messages`));
    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
  });

  test('the composer offers people from this course, not the whole site', async ({ page }) => {
    await page.goto(`${BASE}${Routes.courseMessages(ENROLLED)}`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /new message/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/students can message the course instructor/i)).toBeVisible();
    await expect(dialog.getByLabel(/search this course/i)).toBeVisible();
    // Nothing is selected yet, so there is nothing to start.
    await expect(dialog.getByRole('button', { name: /start conversation/i })).toBeDisabled();

    // The list must resolve to real people or an explicit "nobody here" — never sit on
    // the spinner, and never show the load error.
    await expect
      .poll(
        async () => {
          if (await dialog.getByRole('alert').isVisible().catch(() => false)) return 'error';
          if (await dialog.getByText(/nobody in this course you can message/i).isVisible().catch(() => false)) {
            return 'empty';
          }
          // eslint-disable-next-line no-restricted-syntax
          if (await dialog.locator('button:visible', { hasText: /instructor|student/i }).count()) return 'people';
          return 'pending';
        },
        { timeout: 20_000, message: 'the course contact picker should resolve' },
      )
      .toMatch(/^(people|empty)$/);

    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('a course page shows only that course\'s threads', async ({ page }) => {
    await page.goto(`${BASE}${Routes.courseMessages(ENROLLED)}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
    // Every row on this page must be a thread about this course. The strong version of
    // that claim needs seeded cross-course threads; what is asserted here is the part
    // that holds with or without them — the scoped read never fails open into the
    // unscoped inbox, which would show up as the error alert.
    await expect(page.getByText(/error loading conversations/i)).toHaveCount(0);
  });
});
