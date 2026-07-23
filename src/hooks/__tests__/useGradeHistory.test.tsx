// ABOUTME: Unit tests for the useGradeHistory React Query hooks.
// ABOUTME: Covers grade-history queries and submission-comment mutations.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useGradeHistory,
  useCourseGradeHistory,
  useSubmissionComments,
} from '../useGradeHistory';
import { gradeHistoryService } from '@/services/gradeHistoryService';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { toast } from 'sonner';

vi.mock('@/services/gradeHistoryService', () => ({
  gradeHistoryService: {
    getGradeHistory: vi.fn(),
    getStudentGradeHistory: vi.fn(),
    getCourseGradeHistory: vi.fn(),
    getSubmissionComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    getGradingSessions: vi.fn(),
    startGradingSession: vi.fn(),
    updateGradingSession: vi.fn(),
    endGradingSession: vi.fn(),
    getUnreadNotifications: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    getGradingStats: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const makeHistoryEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'history-1',
  grade_id: 'grade-1',
  previous_score: 80,
  new_score: 90,
  changed_by: 'grader-1',
  change_reason: 'Regrade',
  created_at: '2026-01-15T00:00:00Z',
  ...overrides,
});

const makeComment = (overrides: Record<string, unknown> = {}) => ({
  id: 'comment-1',
  submission_id: 'submission-1',
  submission_type: 'assignment',
  author_id: 'grader-1',
  comment: 'Good effort',
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  ...overrides,
});

describe('useGradeHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grade history on success', async () => {
    const entries = [makeHistoryEntry(), makeHistoryEntry({ id: 'history-2', new_score: 95 })];
    vi.mocked(gradeHistoryService.getGradeHistory).mockResolvedValue(entries as any);

    const { result } = renderHook(() => useGradeHistory('grade-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.history).toEqual(entries);
    expect(result.current.error).toBeNull();
    expect(gradeHistoryService.getGradeHistory).toHaveBeenCalledWith('grade-1');
  });

  it('returns an empty list when the grade has no history', async () => {
    vi.mocked(gradeHistoryService.getGradeHistory).mockResolvedValue([] as any);

    const { result } = renderHook(() => useGradeHistory('grade-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error and leaves data undefined when the query fails', async () => {
    vi.mocked(gradeHistoryService.getGradeHistory).mockRejectedValue(
      new Error('history query failed')
    );

    const { result } = renderHook(() => useGradeHistory('grade-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect((result.current.error as Error).message).toBe('history query failed');
    expect(result.current.history).toBeUndefined();
  });

  it('does not query when gradeId is missing', async () => {
    const { result } = renderHook(() => useGradeHistory(undefined), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.history).toBeUndefined();
    expect(gradeHistoryService.getGradeHistory).not.toHaveBeenCalled();
  });
});

describe('useCourseGradeHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns course grade history with the requested limit', async () => {
    const entries = [makeHistoryEntry()];
    vi.mocked(gradeHistoryService.getCourseGradeHistory).mockResolvedValue(entries as any);

    const { result } = renderHook(() => useCourseGradeHistory('course-1', 10), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.history).toEqual(entries);
    expect(gradeHistoryService.getCourseGradeHistory).toHaveBeenCalledWith('course-1', 10);
  });

  it('sets error and leaves data undefined when the query fails', async () => {
    vi.mocked(gradeHistoryService.getCourseGradeHistory).mockRejectedValue(
      new Error('course history failed')
    );

    const { result } = renderHook(() => useCourseGradeHistory('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect((result.current.error as Error).message).toBe('course history failed');
    expect(result.current.history).toBeUndefined();
  });
});

describe('useSubmissionComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns comments on success', async () => {
    const comments = [makeComment()];
    vi.mocked(gradeHistoryService.getSubmissionComments).mockResolvedValue(comments as any);

    const { result } = renderHook(
      () => useSubmissionComments('submission-1', 'assignment'),
      { wrapper: createHookWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.comments).toEqual(comments);
    expect(result.current.error).toBeNull();
    expect(gradeHistoryService.getSubmissionComments).toHaveBeenCalledWith(
      'submission-1',
      'assignment'
    );
  });

  it('creates a comment, toasts success and invalidates the comments query', async () => {
    vi.mocked(gradeHistoryService.getSubmissionComments).mockResolvedValue([] as any);
    vi.mocked(gradeHistoryService.createComment).mockResolvedValue(makeComment() as any);

    const { result } = renderHook(
      () => useSubmissionComments('submission-1', 'assignment'),
      { wrapper: createHookWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createComment({
        submission_id: 'submission-1',
        submission_type: 'assignment',
        author_id: 'grader-1',
        comment: 'Good effort',
      } as any);
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Comment added successfully')
    );
    await waitFor(() =>
      expect(gradeHistoryService.getSubmissionComments).toHaveBeenCalledTimes(2)
    );
  });

  it('toasts an error when creating a comment fails', async () => {
    vi.mocked(gradeHistoryService.getSubmissionComments).mockResolvedValue([] as any);
    vi.mocked(gradeHistoryService.createComment).mockRejectedValue(new Error('insert failed'));

    const { result } = renderHook(
      () => useSubmissionComments('submission-1', 'assignment'),
      { wrapper: createHookWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createComment({
        submission_id: 'submission-1',
        submission_type: 'assignment',
        author_id: 'grader-1',
        comment: 'Good effort',
      } as any);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to add comment')
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(gradeHistoryService.getSubmissionComments).toHaveBeenCalledTimes(1);
  });
});
