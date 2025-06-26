import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { eventService } from '@/services/eventService';

export interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  location: string | null;
  link: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  image: string | null;
  capacity: number | null;
  calendly_link: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useEvents = () => {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }

      return data as Event[];
    },
  });
};

export const useUpcomingEvents = (limit?: number) => {
  return useQuery({
    queryKey: ['events', 'upcoming', limit],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('events')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching upcoming events:', error);
        throw error;
      }

      return data as Event[];
    },
  });
};

export const useRecentEvents = (limit?: number) => {
  return useQuery({
    queryKey: ['events', 'recent', limit],
    queryFn: async () => {
      // Get events from the last 3 months and upcoming
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];
      
      let query = supabase
        .from('events')
        .select('*')
        .gte('date', threeMonthsAgoStr)
        .order('date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recent events:', error);
        throw error;
      }

      // Sort to show upcoming events first, then recent past events
      const today = new Date().toISOString().split('T')[0];
      const sorted = (data as Event[]).sort((a, b) => {
        const aIsUpcoming = a.date >= today;
        const bIsUpcoming = b.date >= today;
        
        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;
        
        // If both are upcoming, sort by date ascending
        if (aIsUpcoming && bIsUpcoming) {
          return a.date.localeCompare(b.date);
        }
        
        // If both are past, sort by date descending (most recent first)
        return b.date.localeCompare(a.date);
      });

      return sorted;
    },
  });
};

export const useEvent = (eventId: string) => {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
        throw error;
      }

      return data as Event;
    },
    enabled: !!eventId,
  });
};

// Mutation hooks for event operations
export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Creating event with data:', eventData);
      
      // Validate required fields
      if (!eventData.title || !eventData.description || !eventData.date || !eventData.type || !eventData.format) {
        throw new Error('Missing required fields: title, description, date, type, and format are required');
      }
      
      const result = await eventService.createEvent(eventData);
      console.log('Event created successfully:', result);
      return result;
    },
    onSuccess: () => {
      console.log('Invalidating events cache after successful creation');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error) => {
      console.error('Error creating event:', error);
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      console.log('Updating event:', id, 'with data:', updates);
      
      const result = await eventService.updateEvent(id, updates);
      console.log('Event updated successfully:', result);
      return result;
    },
    onSuccess: (_, variables) => {
      console.log('Invalidating events cache after successful update');
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.id] });
    },
    onError: (error) => {
      console.error('Error updating event:', error);
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      console.log('Deleting event:', eventId);
      
      await eventService.deleteEvent(eventId);
      console.log('Event deleted successfully');
    },
    onSuccess: () => {
      console.log('Invalidating events cache after successful deletion');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
    },
  });
};