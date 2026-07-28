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
          page_path: '/resume',
          page_name: 'Resume Analyzer',
          visible_to_users: false,
          visible_to_instructors: false,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePageVisibility(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.loadError).toBe(false);
    expect(result.current.isPageVisible('/resume')).toBe(false);
    // Pages not present in the table still default to visible
    expect(result.current.isPageVisible('/unmanaged')).toBe(true);
  });

  it('hides an entire subtree when its governing section is hidden', async () => {
    getQueryBuilder().order.mockResolvedValue({
      data: [
        {
          id: '1',
          page_path: '/courses',
          page_name: 'Courses',
          visible_to_users: false,
          visible_to_instructors: false,
        },
        {
          id: '2',
          page_path: '/interview-prep',
          page_name: 'Interview Prep',
          visible_to_users: false,
          visible_to_instructors: true,
        },
        {
          id: '3',
          page_path: '/interview-prep/star-practice',
          page_name: 'STAR Practice',
          visible_to_users: true,
          visible_to_instructors: true,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePageVisibility(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    // Hidden /courses governs every nested course URL, including param routes
    expect(result.current.isPageVisible('/courses')).toBe(false);
    expect(result.current.isPageVisible('/courses/abc-123')).toBe(false);
    expect(result.current.isPageVisible('/courses/abc-123/learn/m1/i2')).toBe(false);
    // Aliases resolve to the governing section
    expect(result.current.isPageVisible('/course/abc-123')).toBe(false);

    // A visible child cannot escape a hidden parent (AND across the chain)
    expect(result.current.isPageVisible('/interview-prep/star-practice')).toBe(false);
  });

  it('applies instructor OR-visibility across the governing chain', async () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseAuth,
      user: { id: 'instructor-1', roles: ['instructor'] },
      isAuthenticated: true,
    } as any);
    getQueryBuilder().order.mockResolvedValue({
      data: [
        {
          id: '1',
          page_path: '/interview-prep',
          page_name: 'Interview Prep',
          visible_to_users: false,
          visible_to_instructors: true,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePageVisibility(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    // Instructor sees the section (and its subtree) via the instructor toggle
    expect(result.current.isPageVisible('/interview-prep')).toBe(true);
    expect(result.current.isPageVisible('/interview-prep/star-practice')).toBe(true);
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
