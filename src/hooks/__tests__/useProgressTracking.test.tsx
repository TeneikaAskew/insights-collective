// ABOUTME: Unit tests for useProgressTracking (course + module progress aggregation).
// ABOUTME: Includes regression coverage: a failed progressions query must surface an
// ABOUTME: error and must NOT be presented as 0% progress.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressTracking } from '../useProgressTracking';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { makeModule, makeContentItem, makeProgression } from '@/test/utils/course-fixtures';
import { useAuth } from '@/contexts/AuthContext';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// --- per-table supabase builder --------------------------------------------
// The shared global mock wires every from() call to a single builder; these
// hooks issue several queries per fetch with different terminal methods, so
// give each table its own builder. Terminals:
//   single / maybeSingle -> cfg.single / cfg.maybeSingle
//   awaiting the chain itself (thenable) -> cfg.result

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

describe('useProgressTracking', () => {
  beforeEach(() => {
    toastMock.mockClear();
    vi.mocked(useAuth).mockReturnValue(authedProvider as any);
  });

  it('computes per-module and overall percentages from fixtures', async () => {
    mockTables({
      courses: { single: { data: { id: 'course-1', title: 'Intro to Data Analytics' }, error: null } },
      modules: {
        result: {
          data: [
            makeModule({ id: 'm1', title: 'Module 1', week: 1 }),
            makeModule({ id: 'm2', title: 'Module 2', week: 2 }),
          ],
          error: null,
        },
      },
      content_items: {
        result: {
          data: [
            makeContentItem({ id: 'i1', module_id: 'm1' }),
            makeContentItem({ id: 'i2', module_id: 'm1' }),
            makeContentItem({ id: 'i3', module_id: 'm2' }),
            makeContentItem({ id: 'i4', module_id: 'm2' }),
          ],
          error: null,
        },
      },
      content_item_progressions: {
        result: {
          data: [
            makeProgression({ content_item_id: 'i1', workflow_state: 'completed', updated_at: '2026-01-12T00:00:00Z' }),
            makeProgression({ content_item_id: 'i3', workflow_state: 'graded', updated_at: '2026-01-13T00:00:00Z' }),
            // unread must not count as complete
            makeProgression({ content_item_id: 'i4', workflow_state: 'unread', updated_at: '2026-01-14T00:00:00Z' }),
          ],
          error: null,
        },
      },
    });

    const { result } = renderHook(() => useProgressTracking('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    const progress = result.current.courseProgress;
    expect(progress).not.toBeNull();
    expect(progress!.course_title).toBe('Intro to Data Analytics');
    expect(progress!.total_modules).toBe(2);
    expect(progress!.overall_completion).toBe(50); // 2 of 4 items
    expect(progress!.completed_modules).toBe(0); // neither module is at 100%

    const m1 = progress!.modules.find((m) => m.module_id === 'm1');
    const m2 = progress!.modules.find((m) => m.module_id === 'm2');
    expect(m1).toMatchObject({ total_blocks: 2, completed_blocks: 1, completion_percentage: 50 });
    expect(m2).toMatchObject({ total_blocks: 2, completed_blocks: 1, completion_percentage: 50 });
  });

  it('REGRESSION: failed progressions query surfaces an error and does NOT report 0% progress', async () => {
    mockTables({
      courses: { single: { data: { id: 'course-1', title: 'Intro to Data Analytics' }, error: null } },
      modules: { result: { data: [makeModule({ id: 'm1', title: 'Module 1', week: 1 })], error: null } },
      content_items: { result: { data: [makeContentItem({ id: 'i1', module_id: 'm1' })], error: null } },
      content_item_progressions: { result: supabaseError('progressions query failed') },
    });

    const { result } = renderHook(() => useProgressTracking('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Error is exposed...
    expect(result.current.error).toBe('progressions query failed');
    // ...and no zeroed/partial progress object is presented as real data.
    expect(result.current.courseProgress).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('empty course reports zero progress WITHOUT an error', async () => {
    mockTables({
      courses: { single: { data: { id: 'course-1', title: 'Empty Course' }, error: null } },
      modules: { result: { data: [], error: null } },
      content_items: { result: { data: [], error: null } },
      content_item_progressions: { result: { data: [], error: null } },
    });

    const { result } = renderHook(() => useProgressTracking('course-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.courseProgress).toMatchObject({
      course_id: 'course-1',
      total_modules: 0,
      completed_modules: 0,
      overall_completion: 0,
      modules: [],
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('module mode: computes module percentages from progressions', async () => {
    mockTables({
      modules: { single: { data: { id: 'm1', title: 'Module 1' }, error: null } },
      content_items: {
        result: {
          data: [
            makeContentItem({ id: 'i1', module_id: 'm1' }),
            makeContentItem({ id: 'i2', module_id: 'm1' }),
          ],
          error: null,
        },
      },
      content_item_progressions: {
        result: {
          data: [
            makeProgression({ id: 'p1', content_item_id: 'i1', workflow_state: 'completed', updated_at: '2026-01-12T00:00:00Z' }),
          ],
          error: null,
        },
      },
    });

    const { result } = renderHook(() => useProgressTracking(undefined, 'm1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.moduleProgress).toMatchObject({
      module_id: 'm1',
      total_blocks: 2,
      completed_blocks: 1,
      completion_percentage: 50,
    });
    expect(result.current.contentProgress).toHaveLength(1);
  });

  it('REGRESSION: module mode with failed progressions query exposes error, no zeroed progress', async () => {
    mockTables({
      modules: { single: { data: { id: 'm1', title: 'Module 1' }, error: null } },
      content_items: { result: { data: [makeContentItem({ id: 'i1', module_id: 'm1' })], error: null } },
      content_item_progressions: { result: supabaseError('module progressions failed') },
    });

    const { result } = renderHook(() => useProgressTracking(undefined, 'm1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('module progressions failed');
    expect(result.current.moduleProgress).toBeNull();
  });
});
