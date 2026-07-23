// ABOUTME: Unit tests for the useRubrics React Query hook.
// ABOUTME: Covers query success/empty/error and create/update/delete mutations.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRubrics } from '../useRubrics';
import { rubricService } from '@/services/rubricService';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { toast } from 'sonner';

vi.mock('@/services/rubricService', () => ({
  rubricService: {
    getRubricsByCourse: vi.fn(),
    getRubric: vi.fn(),
    createRubric: vi.fn(),
    updateRubric: vi.fn(),
    deleteRubric: vi.fn(),
    createCriteria: vi.fn(),
    updateCriteria: vi.fn(),
    deleteCriteria: vi.fn(),
    reorderCriteria: vi.fn(),
    getRubricsForAssignment: vi.fn(),
    attachRubricToAssignment: vi.fn(),
    detachRubricFromAssignment: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const makeRubric = (overrides: Record<string, unknown> = {}) => ({
  id: 'rubric-1',
  course_id: 'course-1',
  title: 'Essay rubric',
  description: 'Rubric for grading essays',
  points_possible: 100,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('useRubrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rubrics on success', async () => {
    const rubrics = [makeRubric(), makeRubric({ id: 'rubric-2', title: 'Lab rubric' })];
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue(rubrics as any);

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rubrics).toEqual(rubrics);
    expect(result.current.error).toBeNull();
    expect(rubricService.getRubricsByCourse).toHaveBeenCalledWith('course-1');
  });

  it('returns an empty list when the course has no rubrics', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([] as any);

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rubrics).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error and leaves data undefined when the query fails', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockRejectedValue(
      new Error('rubrics query failed')
    );

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect((result.current.error as Error).message).toBe('rubrics query failed');
    expect(result.current.rubrics).toBeUndefined();
  });

  it('does not query when courseId is missing', async () => {
    const { result } = renderHook(() => useRubrics(undefined), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.rubrics).toBeUndefined();
    expect(rubricService.getRubricsByCourse).not.toHaveBeenCalled();
  });

  it('creates a rubric, toasts success and invalidates the list', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([] as any);
    vi.mocked(rubricService.createRubric).mockResolvedValue(makeRubric() as any);

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createRubric({ course_id: 'course-1', title: 'Essay rubric' } as any);
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Rubric created successfully')
    );
    await waitFor(() =>
      expect(rubricService.getRubricsByCourse).toHaveBeenCalledTimes(2)
    );
  });

  it('toasts an error when creating a rubric fails', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([] as any);
    vi.mocked(rubricService.createRubric).mockRejectedValue(new Error('insert failed'));

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createRubric({ course_id: 'course-1', title: 'Essay rubric' } as any);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to create rubric')
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(rubricService.getRubricsByCourse).toHaveBeenCalledTimes(1);
  });

  it('updates a rubric and toasts success', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([makeRubric()] as any);
    vi.mocked(rubricService.updateRubric).mockResolvedValue(makeRubric({ title: 'Renamed' }) as any);

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateRubric({ id: 'rubric-1', updates: { title: 'Renamed' } });
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Rubric updated successfully')
    );
    expect(rubricService.updateRubric).toHaveBeenCalledWith('rubric-1', { title: 'Renamed' });
  });

  it('toasts an error when updating a rubric fails', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([makeRubric()] as any);
    vi.mocked(rubricService.updateRubric).mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateRubric({ id: 'rubric-1', updates: { title: 'Renamed' } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to update rubric')
    );
  });

  it('deletes a rubric and toasts success', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([makeRubric()] as any);
    vi.mocked(rubricService.deleteRubric).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.deleteRubric('rubric-1');
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Rubric deleted successfully')
    );
    expect(rubricService.deleteRubric).toHaveBeenCalledWith('rubric-1');
  });

  it('toasts an error when deleting a rubric fails', async () => {
    vi.mocked(rubricService.getRubricsByCourse).mockResolvedValue([makeRubric()] as any);
    vi.mocked(rubricService.deleteRubric).mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useRubrics('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.deleteRubric('rubric-1');
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to delete rubric')
    );
  });
});
