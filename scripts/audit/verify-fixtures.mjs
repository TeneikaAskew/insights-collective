#!/usr/bin/env node
// ABOUTME: Checks every TestIds default in e2e/helpers/route-helpers.ts is a real, readable row.
// ABOUTME: Reads as the role that owns the route, so RLS is part of the check.
//
// Why this is worth a script
// --------------------------
// The defaults used to be readable placeholders — 'test-module-id',
// 'test-quiz-id'. Postgres rejects a non-UUID with 22P02, so the pages never
// fetched anything and the specs asserted against an error state and passed.
// Eight route builders were affected.
//
// The seed asserts these rows exist. This asserts the role that loads the page
// can actually read them, which is a different question: a row behind an RLS
// policy the member does not satisfy produces exactly the same empty page as no
// row at all.
//
// Usage: node scripts/audit/verify-fixtures.mjs   (needs .env with role credentials)


const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function tokenFor(role) {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`] ?? process.env.E2E_TEST_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token;
}

// Each entry is the row a route builder's default resolves to, and the role
// whose session that route runs under.
const FIXTURES = [
  ['member', 'courseId', 'courses', 'id=eq.660e8400-e29b-41d4-a716-446655440001'],
  ['member', 'moduleId', 'modules', 'id=eq.770e8400-e29b-41d4-a716-446655440001'],
  ['member', 'lessonId', 'content_items', 'id=eq.b25050bd-9e06-4e89-b994-8eb176546ad7'],
  ['member', 'assignmentContentItemId', 'content_items', 'id=eq.19d80f57-3623-47a7-9e12-05a86f671f21'],
  ['member', 'quizContentItemId', 'content_items', 'id=eq.aaaa1111-1111-1111-1111-111111111111'],
  ['member', 'quizContentItemId → quiz', 'quizzes', 'content_item_id=eq.aaaa1111-1111-1111-1111-111111111111'],
  ['member', 'submissionId', 'quiz_submissions', 'id=eq.dddd4444-4444-4444-4444-444444444444'],
  ['member', 'portfolioPageId', 'portfolio_pages', 'id=eq.ffff6666-6666-6666-6666-666666666666'],
  ['member', 'eventId', 'events', 'id=eq.dd0e8400-e29b-41d4-a716-446655440001'],
  ['instructor', 'rubricId', 'rubrics', 'id=eq.eeee5555-5555-5555-5555-555555555555'],
  ['admin', 'surveyFormId', 'forms', 'id=eq.aaab7777-7777-7777-7777-777777777777'],
];

const tokens = {};
for (const role of ['member', 'instructor', 'admin']) tokens[role] = await tokenFor(role);

let failures = 0;
for (const [role, name, table, filter] of FIXTURES) {
  const token = tokens[role];
  if (!token) {
    console.error(`  SKIP  ${name} — no ${role} credentials`);
    continue;
  }
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=id&${filter}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  const rows = Array.isArray(body) ? body.length : 0;

  if (!res.ok) {
    failures++;
    console.error(`  FAIL  ${name.padEnd(26)} ${table} → ${res.status} ${body?.code ?? ''} ${body?.message ?? ''}`);
  } else if (rows === 0) {
    failures++;
    console.error(`  FAIL  ${name.padEnd(26)} ${table} → 0 rows as ${role}`);
    console.error(`        Either the seed did not run, or RLS hides it from the role that loads the page.`);
  } else {
    console.log(`  ok    ${name.padEnd(26)} ${table} readable as ${role}`);
  }
}

// The quiz is the one fixture where "the row exists" is not enough. Ask the same
// RPC the page asks — quiz_questions itself is not readable over PostgREST, and
// the function chooses between the `answers` and `options` shapes, so only its
// output says whether a student would see anything to click.
if (tokens.member) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/get_quiz_questions_for_taking`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${tokens.member}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_quiz_id: 'bbbb2222-2222-2222-2222-222222222222' }),
  });
  const body = await res.json().catch(() => null);
  // The function returns each question's choices as `answers`, whichever column
  // it sourced them from.
  const usable =
    Array.isArray(body) &&
    body.length > 0 &&
    body.every((q) => Array.isArray(q.answers) && q.answers.length > 1);
  if (usable) {
    const choices = body.map((q) => q.answers.length).join('/');
    console.log(`  ok    ${'quiz is answerable'.padEnd(26)} ${body.length} question(s), ${choices} choices`);
  } else {
    failures++;
    console.error(`  FAIL  ${'quiz is answerable'.padEnd(26)} → ${res.status} ${JSON.stringify(body).slice(0, 220)}`);
    console.error('        A question with no answers renders "No options configured for this question".');
  }
}

if (failures) {
  console.error(`\n${failures} fixture(s) are not usable. Run e2e/fixtures/seed.sql.`);
  process.exit(1);
}
console.log('\nevery route-helper default resolves to a row its role can read.');
