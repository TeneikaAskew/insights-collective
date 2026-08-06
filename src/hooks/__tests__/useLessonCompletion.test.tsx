// ABOUTME: Unit tests for the React Query hooks in useLessonCompletion.
// ABOUTME: The hooks wrap lessonCompletionService — the service module is mocked, and
// ABOUTME: query errors must propagate to isError/error (no default data on failure).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useLessonCompletion,
  useModuleCompletions,
  useMarkLessonComplete,
} from '../useLessonCompletion';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { lessonCompletionService } from '@/services/lessonCompletionService';

vi.mock('@/services/lessonCompletionService', () => ({
  lessonCompletionService: {
    markLessonComplete: vi.fn(),
    markLessonIncomplete: vi.fn(),
    getLessonCompletion: vi.fn(),
    getModuleCompletions: vi.fn(),
    getCourseCompletions: vi.fn(),
    getLessonRequirements: vi.fn(),
    setLessonRequirements: vi.fn(),
    checkLessonRequirements: vi.fn(),
    trackLessonView: vi.fn(),
  },
}));

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

describe('useLessonCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the completion record on success', async () => {
    const completion = {
      id: 'comp-1',
      lesson_id: 'lesson-1',
      user_id: 'student-1',
      completion_method: 'manual',
      completed_at: new Date().toISOString(),
    };
    vi.mocked(lessonCompletionService.getLessonCompletion).mockResolvedValue(completion);

    const { result } = renderHook(() => useLessonCompletion('lesson-1', 'student-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(completion);
    expect(result.current.error).toBeNull();
    expect(lessonCompletionService.getLessonCompletion).toHaveBeenCalledWith('lesson-1', 'student-1');
  });

  it('empty completion (null) is success, not an error', async () => {
    vi.mocked(lessonCompletionService.getLessonCompletion).mockResolvedValue(null);

    const { result } = renderHook(() => useLessonCompletion('lesson-1', 'student-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('propagates service failure as isError with no default data', async () => {
    vi.mocked(lessonCompletionService.getLessonCompletion).mockRejectedValue(
      new Error('service exploded')
    );

    const { result } = renderHook(() => useLessonCompletion('lesson-1', 'student-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('service exploded');
    expect(result.current.data).toBeUndefined();
  });

  it('does not query when ids are missing (disabled)', async () => {
    const { result } = renderHook(() => useLessonCompletion('', 'student-1'), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(lessonCompletionService.getLessonCompletion).not.toHaveBeenCalled();
  });
});

describe('useModuleCompletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns module completions on success', async () => {
    const completions = [
      { id: 'comp-1', lesson_id: 'lesson-1', student_id: 'student-1' },
      { id: 'comp-2', lesson_id: 'lesson-2', student_id: 'student-1' },
    ];
    vi.mocked(lessonCompletionService.getModuleCompletions).mockResolvedValue(completions as any);

    const { result } = renderHook(() => useModuleCompletions('module-1', 'student-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(completions);
  });

  it('propagates failure as isError instead of an empty list', async () => {
    vi.mocked(lessonCompletionService.getModuleCompletions).mockRejectedValue(
      new Error('completions fetch failed')
    );

    const { result } = renderHook(() => useModuleCompletions('module-1', 'student-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('completions fetch failed');
    expect(result.current.data).toBeUndefined();
  });
});

describe('useMarkLessonComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toasts success when a lesson is newly completed', async () => {
    vi.mocked(lessonCompletionService.markLessonComplete).mockResolvedValue({
      data: { id: 'comp-1' },
      alreadyCompleted: false,
    } as any);

    const { result } = renderHook(() => useMarkLessonComplete(), {
      wrapper: createHookWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ lessonId: 'lesson-1', studentId: 'student-1' });
    });

    expect(lessonCompletionService.markLessonComplete).toHaveBeenCalledWith(
      'lesson-1',
      'student-1',
      undefined
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Lesson marked as complete' })
    );
  });

  it('does not toast success when the lesson was already completed', async () => {
    vi.mocked(lessonCompletionService.markLessonComplete).mockResolvedValue({
      data: null,
      alreadyCompleted: true,
    } as any);

    const { result } = renderHook(() => useMarkLessonComplete(), {
      wrapper: createHookWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ lessonId: 'lesson-1', studentId: 'student-1' });
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('rejects and toasts destructive on failure', async () => {
    vi.mocked(lessonCompletionService.markLessonComplete).mockRejectedValue(
      new Error('insert failed')
    );

    const { result } = renderHook(() => useMarkLessonComplete(), {
      wrapper: createHookWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ lessonId: 'lesson-1', studentId: 'student-1' })
      ).rejects.toThrow('insert failed');
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'insert failed' })
    );
  });
});
