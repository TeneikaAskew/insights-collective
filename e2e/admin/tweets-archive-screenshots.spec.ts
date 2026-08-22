// ABOUTME: Captures the /teneika-tweets archive-import UI for review — the admin
// ABOUTME: header, each state of the upload dialog, and the non-admin view that
// ABOUTME: must show no import control. Screenshots land in e2e/screenshots/.
//
// This spec WRITES NOTHING. The import-x-archive call is intercepted and answered
// with a canned success, so the "imported" screenshot is real UI driven by a real
// parse of a real zip, without touching the live tables.
//
// Run it: npm run e2e:relay -- e2e/admin/tweets-archive-screenshots.spec.ts --project=chromium-admin
//
// Relay mode blocks Google Fonts (see hermeticArgs in playwright.config.ts), so
// the typography here is a fallback stack rather than the deployed face. Layout,
// spacing and every control are accurate; the letterforms are not. That is also
// why these are written to e2e/screenshots/ and are NOT visual baselines.

import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const SHOTS = path.join(process.cwd(), 'e2e', 'screenshots');

/** A believable X export: two parts, plus the files the import must ignore. */
async function archiveZip(): Promise<Buffer> {
  const entry = (id: string, createdAt: string, text: string, likes: string, rts: string) => ({
    tweet: {
      id_str: id,
      created_at: createdAt,
      full_text: text,
      favorite_count: likes,
      retweet_count: rts,
      lang: 'en',
      source: '<a href="https://mobile.x.com" rel="nofollow">X for Android</a>',
      entities: { user_mentions: [], urls: [] },
    },
  });

  const part0 = [
    entry('1845997658068209681', 'Tue Oct 15 01:18:33 +0000 2024',
      'Focus: Data & Software\nAgency: CDC\nPay: GS 13 / $134K\n*special hiring authority*', '105', '6'),
    entry('1844865304595255314', 'Fri Oct 11 22:18:59 +0000 2024',
      'I get a lot of people asking me how to get their PMP, SEC+, AWS, Azure certs paid for.', '58', '4'),
    entry('1840001111111111111', 'Mon Sep 30 14:02:10 +0000 2024',
      'Reminder: the federal hiring process rewards people who read the announcement twice.', '212', '31'),
  ];
  const part1 = [
    entry('1850002222222222222', 'Thu Oct 24 16:40:00 +0000 2024',
      'New cohort opens Monday. Bring a resume you are willing to have marked up.', '77', '9'),
    entry('1855003333333333333', 'Wed Nov 06 12:15:45 +0000 2024',
      'RT @someone: the best time to build a portfolio was last year', '0', '18'),
  ];

  const zip = new JSZip();
  zip.file('data/tweets.js', `window.YTD.tweets.part0 = ${JSON.stringify(part0)}`);
  zip.file('data/tweets-part1.js', `window.YTD.tweets.part1 = ${JSON.stringify(part1)}`);
  // None of these may be read. Present so the screenshot run exercises that.
  zip.file('data/direct-messages.js', 'window.YTD.direct_messages.part0 = [{"private":true}]');
  zip.file('data/account.js', 'window.YTD.account.part0 = []');
  zip.file('data/tweets_media/photo.jpg', 'not-really-a-jpeg');
  zip.file('Your archive.html', '<html><body>Your archive</body></html>');

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Frame the page header — the h1 and, for an admin, the import control.
 *
 * Two earlier attempts were wrong in opposite directions. `div.container` is not
 * the same element for both roles: signed out the first match is an outer
 * wrapper, and the shot came out 20,000px tall. A fixed 1200px-wide clip then cut
 * off the right edge of a 1280px viewport, which is exactly where the import icon
 * sits — a screenshot that hid the thing being reviewed. Shooting the header row
 * itself is stable across roles and always contains the control.
 */
async function shootHeader(page: Page, file: string) {
  const header = page
    .getByRole('heading', { name: "Teneika's Tweets" })
    .locator('xpath=../..');
  await expect(header).toBeVisible();
  await header.screenshot({ path: path.join(SHOTS, file) });
}

/** Answer the privileged write locally so the live tables are never touched. */
async function stubImportEndpoint(page: Page) {
  await page.route('**/functions/v1/import-x-archive', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, tweetsWritten: 5, resourcesWritten: 5 }),
    }),
  );
}

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
});

test.describe('archive import UI (admin)', () => {
  test('captures the header and every dialog state', async ({ page }) => {
    await stubImportEndpoint(page);

    await page.goto('/teneika-tweets');
    await expect(page.getByRole('heading', { name: "Teneika's Tweets" })).toBeVisible();

    const importButton = page.getByTestId('import-archive-button');
    await expect(importButton).toBeVisible();

    // 1. The page header as an admin sees it — import icon, and no scrape button.
    await expect(page.getByRole('button', { name: /refresh tweets/i })).toHaveCount(0);
    await shootHeader(page, '01-admin-header.png');

    // 2. The dialog as it opens.
    await importButton.click();
    const dialog = page.getByTestId('tweet-archive-upload-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('archive-dropzone')).toBeVisible();
    await dialog.screenshot({ path: path.join(SHOTS, '02-dialog-choose.png') });

    // 3. After picking a real zip — counts, date range, files read, skips.
    await page.getByTestId('archive-file-input').setInputFiles({
      name: 'twitter-archive.zip',
      mimeType: 'application/zip',
      buffer: await archiveZip(),
    });

    await expect(page.getByTestId('archive-review')).toBeVisible({ timeout: 15_000 });
    // Five tweets across two parts; the DM and account files must not be counted.
    await expect(page.getByTestId('archive-ready-count')).toHaveText('5');
    await expect(dialog).toContainText('tweets.js, tweets-part1.js');
    await dialog.screenshot({ path: path.join(SHOTS, '03-dialog-review.png') });

    // 4. The confirmation state, against the stubbed endpoint.
    await page.getByTestId('archive-import-confirm').click();
    await expect(page.getByTestId('archive-upload-success')).toBeVisible({ timeout: 15_000 });
    await dialog.screenshot({ path: path.join(SHOTS, '04-dialog-imported.png') });
  });

  test('captures the error state for the wrong file', async ({ page }) => {
    await stubImportEndpoint(page);

    await page.goto('/teneika-tweets');
    await page.getByTestId('import-archive-button').click();

    // Dropping direct-messages.js is the mistake worth showing a real message for.
    await page.getByTestId('archive-file-input').setInputFiles({
      name: 'direct-messages.js',
      mimeType: 'text/javascript',
      buffer: Buffer.from('window.YTD.direct_messages.part0 = [{"private":true}]'),
    });

    const error = page.getByTestId('archive-upload-error');
    await expect(error).toBeVisible({ timeout: 15_000 });
    await page
      .getByTestId('tweet-archive-upload-dialog')
      .screenshot({ path: path.join(SHOTS, '05-dialog-wrong-file.png') });
  });
});

test.describe('archive import UI (signed out)', () => {
  // A signed-out assertion inside a signed-in project races session restore, so
  // the storage state is overridden rather than the page merely being logged out.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows no import control to a visitor', async ({ page }) => {
    await page.goto('/teneika-tweets');
    await expect(page.getByRole('heading', { name: "Teneika's Tweets" })).toBeVisible();

    await expect(page.getByTestId('import-archive-button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /refresh tweets/i })).toHaveCount(0);

    await shootHeader(page, '06-visitor-header.png');
  });
});
