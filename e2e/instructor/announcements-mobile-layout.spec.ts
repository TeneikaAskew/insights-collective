// ABOUTME: Guards the course announcements header against the New Announcement
// ABOUTME: button colliding with the "Announcements" heading at phone width.
import type { Locator } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FIXTURE_COURSES } from '../fixtures/test-data';
import { MOBILE_VIEWPORT, measureOverflow } from '../helpers/mobile-overflow';

/**
 * The header was `flex items-center justify-between` with no wrapping, so at
 * phone width the `text-2xl` heading claimed the row and the button rendered
 * on top of it and off the right edge of the card (reported from a device
 * screenshot at 360 CSS px).
 *
 * The button only exists for instructors/admins, so this has to run signed in
 * as an instructor — hence e2e/instructor/, which the chromium-instructor
 * project claims wholesale.
 */
const ROUTE = `/courses/${FIXTURE_COURSES.enrolled.id}/announcements`;

/** Pixel overlap of two rendered boxes; 0 on either axis means no collision. */
async function overlapOf(a: Locator, b: Locator): Promise<{ x: number; y: number }> {
  const [ba, bb] = [await a.boundingBox(), await b.boundingBox()];
  expect(ba, 'element has no layout box').not.toBeNull();
  expect(bb, 'element has no layout box').not.toBeNull();
  return {
    x: Math.min(ba!.x + ba!.width, bb!.x + bb!.width) - Math.max(ba!.x, bb!.x),
    y: Math.min(ba!.y + ba!.height, bb!.y + bb!.height) - Math.max(ba!.y, bb!.y),
  };
}

test.describe('Course announcements header (mobile)', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('New Announcement button does not overlap the heading', async ({ page }, testInfo) => {
    await page.goto(ROUTE);

    const heading = page.getByRole('heading', { name: 'Announcements', level: 2 });
    await expect(heading).toBeVisible();

    // The course header's Manage Course button mounts after a permissions round
    // trip. Measuring before it lands reports a layout no instructor ever sees —
    // the first version of this spec screenshotted the page without it.
    await expect(page.getByRole('link', { name: /Manage Course/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const button = page.getByRole('button', { name: /New Announcement/i });
    // If the acting account cannot author announcements the button is absent and
    // this spec would pass while measuring nothing. Assert it is there instead.
    await expect(button).toBeVisible();

    // Written to the run's output dir rather than attached as a buffer, so the
    // shot survives as a file on a passing run too — a buffer attachment only
    // exists inside the HTML report.
    const shot = testInfo.outputPath('announcements-390.png');
    await page.screenshot({ path: shot, fullPage: true });
    await testInfo.attach('announcements-390.png', { path: shot, contentType: 'image/png' });

    const overlap = await overlapOf(heading, button);
    expect(
      overlap.x > 0 && overlap.y > 0,
      `button overlaps the heading by ${Math.round(overlap.x)}x${Math.round(overlap.y)}px`,
    ).toBe(false);

    // Same defect one card up: Manage Course sat on top of the course title.
    //
    // Comparing bounding boxes does NOT catch this, and a version of this spec
    // that did passed against the broken page. `flex-1 min-w-0` keeps the h1's
    // *box* clear of the button; what collides is the *text*, which overflows
    // its own box because a single long word cannot wrap. So measure the text:
    // scrollWidth is how wide the content actually is, clientWidth is the box
    // it was given, and painting happens at the former.
    const title = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return null;
      const box = h1.getBoundingClientRect();
      return { over: h1.scrollWidth - h1.clientWidth, textRight: box.left + h1.scrollWidth };
    });
    expect(title, 'course title not found').not.toBeNull();
    expect(
      title!.over,
      `course title text overflows its box by ${title!.over}px and paints over anything to its right`,
    ).toBeLessThanOrEqual(1);

    const manageBox = await page.getByRole('link', { name: /Manage Course/i }).boundingBox();
    expect(manageBox, 'Manage Course button has no layout box').not.toBeNull();
    // Only meaningful while the two share a row; once the header stacks the
    // button sits below and this is trivially true.
    const sharesRow = manageBox!.y < (await page.locator('h1').boundingBox())!.y + 8;
    if (sharesRow) {
      expect(
        Math.round(title!.textRight - manageBox!.x),
        'course title text runs under the Manage Course button',
      ).toBeLessThanOrEqual(1);
    }

    // The original symptom was the button escaping the card to the right, which
    // an overlap check alone would not catch if the two merely sat flush.
    const cardRight = await page.evaluate(() => {
      const h2 = Array.from(document.querySelectorAll('h2')).find(
        (el) => el.textContent?.trim() === 'Announcements',
      );
      return h2?.closest('.bg-card')?.getBoundingClientRect().right ?? null;
    });
    expect(cardRight, 'announcements card not found').not.toBeNull();
    const buttonBox = await button.boundingBox();
    expect(buttonBox, 'button has no layout box').not.toBeNull();
    expect(
      Math.round(buttonBox!.x + buttonBox!.width - cardRight!),
      'button extends past the right edge of its card',
    ).toBeLessThanOrEqual(1);

    const report = await measureOverflow(page);
    expect(
      report.main,
      `${ROUTE} overflows ${report.main}px` +
        (report.worst ? `; widest offender ${report.worst.selector} at ${report.worst.over}px` : ''),
    ).toBeLessThanOrEqual(1);
  });
});
