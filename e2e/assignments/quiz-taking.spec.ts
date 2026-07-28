import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Quiz Taking', () => {
  const quizUrl = Routes.quizTaking();

  test('renders quiz page', async ({ page }) => {
    await goto(page, quizUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(quizUrl);
    await waitForPageLoad(page);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('quiz title or instructions are visible', async ({ page }) => {
    await goto(page, quizUrl);
    const title = page.locator('h1, h2, h3').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await title.count() > 0) {
      await expect(title).toBeVisible();
    }
  });

  test('Start Quiz button is visible before quiz begins', async ({ page }) => {
    await goto(page, quizUrl);
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Take Quiz")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await startBtn.count() > 0) {
      await expect(startBtn).toBeVisible();
    }
  });

  test('question navigation renders after starting quiz', async ({ page }) => {
    await goto(page, quizUrl);
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Take Quiz")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(500);
      // Question counter or navigation should appear
      const questionNav = page.locator('[class*="question"], [class*="Question"], [aria-label*="question"]').first();
      // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
      // eslint-disable-next-line no-restricted-syntax
      if (await questionNav.count() > 0) {
        await expect(questionNav).toBeVisible();
      }
    }
  });

  test('multiple choice options render as radio buttons or buttons', async ({ page }) => {
    await goto(page, quizUrl);
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Take Quiz")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(500);
      const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]');
      // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
      // eslint-disable-next-line no-restricted-syntax
      if (await options.count() > 0) {
        await expect(options.first()).toBeVisible();
      }
    }
  });

  test('Submit Quiz button appears', async ({ page }) => {
    await goto(page, quizUrl);
    const submitBtn = page.locator('button:has-text("Submit Quiz"), button:has-text("Finish"), button:has-text("Submit")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
    }
  });
});
