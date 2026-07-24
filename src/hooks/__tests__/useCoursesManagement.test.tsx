// ABOUTME: Unit tests for useCoursesManagement hook
// ABOUTME: Covers course fetching with real enrollment counts, error surfacing
// ABOUTME: (regression: enrollment-count query failures must NOT silently render
// ABOUTME: "0 enrolled"), and save/delete success + failure toast paths.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCoursesManagement } from '../useCoursesManagement';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { makeCourse } from '@/test/utils/course-fixtures';
import { useAuth } from '@/contexts/AuthContext';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// Chainable per-table query builder. Every chain method returns the builder;
// awaiting the builder resolves `builder.result`, and terminal `.single()` /
// `.maybeSingle()` resolve `builder.singleResult` (falling back to `result`).
// Mutate `result` / `singleResult` mid-test to change what later queries see.
function makeTableBuilder(initialResult: any = { data: null, error: null }) {
  const builder: any = { result: initialResult, singleResult: null };
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'not', 'or', 'filter', 'match',
    'order', 'limit', 'range',
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }
  builder.single = vi.fn().mockImplementation(() =>
    Promise.resolve(builder.singleResult ?? builder.result)
  );
  builder.maybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve(builder.singleResult ?? builder.result)
  );
  builder.then = (resolve: any, reject: any) =>
    Promise.resolve(builder.result).then(resolve, reject);
  return builder;
}

function setupTables(tables: Record<string, any>) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (!tables[table]) tables[table] = makeTableBuilder();
    return tables[table];
  });
  return tables;
}

const instructorRow = {
  id: 'instructor-1',
  first_name: 'Jane',
  last_name: 'Doe',
  avatar_url: null,
};

describe('useCoursesManagement', () => {
  const mockUser = { id: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    // The global AuthContext mock returns user: null; this hook requires a
    // logged-in user before it fetches. Return a STABLE object so the
    // [user]-keyed effect does not loop.
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('fetches courses with real enrollment counts', async () => {
    const courseA = makeCourse({ id: 'course-a', instructor: instructorRow });
    const courseB = makeCourse({ id: 'course-b', instructor: instructorRow });

    setupTables({
      courses: makeTableBuilder({ data: [courseA, courseB], error: null }),
      enrollments: makeTableBuilder({
        data: [
          { course_id: 'course-a' },
          { course_id: 'course-a' },
          { course_id: 'course-b' },
        ],
        error: null,
      }),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.courses).toHaveLength(2);

    const byId = Object.fromEntries(result.current.courses.map(c => [c.id, c]));
    expect(byId['course-a'].enrollmentCount).toBe(2);
    expect(byId['course-b'].enrollmentCount).toBe(1);
    expect(byId['course-a'].instructor?.name).toBe('Jane Doe');
  });

  it('REGRESSION: enrollment-count query error sets hook error and does NOT silently render courses with 0 counts', async () => {
    const courseA = makeCourse({ id: 'course-a', instructor: instructorRow });

    setupTables({
      courses: makeTableBuilder({ data: [courseA], error: null }),
      enrollments: makeTableBuilder(supabaseError('enrollment counts failed')),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The whole fetch fails loudly instead of rendering '0 enrolled' per course
    expect(result.current.error).toBe('enrollment counts failed');
    expect(result.current.courses).toEqual([]);
    expect(
      result.current.courses.some(c => c.enrollmentCount === 0)
    ).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('REGRESSION: role-query failure sets hook error and does NOT silently filter the course list', async () => {
    const courseA = makeCourse({ id: 'course-a', instructor: instructorRow });

    setupTables({
      courses: makeTableBuilder({ data: [courseA], error: null }),
      enrollments: makeTableBuilder({ data: [], error: null }),
      user_roles: makeTableBuilder(supabaseError('roles query failed')),
    });

    const { result } = renderHook(() => useCoursesManagement());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The fetch fails loudly instead of quietly treating the user as
    // non-admin and rendering a filtered (possibly empty) course list.
    expect(result.current.error).toBe('roles query failed');
    expect(result.current.courses).toEqual([]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('treats an empty course list as success, not an error', async () => {
    setupTables({
      courses: makeTableBuilder({ data: [], error: null }),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.courses).toEqual([]);
    // No course ids -> no enrollment-count query at all
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('enrollments');
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('saveCourse creates a course and shows a success toast', async () => {
    const created = makeCourse({ id: 'course-new', title: 'New Course' });
    const tables = setupTables({
      courses: makeTableBuilder({ data: [], error: null }),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // insert(...).select().single() resolves the created row; the follow-up
    // refetch keeps resolving the (empty) course list via the awaited builder.
    tables.courses.singleResult = { data: created, error: null };

    let saved: any;
    await act(async () => {
      saved = await result.current.saveCourse({ title: 'New Course' });
    });

    expect(saved).toEqual(created);
    expect(tables.courses.insert).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'Course created successfully',
      })
    );
  });

  it('saveCourse failure throws and shows a destructive toast', async () => {
    const tables = setupTables({
      courses: makeTableBuilder({ data: [], error: null }),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    tables.courses.singleResult = supabaseError('insert failed');

    await act(async () => {
      await expect(
        result.current.saveCourse({ title: 'Broken Course' })
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'insert failed',
      })
    );
  });

  it('deleteCourse deletes and shows a success toast', async () => {
    const tables = setupTables({
      courses: makeTableBuilder({ data: [], error: null }),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteCourse('course-a');
    });

    expect(deleted).toBe(true);
    expect(tables.courses.delete).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'Course deleted successfully',
      })
    );
  });

  it('deleteCourse failure returns false and shows a destructive toast', async () => {
    const tables = setupTables({
      courses: makeTableBuilder({ data: [], error: null }),
      user_roles: makeTableBuilder({ data: [{ role: 'admin' }], error: null }),
    });

    const { result } = renderHook(() => useCoursesManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Make subsequent awaited courses queries (the delete) resolve an error
    tables.courses.result = supabaseError('delete failed');

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteCourse('course-a');
    });

    expect(deleted).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'delete failed',
      })
    );
  });
});
