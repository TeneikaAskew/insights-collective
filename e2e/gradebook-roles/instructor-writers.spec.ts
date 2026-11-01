// ABOUTME: Instructor half of the gradebook real-role run. Both writers grade four 10-point assignments by identity, every
// ABOUTME: save is checked against the exact intended request (grade, feedback oracle, graded_at) and read back after a reload,
// ABOUTME: UI and CSV totals are 14/40 = 35%, and two UI saves that the server answers zero-row / pinned must show an error.
import { test, expect } from '../fixtures/page-helpers';
import { waitForPageLoad } from '../fixtures/page-helpers';
import type { Page } from '@playwright/test';
import { GB, FINAL, TOTAL, FEEDBACK, STORED, BINDING, num, sameInstant, patchAsPage, readAsPage, savedToken, isPatchTo, shot } from './fixture';

test.describe.configure({ mode: 'serial' });
const grader = (item: string) => `/courses/${GB.course}/assignments/${item}/grade`;

async function openGrader(page: Page, item: string) {
  await page.goto(grader(item));
  await waitForPageLoad(page);
  await expect(page.locator('#grade')).toBeVisible();
  await expect(page.getByText('/ 10', { exact: false }).first()).toBeVisible();
}
async function fillFeedback(page: Page, text: string) {
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
}

/** One SpeedGrader save, checked against the exact request it sent and the row the server returned. */
async function speedGrade(page: Page, key: 'SG0' | 'SG7', grade: number, feedback: string) {
  await openGrader(page, GB.item[key]);
  await page.locator('#grade').fill(String(grade));
  await fillFeedback(page, feedback);
  const resP = page.waitForResponse(isPatchTo(GB.sub[key]));
  await page.getByRole('button', { name: /^Save$/ }).click();
  const res = await resP;
  const sent = res.request().postDataJSON();
  expect(num(sent.grade, 'sent grade')).toBe(grade);
  expect(sent.grader_comments).toBe(STORED(feedback));           // independent oracle, not the stored value
  expect(sent.workflow_state).toBe('graded');
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(GB.sub[key]);
  expect(num(rows[0].grade, 'returned grade')).toBe(grade);
  expect(rows[0].grader_comments).toBe(STORED(feedback));
  expect(rows[0].workflow_state).toBe('graded');
  expect(sameInstant(rows[0].graded_at, sent.graded_at), 'persisted graded_at equals the intended one').toBe(true);
  await expect(page.getByText('Grade published').first()).toBeVisible();
  // Fresh load: nothing comes from component state.
  await openGrader(page, GB.item[key]);
  await expect(page.locator('#grade')).toHaveValue(String(grade));
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText(feedback);
  const row = await readAsPage(page, GB.sub[key]);
  expect(num(row.grade, 'read grade')).toBe(grade);
  expect(row.grader_comments).toBe(STORED(feedback));
  expect(sameInstant(row.graded_at, sent.graded_at)).toBe(true);
}

test('W1 SpeedGrader: SG0 = 0 with feedback, exact request/response/readback', async ({ page }, info) => {
  await speedGrade(page, 'SG0', 0, FEEDBACK.SG0a);
  await shot(page, info, 'W1-speedgrader-SG0-0of10');
});
test('W1b SpeedGrader: SG0 SAME grade 0 re-saved with new feedback; new feedback and new graded_at persist', async ({ page }, info) => {
  const before = await (async () => { await openGrader(page, GB.item.SG0); return readAsPage(page, GB.sub.SG0); })();
  await speedGrade(page, 'SG0', 0, FEEDBACK.SG0b);
  const after = await readAsPage(page, GB.sub.SG0);
  expect(sameInstant(after.graded_at, before.graded_at), 'a same-grade re-save writes a new graded_at').toBe(false);
  await shot(page, info, 'W1b-speedgrader-SG0-same-grade-new-feedback');
});
test('W2 SpeedGrader: SG7 = 7 with feedback, exact request/response/readback', async ({ page }, info) => {
  await speedGrade(page, 'SG7', 7, FEEDBACK.SG7);
  await shot(page, info, 'W2-speedgrader-SG7-7of10');
});

async function memberRow(page: Page) {
  const row = page.locator('tbody tr').filter({ hasText: 'E2E Member' }).filter({ visible: true });
  await expect(row).toHaveCount(1);
  return row;
}
async function columnOf(page: Page, title: string) {
  const heads = await page.locator('thead th').filter({ visible: true }).allInnerTexts();
  const idx = heads.findIndex((t) => t.split('\n')[0].trim() === title || t.includes(title));
  expect(heads.filter((t) => t.includes(title)), `exactly one column for ${title}`).toHaveLength(1);
  return idx;
}

test('W3 course gradebook: GB0 = 0 and GB7 = 7 by identity; every cell, total 14/40 = 35% and CSV exact', async ({ page }, info) => {
  const url = `/courses/${GB.course}/gradebook`;
  for (const key of ['GB0', 'GB7'] as const) {
    await page.goto(url);
    await waitForPageLoad(page);
    const idx = await columnOf(page, GB.title[key]);
    const cell = (await memberRow(page)).locator('td').nth(idx);
    await cell.locator('div.cursor-pointer').click();
    await cell.locator('input[type="number"]').fill(String(FINAL[key]));
    const resP = page.waitForResponse(isPatchTo(GB.sub[key]));
    await cell.getByRole('button').click();
    const res = await resP;
    const sent = res.request().postDataJSON();
    expect(num(sent.grade, 'sent grade')).toBe(FINAL[key]);
    expect(sent.workflow_state).toBe('graded');
    expect('grader_comments' in sent).toBe(false);
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(num(rows[0].grade, 'returned grade')).toBe(FINAL[key]);
    expect(rows[0].workflow_state).toBe('graded');
    expect(sameInstant(rows[0].graded_at, sent.graded_at), 'persisted graded_at equals the intended one').toBe(true);
  }
  await page.goto(url);
  await waitForPageLoad(page);
  const row = await memberRow(page);
  for (const key of ['SG0', 'SG7', 'GB0', 'GB7'] as const) {
    const idx = await columnOf(page, GB.title[key]);
    await expect(row.locator('td').nth(idx), `${key} cell`).toHaveText(new RegExp(`^\\s*${FINAL[key]}\\s*/\\s*10\\s*$`));
  }
  const totalIdx = await columnOf(page, 'Total');
  const total = row.locator('td').nth(totalIdx);
  await expect(total).toContainText(`${TOTAL.pct.toFixed(1)}%`);
  await expect(total).toContainText(`${TOTAL.earned}/${TOTAL.possible}`);
  await shot(page, info, 'W3-gradebook-after-reload');

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export/ }).click();
  const stream = await (await dl).createReadStream();
  let csv = ''; for await (const c of stream) csv += c;
  await info.attach('gradebook.csv', { body: Buffer.from(csv), contentType: 'text/csv' });
  const lines = csv.replace(/^﻿/, '').trim().split(/\r\n/).map((l) => l.split(','));
  const head = lines[0];
  const member = lines.filter((l) => l[0] === GB.memberId);
  expect(member, 'exactly one member row in CSV').toHaveLength(1);
  for (const key of ['SG0', 'SG7', 'GB0', 'GB7'] as const) {
    const e = head.indexOf(`${GB.title[key]} (assignment) - earned`);
    expect(e, `CSV column for ${key}`).toBeGreaterThan(-1);
    expect(member[0].slice(e, e + 3)).toEqual([String(FINAL[key]), '10', 'graded']);
  }
  const at = (h: string) => { const i = head.indexOf(h); expect(i, h).toBeGreaterThan(-1); return member[0][i]; };
  expect(at('Total earned')).toBe(String(TOTAL.earned));
  expect(at('Total possible (graded items)')).toBe(String(TOTAL.possible));
  expect(at('Total %')).toBe(String(TOTAL.pct));
});

test('U1 SpeedGrader save the server answers with ZERO rows: error shown, nothing published, SG7 unchanged', async ({ page }, info) => {
  await openGrader(page, GB.item.SG7);
  const before = await readAsPage(page, GB.sub.SG7);
  // FAULT, labelled: the request is redirected to a submission in a course this instructor does not teach; the server's
  // zero-row answer is authentic. The UI must report failure, not success.
  await page.route(`${BINDING.api.origin}/rest/v1/assignment_submissions*`, (route) => {
    const r = route.request();
    if (r.method() !== 'PATCH') return route.continue();
    return route.continue({ url: r.url().replace(`id=eq.${GB.sub.SG7}`, `id=eq.${GB.sub.GX_MEMBER}`) });
  });
  await page.locator('#grade').fill('9');
  const resP = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(GB.sub.GX_MEMBER));
  await page.getByRole('button', { name: /^Save$/ }).click();
  const res = await resP;
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual([]);
  await expect(page.getByText('Error saving grade').first()).toBeVisible();
  await expect(page.getByText(/Grade was not saved: the submission was not updated/).first()).toBeVisible();
  await expect(page.getByText('Grade published')).toHaveCount(0);
  await shot(page, info, 'U1-speedgrader-zero-row-error');
  await page.unroute(`${BINDING.api.origin}/rest/v1/assignment_submissions*`);
  const after = await readAsPage(page, GB.sub.SG7);
  expect(after).toEqual(before);
});

test('U2 SpeedGrader save the server PINS (non-staff token on own row): error shown, SG7 unchanged', async ({ page }, info) => {
  await openGrader(page, GB.item.SG7);
  const before = await readAsPage(page, GB.sub.SG7);
  const memberToken = savedToken('member');
  // FAULT, labelled: the save is sent with the LEARNER's token (who owns this row and may update it under RLS); the pin
  // trigger's answer (one row, grade/feedback/graded_at unchanged) is authentic. The UI must report failure.
  await page.route(`${BINDING.api.origin}/rest/v1/assignment_submissions*`, (route) => {
    const r = route.request();
    if (r.method() !== 'PATCH') return route.continue();
    return route.continue({ headers: { ...r.headers(), authorization: `Bearer ${memberToken}` } });
  });
  await page.locator('#grade').fill('9');
  await fillFeedback(page, 'GB fixture: pinned attempt.');
  const resP = page.waitForResponse(isPatchTo(GB.sub.SG7));
  await page.getByRole('button', { name: /^Save$/ }).click();
  const res = await resP;
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(num(rows[0].grade, 'pinned grade')).toBe(FINAL.SG7);
  expect(rows[0].grader_comments).toBe(STORED(FEEDBACK.SG7));
  await expect(page.getByText('Error saving grade').first()).toBeVisible();
  await expect(page.getByText(/did not take the new value/).first()).toBeVisible();
  await expect(page.getByText('Grade published')).toHaveCount(0);
  await shot(page, info, 'U2-speedgrader-pinned-error');
  await page.unroute(`${BINDING.api.origin}/rest/v1/assignment_submissions*`);
  expect(await readAsPage(page, GB.sub.SG7)).toEqual(before);
});

test('Z1 API: instructor PATCH on a course they do not teach answers zero rows', async ({ page }) => {
  await page.goto(`/courses/${GB.course}/gradebook`);
  await waitForPageLoad(page);
  const r = await patchAsPage(page, GB.sub.GX_MEMBER, { grade: 9, workflow_state: 'graded' });
  expect(r.status).toBe(200);
  expect(r.rows).toEqual([]);
});
