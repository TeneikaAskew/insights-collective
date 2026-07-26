// ABOUTME: Regression tests for useAdminUsers role loading.
// ABOUTME: Roles are loaded in one batched user_roles query; a failure must
// ABOUTME: fail the fetch with an error, not render every user as 'student'.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminUsers } from '../useAdminUsers';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
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

// Chainable builder that resolves (via await / .then) to `result`.
function makeBuilder(result: any) {
  const builder: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

// Wire `from()` to return a distinct builder per table.
function wireTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    if (!(table in tables)) {
      throw new Error(`Unexpected table in test: ${table}`);
    }
    return tables[table];
  });
}

describe('useAdminUsers.fetchUsers', () => {
  beforeEach(() => {
    mockToast.mockClear();
    (mockSupabaseClient.from as any).mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1', roles: ['admin'] },
    } as any);
  });

  it('fails the fetch when the roles query errors instead of defaulting everyone to student', async () => {
    wireTables({
      profiles: makeBuilder({ data: [profileRow], error: null }),
      user_roles: makeBuilder(supabaseError('roles query failed')),
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

  it('uses canonical roles from user_roles on success', async () => {
    wireTables({
      profiles: makeBuilder({ data: [profileRow], error: null }),
      user_roles: makeBuilder({
        data: [{ user_id: 'user-1', role: 'instructor' }],
        error: null,
      }),
    });

    const { result } = renderHook(() => useAdminUsers());

    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].roles).toEqual(['instructor']);
  });

  it('defaults to student only when a user has no user_roles rows', async () => {
    wireTables({
      profiles: makeBuilder({ data: [profileRow], error: null }),
      user_roles: makeBuilder({ data: [], error: null }),
    });

    const { result } = renderHook(() => useAdminUsers());

    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.users[0].roles).toEqual(['student']);
  });
});
