// ABOUTME: Regression tests for useUserProfile silent-failure fixes: a failed
// ABOUTME: roles RPC must surface through the error state instead of silently downgrading roles.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';

import { mockSupabaseClient, getQueryBuilder } from '@/test/mocks/supabase';
import { useUserProfile } from '../useUserProfile';

const testUser = {
  id: 'user-1',
  email: 'tester@example.com',
} as unknown as User;

describe('useUserProfile', () => {
  beforeEach(() => {
    mockSupabaseClient.rpc.mockReset();
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('resolves roles from the user_roles RPC on success with no error', async () => {
    getQueryBuilder().single.mockResolvedValue({
      data: { id: 'user-1', first_name: 'Test', last_name: 'User' },
      error: null,
    });
    mockSupabaseClient.rpc.mockResolvedValue({ data: ['admin', 'student'], error: null });

    const { result } = renderHook(() => useUserProfile(testUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.enrichedUser?.roles).toEqual(['admin', 'student']);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a roles RPC failure via error state while failing closed to default roles', async () => {
    getQueryBuilder().single.mockResolvedValue({
      data: { id: 'user-1', first_name: 'Test', last_name: 'User' },
      error: null,
    });
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc unavailable', code: 'PGRST000' },
    });

    const { result } = renderHook(() => useUserProfile(testUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Fail closed: default (lowest-privilege) roles, never a silent guess
    expect(result.current.enrichedUser?.roles).toEqual(['student']);
    // Previously error stayed null here — the downgrade was invisible
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Failed to load user roles');
  });

  it('sets error and a fallback user when the profile fetch fails hard', async () => {
    getQueryBuilder().single.mockResolvedValue({
      data: null,
      error: { message: 'connection refused', code: '500' },
    });

    const { result } = renderHook(() => useUserProfile(testUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.enrichedUser?.roles).toEqual(['student']);
    expect(result.current.enrichedUser?.name).toBe('tester');
  });

  it('clears a previous error on a subsequent successful load', async () => {
    getQueryBuilder().single.mockResolvedValue({
      data: { id: 'user-1', first_name: 'Test', last_name: 'User' },
      error: null,
    });
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc unavailable', code: 'PGRST000' },
    });

    const { result, rerender } = renderHook(({ user }) => useUserProfile(user), {
      initialProps: { user: testUser },
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Recovery: RPC works on the next load
    mockSupabaseClient.rpc.mockResolvedValue({ data: ['student'], error: null });
    rerender({ user: { ...testUser, id: 'user-1' } as unknown as User });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
