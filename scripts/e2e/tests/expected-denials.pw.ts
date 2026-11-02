// ABOUTME: Real-browser causal controls for the shared console-errors fixture's expected-denial declaration: the fixture
// ABOUTME: itself (teardown at the structural check, then the ordinary console check) under OLD/NEW and each deviation.
import type { Page } from '@playwright/test';
import { test } from '../../../e2e/fixtures/console-errors.fixture';

const ROUTE = '/courses/9c002000-0000-4000-8000-0000000000c0/learn/x';
const D = { method: 'POST', target: 'rpc/start_quiz_attempt', status: 403 as const, code: '42501' as const, message: 'You do not have access to this quiz.', route: ROUTE, count: 2 };
async function seed(page: Page, extra: object[] = []) {
  await page.setContent('<html><body>fixture control</body></html>');
  const at = new Date(Date.now() + 5).toISOString();
  await page.evaluate(([d, a, x]) => {
    const one = { kind: 'error', method: d.method, target: d.target, status: d.status, code: d.code, message: d.message, route: d.route, at: a };
    (window as unknown as { __supabaseIssues: object[] }).__supabaseIssues = [one, { ...one }, ...(x as object[])];
  }, [D, at, extra] as const);
}

test('OLD: two refusals, nothing declared -> the fixture fails (as run 41371698351)', async ({ page }) => {
  test.fail();
  await seed(page);
});
test('NEW: exact declaration -> the fixture passes, including its later console check', async ({ page, expectedDenials }) => {
  expectedDenials.declare({ ...D, after: Date.now() });
  await seed(page);
});
test('N1 declared count 1 vs 2 observed -> fails', async ({ page, expectedDenials }) => {
  test.fail();
  expectedDenials.declare({ ...D, count: 1, after: Date.now() });
  await seed(page);
});
test('N2 phase: declared after the refusals -> fails', async ({ page, expectedDenials }) => {
  test.fail();
  expectedDenials.declare({ ...D, after: Date.now() + 60_000 });
  await seed(page);
});
test('N3 unrelated structural issue next to a met declaration -> fails', async ({ page, expectedDenials }) => {
  test.fail();
  expectedDenials.declare({ ...D, after: Date.now() });
  await seed(page, [{ kind: 'error', method: 'GET', target: 'profiles', status: 400, code: '42703', message: 'column x does not exist', route: ROUTE, at: new Date(Date.now() + 5).toISOString() }]);
});
test('N4 met declaration, then an ordinary console.error -> the later console check still fails', async ({ page, expectedDenials }) => {
  test.fail();
  expectedDenials.declare({ ...D, after: Date.now() });
  await seed(page);
  await page.evaluate(() => console.error('unrelated application error'));
});
test('N5 a non-42501 declaration is rejected -> fails', async ({ page, expectedDenials }) => {
  test.fail();
  expectedDenials.declare({ ...D, code: '42703' as never, after: Date.now() });
  await seed(page);
});
