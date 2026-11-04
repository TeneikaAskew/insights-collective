// ABOUTME: useCourseRosterStats keeps the enrolled count but reports progress unknown (null).
// ABOUTME: The RPC averages enrollments.completion_status, which the app never writes (T-15).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: [{ course_id: 'c1', enrolled: 3, avg_progress: 0 }], error: null }),
  },
}));

import { useCourseRosterStats } from '../useCourseRosterStats';

describe('useCourseRosterStats', () => {
  it('never turns the RPC completion_status average into a progress value', async () => {
    const { result } = renderHook(() => useCourseRosterStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statsByCourse.c1).toEqual({ enrolled: 3, avgProgress: null });
  });
});
