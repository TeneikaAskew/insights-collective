import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';

test.describe('Grading Interface (Instructor)', () => {
  // The all-types fixture assignment, which seed.sql gives a SUBMITTED
  // submission. The production assignment this pointed at has none, so the
  // grader rendered "Needs (0) / Graded (0) / All (0)" and the grade input,
  // feedback box and Save control legitimately did not exist — which is what
  // the count-guards below were reporting as passing tests.
  const gradingUrl = Routes.gradingInterface(
    TestIds.courseId,
    TestIds.assignmentAllTypesContentItemId,
  );

  test('renders grading interface', async ({ page }) => {
    await goto(page, gradingUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(gradingUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('the grader lists the submission awaiting grading', async ({ page }) => {
    await goto(page, gradingUrl);
    // The queue tabs carry counts, so this asserts there IS something to grade
    // rather than that some element with "submission" in its class exists.
    await expect(page.getByRole('tab', { name: /^Needs \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^All \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Needs (0)' })).toHaveCount(0);
  });

  test('grade input field is present', async ({ page }) => {
    await goto(page, gradingUrl);
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
  });

  test('the grade feedback editor is present', async ({ page }) => {
    await goto(page, gradingUrl);
    // NOT `textarea`. SubmissionComments renders its own "Add a comment or
    // feedback..." textarea further down, so a bare textarea locator passes on
    // the comments box and stays green even if the grade feedback control
    // disappears entirely.
    //
    // The grade feedback control is a TipTap UnifiedCanvasEditor
    // (CanvasGradingInterface.tsx:487). The page mounts two of those — the
    // submission viewer above it is readOnly — and only the editable one is
    // contenteditable="true", so that attribute distinguishes them.
    await expect(page.getByText('Feedback', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
  });

  test('a save control is offered', async ({ page }) => {
    await goto(page, gradingUrl);
    await expect(
      page.getByRole('button', { name: /Save|Submit Grade|Grade/ }).first(),
    ).toBeVisible();
  });
});
