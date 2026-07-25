// ABOUTME: Regression tests for usePortfolio recommendations silent-failure fix.
// ABOUTME: A portfolio-table query failure must surface via recommendationsError, not read as "no recommendations".

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePortfolio } from '../usePortfolio';
import {
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { useAuth } from '@/contexts/AuthContext';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('usePortfolio previousRecommendations', () => {
  beforeEach(() => {
    mockToast.mockClear();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    (localStorage.getItem as any).mockReturnValue(null);
  });

  it('surfaces a recommendations query failure instead of silently returning null', async () => {
    const builder = getQueryBuilder();
    // portfolio/resumes/career_pathway_results all end in .maybeSingle();
    // injecting the error here fails the recommendations query.
    builder.maybeSingle.mockResolvedValue(supabaseError('portfolio fetch failed'));
    // projects list query resolves through `then`
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null })
    );

    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.recommendationsError).toBeTruthy());
    expect(result.current.previousRecommendations).toBeUndefined();
  });

  it('returns stored recommendations from the portfolio table on success', async () => {
    const recommendations = { projectIdeas: [{ title: 'Build a dashboard' }] };
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({
      data: { recommendations },
      error: null,
    });
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null })
    );

    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() =>
      expect(result.current.previousRecommendations).toEqual(recommendations)
    );
    expect(result.current.recommendationsError).toBeNull();
  });

  it('returns null recommendations when the user genuinely has none', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null })
    );

    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.recommendationsLoading).toBe(false));
    expect(result.current.previousRecommendations).toBeNull();
    expect(result.current.recommendationsError).toBeNull();
  });
});
