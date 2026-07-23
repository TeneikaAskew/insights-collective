// ABOUTME: Unit tests for useLessonProgress (fetch, markAsComplete, updateProgress).
// ABOUTME: Verifies error propagation: failed queries set error state, never default data.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLessonProgress } from '../useLessonProgress';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// isValidUUID gates the fetch — must be a real v4-shaped UUID.
const LESSON_ID = '22222222-2222-4222-8222-222222222222';

const authedProvider = { user: { id: 'user-1', email: 'test@example.com' }, isAuthenticated: true };

// useLessonProgress only touches the lesson_progress table, so the shared
// single-builder global mock works directly: fetch terminates in maybeSingle,
// writes terminate in single.

describe('useLessonProgress', () => {
  beforeEach(() => {
    toastMock.mockClear();
    // resetSupabaseMock (global beforeEach) swaps the builder but keeps the
    // from() call history — clear it so per-test call assertions are accurate.
    vi.mocked(mockSupabaseClient.from as any).mockClear();
    vi.mocked(useAuth).mockReturnValue(authedProvider as any);
  });

  it('loads existing lesson progress', async () => {
    const row = {
      id: 'lp-1',
      user_id: 'user-1',
      lesson_id: LESSON_ID,
      completed: false,
      completion_percentage: 60,
      time_spent: 300,
      started_at: '2026-01-01T00:00:00Z',
      last_accessed_at: '2026-01-02T00:00:00Z',
    };
    getQueryBuilder().maybeSingle.mockResolvedValue({ data: row, error: null });

    const { result } = renderHook(() => useLessonProgress(LESSON_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.progress).toEqual(row);
    expect(result.current.error).toBeNull();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('lesson_progress');
  });

  it('empty result (no progress row yet) is not an error', async () => {
    getQueryBuilder().maybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useLessonProgress(LESSON_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('failed fetch sets error state and leaves progress null', async () => {
    getQueryBuilder().maybeSingle.mockResolvedValue(supabaseError('fetch failed'));

    const { result } = renderHook(() => useLessonProgress(LESSON_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('fetch failed');
    expect(result.current.progress).toBeNull();
  });

  it('rejects invalid lesson id without querying supabase', async () => {
    const { result } = renderHook(() => useLessonProgress('not-a-uuid'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Invalid lesson ID format');
    expect(result.current.progress).toBeNull();
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('lesson_progress');
  });

  it('markAsComplete upserts, updates state, and toasts success', async () => {
    const completedRow = {
      id: 'lp-1',
      user_id: 'user-1',
      lesson_id: LESSON_ID,
      completed: true,
      completion_percentage: 100,
    };
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    builder.single.mockResolvedValue({ data: completedRow, error: null });

    const { result } = renderHook(() => useLessonProgress(LESSON_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.markAsComplete();
    });

    expect(ok).toBe(true);
    expect(result.current.progress).toEqual(completedRow);
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', lesson_id: LESSON_ID, completed: true, completion_percentage: 100 }),
      { onConflict: 'user_id,lesson_id' }
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Lesson marked as complete' })
    );
  });

  it('updateProgress failure returns false, toasts destructive, and does not set progress', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    builder.single.mockResolvedValue(supabaseError('write failed'));

    const { result } = renderHook(() => useLessonProgress(LESSON_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.updateProgress(75);
    });

    expect(ok).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'write failed' })
    );
  });
});
