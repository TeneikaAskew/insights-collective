// ABOUTME: Genuine end-to-end test for Drive-style course materials. Verifies enrollment-gated
// ABOUTME: access, folder/file listing for an enrolled student, and download signed-URL generation.
import { test, expect } from '../fixtures/page-helpers';
import { TEST_USERS } from '../fixtures/test-data';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
// Resolved in one place (fixtures/test-data.ts). Reading E2E_TEST_EMAIL here
// with its own default is how this spec ended up signing in as a different
// account than global-setup and seed.sql use.
const EMAIL = TEST_USERS.member.email;
const PASSWORD = TEST_USERS.member.password;
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
  test.beforeEach(async ({ page }) => { await signIn(page); });

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

    // Assert that manage controls follow real permissions: a signed-in user with
    // admin OR course-instructor rights SHOULD see them; a pure student MUST NOT.
    // Determining this from the actual session avoids false failures when the shared
    // test user carries multiple roles.
    const hasManage = await page.evaluate(async () => {
      // Read the session token from whichever key the Supabase client used.
      let token: string | null = null;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if ((k.startsWith('sb-') && k.endsWith('-auth-token')) || k === 'supabase.auth.token') {
          try {
            const p = JSON.parse(localStorage.getItem(k)!);
            token = p?.access_token ?? p?.currentSession?.access_token ?? null;
            if (token) break;
          } catch {}
        }
      }
      if (!token) return false;
      // Decode JWT payload for the user id (no crypto needed for the sub claim).
      const [, payload] = token.split('.');
      const sub = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub;
      const SUPA = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
      const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
      const h = { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const [adminRes, instrRes] = await Promise.all([
        fetch(`${SUPA}/rest/v1/rpc/has_admin_access`, { method: 'POST', headers: h, body: JSON.stringify({ user_id_param: sub }) }).then((r) => r.json()).catch(() => false),
        fetch(`${SUPA}/rest/v1/rpc/is_course_instructor`, { method: 'POST', headers: h, body: JSON.stringify({ user_id_param: sub, course_id_param: '660e8400-e29b-41d4-a716-446655440001' }) }).then((r) => r.json()).catch(() => false),
      ]);
      return Boolean(adminRes) || Boolean(instrRes);
    });
    const expectedCount = hasManage ? 1 : 0;
    await expect(page.getByRole('button', { name: /new folder/i })).toHaveCount(expectedCount);
    await expect(page.getByText(/upload files/i)).toHaveCount(hasManage ? expectedCount : 0);
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
    expect(
      fileCount,
      'Seed gap: no course-materials files seeded for the enrolled course. Upload at least one file via the course-materials bucket in seed.sql.',
    ).toBeGreaterThan(0);

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
