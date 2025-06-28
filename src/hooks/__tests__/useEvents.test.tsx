import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useEvents,
  useUpcomingEvents,
  useRecentEvents,
  useEvent,
} from '../useEvents';
import * as eventService from '@/services/eventService';

vi.mock('@/services/eventService');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEvents hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useEvents', () => {
    it('should fetch all events', async () => {
      const mockEvents = [
        { id: '1', title: 'Event 1', date: '2024-12-25' },
        { id: '2', title: 'Event 2', date: '2024-12-26' },
      ];

      vi.mocked(eventService.getAllEvents).mockResolvedValue(mockEvents);

      const { result } = renderHook(() => useEvents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEvents);
      expect(eventService.getAllEvents).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch events');
      vi.mocked(eventService.getAllEvents).mockRejectedValue(error);

      const { result } = renderHook(() => useEvents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useUpcomingEvents', () => {
    it('should fetch upcoming events with limit', async () => {
      const mockEvents = [
        { id: '1', title: 'Upcoming Event 1', date: '2025-01-01' },
        { id: '2', title: 'Upcoming Event 2', date: '2025-01-02' },
      ];

      vi.mocked(eventService.getUpcomingEvents).mockResolvedValue(mockEvents);

      const { result } = renderHook(() => useUpcomingEvents(2), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEvents);
      expect(eventService.getUpcomingEvents).toHaveBeenCalledWith(2);
    });

    it('should fetch all upcoming events without limit', async () => {
      const mockEvents = [
        { id: '1', title: 'Upcoming Event', date: '2025-01-01' },
      ];

      vi.mocked(eventService.getUpcomingEvents).mockResolvedValue(mockEvents);

      const { result } = renderHook(() => useUpcomingEvents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEvents);
      expect(eventService.getUpcomingEvents).toHaveBeenCalledWith(undefined);
    });
  });

  describe('useRecentEvents', () => {
    it('should fetch recent events from last 3 months', async () => {
      const mockEvents = [
        { id: '1', title: 'Recent Event 1', date: '2024-11-01' },
        { id: '2', title: 'Recent Event 2', date: '2024-10-15' },
      ];

      vi.mocked(eventService.getAllEvents).mockResolvedValue(mockEvents);

      const { result } = renderHook(() => useRecentEvents(5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(eventService.getAllEvents).toHaveBeenCalled();
    });
  });

  describe('useEvent', () => {
    it('should fetch a single event by ID', async () => {
      const eventId = '1';
      const mockEvent = {
        id: eventId,
        title: 'Test Event',
        description: 'Test Description',
      };

      vi.mocked(eventService.getEvent).mockResolvedValue(mockEvent);

      const { result } = renderHook(() => useEvent(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEvent);
      expect(eventService.getEvent).toHaveBeenCalledWith(eventId);
    });

    it('should not fetch if eventId is not provided', () => {
      const { result } = renderHook(() => useEvent(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isIdle).toBe(true);
      expect(eventService.getEvent).not.toHaveBeenCalled();
    });
  });
});