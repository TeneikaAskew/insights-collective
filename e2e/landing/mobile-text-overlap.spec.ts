// ABOUTME: Fails when landing-page text collides with itself at phone width.
// ABOUTME: Signed out, because Index redirects an authenticated visitor away.
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import { MOBILE_VIEWPORT } from '../helpers/mobile-overflow';

/**
 * The sibling sweep in e2e/layout measures whether a route scrolls sideways.
 * That is a different defect from this one and would not have caught it: the
 * quiz's five-column scale printed "Very Uncomfortable" on top of
 * "Uncomfortable" and the pie chart's callout labels were cut off mid-word,
 * both entirely inside the viewport. `main.scrollWidth` never moved, so the
 * page measured clean while the text was unreadable.
 *
 * So these assertions are about text against text, and text against the box it
 * was given, rather than against the width of the page.
 */

test.use({ viewport: MOBILE_VIEWPORT });

/** Boxes overlap only when they collide on both axes; sharing a row or a column is fine. */
type Box = { label: string; rect: { x: number; y: number; width: number; height: number } };

function findOverlaps(boxes: Box[]): string[] {
  const collisions: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].rect;
      const b = boxes[j].rect;
      const overlapsX = a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5;
      const overlapsY = a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
      if (overlapsX && overlapsY) collisions.push(`"${boxes[i].label}" overlaps "${boxes[j].label}"`);
    }
  }
  return collisions;
}

test.describe('Landing page text at phone width', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.landing);
  });

  test('quiz scale options do not print on top of each other', async ({ page }) => {
    await page.getByRole('button', { name: /Take the Career Quiz/i }).click();

    // Every option is one labelled row; the scale is answered by tapping it.
    const options = page.locator('[role="radiogroup"] label').filter({ visible: true });
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBe(5);

    // The rendered text, not the row that contains it. Measuring the rows
    // instead proves nothing: grid cells tile without overlapping no matter how
    // far their contents spill, so the five-column version of this scale passed
    // a row-level check while printing "Very Uncomfortable" over its neighbour.
    const boxes: Box[] = await options.evaluateAll((els) =>
      els.flatMap((el) => {
        const text = el.querySelector('span');
        if (!text) return [];
        const { x, y, width, height } = text.getBoundingClientRect();
        return [{ label: (text.textContent ?? '').trim(), rect: { x, y, width, height } }];
      }),
    );
    expect(boxes).toHaveLength(5);

    const collisions = findOverlaps(boxes);
    expect(collisions, `scale labels collide: ${collisions.join('; ')}`).toEqual([]);

    // A label wider than the row it sits in is the overflow that caused the
    // collisions in the first place, so measure the text against its own box.
    const escaping = await options.evaluateAll((els) =>
      els
        .map((el) => {
          const text = el.querySelector('span');
          if (!text) return null;
          const outer = el.getBoundingClientRect();
          const inner = text.getBoundingClientRect();
          return inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5
            ? (text.textContent ?? '').trim()
            : null;
        })
        .filter(Boolean),
    );
    expect(escaping, `scale labels overflow their row: ${escaping.join(', ')}`).toEqual([]);
  });

  for (const tab of ['Skills', 'Growth', 'Pay']) {
    test(`${tab} chart keeps its labels inside the plot area`, async ({ page }) => {
      // Index holds this section out of the DOM until it nears the viewport
      // (deferUntilVisible), rendering a same-height placeholder in its place.
      // Querying for the tab first only ever finds the placeholder, so scroll
      // the section itself into view and wait for the real thing to mount.
      await page.locator('[data-tour="interactiveShowcase"]').scrollIntoViewIfNeeded();

      const trigger = page.getByRole('tab', { name: tab });
      await expect(trigger).toBeVisible({ timeout: 15_000 });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();

      const surface = page.locator('.recharts-surface').filter({ visible: true }).first();
      await expect(surface).toBeVisible();
      // Recharts animates bars and axis labels in; measuring mid-flight reports
      // half-drawn geometry as a pass.
      await page.waitForTimeout(2000);

      const clipped = await surface.evaluate((svg) => {
        const box = svg.getBoundingClientRect();
        return Array.from(svg.querySelectorAll('text'))
          .filter((t) => {
            const b = t.getBoundingClientRect();
            return b.left < box.left - 0.5 || b.right > box.right + 0.5;
          })
          .map((t) => (t.textContent ?? '').trim());
      });

      expect(clipped, `${tab} chart text is cut off: ${clipped.join(', ')}`).toEqual([]);
    });
  }
});
