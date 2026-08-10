// ABOUTME: Covers which recorded Supabase issues fail an e2e test and which do not.
// ABOUTME: The false-negative cases matter as much as the positives.

import { describe, it, expect } from 'vitest';
import { isStructural, structuralIssues, describeIssue } from '../issue-triage';
import type { SupabaseIssue } from '../instrumentation';

function issue(over: Partial<SupabaseIssue> = {}): SupabaseIssue {
  return {
    kind: 'error',
    method: 'GET',
    target: 'profiles',
    status: 400,
    route: '/dashboard',
    at: '2026-07-27T00:00:00.000Z',
    ...over,
  };
}

describe('structural issue triage', () => {
  /**
   * These are the shapes the audit actually found in production code. Every one
   * of them rendered as an empty list rather than an error, and every one was
   * invisible to the e2e suite because the console fixture suppressed all of
   * /rest/v1/.
   */
  it.each([
    ['42703', 'column profiles.full_name does not exist'],
    ['42P01', 'relation "public.course_settings" does not exist'],
    ['PGRST200', "Could not find a relationship between 'content_discussions' and 'profiles'"],
    ['PGRST204', 'column not found in the schema cache'],
    ['PGRST202', 'could not find the function'],
    ['22P02', 'invalid input syntax for type uuid: "test-quiz-id"'],
  ])('fails on %s', (code, message) => {
    expect(isStructural(issue({ code, message }))).toBe(true);
  });

  it('fails on a write that changed nothing', () => {
    // The certificate-revoke bug: 204, error === null, nothing deleted.
    expect(isStructural(issue({ kind: 'empty-write', method: 'DELETE', status: 204, code: undefined })))
      .toBe(true);
  });

  it('fails on a filter built from undefined', () => {
    expect(isStructural(issue({ kind: 'bad-filter', status: 0, code: undefined }))).toBe(true);
  });

  /**
   * The other half of the job. A predicate that flags everything is the blanket
   * suppression's mirror image — it would be turned off within a week.
   */
  it('ignores PGRST116, which only means the table was empty', () => {
    expect(isStructural(issue({ code: 'PGRST116', status: 406 }))).toBe(false);
  });

  /**
   * 42501 used to be ignored here on the grounds that a denial is the right
   * answer when a role lacks access. It is not, when the app's own page is the
   * one asking: CTASection read `enrollments` — a table `anon` has no grant on
   * — from a page only anonymous visitors ever see, so it failed on every load
   * while this predicate called it expected.
   *
   * Postgres raises 42501 only for a missing table-level GRANT. RLS filters
   * rows instead of raising, so "this role may not see these rows" arrives as
   * an empty result, never as this code.
   */
  it.each([401, 403])('fails on %d carrying 42501, a grant the role will never have', (status) => {
    expect(isStructural(issue({ status, code: '42501', message: 'permission denied' }))).toBe(true);
  });

  it('ignores a bare 401 with no code, which is an expired or absent JWT', () => {
    expect(isStructural(issue({ status: 401, code: undefined, message: 'JWT expired' }))).toBe(false);
  });

  it('ignores an error with no code, such as a network abort mid-navigation', () => {
    expect(isStructural(issue({ code: undefined, message: 'Failed to fetch' }))).toBe(false);
  });

  it('filters a mixed batch down to the real defects', () => {
    const batch = [
      issue({ code: 'PGRST116' }),
      issue({ code: '42703', target: 'profiles' }),
      issue({ status: 401, code: undefined, message: 'JWT expired' }),
      issue({ status: 403, code: '42501', target: 'enrollments' }),
      issue({ kind: 'empty-write', target: 'certificates', method: 'DELETE' }),
    ];
    expect(structuralIssues(batch).map((i) => i.target)).toEqual([
      'profiles',
      'enrollments',
      'certificates',
    ]);
  });
});

describe('issue descriptions', () => {
  it('names the column list for a failed select, which is the usual culprit', () => {
    const text = describeIssue(
      issue({ code: '42703', message: 'column profiles.full_name does not exist', select: 'id,full_name' }),
    );
    expect(text).toContain('42703');
    expect(text).toContain('select: id,full_name');
    expect(text).toContain('/dashboard');
  });

  it('explains an empty write rather than printing a bare code', () => {
    const text = describeIssue(issue({ kind: 'empty-write', method: 'DELETE', target: 'certificates' }));
    expect(text).toContain('changed 0 rows');
    expect(text).toContain('RLS');
  });
});
