// ABOUTME: E2E coverage for student-uploaded files in the instructor grader —
// ABOUTME: the list, the inline image/PDF previews, download, and comment seeding.
//
// The panel returns null when a submission has no attachments, so a spec that
// only checked "no error" would pass against a completely broken component.
// Every assertion here is on the seeded fixture files by name, and the first
// test fails loudly when the fixture is missing (rows come from
// e2e/fixtures/seed.sql, the storage objects from
// scripts/e2e/seed-submission-files.mjs) instead of treating an empty panel as
// a pass.
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';
import type { Page } from '@playwright/test';

const IMAGE = 'e2e-fixture-chart.png';
const PDF = 'e2e-fixture-writeup.pdf';

const gradingUrl = Routes.gradingInterface(
  TestIds.courseId,
  TestIds.assignmentAllTypesContentItemId,
);

// Each file is one <li> in the "Uploaded files" list, and the row is what
// scopes Preview/Download/Comment to a specific file — a page-wide
// getByRole('button', { name: 'Download' }) would hit whichever row rendered
// first and pass even if the buttons were wired to the wrong attachment.
const fileRow = (page: Page, filename: string) =>
  page.locator('li').filter({ hasText: filename }).first();

test.describe('Submission attachments in the grader (instructor)', () => {
  test('lists the seeded uploads with type and size', async ({ page }) => {
    await goto(page, gradingUrl);

    await expect(page.getByRole('heading', { name: /Uploaded files/i })).toBeVisible();
    await expect(fileRow(page, IMAGE)).toBeVisible();
    await expect(fileRow(page, PDF)).toBeVisible();
    // Metadata line, not just the name: a row that lost its type/size would
    // otherwise still pass.
    await expect(fileRow(page, IMAGE).getByText(/image\/png/)).toBeVisible();
    await expect(fileRow(page, PDF).getByText(/application\/pdf/)).toBeVisible();
  });

  test('previews an image inline from a signed URL', async ({ page }) => {
    await goto(page, gradingUrl);
    const row = fileRow(page, IMAGE);
    await row.getByRole('button', { name: 'Preview' }).click();

    const img = row.locator(`img[alt="Preview of ${IMAGE}"]`);
    await expect(img).toBeVisible();
    // Signed, not public: the bucket is private, and a public URL would render
    // broken for every real submission.
    await expect(img).toHaveAttribute('src', /token=/);

    // Collapsing is part of the contract — the button toggles to Hide.
    await row.getByRole('button', { name: 'Hide' }).click();
    await expect(img).toHaveCount(0);
  });

  test('previews a PDF in a blob-backed iframe', async ({ page }) => {
    await goto(page, gradingUrl);
    const row = fileRow(page, PDF);
    await row.getByRole('button', { name: 'Preview' }).click();

    // Headless Chromium ships no PDF plugin, so the frame paints empty. The
    // assertion is on the frame and its src scheme, which is what the app owns.
    //
    // blob:, NOT a Supabase signed URL: the app's CSP frame-src allows only
    // 'self', blob: and the video hosts, so framing supabase.co directly is
    // refused by the browser and the pane stays blank in production too. This
    // spec caught exactly that, and the console-error fixture is what surfaced
    // it — do not "fix" a failure here by widening frame-src.
    const frame = row.locator(`iframe[title="Preview of ${PDF}"]`);
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /^blob:/);
  });

  test('downloads a file under its original name', async ({ page }) => {
    await goto(page, gradingUrl);
    const downloadPromise = page.waitForEvent('download');
    await fileRow(page, IMAGE).getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(IMAGE);
  });

  test('Comment seeds the comment composer with the filename', async ({ page }) => {
    await goto(page, gradingUrl);
    await fileRow(page, IMAGE).getByRole('button', { name: 'Comment' }).click();

    const composer = page.getByPlaceholder(/comment|feedback/i).first();
    await expect(composer).toHaveValue(new RegExp(IMAGE.replace(/\./g, '\\.')));
    await expect(composer).toBeFocused();
  });
});

test.describe('Submission attachments are not exposed to peers', () => {
  // A student must not reach another student's uploads through the grader URL.
  test.use({ storageState: '.playwright-sessions/member.json' });

  test('a student does not see the uploads on the grading route', async ({ page }) => {
    await page.goto(gradingUrl);
    await expect(page.getByText(IMAGE)).toHaveCount(0);
  });
});
