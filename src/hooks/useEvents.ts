import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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