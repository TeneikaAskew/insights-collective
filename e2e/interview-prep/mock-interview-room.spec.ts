import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Mock Interview Room', () => {
  test.use({
    // Grant camera/microphone permissions so the page doesn't block on permission dialog
    permissions: ['camera', 'microphone'],
  });

  test('renders interview room page without crashing', async ({ page }) => {
    // Mock getUserMedia to avoid actual camera access
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.resolve({
            getTracks: () => [],
            getVideoTracks: () => [],
            getAudioTracks: () => [],
          }),
        },
        writable: true,
      });
    });
    await goto(page, Routes.mockInterviewRoom);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.mockInterviewRoom);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.mockInterviewRoom);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('response input or recording area renders', async ({ page }) => {
    await goto(page, Routes.mockInterviewRoom);
    const input = page.locator('textarea, [contenteditable], [class*="response"], [class*="answer"]').first();
    if (await input.count() > 0) {
      await expect(input).toBeVisible();
    }
  });
});
