// ABOUTME: Regression tests for usePortfolioPages silent-failure fix.
// ABOUTME: A failed display-order lookup must reject the add-project mutation instead of inserting with a guessed order.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePortfolioPages } from '../usePortfolioPages';
import {
  mockSupabaseClient,
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { createHookWrapper } from '@/test/utils/course-fixtures';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('usePortfolioPages.addProjectToPortfolio', () => {
  beforeEach(() => {
    mockToast.mockClear();
    (mockSupabaseClient.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('rejects and does not insert when the display-order lookup fails', async () => {
    const builder = getQueryBuilder();
    // The pages list query and the display-order lookup both resolve through
    // `then`; failing both keeps the test focused on error propagation.
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve(supabaseError('order lookup failed'))
    );

    const { result } = renderHook(() => usePortfolioPages(), {
      wrapper: createHookWrapper(),
    });

    await expect(
      result.current.addProjectToPortfolio.mutateAsync({
        portfolioPageId: 'page-1',
        projectId: 'project-1',
      })
    ).rejects.toMatchObject({ message: 'order lookup failed' });

    expect(builder.insert).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      )
    );
  });

  it('inserts with the next display order when the lookup succeeds', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [{ display_order: 4 }], error: null })
    );
    builder.single.mockResolvedValue({
      data: { id: 'ppp-1', display_order: 5 },
      error: null,
    });

    const { result } = renderHook(() => usePortfolioPages(), {
      wrapper: createHookWrapper(),
    });

    await result.current.addProjectToPortfolio.mutateAsync({
      portfolioPageId: 'page-1',
      projectId: 'project-1',
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 5 })
    );
  });
});
