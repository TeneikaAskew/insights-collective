// ABOUTME: Unit tests for usePublishedCourses — the lightweight course read the
// ABOUTME: Navbar's SiteSearch uses. Pins the two properties that matter: it
// ABOUTME: filters to published and touches ONLY `courses` (regression: it used
// ABOUTME: to run the admin hook, which also scanned `enrollments` on every page
// ABOUTME: load and returned nothing at all for a non-instructor member).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePublishedCourses } from '../usePublishedCourses';
import { mockSupabaseClient } from '@/test/mocks/supabase';

function makeTableBuilder(result: any = { data: null, error: null }) {
  const builder: any = { result };
  for (const method of ['select', 'eq', 'order', 'in', 'limit']) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }
  builder.then = (resolve: any, reject: any) =>
    Promise.resolve(builder.result).then(resolve, reject);
  return builder;
}

const publishedCourse = {
  id: 'course-1',
  title: 'Introduction to Data Science',
  description: 'Learn the fundamentals',
  category: 'Data',
  image_url: null,
  thumbnail: null,
};

describe('usePublishedCourses', () => {
  let tables: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {};
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (!tables[table]) tables[table] = makeTableBuilder();
      return tables[table];
    });
  });

  it('returns published courses and asks the database for published only', async () => {
    tables.courses = makeTableBuilder({ data: [publishedCourse], error: null });

    const { result } = renderHook(() => usePublishedCourses());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courses).toEqual([publishedCourse]);
    // The filter must be server-side — a client-side filter would ship
    // unpublished course titles to the browser.
    expect(tables.courses.eq).toHaveBeenCalledWith('published', true);
  });

  it('reads only the courses table — no enrollments scan, no role lookup', async () => {
    tables.courses = makeTableBuilder({ data: [publishedCourse], error: null });

    const { result } = renderHook(() => usePublishedCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const queried = mockSupabaseClient.from.mock.calls.map((c: any[]) => c[0]);
    expect(queried).toEqual(['courses']);
    expect(queried).not.toContain('enrollments');
    expect(queried).not.toContain('user_roles');
  });

  it('degrades to an empty list on error instead of throwing', async () => {
    tables.courses = makeTableBuilder({
      data: null,
      error: { code: '42501', message: 'permission denied for table courses' },
    });

    const { result } = renderHook(() => usePublishedCourses());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courses).toEqual([]);
  });
});
