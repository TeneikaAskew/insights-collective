// ABOUTME: Tests for the course-scoped composer that replaced the site-wide directory dialog.
// ABOUTME: The picker must offer exactly who open_course_thread would accept, and nobody else.
//
// These mirror the rules the database enforces (verified against the live RPC on
// 2026-08-02): a student may address the course instructor, an instructor may address
// anyone enrolled, and somebody who is in neither camp gets nothing. The UI offering a
// person the RPC will reject is not a security hole — the RPC still refuses — but it is a
// dead end the user cannot understand, which is how the old directory dialog behaved for
// every account on the site.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCourseContacts } from '../CourseThreadComposer';
import { mockSupabaseClient, resetSupabaseMock } from '@/test/mocks/supabase';

const COURSE = 'course-1';
const INSTRUCTOR = 'instructor-1';
const STUDENT = 'student-1';
const OTHER_STUDENT = 'student-2';
const OUTSIDER = 'outsider-1';

/**
 * fetchCourseContacts issues three reads in a fixed order: the course, its enrollments,
 * and the profiles of whoever survived. Stub `from` by table name so the test says what
 * the database contains rather than what order the code happens to ask in.
 */
function stubTables({ enrollments }: { enrollments: string[] }) {
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

  it('offers a student the course instructor, and only the instructor', async () => {
    stubTables({ enrollments: [STUDENT, OTHER_STUDENT] });

    const contacts = await fetchCourseContacts(COURSE, STUDENT);

    expect(contacts.map((c) => c.id)).toEqual([INSTRUCTOR]);
    expect(contacts[0].role).toBe('instructor');
    // Classmates are not offered: open_course_thread answers a student->student request
    // with "Students can only message the course instructor".
    expect(contacts.map((c) => c.id)).not.toContain(OTHER_STUDENT);
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
