import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useEventRegistrations = (eventId?: string) => {
  return useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: async () => {
      let query = supabase
        .from('event_registrations')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email,
            avatar_url
          ),
          events:event_id (
            id,
            title,
            date,
            start_time
          )
        `);
      
      if (eventId) {
        query = query.eq('event_id', eventId);
      }
      
      const { data, error } = await query.order('registered_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });
};

export const useUserRegistrations = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-registrations', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          *,
          events:event_id (
            id,
            title,
            description,
            type,
            format,
            location,
            link,
            date,
            start_time,
            end_time,
            image,
            capacity,
            calendly_link
          )
        `)
        .eq('user_id', user!.id)
        .order('registered_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });
};

export const useRegisterForEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error('Must be logged in to register');
      
      console.log('Attempting to register user:', user.id, 'for event:', eventId);
      
      const { data, error } = await supabase
        .from('event_registrations')
        .insert({
          event_id: eventId,
          user_id: user.id
        })
        .select()
        .single();
      
      console.log('Registration result:', { data, error });
      
      if (error) {
        console.error('Registration error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['user-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['event-registration-count'] });
      queryClient.invalidateQueries({ queryKey: ['is-registered'] });
    }
  });
};

export const useUnregisterFromEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error('Must be logged in to unregister');
      
      console.log('Attempting to unregister user:', user.id, 'from event:', eventId);
      
      const { error, count } = await supabase
        .from('event_registrations')
        .delete({ count: 'exact' })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      
      console.log('Unregistration result:', { error, count });
      
      if (error) {
        console.error('Unregistration error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['user-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['event-registration-count'] });
      queryClient.invalidateQueries({ queryKey: ['is-registered'] });
    }
  });
};

export const useEventRegistrationCount = (eventId: string) => {
  return useQuery({
    queryKey: ['event-registration-count', eventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      
      if (error) throw error;
      return count || 0;
    }
  });
};

export const useIsRegisteredForEvent = (eventId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['is-registered', eventId, user?.id],
    enabled: !!user && !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user!.id)
        .single();
      
      return !!data;
    }
  });
};