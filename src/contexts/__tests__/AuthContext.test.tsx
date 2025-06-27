import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../AuthContext';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import React from 'react';

// Mock the modules
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

vi.mock('@/utils/securityUtils', () => ({
  validateSessionIntegrity: vi.fn().mockReturnValue(true),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthProvider: vi.fn().mockReturnValue({
    session: null,
    user: null,
    enrichedUser: null,
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    socialSignIn: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    storeRedirectPath: vi.fn(),
    handleRedirectAfterLogin: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide auth context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current).toBeDefined();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
  });

  it('should throw error when used outside provider', () => {
    // Temporarily mock useContext to return null
    const originalUseContext = React.useContext;
    React.useContext = vi.fn().mockReturnValue(null);

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    // Restore original useContext
    React.useContext = originalUseContext;
  });
});