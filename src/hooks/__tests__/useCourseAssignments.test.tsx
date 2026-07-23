// ABOUTME: Unit tests for useCourseAssignments hook
// ABOUTME: Covers fetching course assignments with profiles, empty results,
// ABOUTME: error propagation (query errors are thrown, never swallowed),
// ABOUTME: UUID validation, and add/remove instructor flows.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCourseAssignments } from '../useCourseAssignments';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// Chainable per-table query builder; awaiting it resolves `builder.result`,
// `.single()` / `.maybeSingle()` resolve their own dedicated results.
function makeTableBuilder(initialResult: any = { data: null, error: null }) {
  const builder: any = {
    result: initialResult,
    singleResult: null,
    maybeSingleResult: { data: null, error: null },
  };
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
    Promise.resolve(builder.maybeSingleResult)
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

const COURSE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT_ID = '33333333-3333-4333-8333-333333333333';

const assignmentRows = [
  {
    id: ASSIGNMENT_ID,
    user_id: USER_ID,
    course_id: COURSE_ID,
    role: 'instructor',
    created_at: '2026-01-01T00:00:00Z',
    profile: { id: USER_ID, first_name: 'Jane', last_name: 'Doe', avatar_url: null },
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    user_id: '55555555-5555-4555-8555-555555555555',
    course_id: COURSE_ID,
    role: 'student',
    created_at: '2026-01-02T00:00:00Z',
    profile: { id: '55555555-5555-4555-8555-555555555555', first_name: 'Sam', last_name: 'Lee', avatar_url: null },
  },
];

describe('useCourseAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches assignments with joined profiles and derives instructors', async () => {
    setupTables({
      course_assignments: makeTableBuilder({ data: assignmentRows, error: null }),
    });

    const { result } = renderHook(() => useCourseAssignments(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.assignments).toHaveLength(2);
    expect(result.current.assignments[0].profile?.first_name).toBe('Jane');
    // Only instructor/admin roles surface as instructors
    expect(result.current.instructors).toHaveLength(1);
    expect(result.current.instructors[0].id).toBe(ASSIGNMENT_ID);
  });

  it('treats an empty assignment list as success, not an error', async () => {
    setupTables({
      course_assignments: makeTableBuilder({ data: [], error: null }),
    });

    const { result } = renderHook(() => useCourseAssignments(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.assignments).toEqual([]);
    expect(result.current.instructors).toEqual([]);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('propagates a query error into error state and a destructive toast', async () => {
    setupTables({
      course_assignments: makeTableBuilder(supabaseError('assignments failed')),
    });

    const { result } = renderHook(() => useCourseAssignments(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('assignments failed');
    expect(result.current.assignments).toEqual([]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('rejects an invalid course id without querying', async () => {
    const { result } = renderHook(() => useCourseAssignments('not-a-uuid'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Invalid course ID format');
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('addInstructor inserts a new assignment with its profile', async () => {
    const tables = setupTables({
      course_assignments: makeTableBuilder({ data: [], error: null }),
      profiles: makeTableBuilder(),
    });

    const { result } = renderHook(() => useCourseAssignments(COURSE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const insertedRow = {
      id: ASSIGNMENT_ID,
      user_id: USER_ID,
      course_id: COURSE_ID,
      role: 'instructor',
      created_at: '2026-02-01T00:00:00Z',
    };
    const profileRow = { id: USER_ID, first_name: 'Jane', last_name: 'Doe', avatar_url: null };

    // Existing-assignment check finds nothing; insert returns the new row
    tables.course_assignments.maybeSingleResult = { data: null, error: null };
    tables.course_assignments.singleResult = { data: insertedRow, error: null };
    tables.profiles.singleResult = { data: profileRow, error: null };

    let added: any;
    await act(async () => {
      added = await result.current.addInstructor(USER_ID);
    });

    expect(added).toEqual({ ...insertedRow, profile: profileRow });
    expect(result.current.assignments).toHaveLength(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success' })
    );
  });

  it('addInstructor surfaces an insert failure via a destructive toast and returns null', async () => {
    const tables = setupTables({
      course_assignments: makeTableBuilder({ data: [], error: null }),
    });

    const { result } = renderHook(() => useCourseAssignments(COURSE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    tables.course_assignments.maybeSingleResult = { data: null, error: null };
    tables.course_assignments.singleResult = supabaseError('insert failed');

    let added: any;
    await act(async () => {
      added = await result.current.addInstructor(USER_ID);
    });

    expect(added).toBeNull();
    expect(result.current.assignments).toEqual([]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'insert failed' })
    );
  });

  it('removeInstructor deletes the assignment and updates local state', async () => {
    const tables = setupTables({
      course_assignments: makeTableBuilder({ data: assignmentRows, error: null }),
    });

    const { result } = renderHook(() => useCourseAssignments(COURSE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assignments).toHaveLength(2);

    // The awaited delete chain resolves without error
    tables.course_assignments.result = { data: null, error: null };

    let removed: boolean | undefined;
    await act(async () => {
      removed = await result.current.removeInstructor(ASSIGNMENT_ID);
    });

    expect(removed).toBe(true);
    expect(tables.course_assignments.delete).toHaveBeenCalled();
    expect(result.current.assignments).toHaveLength(1);
    expect(result.current.assignments[0].id).not.toBe(ASSIGNMENT_ID);
  });
});
