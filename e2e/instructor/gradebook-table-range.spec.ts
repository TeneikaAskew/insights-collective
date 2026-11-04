// ABOUTME: Course gradebook inline grade entry against the built app and the isolated local stack: out-of-range,
// ABOUTME: empty and zero-point entries are refused before any write; valid entries persist and survive a reload.
import { execFileSync } from 'node:child_process';
import type { Locator, Page, Request } from '@playwright/test';
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import { assertLocalDsn } from '../../scripts/local-db/assert-local-dsn.mjs';

/**
 * Runs under chromium-instructor, signed in as the fixture instructor, on the reference course gradebook.
 * Each case is one cell of the shared member's row, from the "acdc" block in e2e/fixtures/seed.sql, which
 * resets the rows on every seed. What earns these tests is the stored row, read back through psql on the
 * loopback database only; a missing or non-loopback SUPABASE_DB_URL fails rather than skips.
 */
// The gradebook row shows the member's profile name, never an email (CourseGradebook builds students with
// email: ''). The isolated stack names the member in scripts/local-stack/auth-fixtures.sql.
const MEMBER_NAME = 'E2E Member';
const CELL = {
  range: { title: 'Gradebook Range Ten (10 pts)', submission: 'acdc3333-0000-0000-0000-000000000001' },
  bounds: { title: 'Gradebook Bounds Ten (10 pts)', submission: 'acdc3333-0000-0000-0000-000000000002' },
  precision: { title: 'Gradebook Precision Twenty (20 pts)', submission: 'acdc3333-0000-0000-0000-000000000003' },
  zero: { title: 'Gradebook Zero Point (0 pts)', submission: 'acdc3333-0000-0000-0000-000000000004' },
} as const;

test.describe.configure({ mode: 'serial', retries: 0 });

function psqlEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT']) delete env[k];
  return env;
}

type StoredGrade = { grade: string | null; workflow_state: string; graded_at: string | null };

function readStoredGrade(submissionId: string): StoredGrade {
  const dsn = process.env.SUPABASE_DB_URL;
  const verdict = assertLocalDsn(dsn ?? '');
  expect(
    verdict.ok && verdict.target === 'loopback',
    `SUPABASE_DB_URL must point at the loopback stack for the stored-grade readback (${verdict.reason ?? 'not loopback'})`,
  ).toBe(true);
  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/);
  const out = execFileSync(
    'psql',
    [
      dsn as string,
      '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
      '-c',
      `select coalesce(grade::text, '<null>') || '|' || workflow_state || '|' || coalesce(graded_at::text, '<null>')
         from public.assignment_submissions where id = '${submissionId}'`,
    ],
    { encoding: 'utf8', env: psqlEnv() },
  ).trim();
  expect(out, `submission ${submissionId} must exist`).not.toBe('');
  const [grade, workflow_state, graded_at] = out.split('|');
  return { grade: grade === '<null>' ? null : grade, workflow_state, graded_at: graded_at === '<null>' ? null : graded_at };
}

/** Records every write to assignment_submissions from now on. */
function recordWrites(page: Page): Request[] {
  const writes: Request[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' && req.url().includes('/rest/v1/assignment_submissions')) writes.push(req);
  });
  return writes;
}

async function openGradebook(page: Page) {
  await goto(page, Routes.gradebook());
  await expect(page.locator('th').filter({ hasText: CELL.range.title }).first()).toBeVisible();
}

/** The member's cell under the column whose header carries `title`. */
async function cellFor(page: Page, title: string): Promise<Locator> {
  const headers = page.locator('thead tr').first().locator('th');
  const texts = await headers.allInnerTexts();
  const index = texts.findIndex((t) => t.includes(title));
  expect(index, `gradebook column "${title}"`).toBeGreaterThan(0);
  const row = page.locator('tbody tr').filter({ has: page.getByText(MEMBER_NAME, { exact: true }) });
  await expect(row).toHaveCount(1);
  return row.locator('td').nth(index);
}

/** `open: 'click'` opens a closed cell; `open: 'already'` corrects one a refusal left open, which must be open. */
async function enter(page: Page, title: string, typed: string, open: 'click' | 'already' = 'click') {
  const cell = await cellFor(page, title);
  if (open === 'click') await cell.locator('.cursor-pointer').click();
  const input = cell.getByRole('spinbutton');
  await expect(input).toBeVisible();
  await input.fill(typed);
  await cell.getByRole('button').click();
  return { cell, input };
}

async function expectRefused(page: Page, title: string, typed: string, submission: string, points: number) {
  // Start from a fresh page so a toast from the previous case cannot satisfy this one.
  await page.reload();
  await openGradebook(page);
  await expect(page.getByText('Invalid grade')).toHaveCount(0);
  const before = readStoredGrade(submission);
  const writes = recordWrites(page);
  const { input } = await enter(page, title, typed);
  await expect(page.getByText('Invalid grade').first()).toBeVisible();
  await expect(page.getByText(`Enter a value between 0 and ${points}.`).first()).toBeVisible();
  // The cell stays open with what was typed, for correction.
  await expect(input).toBeVisible();
  await expect(input).toHaveValue(typed);
  await expect(page.getByText('Grade updated successfully')).toHaveCount(0);
  expect(writes.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  expect(readStoredGrade(submission)).toEqual(before);
}

async function expectSaved(
  page: Page, title: string, typed: string, submission: string, stored: string, shown: string,
  open: 'click' | 'already' = 'click',
) {
  const { cell } = await enter(page, title, typed, open);
  await expect(page.getByText('Grade updated successfully').first()).toBeVisible();
  await expect(cell.getByRole('spinbutton')).toHaveCount(0);
  const row = readStoredGrade(submission);
  expect(row.grade).toBe(stored);
  expect(row.workflow_state).toBe('graded');
  expect(row.graded_at).not.toBeNull();
  // Reload: the gradebook shows what the database holds, not what the page remembered.
  await page.reload();
  await openGradebook(page);
  // The earned-points span alone, so "0" cannot match the "/10" beside it.
  await expect((await cellFor(page, title)).locator('.cursor-pointer span.font-medium')).toHaveText(shown);
}

test.describe('Gradebook table grade range (isolated stack)', () => {
  test('10 points: -0.004, 10.004 and an emptied cell are refused, then a correction saves', async ({ page }) => {
    await openGradebook(page);
    for (const typed of ['-0.004', '10.004', '']) {
      await expectRefused(page, CELL.range.title, typed, CELL.range.submission, 10);
    }
    await expectSaved(page, CELL.range.title, '9.25', CELL.range.submission, '9.25', '9.25', 'already');
  });

  test('10 points: the bounds 0 and 10 save and survive a reload', async ({ page }) => {
    await openGradebook(page);
    await expectSaved(page, CELL.bounds.title, '0', CELL.bounds.submission, '0.00', '0');
    await expectSaved(page, CELL.bounds.title, '10', CELL.bounds.submission, '10.00', '10');
  });

  test('20 points: 10.075 is stored and shown as 10.08', async ({ page }) => {
    await openGradebook(page);
    await expectSaved(page, CELL.precision.title, '10.075', CELL.precision.submission, '10.08', '10.08');
  });

  test('0 points: 0.01 is refused, then 0 saves', async ({ page }) => {
    await openGradebook(page);
    await expectRefused(page, CELL.zero.title, '0.01', CELL.zero.submission, 0);
    await expectSaved(page, CELL.zero.title, '0', CELL.zero.submission, '0.00', '0', 'already');
  });
});
