import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';

// THIS PAGE WAS BROKEN FOR EVERY SUBMISSION, AND THIS FILE DESCRIBED THE ERROR.
//
// Removing the two count-guards below turned up two production defects in
// CanvasQuizResults, both fixed alongside this file:
//
//   1. it called getQuiz(submission.quiz_id), but getQuiz is keyed on
//      content_item_id — so the query searched the wrong column, matched
//      nothing, and the page threw "Quiz not found" every time.
//   2. the content-item lookup filtered on `settings->quiz_id`. `->` yields
//      JSONB, so comparing it to a bare uuid raised 22P02 on every load; and
//      the key does not exist on real rows anyway, since the relationship
//      lives in quizzes.content_item_id.
//
// The old assertions could not see either one. "score or result is displayed"
// used bare `:has-text(...)` with no tag qualifier, which matches every
// ANCESTOR of a match up to <html>, and `.first()` therefore resolved to the
// document element; the guard then made even that optional. "link back to
// course" was satisfied by any /courses/ link on the page, and the spinner test
// asserted a non-empty body with a comment excusing the placeholder id.
test.describe('Quiz Results', () => {
  const resultsUrl = Routes.quizResults();

  test('renders quiz results page', async ({ page }) => {
    await goto(page, resultsUrl);
    await expect(page.getByRole('heading', { name: 'Foundations Check-in - Results' })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(resultsUrl);
    await waitForPageLoad(page);
    await expect(page.getByRole('heading', { name: 'Foundations Check-in - Results' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('score and percentage are displayed', async ({ page }) => {
    await goto(page, resultsUrl);
    const main = page.locator('main');
    // The seeded submission scores 20 of 20. Asserted as a labeled pair rather
    // than as a bare number so this cannot pass on an unrelated "20" elsewhere,
    // and matched on the Score label the page actually renders.
    await expect(main.getByText('20/20')).toBeVisible();
    await expect(main.getByText('100.0%').first()).toBeVisible();
    await expect(main.getByText('Score', { exact: true })).toBeVisible();
  });

  test('question review section renders', async ({ page }) => {
    await goto(page, resultsUrl);
    // The part of the page that needed BOTH fixes: the questions arrive through
    // getQuizQuestionsForTaking, which is only reached once the quiz resolves.
    await expect(page.getByRole('heading', { name: 'Question Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Answers' })).toBeVisible();
  });

  test('link back to the module is present', async ({ page }) => {
    await goto(page, resultsUrl);
    // The page's own back link, by name and destination. `a[href*="/courses/"]`
    // matched the sidebar's course links too, so the old assertion held with
    // this control absent.
    const backLink = page.getByRole('link', { name: 'Back to Module' }).first();
    await expect(backLink).toBeVisible();
    // Built from the SAME ids the route is built from. Hard-coding the default
    // fixture uuids would fail whenever E2E_TEST_COURSE_ID or
    // E2E_TEST_MODULE_ID is set, even though the link would be correct — this
    // assertion is about the linkage, not about which course it points at.
    await expect(backLink).toHaveAttribute(
      'href',
      `/courses/${TestIds.courseId}/modules/${TestIds.moduleId}`,
    );
  });
});
