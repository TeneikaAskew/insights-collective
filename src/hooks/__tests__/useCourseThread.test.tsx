// ABOUTME: Unit tests for the useCourseThread hook (open_course_thread RPC wrapper).
// ABOUTME: Covers successful navigation, empty RPC result, and RPC error propagation to toast.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCourseThread } from '../useCourseThread';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const { mockNavigate, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useCourseThread', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockToast.mockClear();
    (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValue({ data: null, error: null });
  });

  it('opens the thread and navigates to it on success', async () => {
    (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: 'thread-42',
      error: null,
    });

    const { result } = renderHook(() => useCourseThread());

    await act(async () => {
      await result.current.openThread('course-1', 'user-2');
    });

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('open_course_thread', {
      p_course_id: 'course-1',
      p_other_user_id: 'user-2',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/messages/thread-42');
    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.opening).toBe(false);
  });

  it('shows an error toast when the RPC returns no thread id', async () => {
    (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useCourseThread());

    await act(async () => {
      await result.current.openThread('course-1', 'user-2');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unable to open thread',
        description: 'Could not open thread',
        variant: 'destructive',
      })
    );
    expect(result.current.opening).toBe(false);
  });

  it('propagates the RPC error message to the toast and does not navigate', async () => {
    (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'not enrolled in course', code: 'PGRST000' },
    });

    const { result } = renderHook(() => useCourseThread());

    await act(async () => {
      await result.current.openThread('course-1', 'user-2');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unable to open thread',
        description: 'not enrolled in course',
        variant: 'destructive',
      })
    );
    expect(result.current.opening).toBe(false);
  });
});
