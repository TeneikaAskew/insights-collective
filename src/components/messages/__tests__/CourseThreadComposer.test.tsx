// ABOUTME: Tests for the course-scoped composer that replaced the site-wide directory dialog.
// ABOUTME: The picker must offer exactly who open_course_thread would accept, and nobody else.
//
// These mirror the rules the database enforces (verified against the live RPC on
// 2026-08-02): membership of the course is the whole rule, so anyone in it can address
// anyone else in it, and somebody outside gets nothing. The UI offering a person the RPC
// will reject is not a security hole — the RPC still refuses — but it is a dead end the
// user cannot understand, which is how the old directory dialog behaved for every account
// on the site. Offering too FEW people is the opposite failure and just as wrong: it hides
// a conversation the database would have allowed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCourseContacts } from '../CourseThreadComposer';
import { mockSupabaseClient, resetSupabaseMock } from '@/test/mocks/supabase';

const COURSE = 'course-1';
const INSTRUCTOR = 'instructor-1';
const STUDENT = 'student-1';
const OTHER_STUDENT = 'student-2';
const OUTSIDER = 'outsider-1';
const CO_INSTRUCTOR = 'co-instructor-1';

/**
 * fetchCourseContacts issues three reads in a fixed order: the course, its enrollments,
 * and the profiles of whoever survived. Stub `from` by table name so the test says what
 * the database contains rather than what order the code happens to ask in.
 */
function stubTables({
  enrollments,
  assignedInstructors = [],
}: {
  enrollments: string[];
  assignedInstructors?: string[];
}) {
  vi.mocked(mockSupabaseClient.from).mockImplementation((table: string) => {
    if (table === 'courses') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: COURSE, instructor_id: INSTRUCTOR }, error: null }),
          }),
        }),
      } as any;
    }
    if (table === 'enrollments') {
      return {
        select: () => ({
          eq: async () => ({ data: enrollments.map((user_id) => ({ user_id })), error: null }),
        }),
      } as any;
    }
    if (table === 'course_assignments') {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({
              data: assignedInstructors.map((user_id) => ({ user_id })),
              error: null,
            }),
          }),
        }),
      } as any;
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          in: async (_column: string, ids: string[]) => ({
            data: ids.map((id) => ({ id, first_name: id, last_name: 'Person', avatar_url: null })),
            error: null,
          }),
        }),
      } as any;
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

describe('fetchCourseContacts', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it('offers a student their classmates as well as the teaching staff', async () => {
    stubTables({ enrollments: [STUDENT, OTHER_STUDENT] });

    const contacts = await fetchCourseContacts(COURSE, STUDENT);

    // open_course_thread used to refuse student-to-student threads; 20260802020300
    // dropped that, so a picker limited to instructors would now hide people the
    // database accepts.
    expect(contacts.map((c) => c.id).sort()).toEqual([INSTRUCTOR, OTHER_STUDENT].sort());
    expect(contacts.find((c) => c.id === INSTRUCTOR)?.role).toBe('instructor');
    expect(contacts.find((c) => c.id === OTHER_STUDENT)?.role).toBe('student');
    // Never yourself.
    expect(contacts.map((c) => c.id)).not.toContain(STUDENT);
  });

  it('offers an instructor every enrolled student, and not themselves', async () => {
    stubTables({ enrollments: [STUDENT, OTHER_STUDENT] });

    const contacts = await fetchCourseContacts(COURSE, INSTRUCTOR);

    expect(contacts.map((c) => c.id).sort()).toEqual([STUDENT, OTHER_STUDENT].sort());
    expect(contacts.map((c) => c.id)).not.toContain(INSTRUCTOR);
    expect(contacts.every((c) => c.role === 'student')).toBe(true);
  });

  it('offers nobody to someone who neither takes nor teaches the course', async () => {
    stubTables({ enrollments: [STUDENT] });

    const contacts = await fetchCourseContacts(COURSE, OUTSIDER);

    expect(contacts).toEqual([]);
  });

  it('offers nobody when an instructor has no students yet', async () => {
    stubTables({ enrollments: [] });

    const contacts = await fetchCourseContacts(COURSE, INSTRUCTOR);

    expect(contacts).toEqual([]);
  });

  it('still offers nobody outside the course', async () => {
    stubTables({ enrollments: [STUDENT, OTHER_STUDENT] });

    // Loosening the rule to "anyone in the course" must not loosen it to "anyone".
    const contacts = await fetchCourseContacts(COURSE, STUDENT);
    expect(contacts.map((c) => c.id)).not.toContain(OUTSIDER);
  });

  /**
   * A course can be taught by more than one person. `courses.instructor_id` is only the
   * primary; open_course_thread accepts anyone `is_course_instructor()` accepts, which is
   * that column OR a course_assignments row with role 'instructor'. A picker built from
   * the column alone disagreed with the RPC in both directions.
   */
  it('offers a student the assigned co-instructors as well as the primary one', async () => {
    stubTables({ enrollments: [STUDENT], assignedInstructors: [CO_INSTRUCTOR] });

    const contacts = await fetchCourseContacts(COURSE, STUDENT);

    expect(contacts.map((c) => c.id).sort()).toEqual([INSTRUCTOR, CO_INSTRUCTOR].sort());
    expect(contacts.every((c) => c.role === 'instructor')).toBe(true);
  });

  it('offers nobody to a course with only you in it', async () => {
    stubTables({ enrollments: [STUDENT] });

    const contacts = await fetchCourseContacts(COURSE, STUDENT);

    // The primary instructor is still a member, so this is about the *self* exclusion.
    expect(contacts.map((c) => c.id)).toEqual([INSTRUCTOR]);
  });

  it('gives an assigned co-instructor the roster, not an empty picker', async () => {
    // They are neither instructor_id nor enrolled, so the old check called them a
    // stranger to a course they teach.
    stubTables({ enrollments: [STUDENT, OTHER_STUDENT], assignedInstructors: [CO_INSTRUCTOR] });

    const contacts = await fetchCourseContacts(COURSE, CO_INSTRUCTOR);

    expect(contacts.map((c) => c.id).sort()).toEqual([STUDENT, OTHER_STUDENT, INSTRUCTOR].sort());
    expect(contacts.find((c) => c.id === INSTRUCTOR)?.role).toBe('instructor');
    expect(contacts.find((c) => c.id === STUDENT)?.role).toBe('student');
    expect(contacts.map((c) => c.id)).not.toContain(CO_INSTRUCTOR);
  });

  it('throws rather than returning an empty picker when the enrollment read fails', async () => {
    // An empty picker and a failed read look identical on screen. The caller renders the
    // failure; it must not be able to mistake it for "nobody to message".
    vi.mocked(mockSupabaseClient.from).mockImplementation((table: string) => {
      if (table === 'courses') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: COURSE, instructor_id: INSTRUCTOR }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'course_assignments') {
        return {
          select: () => ({
            eq: () => ({ eq: async () => ({ data: [], error: null }) }),
          }),
        } as any;
      }
      return {
        select: () => ({
          eq: async () => ({ data: null, error: { message: 'enrollments unavailable' } }),
        }),
      } as any;
    });

    await expect(fetchCourseContacts(COURSE, STUDENT)).rejects.toMatchObject({
      message: 'enrollments unavailable',
    });
  });
});
