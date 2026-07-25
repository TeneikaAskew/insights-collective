// ABOUTME: Regression tests for PageVisibilityContext silent-failure fixes:
// ABOUTME: fetch failures must fail CLOSED (not default-visible) and sync must report honest counts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

import {
  mockSupabaseClient,
  getQueryBuilder,
  supabaseError,
} from '@/test/mocks/supabase';

// The global setup mocks @/contexts/AuthContext; grab the mocked useAuth so
// individual tests can control the current user/roles.
import { useAuth } from '@/contexts/AuthContext';

// vi.hoisted so the spy exists when the hoisted vi.mock factory runs
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
  toast: toastSpy,
}));

import { PageVisibilityProvider, usePageVisibility } from '../PageVisibilityContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PageVisibilityProvider>{children}</PageVisibilityProvider>
);

const baseAuth = {
  user: null as any,
  session: null,
  loading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  googleSignIn: vi.fn(),
  githubSignIn: vi.fn(),
  twitterSignIn: vi.fn(),
  isAuthenticated: false,
  isAdmin: false,
  isAdminAuthenticated: false,
  storeRedirectPath: vi.fn(),
  handleRedirectAfterLogin: vi.fn(),
};

describe('PageVisibilityContext', () => {
  beforeEach(() => {
    toastSpy.mockClear();
    vi.mocked(useAuth).mockReturnValue({ ...baseAuth } as any);
  });

  it('fails CLOSED for non-admins when the visibility fetch errors', async () => {
    getQueryBuilder().order.mockResolvedValue(supabaseError('db unavailable'));

    const { result } = renderHook(() => usePageVisibility(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.loadError).toBe(true);
    // Previously this returned true (fail-open) because the list was empty
    expect(result.current.isPageVisible('/admin/users')).toBe(false);
    expect(result.current.isPageVisible('/any-page')).toBe(false);
    // The failure must be surfaced, not silent
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('keeps normal visibility rules when the fetch succeeds', async () => {
    getQueryBuilder().order.mockResolvedValue({
      data: [
        {
          id: '1',
          page_path: '/gated',
          page_name: 'Gated',
          visible_to_users: false,
          visible_to_instructors: false,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePageVisibility(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.loadError).toBe(false);
    expect(result.current.isPageVisible('/gated')).toBe(false);
    // Pages not present in the table still default to visible
    expect(result.current.isPageVisible('/unmanaged')).toBe(true);
  });

  it('still shows everything to admins even when the fetch errors', async () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseAuth,
      user: { id: 'admin-1', roles: ['admin', 'student'] },
      isAuthenticated: true,
      isAdmin: true,
    } as any);
    getQueryBuilder().order.mockResolvedValue(supabaseError('db unavailable'));

    const { result } = renderHook(() => usePageVisibility(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isPageVisible('/admin/users')).toBe(true);
  });

  it('reports an honest failure when every page upsert fails during sync', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [], error: null });
    builder.upsert.mockResolvedValue(supabaseError('insert denied'));

    const { result } = renderHook(() => usePageVisibility(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    toastSpy.mockClear();

    await act(async () => {
      await result.current.syncAvailablePages();
    });

    // Previously this toasted "Pages synced successfully" even when every
    // upsert failed. It must now report the failure.
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Page sync failed',
        variant: 'destructive',
      })
    );
    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pages synced successfully' })
    );
  });
});
