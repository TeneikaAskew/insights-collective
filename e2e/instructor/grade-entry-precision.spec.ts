// ABOUTME: SpeedGrader grade entry against the real built app and the isolated local stack:
// ABOUTME: a tie like 10.075 is stored and shown as 10.08, and out-of-range entries are refused before any write.
import { execFileSync } from 'node:child_process';
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';
import { assertLocalDsn } from '../../scripts/local-db/assert-local-dsn.mjs';

/**
 * Runs under chromium-instructor (e2e/instructor/** is matched by that project), signed in as the
 * fixture instructor. The three assignments and their single submissions come from the "acce"
 * block in e2e/fixtures/seed.sql, which resets them on every seed:
 *   acce…0001  20 points, submitted, ungraded
 *   acce…0002  10 points, graded 5.00
 *   acce…0003  10 points, graded 5.00
 *
 * What earns these tests is the stored value, so each one reads assignment_submissions back
 * through psql rather than trusting the toast or the input. That read only ever goes to the
 * loopback database: this spec writes grades, and the suite-wide guard in global-setup already
 * refuses any non-isolated target before a test starts. A missing or non-loopback
 * SUPABASE_DB_URL fails the test rather than skipping it, so a run that could not check the
 * database never reports as a pass.
 */
const ITEM = {
  precision: 'acce1111-0000-0000-0000-000000000001',
  low: 'acce1111-0000-0000-0000-000000000002',
  high: 'acce1111-0000-0000-0000-000000000003',
};
const SUBMISSION = {
  precision: 'acce3333-0000-0000-0000-000000000001',
  low: 'acce3333-0000-0000-0000-000000000002',
  high: 'acce3333-0000-0000-0000-000000000003',
};

function psqlEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT']) delete env[k];
  return env;
}

type StoredGrade = { grade: string | null; workflow_state: string; graded_at: string | null };

function readStoredGrade(submissionId: string): StoredGrade {
  const dsn = process.env.SUPABASE_DB_URL;
  // The repo's libpq DSN guard, loopback only (no isolated-project allowance). It refuses when
  // PGHOST/PGPORT/PGSERVICE overrides are set, and psql below runs with them removed regardless.
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
  return {
    grade: grade === '<null>' ? null : grade,
    workflow_state,
    graded_at: graded_at === '<null>' ? null : graded_at,
  };
}

async function openGrader(page: import('@playwright/test').Page, itemId: string) {
  await goto(page, Routes.gradingInterface(TestIds.courseId, itemId));
  // One submission per fixture assignment, so the grader selects it on load and the
  // Score input carries its stored grade.
  await expect(page.getByRole('tab', { name: 'All (1)' })).toBeVisible();
  return page.locator('#grade');
}

test.describe('SpeedGrader grade entry (stored precision and range)', () => {
  // The three cases each own a separate fixture row, but the first one mutates its row and the
  // seed is what resets it, so a retry would start from 10.08 rather than ungraded.
  test.describe.configure({ retries: 0 });

  test('a two-decimal tie (10.075 on a 20-point assignment) is stored and shown as 10.08', async ({ page }) => {
    const before = readStoredGrade(SUBMISSION.precision);
    expect(before.grade, 'fixture must start ungraded (the seed resets it)').toBeNull();
    expect(before.workflow_state).toBe('submitted');

    const score = await openGrader(page, ITEM.precision);
    await expect(score).toHaveValue('');
    await score.fill('10.075');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // The toast reports the value the client wrote, so this is where a float-rounding 10.07 shows.
    await expect(page.getByText('Grade published', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/: 10\.08\/20$/).first()).toBeVisible();
    await expect(page.getByText('Invalid grade', { exact: true })).toHaveCount(0);

    const after = readStoredGrade(SUBMISSION.precision);
    expect(after.grade).toBe('10.08');
    expect(after.workflow_state).toBe('graded');
    expect(after.graded_at).not.toBeNull();

    // Revisit: the page reloads the row from the API, so the input and the list show what was stored.
    await page.reload();
    const reloaded = await openGrader(page, ITEM.precision);
    await expect(reloaded).toHaveValue('10.08');
    // The queue opens on "Needs", which no longer lists a graded submission; its row with the
    // stored grade is under "Graded".
    const gradedTab = page.getByRole('tab', { name: 'Graded (1)' });
    await expect(gradedTab).toBeVisible();
    await gradedTab.click();
    await expect(page.getByText('10.08/20', { exact: true }).first()).toBeVisible();
  });

  for (const c of [
    { name: 'a negative value just below zero (-0.004)', key: 'low' as const, typed: '-0.004' },
    { name: 'a value just above the maximum (10.004 on a 10-point assignment)', key: 'high' as const, typed: '10.004' },
  ]) {
    test(`${c.name} is refused before any write`, async ({ page }) => {
      const before = readStoredGrade(SUBMISSION[c.key]);
      expect(before.grade, 'fixture must start graded at 5.00 (the seed resets it)').toBe('5.00');
      expect(before.workflow_state).toBe('graded');

      // Any write to the row would be a PATCH on assignment_submissions; record them all.
      const writes: string[] = [];
      page.on('request', (req) => {
        if (req.method() !== 'GET' && req.url().includes('/rest/v1/assignment_submissions')) {
          writes.push(`${req.method()} ${req.url()}`);
        }
      });

      const score = await openGrader(page, ITEM[c.key]);
      await expect(score).toHaveValue('5');
      await score.fill(c.typed);
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      await expect(page.getByText('Invalid grade', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Enter a value between 0 and 10.', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Grade published', { exact: true })).toHaveCount(0);
      expect(writes, 'no write may reach assignment_submissions').toEqual([]);

      const after = readStoredGrade(SUBMISSION[c.key]);
      expect(after).toEqual(before);

      // And the grader still shows the stored grade after a revisit.
      await page.reload();
      const reloaded = await openGrader(page, ITEM[c.key]);
      await expect(reloaded).toHaveValue('5');
    });
  }
});
