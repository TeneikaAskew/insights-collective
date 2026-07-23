// ABOUTME: Unit tests for the useCoursePermissions hook (RPC-based role checks).
// ABOUTME: Covers admin, instructor, plain-user, and fail-closed error handling paths.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCoursePermissions } from '../useCoursePermissions';
import { useAuth } from '@/contexts/AuthContext';
import {
  mockSupabaseClient,
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';

const COURSE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USER = { id: 'user-1', email: 'ada@example.com' };

// Route each named RPC to its response; anything unlisted (e.g.
// log_security_event) resolves harmlessly.
function stubRpc(responses: Record<string, { data: unknown; error: unknown }>) {
  (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockImplementation(
    async (fnName: string) =>
      responses[fnName] ?? { data: null, error: null }
  );
}

function stubProfile(result: unknown) {
  getQueryBuilder().single.mockResolvedValue(result);
}

describe('useCoursePermissions', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: USER } as any);
    (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValue({ data: null, error: null });
    // Default: a plain-user profile row exists.
    stubProfile({ data: { roles: ['user'] }, error: null });
  });

  it('grants edit access to an admin via the has_admin_access RPC', async () => {
    stubRpc({
      has_admin_access: { data: true, error: null },
      is_course_instructor: { data: false, error: null },
    });

    const { result } = renderHook(() => useCoursePermissions(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isInstructor).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('grants edit access to the instructor of the course', async () => {
    stubRpc({
      has_admin_access: { data: false, error: null },
      is_course_instructor: { data: true, error: null },
    });

    const { result } = renderHook(() => useCoursePermissions(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(true);
    expect(result.current.isInstructor).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('denies edit access to a plain enrolled user', async () => {
    stubRpc({
      has_admin_access: { data: false, error: null },
      is_course_instructor: { data: false, error: null },
    });

    const { result } = renderHook(() => useCoursePermissions(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isInstructor).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fails closed (canEdit false) and surfaces the error when an RPC fails', async () => {
    stubRpc({
      has_admin_access: { data: null, error: { message: 'rpc exploded' } },
    });

    const { result } = renderHook(() => useCoursePermissions(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(false);
    expect(result.current.error).toBe('rpc exploded');
    // The failed attempt is logged as a security event.
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'log_security_event',
      expect.objectContaining({ p_event_type: 'course_access_denied' })
    );
  });

  it('fails closed when the profile query fails (regression)', async () => {
    stubProfile(supabaseError('profile fetch failed'));
    stubRpc({
      has_admin_access: { data: true, error: null },
      is_course_instructor: { data: true, error: null },
    });

    const { result } = renderHook(() => useCoursePermissions(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(false);
    expect(result.current.error).toBe('profile fetch failed');
  });

  it('denies access without a logged-in user and never queries', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useCoursePermissions(COURSE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(false);
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('rejects an invalid course id format without querying', async () => {
    const { result } = renderHook(() => useCoursePermissions('not-a-uuid'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(false);
    expect(result.current.error).toBe('Invalid course ID format');
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });
});
