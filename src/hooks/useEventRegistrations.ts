import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useEventRegistrations');

export const useEventRegistrations = (eventId?: string) => {
  return useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: async () => {
      // NOTE: profiles has no full_name/email columns in the live schema —
      // selecting them made PostgREST reject the whole query. Select the
      // real columns (first_name/last_name) instead.
      let query = supabase
        .from('event_registrations')
        .select(`
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
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
    staleTime: 0, // Always fetch fresh data
    queryFn: async () => {
      logger.log('Fetching registrations for user:', user?.id);
      
      // First, try a simple query without joins
      const { data: simpleData, error: simpleError } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('user_id', user!.id);
      
      logger.log('Simple query result:', { simpleData, simpleError });
      
      // For now, return the simple data to debug the issue
      if (simpleError) {
        logger.error('Error fetching user registrations (simple):', simpleError);
        throw simpleError;
      }
      
      // Return the simple data for now
      return simpleData || [];
    }
  });
};

export const useRegisterForEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error('Must be logged in to register');
      
      logger.log('Attempting to register user:', user.id, 'for event:', eventId);
      
      // First check if user is already registered
      const { data: existing, error: checkError } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (checkError) {
        logger.error('Error checking registration:', checkError);
        throw checkError;
      }
      
      if (existing) {
        logger.log('User already registered for this event');
        return { already_registered: true, data: existing };
      }
      
      // Now insert the registration
      const { data, error } = await supabase
        .from('event_registrations')
        .insert({
          event_id: eventId,
          user_id: user.id
        })
        .select()
        .single();
      
      logger.log('Registration result:', { data, error });
      
      if (error) {
        logger.error('Registration error:', error);
        throw error;
      }
      
      return { already_registered: false, data };
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events-with-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['event-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['user-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['event-registration-count'] }),
        queryClient.invalidateQueries({ queryKey: ['is-registered'] })
      ]);
    }
  });
};

export const useUnregisterFromEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error('Must be logged in to unregister');
      
      logger.log('Attempting to unregister user:', user.id, 'from event:', eventId);
      
      const { error, count } = await supabase
        .from('event_registrations')
        .delete({ count: 'exact' })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      
      logger.log('Unregistration result:', { error, count });
      
      if (error) {
        logger.error('Unregistration error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events-with-registrations'] });
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
      const { data, error } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user!.id)
        .maybeSingle();

      // A query failure must not masquerade as "not registered".
      if (error) {
        logger.error('Error checking event registration:', error);
        throw error;
      }

      return !!data;
    }
  });
};