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

  test('previews a PDF on a pdf.js canvas that actually paints', async ({ page }) => {
    await goto(page, gradingUrl);
    const row = fileRow(page, PDF);
    await row.getByRole('button', { name: 'Preview' }).click();

    // Deliberately NOT an <iframe>: that needs a native PDF plugin, which headless
    // Chromium does not have, and a signed supabase.co URL is refused by the app's
    // CSP frame-src. pdf.js paints the page onto a canvas, so this asserts real
    // pixels — do not weaken it back to an iframe/src check.
    const canvas = row.locator(`canvas[aria-label="Preview of ${PDF}"]`);
    await expect(canvas).toBeVisible();
    // Poll the ink itself, not the canvas dimensions. pdf.js sizes the canvas
    // from the viewport BEFORE it paints the page, so a width*height gate goes
    // green while the bitmap is still blank — that race is why this read came
    // back 0 under load even though the preview renders fine.
    await expect
      .poll(
        async () =>
          canvas.evaluate((c: HTMLCanvasElement) => {
            const ctx = c.getContext('2d');
            if (!ctx || c.width === 0 || c.height === 0) return 0;
            const { data } = ctx.getImageData(0, 0, c.width, c.height);
            // Only opaque pixels count. An untouched canvas reads back as
            // transparent black (0,0,0,0), which a naive "darker than white"
            // test counts as ink and passes against a completely blank preview.
            let inked = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] < 255) continue;
              if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) inked += 1;
            }
            return inked;
          }),
        { timeout: 30_000, intervals: [250, 500, 1000] },
      )
      // The fixture PDF carries a heading, a line of body text and a rule.
      .toBeGreaterThan(500);
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
