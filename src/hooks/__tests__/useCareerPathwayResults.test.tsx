// ABOUTME: Regression tests for useCareerPathwayResults silent-failure fixes.
// ABOUTME: Query errors and corrupted reports must error out — never fall back to the "not completed" default report.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCareerPathwayResults } from '../useCareerPathwayResults';
import {
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { createHookWrapper } from '@/test/utils/course-fixtures';
import { useAuth } from '@/contexts/AuthContext';
import { parseCareerReport } from '@/components/assistants/utils/CareerReportParser';

vi.mock('@/components/assistants/utils/CareerReportParser', () => ({
  parseCareerReport: vi.fn(),
}));

describe('useCareerPathwayResults', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    vi.mocked(parseCareerReport).mockReset();
  });

  it('errors on query failure instead of returning the default "not completed" report', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue(supabaseError('results fetch failed'));

    const { result } = renderHook(() => useCareerPathwayResults(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('errors when the stored report cannot be parsed (corrupted data is not "no data")', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({
      data: { report: 'garbage', action_plan: null },
      error: null,
    });
    vi.mocked(parseCareerReport).mockImplementation(() => {
      throw new Error('unparseable report');
    });

    const { result } = renderHook(() => useCareerPathwayResults(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('returns the parsed report and action plan on success', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({
      data: { report: 'raw report', action_plan: { '6_weeks': [] } },
      error: null,
    });
    vi.mocked(parseCareerReport).mockReturnValue({ userName: 'Ada' } as any);

    const { result } = renderHook(() => useCareerPathwayResults(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.report).toEqual({ userName: 'Ada' });
    expect(result.current.data?.actionPlan).toEqual({ '6_weeks': [] });
  });

  it('returns the empty default structure only when there is genuinely no row', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useCareerPathwayResults(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.report.summary).toBe(
      "You haven't completed your career assessment yet."
    );
    expect(result.current.data?.actionPlan).toBeNull();
  });
});
