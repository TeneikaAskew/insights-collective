// ABOUTME: Unit tests for the useAssignments React Query hooks.
// ABOUTME: Covers the assignments query and create/update/grade mutation paths.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useAssignments,
  useCreateAssignment,
  useUpdateAssignment,
  useGradeSubmission,
} from '../useAssignments';
import { assignmentService } from '@/services/assignmentService';
import { createHookWrapper } from '@/test/utils/course-fixtures';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

vi.mock('@/services/assignmentService', () => ({
  assignmentService: {
    getAssignmentsByCourse: vi.fn(),
    getAssignment: vi.fn(),
    createAssignment: vi.fn(),
    updateAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    getSubmission: vi.fn(),
    getSubmissionsByAssignment: vi.fn(),
    submitAssignment: vi.fn(),
    gradeSubmission: vi.fn(),
    createRubric: vi.fn(),
    attachRubricToAssignment: vi.fn(),
  },
}));

const makeAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 'assignment-1',
  course_id: 'course-1',
  title: 'Essay 1',
  description: 'Write an essay',
  points_possible: 100,
  due_at: '2026-02-01T00:00:00Z',
  ...overrides,
});

describe('useAssignments (query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns assignments on success', async () => {
    const assignments = [makeAssignment(), makeAssignment({ id: 'assignment-2' })];
    vi.mocked(assignmentService.getAssignmentsByCourse).mockResolvedValue(assignments as any);

    const { result } = renderHook(() => useAssignments('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(assignments);
    expect(result.current.error).toBeNull();
    expect(assignmentService.getAssignmentsByCourse).toHaveBeenCalledWith('course-1');
  });

  it('returns an empty list when the course has no assignments', async () => {
    vi.mocked(assignmentService.getAssignmentsByCourse).mockResolvedValue([] as any);

    const { result } = renderHook(() => useAssignments('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets isError and leaves data undefined when the query fails', async () => {
    vi.mocked(assignmentService.getAssignmentsByCourse).mockRejectedValue(
      new Error('assignments query failed')
    );

    const { result } = renderHook(() => useAssignments('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('assignments query failed');
    expect(result.current.data).toBeUndefined();
  });

  it('does not query when courseId is missing', async () => {
    const { result } = renderHook(() => useAssignments(undefined), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(assignmentService.getAssignmentsByCourse).not.toHaveBeenCalled();
  });
});

describe('useCreateAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an assignment, toasts success and invalidates the list', async () => {
    vi.mocked(assignmentService.getAssignmentsByCourse).mockResolvedValue([] as any);
    vi.mocked(assignmentService.createAssignment).mockResolvedValue(makeAssignment() as any);

    const wrapper = createHookWrapper();
    const { result } = renderHook(
      () => ({ list: useAssignments('course-1'), create: useCreateAssignment() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    act(() => {
      result.current.create.mutate({ title: 'Essay 1' });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Assignment created successfully' })
    );
    // Invalidation of ['assignments'] refetches the active list query
    await waitFor(() =>
      expect(assignmentService.getAssignmentsByCourse).toHaveBeenCalledTimes(2)
    );
  });

  it('toasts the error message when creation fails', async () => {
    vi.mocked(assignmentService.createAssignment).mockRejectedValue(new Error('insert failed'));

    const { result } = renderHook(() => useCreateAssignment(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate({ title: 'Essay 1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'insert failed',
        variant: 'destructive',
      })
    );
  });
});

describe('useUpdateAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an assignment and toasts success', async () => {
    vi.mocked(assignmentService.updateAssignment).mockResolvedValue(
      makeAssignment({ title: 'Renamed' }) as any
    );

    const { result } = renderHook(() => useUpdateAssignment(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate({ id: 'assignment-1', updates: { title: 'Renamed' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignmentService.updateAssignment).toHaveBeenCalledWith('assignment-1', {
      title: 'Renamed',
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Assignment updated successfully' })
    );
  });

  it('toasts the error message when the update fails', async () => {
    vi.mocked(assignmentService.updateAssignment).mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useUpdateAssignment(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate({ id: 'assignment-1', updates: { title: 'Renamed' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'update failed',
        variant: 'destructive',
      })
    );
  });
});

describe('useGradeSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grades a submission and toasts success', async () => {
    vi.mocked(assignmentService.gradeSubmission).mockResolvedValue({
      id: 'submission-1',
      grade: 95,
    } as any);

    const { result } = renderHook(() => useGradeSubmission(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate({
        submissionId: 'submission-1',
        grade: 95,
        feedback: 'Nice work',
        graderId: 'grader-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignmentService.gradeSubmission).toHaveBeenCalledWith(
      'submission-1',
      95,
      'Nice work',
      'grader-1'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Assignment graded successfully' })
    );
  });

  it('toasts the error message when grading fails', async () => {
    vi.mocked(assignmentService.gradeSubmission).mockRejectedValue(new Error('grading failed'));

    const { result } = renderHook(() => useGradeSubmission(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate({
        submissionId: 'submission-1',
        grade: 95,
        feedback: null,
        graderId: 'grader-1',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'grading failed',
        variant: 'destructive',
      })
    );
  });
});
