// ABOUTME: Regression tests for useAdminUsers silent-failure fix.
// ABOUTME: A roles RPC failure must fail the fetch with an error, not render every user as 'student'.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminUsers } from '../useAdminUsers';
import {
  mockSupabaseClient,
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const profileRow = {
  id: 'user-1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  avatar_url: null,
  bio: '',
  created_at: '2026-01-01T00:00:00Z',
};

describe('useAdminUsers.fetchUsers', () => {
  beforeEach(() => {
    mockToast.mockClear();
    (mockSupabaseClient.rpc as any).mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1', roles: ['admin'] },
    } as any);
  });

  it('fails the fetch when the roles RPC errors instead of defaulting everyone to student', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [profileRow], error: null })
    );
    (mockSupabaseClient.rpc as any).mockResolvedValue(supabaseError('roles rpc failed'));

    const { result } = renderHook(() => useAdminUsers());

    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.users).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('uses canonical roles from the RPC on success', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [profileRow], error: null })
    );
    (mockSupabaseClient.rpc as any).mockResolvedValue({
      data: ['instructor'],
      error: null,
    });

    const { result } = renderHook(() => useAdminUsers());

    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].roles).toEqual(['instructor']);
  });

  it('defaults to student only when the RPC succeeds with no roles', async () => {
    const builder = getQueryBuilder();
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [profileRow], error: null })
    );
    (mockSupabaseClient.rpc as any).mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAdminUsers());

    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.users[0].roles).toEqual(['student']);
  });
});
