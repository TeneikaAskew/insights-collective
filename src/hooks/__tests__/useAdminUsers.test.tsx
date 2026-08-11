// ABOUTME: Tests for useAdminUsers server-side search/pagination.
// ABOUTME: Roles come from search_admin_users; a failure fails the fetch with
// ABOUTME: an error rather than rendering everyone as 'student'.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminUsers } from '../useAdminUsers';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const userRow = {
  id: 'user-1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
};

const countsRow = { total: 1, students: 1, instructors: 0, admins: 0 };

// Route rpc(name) calls to per-function results.
function wireRpc(results: Record<string, any>) {
  (mockSupabaseClient.rpc as any).mockImplementation((fn: string) =>
    Promise.resolve(results[fn] ?? { data: null, error: null })
  );
}

describe('useAdminUsers.fetchUsers', () => {
  beforeEach(() => {
    mockToast.mockClear();
    (mockSupabaseClient.rpc as any).mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1', roles: ['admin'] },
    } as any);
  });

  it('fails the fetch when the search RPC errors instead of defaulting everyone to student', async () => {
    wireRpc({
      search_admin_users: supabaseError('search failed'),
      admin_user_role_counts: { data: [countsRow], error: null },
    });

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

  it('maps roles and total from the search RPC on success', async () => {
    wireRpc({
      search_admin_users: {
        data: [{ ...userRow, roles: ['instructor'], total_count: 1 }],
        error: null,
      },
      admin_user_role_counts: { data: [{ total: 1, students: 1, instructors: 1, admins: 0 }], error: null },
    });

    const { result } = renderHook(() => useAdminUsers());
    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].roles).toEqual(['instructor']);
    expect(result.current.total).toBe(1);
    expect(result.current.counts.instructors).toBe(1);
  });

  it('defaults to student when a returned user has no roles', async () => {
    wireRpc({
      search_admin_users: {
        data: [{ ...userRow, roles: [], total_count: 1 }],
        error: null,
      },
      admin_user_role_counts: { data: [countsRow], error: null },
    });

    const { result } = renderHook(() => useAdminUsers());
    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.users[0].roles).toEqual(['student']);
  });
});
