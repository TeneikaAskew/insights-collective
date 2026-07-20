// ABOUTME: Genuine end-to-end test for Drive-style course materials. Verifies enrollment-gated
// ABOUTME: access, folder/file listing for an enrolled student, and download signed-URL generation.
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@insightscollective.org';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPass123!';
// Seeded course the test member is enrolled in (Introduction to Data Science).
const ENROLLED_COURSE = process.env.E2E_ENROLLED_COURSE_ID ?? '660e8400-e29b-41d4-a716-446655440001';
// A different published course the test member is NOT enrolled in.
const OTHER_COURSE = process.env.E2E_UNENROLLED_COURSE_ID ?? '660e8400-e29b-41d4-a716-446655440002';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
}

test.describe('Course materials — enrollment-gated access', () => {
  test.beforeEach(signIn);

  test('enrolled student can open the materials page and see the tree UI', async ({ page }) => {
    await page.goto(`${BASE}/courses/${ENROLLED_COURSE}/materials`, {
      waitUntil: 'domcontentloaded',
    });

    // Access-gate query resolves — heading appears.
    await expect(page.getByRole('heading', { name: /course materials/i })).toBeVisible({
      timeout: 15_000,
    });

    // Breadcrumb root always shown.
    await expect(page.getByRole('button', { name: /^Materials/i })).toBeVisible();

    // Either the empty-state hint or at least one folder/file row renders.
    await expect
      .poll(async () => {
        const empty = await page
          .getByText(/no materials here yet|folder is empty/i)
          .isVisible()
          .catch(() => false);
        const rows = await page.locator('ul.divide-y > li').count();
        return empty || rows > 0;
      }, { timeout: 10_000 })
      .toBe(true);

    // As a student (non-manager) the New folder / Upload buttons must NOT render.
    await expect(page.getByRole('button', { name: /new folder/i })).toHaveCount(0);
    await expect(page.getByText(/upload files/i)).toHaveCount(0);
  });

  test('unenrolled student is blocked with the enrollment-required alert', async ({ page }) => {
    await page.goto(`${BASE}/courses/${OTHER_COURSE}/materials`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(/must be enrolled in this course to view its materials/i),
    ).toBeVisible({ timeout: 15_000 });
    // The listing UI must not render.
    await expect(page.getByRole('heading', { name: /course materials/i })).toHaveCount(0);
  });

  test('clicking a file requests a signed download URL from Supabase storage', async ({ page }) => {
    await page.goto(`${BASE}/courses/${ENROLLED_COURSE}/materials`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /course materials/i })).toBeVisible({
      timeout: 15_000,
    });

    const fileRow = page.locator('ul.divide-y > li').filter({ has: page.locator('svg.lucide-file') });
    const fileCount = await fileRow.count();
    test.skip(fileCount === 0, 'No files seeded for this course yet');

    // The Download button per row is the first ghost icon button.
    const [signedReq] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes('/storage/v1/object/sign/') ||
          req.url().includes('createSignedUrl'),
        { timeout: 10_000 },
      ),
      fileRow.first().locator('button').first().click(),
    ]);

    expect(signedReq.method()).toMatch(/POST|GET/);
  });
});
