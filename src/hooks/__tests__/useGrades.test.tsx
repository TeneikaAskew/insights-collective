// ABOUTME: Unit tests for the useGrades React Query hooks.
// ABOUTME: Covers grade queries, upsert/bulk-update mutations, and the always-rejecting CSV import.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useGradesByCourse,
  useUpsertGrade,
  useBulkUpdateGrades,
  useImportGrades,
} from '../useGrades';
import { gradeService } from '@/services/gradeService';
import { createHookWrapper } from '@/test/utils/course-fixtures';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

// Mock every service method EXCEPT importGradesFromCSV, which keeps its real
// (hardened) implementation so the test proves the import path always rejects.
vi.mock('@/services/gradeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/gradeService')>();
  return {
    gradeService: {
      getGradesByCourse: vi.fn(),
      getStudentGrades: vi.fn(),
      calculateCourseGrade: vi.fn(),
      upsertGrade: vi.fn(),
      bulkUpdateGrades: vi.fn(),
      getCourseStatistics: vi.fn(),
      exportGradesToCSV: vi.fn(),
      importGradesFromCSV: actual.gradeService.importGradesFromCSV,
    },
  };
});

const makeGrade = (overrides: Record<string, unknown> = {}) => ({
  id: 'grade-1',
  course_id: 'course-1',
  student_id: 'student-1',
  assignment_id: 'assignment-1',
  points_earned: 90,
  points_possible: 100,
  percentage: 90,
  ...overrides,
});

describe('useGradesByCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grades on success', async () => {
    const grades = [makeGrade(), makeGrade({ id: 'grade-2', student_id: 'student-2' })];
    vi.mocked(gradeService.getGradesByCourse).mockResolvedValue(grades as any);

    const { result } = renderHook(() => useGradesByCourse('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(grades);
    expect(result.current.error).toBeNull();
    expect(gradeService.getGradesByCourse).toHaveBeenCalledWith('course-1');
  });

  it('returns an empty list when the course has no grades', async () => {
    vi.mocked(gradeService.getGradesByCourse).mockResolvedValue([] as any);

    const { result } = renderHook(() => useGradesByCourse('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets isError and leaves data undefined when the query fails', async () => {
    vi.mocked(gradeService.getGradesByCourse).mockRejectedValue(
      new Error('grades query failed')
    );

    const { result } = renderHook(() => useGradesByCourse('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('grades query failed');
    expect(result.current.data).toBeUndefined();
  });

  it('does not query when courseId is missing', async () => {
    const { result } = renderHook(() => useGradesByCourse(''), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(gradeService.getGradesByCourse).not.toHaveBeenCalled();
  });
});

describe('useUpsertGrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts a grade, toasts success and invalidates grade queries', async () => {
    vi.mocked(gradeService.getGradesByCourse).mockResolvedValue([] as any);
    vi.mocked(gradeService.upsertGrade).mockResolvedValue(makeGrade() as any);

    const { result } = renderHook(
      () => ({ list: useGradesByCourse('course-1'), upsert: useUpsertGrade() }),
      { wrapper: createHookWrapper() }
    );
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    act(() => {
      result.current.upsert.mutate({ course_id: 'course-1', points_earned: 90 } as any);
    });

    await waitFor(() => expect(result.current.upsert.isSuccess).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Grade updated successfully' })
    );
    // Invalidation of ['grades'] refetches the active course-grades query
    await waitFor(() => expect(gradeService.getGradesByCourse).toHaveBeenCalledTimes(2));
  });

  it('toasts the error message when the upsert fails', async () => {
    vi.mocked(gradeService.upsertGrade).mockRejectedValue(new Error('upsert failed'));

    const { result } = renderHook(() => useUpsertGrade(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate({ course_id: 'course-1' } as any);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'upsert failed',
        variant: 'destructive',
      })
    );
  });
});

describe('useBulkUpdateGrades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulk-updates grades and toasts success', async () => {
    vi.mocked(gradeService.bulkUpdateGrades).mockResolvedValue([makeGrade()] as any);

    const { result } = renderHook(() => useBulkUpdateGrades(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate([{ course_id: 'course-1' }] as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Grades updated successfully' })
    );
  });

  it('toasts the error message when the bulk update fails', async () => {
    vi.mocked(gradeService.bulkUpdateGrades).mockRejectedValue(new Error('bulk update failed'));

    const { result } = renderHook(() => useBulkUpdateGrades(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.mutate([{ course_id: 'course-1' }] as any);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'bulk update failed',
        variant: 'destructive',
      })
    );
  });
});

describe('useImportGrades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always rejects because grade CSV import is not available', async () => {
    vi.mocked(gradeService.getGradesByCourse).mockResolvedValue([] as any);

    const { result } = renderHook(
      () => ({ list: useGradesByCourse('course-1'), importGrades: useImportGrades() }),
      { wrapper: createHookWrapper() }
    );
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    act(() => {
      result.current.importGrades.mutate({
        courseId: 'course-1',
        csvData: 'student,grade\nstudent-1,90',
        graderId: 'grader-1',
      });
    });

    await waitFor(() => expect(result.current.importGrades.isError).toBe(true));

    expect(result.current.importGrades.error?.message).toBe(
      'Grade CSV import is not available: the grades table does not exist in the current schema'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description:
          'Grade CSV import is not available: the grades table does not exist in the current schema',
        variant: 'destructive',
      })
    );
    // No success toast and no invalidation-triggered refetch
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success' })
    );
    expect(gradeService.getGradesByCourse).toHaveBeenCalledTimes(1);
  });
});
