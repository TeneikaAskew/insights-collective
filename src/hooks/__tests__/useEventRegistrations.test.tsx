import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useEventRegistrations,
  useUserRegistrations,
  useRegisterForEvent,
  useUnregisterFromEvent,
  useEventRegistrationCount,
  useIsRegisteredForEvent,
} from '../useEventRegistrations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../useAuth';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../useAuth');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEventRegistrations hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    } as any);
  });

  describe('useEventRegistrations', () => {
    it('should fetch registrations for a specific event', async () => {
      const eventId = 'event-1';
      const mockRegistrations = [
        { id: 'reg-1', event_id: eventId, user_id: 'user-1' },
        { id: 'reg-2', event_id: eventId, user_id: 'user-2' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockRegistrations,
            error: null,
          }),
        }),
      } as any);

      const { result } = renderHook(() => useEventRegistrations(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRegistrations);
      expect(supabase.from).toHaveBeenCalledWith('event_registrations');
    });

    it('should fetch all registrations when no eventId provided', async () => {
      const mockRegistrations = [
        { id: 'reg-1', event_id: 'event-1', user_id: 'user-1' },
        { id: 'reg-2', event_id: 'event-2', user_id: 'user-2' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: mockRegistrations,
          error: null,
        }),
      } as any);

      const { result } = renderHook(() => useEventRegistrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRegistrations);
    });
  });

  describe('useUserRegistrations', () => {
    it('should fetch registrations for the current user', async () => {
      const mockRegistrations = [
        { id: 'reg-1', event_id: 'event-1', user_id: 'user-1' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockRegistrations,
            error: null,
          }),
        }),
      } as any);

      const { result } = renderHook(() => useUserRegistrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRegistrations);
    });

    it('should return empty array when user is not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
      } as any);

      const { result } = renderHook(() => useUserRegistrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useRegisterForEvent', () => {
    it('should register user for an event', async () => {
      const eventId = 'event-1';
      const mockRegistration = {
        id: 'reg-1',
        event_id: eventId,
        user_id: 'user-1',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRegistration,
              error: null,
            }),
          }),
        }),
      } as any);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useRegisterForEvent(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await act(async () => {
        await result.current.mutateAsync(eventId);
      });

      expect(supabase.from).toHaveBeenCalledWith('event_registrations');
    });
  });

  describe('useUnregisterFromEvent', () => {
    it('should unregister user from an event', async () => {
      const eventId = 'event-1';

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useUnregisterFromEvent(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(eventId);
      });

      expect(supabase.from).toHaveBeenCalledWith('event_registrations');
    });
  });

  describe('useEventRegistrationCount', () => {
    it('should return registration count for an event', async () => {
      const eventId = 'event-1';
      const mockRegistrations = [
        { id: 'reg-1' },
        { id: 'reg-2' },
        { id: 'reg-3' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockRegistrations,
            error: null,
          }),
        }),
      } as any);

      const { result } = renderHook(() => useEventRegistrationCount(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(3);
    });
  });

  describe('useIsRegisteredForEvent', () => {
    it('should return true if user is registered', async () => {
      const eventId = 'event-1';
      const mockRegistrations = [
        { id: 'reg-1', event_id: eventId, user_id: 'user-1' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockRegistrations,
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useIsRegisteredForEvent(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(true);
    });

    it('should return false if user is not registered', async () => {
      const eventId = 'event-1';

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useIsRegisteredForEvent(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(false);
    });

    it('should return false if user is not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
      } as any);

      const { result } = renderHook(() => useIsRegisteredForEvent('event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(false);
    });
  });
});