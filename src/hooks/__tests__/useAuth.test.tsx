import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthProvider } from '../useAuth';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

vi.mock('../useUserProfile', () => ({
  useUserProfile: vi.fn().mockReturnValue({
    enrichedUser: null,
    loading: false,
  }),
}));

vi.mock('../use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('../useAuthRedirect', () => ({
  useAuthRedirect: () => ({
    storeRedirectPath: vi.fn(),
    executeRedirect: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useAuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuthProvider(), { wrapper });
    
    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle successful login', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { 
        user: { id: '123', email: 'test@example.com' },
        session: { access_token: 'token' }
      },
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should handle login error', async () => {
    const error = new Error('Invalid credentials');
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error,
    });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'wrongpassword');
    });

    expect(result.current.error).toBe('Invalid credentials');
  });

  it('should handle social sign in', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://oauth.provider.com' },
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await act(async () => {
      await result.current.socialSignIn('google');
    });

    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: expect.stringContaining('/auth/callback'),
      }),
    });
  });

  it('should handle logout', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
  });

  it('should handle password reset', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await act(async () => {
      await result.current.resetPassword('test@example.com');
    });

    expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('/reset-password'),
      })
    );
  });

  it('should detect admin user', async () => {
    const { useUserProfile } = await import('../useUserProfile');
    
    vi.mocked(useUserProfile).mockReturnValue({
      enrichedUser: {
        id: '123',
        email: 'admin@example.com',
        roles: ['admin'],
      } as any,
      loading: false,
    });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('should handle session initialization', async () => {
    const mockSession = {
      access_token: 'token',
      user: { id: '123', email: 'test@example.com' },
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.session).toEqual(mockSession);
    });
  });
});