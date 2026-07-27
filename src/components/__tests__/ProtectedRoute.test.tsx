// ABOUTME: Tests for ProtectedRoute's role gating — especially the additive
// ABOUTME: allowInstructor prop, which must admit instructors ONLY on routes
// ABOUTME: that opt in, and must never widen plain requireAdmin routes.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { mockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

vi.mock('@/utils/securityUtils', async () => {
  const actual = await vi.importActual<any>('@/utils/securityUtils');
  return {
    ...actual,
    logSecurityEvent: vi.fn().mockResolvedValue(undefined),
    validateSessionIntegrity: vi.fn().mockReturnValue(true),
  };
});

const Protected = () => <div>protected content</div>;

function signedInAs(roles: string[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1', roles },
    session: { access_token: 't' },
    isAuthenticated: true,
    loading: false,
    error: null,
    isAdmin: roles.includes('admin'),
    isAdminAuthenticated: roles.includes('admin'),
    storeRedirectPath: vi.fn(),
    handleRedirectAfterLogin: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    googleSignIn: vi.fn(),
    githubSignIn: vi.fn(),
    twitterSignIn: vi.fn(),
  } as any);
}

describe('ProtectedRoute role gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the admin RPC says "not an admin".
    (mockSupabaseClient.rpc as any).mockResolvedValue({ data: false, error: null });
  });

  it('admits an instructor when the route opts in with allowInstructor', async () => {
    signedInAs(['instructor']);

    render(
      <ProtectedRoute requireAdmin allowInstructor>
        <Protected />
      </ProtectedRoute>,
    );

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('still rejects an instructor on a plain requireAdmin route', async () => {
    signedInAs(['instructor']);

    render(
      <ProtectedRoute requireAdmin>
        <Protected />
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    });
  });

  it('rejects a student even when allowInstructor is set', async () => {
    signedInAs(['student']);

    render(
      <ProtectedRoute requireAdmin allowInstructor>
        <Protected />
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    });
  });

  it('admits an admin through the has_admin_access RPC as before', async () => {
    signedInAs(['admin']);
    (mockSupabaseClient.rpc as any).mockResolvedValue({ data: true, error: null });

    render(
      <ProtectedRoute requireAdmin>
        <Protected />
      </ProtectedRoute>,
    );

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('fails closed when the admin check errors', async () => {
    signedInAs(['admin']);
    (mockSupabaseClient.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'rpc exploded' },
    });

    render(
      <ProtectedRoute requireAdmin>
        <Protected />
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    });
  });
});
