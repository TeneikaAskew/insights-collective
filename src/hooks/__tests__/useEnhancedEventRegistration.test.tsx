// ABOUTME: Regression tests for useEnhancedEventRegistration silent-failure fixes.
// ABOUTME: A failed pre-registration check must abort with an error toast, not fall through to the insert.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEnhancedEventRegistration } from '../useEnhancedEventRegistration';
import {
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/utils/securityUtils', () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('useEnhancedEventRegistration.registerForEvent', () => {
  beforeEach(() => {
    mockToast.mockClear();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      isAuthenticated: true,
    } as any);
  });

  it('aborts with a destructive toast when the existing-registration check fails, without inserting', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue(supabaseError('check failed'));

    const { result } = renderHook(() =>
      useEnhancedEventRegistration({ eventId: 'event-1' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockToast.mockClear();

    await act(async () => {
      await result.current.registerForEvent();
    });

    expect(builder.insert).not.toHaveBeenCalled();
    expect(result.current.isRegistered).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('registers and toasts success when the check passes and the insert succeeds', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    // The insert chain is awaited directly, resolving through `then`.
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: null, error: null })
    );

    const { result } = renderHook(() =>
      useEnhancedEventRegistration({ eventId: 'event-1' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockToast.mockClear();

    await act(async () => {
      await result.current.registerForEvent();
    });

    expect(result.current.isRegistered).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Registration Successful' })
    );
  });

  it('does not toast success when the insert itself fails', async () => {
    const builder = getQueryBuilder();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve(supabaseError('insert failed'))
    );

    const { result } = renderHook(() =>
      useEnhancedEventRegistration({ eventId: 'event-1' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockToast.mockClear();

    await act(async () => {
      await result.current.registerForEvent();
    });

    expect(result.current.isRegistered).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Registration Failed' })
    );
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Registration Successful' })
    );
  });
});
