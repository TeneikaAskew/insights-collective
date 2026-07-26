import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as null | { id: string },
  session: null as null | Record<string, unknown>,   // must satisfy validateSessionIntegrity
  loading: true,
  storeRedirectPath: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/AuthContext')>();
  return { ...actual, useAuth: () => authState };
});

vi.mock('@/utils/securityUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/securityUtils')>();
  return { ...actual, logSecurityEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

/** Shape validateSessionIntegrity accepts: user id + access token, unexpired. */
const SESSION = { access_token: 'token', user: { id: 'admin-1' }, expires_at: 4102444800 };

const renderAt = (path = '/admin/courses') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/courses"
          element={<ProtectedRoute requireAdmin><div>ADMIN CONTENT</div></ProtectedRoute>}
        />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  authState.isAuthenticated = false;
  authState.user = null;
  authState.session = null;
  authState.loading = true;
  authState.storeRedirectPath = vi.fn();
  mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: true, error: null });
});

describe('ProtectedRoute requireAdmin', () => {
  /**
   * The session restores before the enriched profile does, so isAuthenticated
   * is false for a moment while a session already exists. Concluding "not an
   * admin" in that gap redirected real admins away from every /admin route —
   * and logged them as an unauthorized access attempt — before the
   * has_admin_access RPC could reply.
   */
  it('waits instead of redirecting while the profile loads behind a live session', async () => {
    authState.session = SESSION;
    authState.loading = true;
    const { rerender } = renderAt();

    // Mid-load: no verdict yet, so neither the content nor a redirect.
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
    expect(screen.queryByText('ADMIN CONTENT')).not.toBeInTheDocument();

    // Profile arrives and the user really is an admin.
    authState.isAuthenticated = true;
    authState.user = { id: 'admin-1' };
    authState.loading = false;
    rerender(
      <MemoryRouter initialEntries={['/admin/courses']}>
        <Routes>
          <Route
            path="/admin/courses"
            element={<ProtectedRoute requireAdmin><div>ADMIN CONTENT</div></ProtectedRoute>}
          />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument());
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('lets an admin through once has_admin_access confirms it', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'admin-1' };
    authState.session = SESSION;
    authState.loading = false;
    renderAt();

    await waitFor(() => expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument());
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('has_admin_access', { user_id_param: 'admin-1' });
  });

  it('still redirects a signed-in non-admin away', async () => {
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    authState.isAuthenticated = true;
    authState.user = { id: 'member-1' };
    authState.session = SESSION;
    authState.loading = false;
    renderAt();

    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    expect(screen.queryByText('ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('treats a failed admin check as denial rather than access', async () => {
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    authState.isAuthenticated = true;
    authState.user = { id: 'member-1' };
    authState.session = SESSION;
    authState.loading = false;
    renderAt();

    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
  });
});
