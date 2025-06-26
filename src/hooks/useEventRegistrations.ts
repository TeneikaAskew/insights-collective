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
      console.log('Registration mutation started for event:', eventId);
      if (!user) throw new Error('Must be logged in to register');
      
      // Check if already registered
      console.log('Checking existing registration...');
      const { data: existing } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      console.log('Existing registration:', existing);
      
      if (existing) {
        // User is already registered, do nothing or throw a descriptive error
        console.log('User already registered');
        return { action: 'already_registered', data: existing };
      }
      
      console.log('Creating new registration...');
      const { data, error } = await supabase
        .from('event_registrations')
        .insert({
          event_id: eventId,
          user_id: user.id
        })
        .select()
        .single();
      
      console.log('Registration result:', { data, error });
      if (error) throw error;
      return { action: 'registered', data };
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
      
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      
      if (error) throw error;
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