import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventService } from '../eventService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEvent', () => {
    it('should create a new event successfully', async () => {
      const mockEvent = {
        title: 'Test Event',
        description: 'Test Description',
        date: '2024-12-25',
        type: 'workshop',
        format: 'in-person',
        location: 'Test Location',
        capacity: 50,
      };

      const mockResponse = {
        data: { id: '1', ...mockEvent },
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockResponse),
          }),
        }),
      } as any);

      const result = await eventService.createEvent(mockEvent);

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error when creation fails', async () => {
      const mockEvent = {
        title: 'Test Event',
        description: 'Test Description',
        date: '2024-12-25',
        type: 'workshop',
        format: 'in-person',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Creation failed' },
            }),
          }),
        }),
      } as any);

      await expect(eventService.createEvent(mockEvent)).rejects.toThrow('Creation failed');
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', async () => {
      const eventId = '1';
      const updates = { title: 'Updated Event' };
      const mockResponse = {
        data: { id: eventId, ...updates },
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(mockResponse),
            }),
          }),
        }),
      } as any);

      const result = await eventService.updateEvent(eventId, updates);

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      const eventId = '1';
      const mockResponse = { error: null };

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockResponse),
        }),
      } as any);

      await eventService.deleteEvent(eventId);

      expect(supabase.from).toHaveBeenCalledWith('events');
    });
  });

  describe('getAllEvents', () => {
    it('should fetch all events ordered by date', async () => {
      const mockEvents = [
        { id: '1', title: 'Event 1', date: '2024-12-25' },
        { id: '2', title: 'Event 2', date: '2024-12-26' },
      ];

      const mockResponse = {
        data: mockEvents,
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue(mockResponse),
        }),
      } as any);

      const result = await eventService.getAllEvents();

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should fetch upcoming events with limit', async () => {
      const limit = 5;
      const mockEvents = [
        { id: '1', title: 'Upcoming Event', date: '2025-01-01' },
      ];

      const mockResponse = {
        data: mockEvents,
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockResponse),
            }),
          }),
        }),
      } as any);

      const result = await eventService.getUpcomingEvents(limit);

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockEvents);
    });

    it('should fetch all upcoming events without limit', async () => {
      const mockEvents = [
        { id: '1', title: 'Upcoming Event 1', date: '2025-01-01' },
        { id: '2', title: 'Upcoming Event 2', date: '2025-01-02' },
      ];

      const mockResponse = {
        data: mockEvents,
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(mockResponse),
          }),
        }),
      } as any);

      const result = await eventService.getUpcomingEvents();

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getPastEvents', () => {
    it('should fetch past events', async () => {
      const mockEvents = [
        { id: '1', title: 'Past Event', date: '2023-12-25' },
      ];

      const mockResponse = {
        data: mockEvents,
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(mockResponse),
          }),
        }),
      } as any);

      const result = await eventService.getPastEvents();

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getEvent', () => {
    it('should fetch a single event by ID', async () => {
      const eventId = '1';
      const mockEvent = { id: eventId, title: 'Test Event' };

      const mockResponse = {
        data: mockEvent,
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockResponse),
          }),
        }),
      } as any);

      const result = await eventService.getEvent(eventId);

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(result).toEqual(mockEvent);
    });
  });
});