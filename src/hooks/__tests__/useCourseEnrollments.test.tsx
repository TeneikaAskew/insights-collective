// ABOUTME: Unit tests for useCourseEnrollments hook
// ABOUTME: Covers enrollments joined with profiles, regression for silently
// ABOUTME: swallowed profile-query errors, the stats RPC failure falling back
// ABOUTME: to an honest client-side recompute, and empty-enrollment handling.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCourseEnrollments } from '../useCourseEnrollments';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { makeEnrollment } from '@/test/utils/course-fixtures';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// Chainable per-table query builder; awaiting it resolves `builder.result`.
function makeTableBuilder(initialResult: any = { data: null, error: null }) {
  const builder: any = { result: initialResult };
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'not', 'or', 'filter', 'match',
    'order', 'limit', 'range',
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(builder.result));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(builder.result));
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

const enrollmentRows = [
  makeEnrollment({ id: 'enr-1', user_id: 'user-a', course_id: 'course-1', completion_status: 100 }),
  makeEnrollment({ id: 'enr-2', user_id: 'user-b', course_id: 'course-1', completion_status: 50 }),
];

const profileRows = [
  { id: 'user-a', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
  { id: 'user-b', first_name: 'Grace', last_name: 'Hopper', avatar_url: null },
];

describe('useCourseEnrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('fetches enrollments with joined profile data and RPC stats', async () => {
    setupTables({
      enrollments: makeTableBuilder({ data: enrollmentRows, error: null }),
      profiles: makeTableBuilder({ data: profileRows, error: null }),
    });
    mockSupabaseClient.rpc.mockResolvedValue({
      data: [{ enrollment_count: 2, completion_rate: 75 }],
      error: null,
    });

    const { result } = renderHook(() => useCourseEnrollments('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.enrollments).toHaveLength(2);
    expect(result.current.enrollments[0].user).toEqual({
      id: 'user-a',
      first_name: 'Ada',
      last_name: 'Lovelace',
      avatar_url: null,
    });
    expect(result.current.enrollments[1].user?.first_name).toBe('Grace');
    expect(result.current.stats).toEqual({
      enrollment_count: 2,
      completion_rate: 75,
    });
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_course_stats', {
      course_id_param: 'course-1',
    });
  });

  it('REGRESSION: profiles query error sets hook error instead of silently rendering enrollments with missing names', async () => {
    setupTables({
      enrollments: makeTableBuilder({ data: enrollmentRows, error: null }),
      profiles: makeTableBuilder(supabaseError('profiles failed')),
    });

    const { result } = renderHook(() => useCourseEnrollments('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('profiles failed');
    // No half-loaded rows with undefined users
    expect(result.current.enrollments).toEqual([]);
    expect(result.current.stats).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('stats RPC error falls back to a client-side recompute from the loaded enrollment data', async () => {
    setupTables({
      enrollments: makeTableBuilder({ data: enrollmentRows, error: null }),
      profiles: makeTableBuilder({ data: profileRows, error: null }),
    });
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc failed', code: 'PGRST000', details: '', hint: '' },
    });

    const { result } = renderHook(() => useCourseEnrollments('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Non-fatal degradation: enrollments loaded fine, stats derived from them
    expect(result.current.error).toBeNull();
    expect(result.current.enrollments).toHaveLength(2);
    expect(result.current.stats).toEqual({
      enrollment_count: 2,
      completion_rate: 75, // (100 + 50) / 2 from genuinely loaded rows
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('treats zero enrollments as a legitimate empty result', async () => {
    setupTables({
      enrollments: makeTableBuilder({ data: [], error: null }),
    });

    const { result } = renderHook(() => useCourseEnrollments('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.enrollments).toEqual([]);
    expect(result.current.stats).toEqual({
      enrollment_count: 0,
      completion_rate: 0,
    });
    // Short-circuits before profiles / stats work
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('profiles');
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('does nothing without a courseId', async () => {
    const { result } = renderHook(() => useCourseEnrollments(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.enrollments).toEqual([]);
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });
});
