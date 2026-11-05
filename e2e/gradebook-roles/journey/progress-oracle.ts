// ABOUTME: Scoped progress-page oracle for the journey lane (UNRUN proposal): the "Course Completion" row and the per-type
// ABOUTME: Lessons/Assignments rows of /courses/:id/progress, each located by its own label, never a page-wide "100%".
import { expect, type Page } from '@playwright/test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { route } from './ids';

/** Whole-text match of one node (whitespace-normalised), never a substring: '11 of 1 completed' cannot pass for '1 of 1'. */
const exactly = (t: string) => new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}\\s*$`);

export async function expectProgress(page: Page, want: { pct: string; lessons: string; assignments: string }, averageGrade?: string) {
  await page.goto(route.progress);
  await waitForPageLoad(page);
  const completion = page.locator('div.flex.justify-between').filter({ has: page.getByText('Course Completion', { exact: true }) });
  await expect(completion).toHaveCount(1);
  await expect(completion.locator('span.font-medium')).toHaveCount(1);
  await expect(completion.locator('span.font-medium')).toHaveText(exactly(want.pct));
  const row = (label: string) => page.locator('div.flex.items-center.justify-between.p-4').filter({ has: page.getByText(label, { exact: true }) });
  await expect(row('Lessons')).toHaveCount(1);
  // The count-bearing node is the one muted paragraph under the label (CourseProgressOverview).
  const count = (label: string) => row(label).locator('p.text-sm.text-muted-foreground');
  await expect(count('Lessons')).toHaveCount(1);
  await expect(count('Lessons')).toHaveText(exactly(want.lessons));
  await expect(row('Assignments')).toHaveCount(1);
  await expect(count('Assignments')).toHaveCount(1);
  await expect(count('Assignments')).toHaveText(exactly(want.assignments));
  if (averageGrade !== undefined) {
    // Separate metric (grade / points), not part of completion. Located by its own card title.
    const card = page.locator('div.rounded-lg, div[class*="card"]').filter({ has: page.getByText('Average Grade', { exact: true }) }).last();
    await expect(card.locator('div.text-2xl')).toHaveCount(1);
    await expect(card.locator('div.text-2xl')).toHaveText(exactly(averageGrade));
  }
}
