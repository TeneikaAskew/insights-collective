#!/usr/bin/env node
// ABOUTME: Integration test for the deployed code-evaluation stack
// ABOUTME: (execute-code + review-code + code_challenges column privileges).
//
// These paths cannot run in the Playwright suite: they need a signed-in
// user, a live Supabase project, and a Judge0 subscription. This script
// creates a throwaway confirmed user, exercises the pipeline and its
// security invariants against a real deployment, then deletes everything
// it created.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_ANON_KEY=<anon> \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   node scripts/verify-code-evaluation.mjs
//
// Exits non-zero if any check fails.

const BASE = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE || !ANON || !SERVICE) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// Seeded by supabase/migrations/20260727000000_code_challenges_evaluation.sql
const TWO_SUM_JS = 'c0de0007-0000-4000-8000-000000000007';

const CORRECT = `function solution(nums, target) {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target) return [i, j];
}`;

// Prints the expected answers at module scope and never defines the
// required function: must NOT be accepted as passing.
const FORGERY = 'console.log("[0, 1]");\nconsole.log("[1, 2]");\nconsole.log("[0, 1]");';

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed });
  console.log(`${passed ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, headers, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const serviceHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

async function main() {
  const email = `code-eval-verify-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;

  const created = await api('POST', '/auth/v1/admin/users', serviceHeaders, {
    email, password, email_confirm: true,
  });
  if (created.status !== 200) throw new Error(`Could not create test user: ${created.status}`);
  const userId = created.data.id;

  const signedIn = await api('POST', '/auth/v1/token?grant_type=password', { apikey: ANON }, { email, password });
  const userHeaders = { apikey: ANON, Authorization: `Bearer ${signedIn.data.access_token}` };

  try {
    // --- Column privileges: hidden test cases must be unreachable ---
    const star = await api('GET', '/rest/v1/code_challenges?select=*&limit=1', userHeaders);
    check('select(*) on code_challenges is denied to members', star.status === 403, `got ${star.status}`);

    const cases = await api('GET', '/rest/v1/code_challenges?select=test_cases&limit=1', userHeaders);
    check('select(test_cases) is denied to members', cases.status === 403, `got ${cases.status}`);

    const safe = await api('GET', '/rest/v1/code_challenges?select=id,title,difficulty&limit=2', userHeaders);
    check('explicit safe-column select works', safe.status === 200 && safe.data.length > 0);

    // --- Execution ---
    const good = await api('POST', '/functions/v1/execute-code', userHeaders, {
      challengeId: TWO_SUM_JS, code: CORRECT, language: 'javascript',
    });
    check('correct solution passes every test case',
      good.status === 200 && good.data.allTestsPassed === true,
      `${good.data?.testsPassed}/${good.data?.testsTotal}`);
    check('execution reports real runtime', typeof good.data?.runtimeMs === 'number', `${good.data?.runtimeMs}ms`);

    const forged = await api('POST', '/functions/v1/execute-code', userHeaders, {
      challengeId: TWO_SUM_JS, code: FORGERY, language: 'javascript',
    });
    check('stdout forgery does not produce a pass',
      forged.status === 200 && forged.data.allTestsPassed === false,
      `${forged.data?.testsPassed}/${forged.data?.testsTotal}`);

    // --- Review derives its verdict from the stored execution record ---
    const review = await api('POST', '/functions/v1/review-code', userHeaders, {
      challengeId: TWO_SUM_JS, code: CORRECT, language: 'javascript', attemptId: good.data.attemptId,
    });
    check('review mode returns the executed verdict',
      review.status === 200 && review.data.evaluationMode === 'executed' && review.data.correct === true);
    check('review includes a written review and suggestions',
      Boolean(review.data?.review) && Array.isArray(review.data?.suggestions) && review.data.suggestions.length > 0);

    const replay = await api('POST', '/functions/v1/review-code', userHeaders, {
      challengeId: TWO_SUM_JS, code: CORRECT, language: 'javascript', attemptId: good.data.attemptId,
    });
    check('review is idempotent for the same attempt', replay.data?.review === review.data?.review);

    const fabricated = await api('POST', '/functions/v1/review-code', userHeaders, {
      challengeId: TWO_SUM_JS, code: CORRECT, language: 'javascript', attemptId: crypto.randomUUID(),
    });
    check('fabricated attemptId is rejected', fabricated.status === 404, `got ${fabricated.status}`);

    // A forged attempt cannot be laundered into a passing review
    const forgedReview = await api('POST', '/functions/v1/review-code', userHeaders, {
      challengeId: TWO_SUM_JS, code: CORRECT, language: 'javascript', attemptId: forged.data.attemptId,
    });
    check('review of a failing attempt stays incorrect', forgedReview.data?.correct === false);

    // --- Attempts are persisted ---
    const attempts = await api('GET', `/rest/v1/code_attempts?user_id=eq.${userId}&select=id,passed_tests`, serviceHeaders);
    check('attempts are persisted', attempts.status === 200 && attempts.data.length === 2, `${attempts.data?.length} rows`);
  } finally {
    await api('DELETE', `/rest/v1/code_attempts?user_id=eq.${userId}`, serviceHeaders);
    await api('DELETE', `/auth/v1/admin/users/${userId}`, serviceHeaders);
    console.log('\ncleaned up test user and attempts');
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error('verification failed:', error);
  process.exit(1);
});
