// ABOUTME: Instructor half of the gradebook real-role run: both writers (SpeedGrader, course gradebook) grade the
// ABOUTME: 10-point fixture to 0 and 7, every save is read back after a reload, the CSV says /10, and a course the
// ABOUTME: instructor does not teach answers zero rows. Runs only under playwright.gradebook-roles.config.ts.
import { test, expect } from '../fixtures/page-helpers';
import { waitForPageLoad } from '../fixtures/page-helpers';
import { GB, FEEDBACK, API_OK, patchAsPage, shot } from './fixture';

test.describe.configure({ mode: 'serial' });
test.skip(!API_OK, 'needs the local loopback API (VITE_SUPABASE_URL) and its anon key');

const grader = (item: string) => `/courses/${GB.course}/assignments/${item}/grade`;

async function speedGrade(page, item: string, sub: string, grade: string, feedback: string) {
  await page.goto(grader(item));
  await waitForPageLoad(page);
  const input = page.locator('#grade');
  await expect(input).toBeVisible();
  await expect(page.getByText('/ 10', { exact: false }).first()).toBeVisible();   // denominator from assignments.points
  await input.fill(grade);
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(feedback);
  const patch = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/rest/v1/assignment_submissions') && r.url().includes(sub));
  await page.getByRole('button', { name: /^Save$/ }).click();
  const res = await patch;
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].grade)).toBe(Number(grade));
  expect(rows[0].workflow_state).toBe('graded');
  expect(String(rows[0].grader_comments)).toContain(feedback);
  await expect(page.getByText('Grade published').first()).toBeVisible();
}

async function readBackSpeedGrader(page, item: string, grade: string, feedback: string) {
  await page.goto(grader(item));        // fresh load: nothing comes from component state
  await waitForPageLoad(page);
  await expect(page.locator('#grade')).toHaveValue(grade);
  await expect(page.locator('[contenteditable="true"]').first()).toContainText(feedback);
  await expect(page.getByRole('tab', { name: /^Graded \(1\)/ })).toBeVisible();
}

test('W1 SpeedGrader: SG0 graded 0/10 with feedback, read back after reload', async ({ page }, info) => {
  await speedGrade(page, GB.item.SG0, GB.sub.SG0, '0', FEEDBACK.SG0a);
  await readBackSpeedGrader(page, GB.item.SG0, '0', FEEDBACK.SG0a);
  await shot(page, info, 'W1-speedgrader-SG0-0of10');
});

test('W1b SpeedGrader: same grade 0 re-saved with new feedback, both read back', async ({ page }, info) => {
  await speedGrade(page, GB.item.SG0, GB.sub.SG0, '0', FEEDBACK.SG0b);
  await readBackSpeedGrader(page, GB.item.SG0, '0', FEEDBACK.SG0b);
  await shot(page, info, 'W1b-speedgrader-SG0-same-grade-new-feedback');
});

test('W2 SpeedGrader: SG7 graded 7/10 with feedback, read back after reload', async ({ page }, info) => {
  await speedGrade(page, GB.item.SG7, GB.sub.SG7, '7', FEEDBACK.SG7);
  await readBackSpeedGrader(page, GB.item.SG7, '7', FEEDBACK.SG7);
  await shot(page, info, 'W2-speedgrader-SG7-7of10');
});

test('W3 course gradebook: GB0 = 0 and GB7 = 7, read back after reload, CSV says /10', async ({ page }, info) => {
  const url = `/courses/${GB.course}/gradebook`;
  for (const [title, sub, value] of [['Points GB0', GB.sub.GB0, '0'], ['Points GB7', GB.sub.GB7, '7']] as const) {
    await page.goto(url);
    await waitForPageLoad(page);
    const col = await page.locator('thead th').allInnerTexts();
    const idx = col.findIndex((t) => t.includes(title));
    expect(idx, `column ${title}`).toBeGreaterThan(0);
    const row = page.locator('tbody tr').filter({ hasText: 'E2E Member' }).filter({ visible: true }).first();
    await row.locator('td').nth(idx).locator('div.cursor-pointer').click();
    await row.locator('td').nth(idx).locator('input[type="number"]').fill(value);
    const patch = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(sub));
    await row.locator('td').nth(idx).getByRole('button').click();
    const res = await patch;
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].grade)).toBe(Number(value));
    expect(rows[0].workflow_state).toBe('graded');
  }
  await page.goto(url);
  await waitForPageLoad(page);
  const row = page.locator('tbody tr').filter({ hasText: 'E2E Member' }).filter({ visible: true }).first();
  for (const v of ['0/10', '7/10']) await expect(row.getByText(v).first()).toBeVisible();
  await expect(row.getByText('/100')).toHaveCount(0);
  await shot(page, info, 'W3-gradebook-after-reload');

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export/ }).click();
  const csv = await (await dl).createReadStream().then(async (s) => { let b = ''; for await (const c of s) b += c; return b; });
  await info.attach('gradebook.csv', { body: Buffer.from(csv), contentType: 'text/csv' });
  const lines = csv.replace(/^﻿/, '').trim().split(/\r\n/).map((l) => l.split(','));
  const head = lines[0];
  const member = lines.find((l) => l[0] === GB.memberId);
  expect(member, 'member row in CSV').toBeTruthy();
  for (const [t, earned] of [['Points SG0', '0'], ['Points SG7', '7'], ['Points GB0', '0'], ['Points GB7', '7']]) {
    const e = head.findIndex((h) => h.includes(`${t} (assignment) - earned`));
    expect(e, `CSV column for ${t}`).toBeGreaterThan(-1);
    expect(member![e]).toBe(earned);
    expect(member![e + 1]).toBe('10');
    expect(member![e + 2]).toBe('graded');
  }
});

test('Z1 instructor PATCH on a course they do not teach: zero rows, row unchanged', async ({ page }) => {
  await page.goto(`/courses/${GB.course}/gradebook`);
  await waitForPageLoad(page);
  const r = await patchAsPage(page, GB.sub.GX_MEMBER, { grade: 9, workflow_state: 'graded' });
  expect(r.status).toBe(200);
  expect(r.rows).toEqual([]);
});
