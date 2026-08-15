// ABOUTME: Tests for the course-scoped composer that replaced the site-wide directory dialog.
// ABOUTME: The membership rule now lives in SQL; these cover the wrapper around it.
//
// WHERE THE RULE WENT, AND WHY THESE TESTS SHRANK
//
// These used to stub `courses`, `enrollments` and `course_assignments` and assert the
// membership rule against them — that a student is offered classmates as well as staff,
// that an outsider gets nobody, that assigned co-instructors count.
//
// That rule was the bug. Assembling the list client-side could never show a student their
// classmates, because `enrollments` is RLS-restricted to `user_id = auth.uid()` OR staff:
// a student reads back exactly one row, their own. The unit tests passed the whole time,
// because stubbing the table meant stubbing away the restriction that made it impossible.
// Only an e2e run against the real database found it.
//
// So the rule moved into `course_contacts` (20260802160000), which answers with the same
// predicate `open_course_thread` enforces. A test that can execute SQL is the only one
// that can check it, and those assertions now live in
// e2e/journeys/course-messaging-e2e.spec.ts — student sees classmates AND staff, outsider
// sees nobody, nobody sees themselves.
//
// What is left here is what is still written in TypeScript: the call, the error path, and
// the mapping. Deliberately not re-stubbing the RPC to re-assert the rule — a mock that
// returns whatever the rule is supposed to return proves only that the mock was written
// to agree with itself, which is exactly how the previous version stayed green.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCourseContacts, fetchMyCourseOptions } from '../CourseThreadComposer';
import { mockSupabaseClient, resetSupabaseMock } from '@/test/mocks/supabase';

const COURSE = 'course-1';
const CALLER = 'student-1';

describe('fetchCourseContacts', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it('asks course_contacts for the course, and nothing else', async () => {
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValue({ data: [], error: null } as any);

    await fetchCourseContacts(COURSE, CALLER);

    // The RPC name is validated against src/test/fixtures/db-functions.json by the
    // mock, so a typo or a function that does not exist fails here rather than in CI.
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('course_contacts', {
      p_course_id: COURSE,
    });
    // No caller id is sent: the function reads auth.uid(), so the client cannot ask on
    // somebody else's behalf.
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
    const args = (vi.mocked(mockSupabaseClient.rpc).mock.calls[0] as unknown as [string, object])[1];
    expect(Object.keys(args as object)).toEqual(['p_course_id']);
  });

  it('maps rows to contacts, keeping the role the database assigned', async () => {
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValue({
      data: [
        { id: 'i1', first_name: 'Ada', last_name: 'Teacher', avatar_url: null, role: 'instructor' },
        { id: 's2', first_name: 'Bo', last_name: 'Student', avatar_url: 'a.png', role: 'student' },
      ],
      error: null,
    } as any);

    const contacts = await fetchCourseContacts(COURSE, CALLER);

    expect(contacts).toEqual([
      { id: 'i1', first_name: 'Ada', last_name: 'Teacher', avatar_url: null, role: 'instructor' },
      { id: 's2', first_name: 'Bo', last_name: 'Student', avatar_url: 'a.png', role: 'student' },
    ]);
  });

  it('treats any role the database did not call instructor as a student', async () => {
    // Defensive: the column is free text, and a contact rendered with an unknown role
    // would fall through the UI's capitalize styling as-is.
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValue({
      data: [{ id: 'x', first_name: 'X', last_name: 'Y', avatar_url: null, role: 'ta' }],
      error: null,
    } as any);

    const contacts = await fetchCourseContacts(COURSE, CALLER);

    expect(contacts[0].role).toBe('student');
  });

  it('returns an empty list when the caller is in no position to message anyone', async () => {
    // course_contacts answers zero rows for someone outside the course rather than
    // raising, so the picker shows "nobody in this course you can message yet".
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValue({ data: [], error: null } as any);

    await expect(fetchCourseContacts(COURSE, CALLER)).resolves.toEqual([]);
  });

  it('tolerates a null payload', async () => {
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValue({ data: null, error: null } as any);

    await expect(fetchCourseContacts(COURSE, CALLER)).resolves.toEqual([]);
  });

  it('throws when the RPC fails, so the dialog can show its error state', async () => {
    // The composer catches this and renders a role="alert" — swallowing it here would
    // put an empty picker in front of the user and call it "nobody to message".
    vi.mocked(mockSupabaseClient.rpc).mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    } as any);

    await expect(fetchCourseContacts(COURSE, CALLER)).rejects.toMatchObject({
      message: 'permission denied',
    });
  });
});

/**
 * The Dashboard composer's course list. The membership definition matters: it must
 * match what open_course_thread accepts, which recognizes enrollment, staff
 * assignment, AND courses.instructor_id — the last of which the Dashboard's own
 * teachingCourses state (course_assignments only) misses.
 */
describe('fetchMyCourseOptions', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  /** The shared builder: the three membership reads end in .eq, in declaration order. */
  const builder = () => mockSupabaseClient.from('enrollments') as any;

  it('merges enrolled, assigned, and instructor_id-owned courses, sorted by title', async () => {
    const b = builder();
    b.eq
      .mockResolvedValueOnce({ data: [{ course_id: 'c-enrolled' }], error: null })
      .mockResolvedValueOnce({ data: [{ course_id: 'c-assigned' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'c-owned', title: 'Zeta Owned' }], error: null });
    b.in.mockResolvedValueOnce({
      data: [
        { id: 'c-enrolled', title: 'Alpha Enrolled' },
        { id: 'c-assigned', title: 'Beta Assigned' },
      ],
      error: null,
    });

    await expect(fetchMyCourseOptions(CALLER)).resolves.toEqual([
      { id: 'c-enrolled', title: 'Alpha Enrolled' },
      { id: 'c-assigned', title: 'Beta Assigned' },
      { id: 'c-owned', title: 'Zeta Owned' },
    ]);
  });

  it('offers a course to its primary instructor even with no course_assignments row', async () => {
    // The Codex-reviewed gap: useCoursesManagement.saveCourse can leave a course
    // represented only by courses.instructor_id.
    const b = builder();
    b.eq
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'c-owned', title: 'Only Mine' }], error: null });

    await expect(fetchMyCourseOptions(CALLER)).resolves.toEqual([
      { id: 'c-owned', title: 'Only Mine' },
    ]);
    // Nothing was missing a title, so no follow-up read.
    expect(b.in).not.toHaveBeenCalled();
  });

  it('throws when a membership read fails, so the dialog can show its error state', async () => {
    const b = builder();
    b.eq
      .mockResolvedValueOnce({ data: null, error: { message: 'enrollments read failed' } })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(fetchMyCourseOptions(CALLER)).rejects.toMatchObject({
      message: 'enrollments read failed',
    });
  });
});
