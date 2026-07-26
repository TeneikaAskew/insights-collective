// ABOUTME: Unit tests for useModuleProgress (fetch, markModuleComplete, submitAssignment).
// ABOUTME: Regression: a failed assignment_submissions upsert must NOT be reported as a
// ABOUTME: successful submission — the hook must reject with a partial-failure error.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useModuleProgress } from '../useModuleProgress';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// isValidUUID gates the fetch — must be a real v4-shaped UUID.
const MODULE_ID = '11111111-1111-4111-8111-111111111111';

// --- per-table supabase builder (see useProgressTracking.test.tsx) ---------

type Resp = { data: any; error: any };
type TableConfig = { single?: Resp; maybeSingle?: Resp; result?: Resp };

const CHAIN_METHODS = [
  'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'contains', 'containedBy', 'range', 'overlaps', 'match', 'not', 'or',
  'filter', 'order', 'limit',
] as const;

function mockTables(tables: Record<string, TableConfig>) {
  const builders: Record<string, any> = {};
  const getBuilder = (table: string) => {
    if (!builders[table]) {
      const cfg = tables[table] ?? {};
      const builder: any = {};
      for (const m of CHAIN_METHODS) builder[m] = vi.fn().mockReturnValue(builder);
      builder.single = vi.fn().mockResolvedValue(cfg.single ?? { data: null, error: null });
      builder.maybeSingle = vi.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null, error: null });
      const result = cfg.result ?? { data: [], error: null };
      builder.then = (onFulfilled: any, onRejected: any) =>
        Promise.resolve(result).then(onFulfilled, onRejected);
      builders[table] = builder;
    }
    return builders[table];
  };
  vi.mocked(mockSupabaseClient.from as any).mockImplementation(getBuilder);
  return getBuilder;
}

const authedProvider = { user: { id: 'user-1', email: 'test@example.com' }, isAuthenticated: true };

describe('useModuleProgress', () => {
  beforeEach(() => {
    toastMock.mockClear();
    vi.mocked(useAuth).mockReturnValue(authedProvider as any);
  });

  it('fetches module, assignment, and quiz progress on mount', async () => {
    const moduleRow = {
      id: 'mp-1',
      user_id: 'user-1',
      module_id: MODULE_ID,
      completed: false,
      completion_percentage: 40,
      time_spent: 120,
      started_at: '2026-01-01T00:00:00Z',
      last_accessed_at: '2026-01-02T00:00:00Z',
    };
    const assignmentRows = [{ id: 'ap-1', user_id: 'user-1', content_item_id: 'item-1', workflow_state: 'submitted' }];
    // Quiz progress comes from quiz_submissions (the table the live quiz flow
    // writes); quiz_attempts was only written by the deleted QuizTaker.
    const quizRows = [
      { id: 'qs-1', user_id: 'user-1', quiz_id: 'quiz-1', score: 8, workflow_state: 'complete', finished_at: '2026-01-02T00:00:00Z' },
    ];

    mockTables({
      module_progress: { maybeSingle: { data: moduleRow, error: null } },
      content_item_progressions: { result: { data: assignmentRows, error: null } },
      quiz_submissions: { result: { data: quizRows, error: null } },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.moduleProgress).toEqual(moduleRow);
    expect(result.current.assignmentProgress).toEqual(assignmentRows);
    expect(result.current.quizProgress).toEqual(quizRows);
  });

  // REGRESSION: quiz progress must come from quiz_submissions. Reading
  // quiz_attempts (only ever written by the removed QuizTaker component) made
  // completed quizzes count as zero for every student.
  it('reads quiz progress from quiz_submissions, not quiz_attempts', async () => {
    mockTables({
      module_progress: { maybeSingle: { data: null, error: null } },
      content_item_progressions: { result: { data: [], error: null } },
      quiz_submissions: { result: { data: [], error: null } },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const tablesQueried = vi.mocked(mockSupabaseClient.from as any).mock.calls.map((c: any[]) => c[0]);
    expect(tablesQueried).toContain('quiz_submissions');
    expect(tablesQueried).not.toContain('quiz_attempts');
  });

  it('exposes error state when the fetch fails (no default data)', async () => {
    mockTables({
      module_progress: { maybeSingle: supabaseError('db down') },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('db down');
    expect(result.current.moduleProgress).toBeNull();
    expect(result.current.assignmentProgress).toEqual([]);
    expect(result.current.quizProgress).toEqual([]);
  });

  it('markModuleComplete upserts and toasts success', async () => {
    const completedRow = {
      id: 'mp-1',
      user_id: 'user-1',
      module_id: MODULE_ID,
      completed: true,
      completion_percentage: 100,
    };

    mockTables({
      module_progress: { single: { data: completedRow, error: null } },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.markModuleComplete();
    });

    expect(ok).toBe(true);
    expect(result.current.moduleProgress).toEqual(completedRow);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Module marked as complete!' })
    );
  });

  it('markModuleComplete failure returns false and toasts destructive', async () => {
    mockTables({
      module_progress: { single: supabaseError('upsert failed') },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.markModuleComplete();
    });

    expect(ok).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'upsert failed' })
    );
  });

  it('submitAssignment succeeds when both the progression and the submission record save', async () => {
    const progressionRow = { id: 'cip-1', user_id: 'user-1', content_item_id: 'item-1', workflow_state: 'submitted' };

    const getBuilder = mockTables({
      content_item_progressions: { single: { data: progressionRow, error: null } },
      content_items: { single: { data: { type: 'assignment', settings: {} }, error: null } },
      assignment_submissions: { result: { data: null, error: null } },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitAssignment('item-1', { answer: 'my work' });
    });

    expect(ok).toBe(true);
    expect(getBuilder('assignment_submissions').upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        assignment_id: 'item-1',
        workflow_state: 'submitted',
      }),
      { onConflict: 'user_id,assignment_id' }
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Assignment submitted successfully!' })
    );
  });

  it('REGRESSION: submitAssignment reports failure when the submission record upsert fails', async () => {
    const progressionRow = { id: 'cip-1', user_id: 'user-1', content_item_id: 'item-1', workflow_state: 'submitted' };

    mockTables({
      content_item_progressions: { single: { data: progressionRow, error: null } },
      content_items: { single: { data: { type: 'assignment', settings: {} }, error: null } },
      // Secondary write fails — this used to be silently swallowed while the
      // hook toasted "Assignment submitted successfully!".
      assignment_submissions: { result: supabaseError('duplicate key') },
    });

    const { result } = renderHook(() => useModuleProgress(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitAssignment('item-1', { answer: 'my work' });
    });

    expect(ok).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Progress was saved, but the submission record failed: duplicate key',
      })
    );
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Assignment submitted successfully!' })
    );
  });
});
