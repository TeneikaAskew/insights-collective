// ABOUTME: Unit tests for the useQuestionBanks React Query hook.
// ABOUTME: Covers query success/empty/error and bank mutations with toast + invalidation.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useQuestionBanks } from '../useQuestionBanks';
import { questionBankService } from '@/services/questionBankService';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { toast } from 'sonner';

vi.mock('@/services/questionBankService', () => ({
  questionBankService: {
    getQuestionBanks: vi.fn(),
    createQuestionBank: vi.fn(),
    updateQuestionBank: vi.fn(),
    deleteQuestionBank: vi.fn(),
    getQuestions: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    bulkCreateQuestions: vi.fn(),
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getQuizQuestionPools: vi.fn(),
    createQuestionPool: vi.fn(),
    updateQuestionPool: vi.fn(),
    deleteQuestionPool: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const makeBank = (overrides: Record<string, unknown> = {}) => ({
  id: 'bank-1',
  course_id: 'course-1',
  title: 'Midterm bank',
  description: 'Questions for the midterm',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('useQuestionBanks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns question banks on success', async () => {
    const banks = [makeBank(), makeBank({ id: 'bank-2', title: 'Final bank' })];
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue(banks as any);

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.banks).toEqual(banks);
    expect(result.current.error).toBeNull();
    expect(questionBankService.getQuestionBanks).toHaveBeenCalledWith('course-1');
  });

  it('returns an empty list when the course has no banks', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([] as any);

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.banks).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error and leaves data undefined when the query fails', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockRejectedValue(
      new Error('banks query failed')
    );

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect((result.current.error as Error).message).toBe('banks query failed');
    expect(result.current.banks).toBeUndefined();
  });

  it('does not query when courseId is missing', async () => {
    const { result } = renderHook(() => useQuestionBanks(undefined), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.banks).toBeUndefined();
    expect(questionBankService.getQuestionBanks).not.toHaveBeenCalled();
  });

  it('creates a bank, toasts success and invalidates the list', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([makeBank()] as any);
    vi.mocked(questionBankService.createQuestionBank).mockResolvedValue(makeBank({ id: 'bank-new' }) as any);

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createBank({ course_id: 'course-1', title: 'New bank' } as any);
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Question bank created successfully')
    );
    // Invalidation refetches the active query
    await waitFor(() =>
      expect(questionBankService.getQuestionBanks).toHaveBeenCalledTimes(2)
    );
  });

  it('toasts an error when creating a bank fails', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([] as any);
    vi.mocked(questionBankService.createQuestionBank).mockRejectedValue(new Error('insert failed'));

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createBank({ course_id: 'course-1', title: 'New bank' } as any);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to create question bank')
    );
    expect(toast.success).not.toHaveBeenCalled();
    // No invalidation on failure
    expect(questionBankService.getQuestionBanks).toHaveBeenCalledTimes(1);
  });

  it('updates a bank and toasts success', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([makeBank()] as any);
    vi.mocked(questionBankService.updateQuestionBank).mockResolvedValue(
      makeBank({ title: 'Renamed' }) as any
    );

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateBank({ id: 'bank-1', updates: { title: 'Renamed' } });
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Question bank updated successfully')
    );
    expect(questionBankService.updateQuestionBank).toHaveBeenCalledWith('bank-1', { title: 'Renamed' });
  });

  it('toasts an error when updating a bank fails', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([makeBank()] as any);
    vi.mocked(questionBankService.updateQuestionBank).mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateBank({ id: 'bank-1', updates: { title: 'Renamed' } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to update question bank')
    );
  });

  it('deletes a bank and toasts success', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([makeBank()] as any);
    vi.mocked(questionBankService.deleteQuestionBank).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.deleteBank('bank-1');
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Question bank deleted successfully')
    );
    expect(questionBankService.deleteQuestionBank).toHaveBeenCalledWith('bank-1');
  });

  it('toasts an error when deleting a bank fails', async () => {
    vi.mocked(questionBankService.getQuestionBanks).mockResolvedValue([makeBank()] as any);
    vi.mocked(questionBankService.deleteQuestionBank).mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useQuestionBanks('course-1'), {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.deleteBank('bank-1');
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to delete question bank')
    );
  });
});
