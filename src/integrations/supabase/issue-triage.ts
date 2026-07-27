// ABOUTME: Decides which recorded Supabase issues are defects by definition.
// ABOUTME: Shared by the e2e console fixture and testable on its own.
//
// This lives next to instrumentation.ts because it is a statement about that
// module's output, and it lives outside the Playwright fixture because a
// pass/fail predicate that nothing can unit-test is how the last set of
// suppression rules drifted into hiding real defects.

import type { SupabaseIssue } from './instrumentation';

/**
 * PostgREST codes that always mean the code asked for something that does not
 * exist:
 *
 *   42703     column does not exist
 *   42P01     relation does not exist
 *   22P02     invalid input syntax (a non-UUID reached a uuid column)
 *   PGRST200  embed cannot be resolved — no such relationship
 *   PGRST204  column not found in the schema cache
 *   PGRST202  no such function
 *
 * None of these is a data condition, so none can be "expected in the test
 * environment" — the usual justification for suppressing them.
 *
 * Deliberately absent: PGRST116 (`.single()` matched no rows — an empty table
 * is a data question), and 401/403, which are the correct answer when a spec
 * checks that a role cannot reach something.
 */
export const STRUCTURAL_CODES: ReadonlySet<string> = new Set([
  '42703',
  '42P01',
  '22P02',
  'PGRST200',
  'PGRST204',
  'PGRST202',
]);

export function isStructural(issue: SupabaseIssue): boolean {
  // A 2xx write that changed nothing: the caller's `if (error)` passed and the
  // UI reported success. This is the certificate-revoke bug.
  if (issue.kind === 'empty-write') return true;
  // eq.undefined — a route param or piece of state was not ready. Postgres
  // rejects it, so it is never a real query, only a missing guard.
  if (issue.kind === 'bad-filter') return true;
  return !!issue.code && STRUCTURAL_CODES.has(issue.code);
}

export function structuralIssues(issues: readonly SupabaseIssue[]): SupabaseIssue[] {
  return issues.filter(isStructural);
}

/** One human-readable line per issue, for a test failure message. */
export function describeIssue(i: SupabaseIssue): string {
  const what =
    i.kind === 'empty-write'
      ? `${i.method} ${i.target} succeeded but changed 0 rows (RLS filtered every row, or the filter matched nothing)`
      : i.kind === 'bad-filter'
        ? `${i.method} ${i.target} — ${i.message ?? 'filter built from an undefined value'}`
        : `${i.method} ${i.target} — ${i.code} ${i.message ?? ''}`.trim();
  return `  • ${what}\n    on ${i.route}${i.select ? `\n    select: ${i.select}` : ''}`;
}
