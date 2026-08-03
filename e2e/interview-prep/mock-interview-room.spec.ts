import { test, expect } from '../fixtures/page-helpers';
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
    await expect(page.getByRole('heading', { name: 'Mock Interviews' })).toBeVisible();
  });

  test('the scheduling tabs are offered', async ({ page }) => {
    await goto(page, Routes.mockInterviewRoom);
    // What this route actually is: /interview-prep/mock-interview-room resolves
    // to /interview-prep/mock-interviews, a SCHEDULING hub — find a partner,
    // set availability, view upcoming sessions. Asserted here because the file
    // is otherwise named for a room that this route never renders.
    for (const tab of ['Find Sessions', 'Set Availability', 'Upcoming Sessions', 'Guidelines']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
  });

  // MEASURED: this route renders 0 textareas, 0 contenteditable, and nothing
  // whose class contains "response" or "answer" — the entire locator matched
  // nothing, and the count-guard turned that into a pass. There is no response
  // or recording area here because this route is the scheduling hub, not a live
  // interview room; the test was written against a page that does not exist at
  // this path.
  test.skip(
    'response input or recording area renders',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'Wrong page: /interview-prep/mock-interview-room resolves to the mock-interview SCHEDULING hub (Find Sessions / Set Availability / Upcoming Sessions / Guidelines). It renders no response or recording area, so there is nothing at this route for this assertion to describe.',
      },
    },
    async ({ page }) => {
      await goto(page, Routes.mockInterviewRoom);
      await expect(page.locator('textarea').first()).toBeVisible();
    },
  );
});
