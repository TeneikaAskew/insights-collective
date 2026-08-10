// ABOUTME: E2E coverage for the instructor bulk download of every student-uploaded
// ABOUTME: file in one assignment's grading view — the zip contents, not just the click.
//
// A zip download is the kind of feature that passes a shallow test while being
// useless: an empty archive, or one that silently drops files, still triggers a
// download event. So this spec opens the downloaded zip and asserts the seeded
// fixture filenames are inside, under a per-student folder.
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';
import { readFileSync } from 'node:fs';

const IMAGE = 'e2e-fixture-chart.png';
const PDF = 'e2e-fixture-writeup.pdf';

const gradingUrl = Routes.gradingInterface(
  TestIds.courseId,
  TestIds.assignmentAllTypesContentItemId,
);

const bulkButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Download all student files as a zip' });

/** Minimal central-directory read: entry names are enough for these assertions. */
function zipEntryNames(zipPath: string): string[] {
  const buf = readFileSync(zipPath);
  const names: string[] = [];
  for (let i = 0; i < buf.length - 4; i += 1) {
    // Local file header signature 'PK\x03\x04'
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
      const nameLen = buf.readUInt16LE(i + 26);
      names.push(buf.subarray(i + 30, i + 30 + nameLen).toString('utf8'));
    }
  }
  return names;
}

test.describe('Bulk attachment download (instructor)', () => {
  test('offers the action with the number of files available', async ({ page }) => {
    await goto(page, gradingUrl);
    const button = bulkButton(page);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    // The count comes from the seeded attachments; a zero would mean the fixture
    // or the query is broken, and the assertions below could never hold.
    await expect(button).toContainText(/\d/);
  });

  test('downloads a zip containing every seeded file, foldered by student', async ({ page }) => {
    await goto(page, gradingUrl);
    const button = bulkButton(page);
    await expect(button).toBeEnabled();

    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    const suggested = download.suggestedFilename();
    expect(suggested).toMatch(/\.zip$/);

    // Asserted before reading the archive: the toast auto-dismisses, so checking
    // it after the zip inspection races the timer rather than the feature.
    await expect(page.getByText(/Download ready/i).first()).toBeVisible();

    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();
    const names = zipEntryNames(zipPath as string);

    expect(names.some((n) => n.endsWith(IMAGE))).toBe(true);
    expect(names.some((n) => n.endsWith(PDF))).toBe(true);
    // Every entry is namespaced by student so a grader can tell whose work is whose.
    for (const name of names) {
      expect(name).toContain('/');
    }

  });
});
