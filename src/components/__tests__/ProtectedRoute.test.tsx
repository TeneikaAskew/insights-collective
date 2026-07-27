import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as null | { id: string; roles?: string[] },
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

  it('does not re-check admin access when the session object is replaced by a token refresh', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'admin-1' };
    authState.session = SESSION;
    authState.loading = false;
    const { rerender } = renderAt();

    await waitFor(() => expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument());
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);

    // Supabase emits TOKEN_REFRESHED and useAuthProvider stores a brand-new
    // session object. Nothing about the user or the route changed, so this must
    // not repeat the RPC or write another security-audit entry.
    authState.session = { ...SESSION, access_token: 'refreshed' };
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
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
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

/**
 * `allowInstructor` is additive: it must widen ONLY the routes that opt in.
 * The database already grants instructors CRUD over their own blog posts, so
 * the routing gate was the thing keeping them out — but a plain `requireAdmin`
 * route must be entirely unaffected.
 */
describe('ProtectedRoute allowInstructor', () => {
  const renderWithInstructorAllowed = () =>
    render(
      <MemoryRouter initialEntries={['/admin/blog']}>
        <Routes>
          <Route
            path="/admin/blog"
            element={
              <ProtectedRoute requireAdmin allowInstructor>
                <div>BLOG ADMIN CONTENT</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          <Route path="/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );

  function signedInAs(roles: string[]) {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', roles };
    authState.session = SESSION;
    authState.loading = false;
  }

  it('admits an instructor on a route that opts in', async () => {
    // has_admin_access says no; the instructor branch is what lets them in.
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    signedInAs(['instructor']);

    renderWithInstructorAllowed();

    await waitFor(() => expect(screen.getByText('BLOG ADMIN CONTENT')).toBeInTheDocument());
  });

  it('does not consult has_admin_access for an instructor on an opted-in route', async () => {
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    signedInAs(['instructor']);

    renderWithInstructorAllowed();

    await waitFor(() => expect(screen.getByText('BLOG ADMIN CONTENT')).toBeInTheDocument());
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalledWith(
      'has_admin_access',
      expect.anything(),
    );
  });

  it('still rejects an instructor on a plain requireAdmin route', async () => {
    // REGRESSION: the prop must not widen routes that did not ask for it.
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    signedInAs(['instructor']);

    renderAt(); // /admin/courses — requireAdmin only

    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    expect(screen.queryByText('ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('rejects a student even where instructors are allowed', async () => {
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    signedInAs(['student']);

    renderWithInstructorAllowed();

    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    expect(screen.queryByText('BLOG ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('still admits an admin on an opted-in route via has_admin_access', async () => {
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    signedInAs(['admin']);

    renderWithInstructorAllowed();

    await waitFor(() => expect(screen.getByText('BLOG ADMIN CONTENT')).toBeInTheDocument());
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('has_admin_access', { user_id_param: 'user-1' });
  });
});
