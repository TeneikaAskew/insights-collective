// ABOUTME: Unit tests for the useLessons hook (direct supabase queries).
// ABOUTME: Covers fetch success/empty/error plus add/update/delete mutation paths.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLessons } from '../useLessons';
import { getQueryBuilder, supabaseError } from '@/test/mocks/supabase';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

// Local override of the global AuthContext mock: addLesson requires a user.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

const MODULE_ID = '123e4567-e89b-12d3-a456-426614174000';
const LESSON_ID = '223e4567-e89b-42d3-a456-426614174001';

function makeLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: LESSON_ID,
    module_id: MODULE_ID,
    title: 'Lesson 1',
    description: 'First lesson',
    order_num: 1,
    content_blocks_count: 0,
    ...overrides,
  };
}

describe('useLessons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads lessons on mount', async () => {
    const rows = [makeLesson(), makeLesson({ id: '323e4567-e89b-42d3-a456-426614174002', order_num: 2 })];
    getQueryBuilder().order.mockResolvedValue({ data: rows, error: null });

    const { result } = renderHook(() => useLessons(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lessons).toEqual(rows);
    expect(result.current.error).toBeNull();
  });

  it('returns empty lessons when the module has none', async () => {
    getQueryBuilder().order.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useLessons(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lessons).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('surfaces a fetch error instead of defaulting data', async () => {
    getQueryBuilder().order.mockResolvedValue(supabaseError('lessons query failed'));

    const { result } = renderHook(() => useLessons(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('lessons query failed');
    expect(result.current.lessons).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('rejects an invalid module id without querying', async () => {
    const { result } = renderHook(() => useLessons('not-a-uuid'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Invalid module ID format');
    expect(result.current.lessons).toEqual([]);
  });

  it('adds a lesson and appends it to state', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [], error: null });
    const newLesson = makeLesson({ title: 'New lesson' });
    builder.single.mockResolvedValue({ data: newLesson, error: null });

    const { result } = renderHook(() => useLessons(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: any;
    await act(async () => {
      created = await result.current.addLesson({ title: 'New lesson' } as any);
    });

    expect(created).toEqual(newLesson);
    expect(result.current.lessons).toEqual([newLesson]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success' })
    );
  });

  it('returns null and toasts when adding a lesson fails', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [], error: null });
    builder.single.mockResolvedValue(supabaseError('insert failed'));

    const { result } = renderHook(() => useLessons(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: any;
    await act(async () => {
      created = await result.current.addLesson({ title: 'New lesson' } as any);
    });

    expect(created).toBeNull();
    expect(result.current.lessons).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'insert failed' })
    );
  });

  it('returns null and toasts when updating a lesson fails', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [makeLesson()], error: null });
    builder.single.mockResolvedValue(supabaseError('update failed'));

    const { result } = renderHook(() => useLessons(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let updated: any;
    await act(async () => {
      updated = await result.current.updateLesson(LESSON_ID, { title: 'Renamed' });
    });

    expect(updated).toBeNull();
    expect(result.current.lessons[0].title).toBe('Lesson 1');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'update failed' })
    );
  });

  it('deletes a lesson and removes it from state', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [makeLesson()], error: null });
    // lesson_progress delete and lessons delete are awaited on .eq(), so the
    // builder itself must resolve as a thenable.
    builder.then.mockImplementation((resolve: any) => resolve({ error: null }));

    const { result } = renderHook(() => useLessons(MODULE_ID));
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));

    let ok: any;
    await act(async () => {
      ok = await result.current.deleteLesson(LESSON_ID);
    });

    expect(ok).toBe(true);
    expect(result.current.lessons).toEqual([]);
  });

  it('keeps state and toasts when deleting a lesson fails', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [makeLesson()], error: null });
    builder.then.mockImplementation((resolve: any) =>
      resolve({ error: { message: 'delete failed' } })
    );

    const { result } = renderHook(() => useLessons(MODULE_ID));
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));

    let ok: any;
    await act(async () => {
      ok = await result.current.deleteLesson(LESSON_ID);
    });

    expect(ok).toBe(false);
    expect(result.current.lessons).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'delete failed' })
    );
  });
});
