import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useEventsWithRegistrations');

export const useEventsWithRegistrations = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['events-with-registrations', user?.id],
    queryFn: async () => {
      logger.log('Fetching events and registrations together...');
      
      // Fetch events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      
      if (eventsError) {
        logger.error('Error fetching events:', eventsError);
        throw eventsError;
      }
      
      // Fetch all registrations for counting
      const { data: allRegistrations, error: allRegError } = await supabase
        .from('event_registrations')
        .select('event_id, user_id');
      
      if (allRegError) {
        logger.error('Error fetching all registrations:', allRegError);
        throw allRegError;
      }
      
      // Fetch user's registrations if logged in
      let userRegistrations: any[] = [];
      if (user) {
        const { data: userRegs, error: userRegError } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('user_id', user.id);
        
        if (userRegError) {
          logger.error('Error fetching user registrations:', userRegError);
          throw userRegError;
        }
        
        userRegistrations = userRegs || [];
      }
      
      logger.log('Fetched data:', {
        eventsCount: events?.length,
        userRegistrationsCount: userRegistrations.length,
        totalRegistrationsCount: allRegistrations?.length
      });
      
      // Transform events with registration data
      const eventsWithCounts = (events || []).map(event => {
        const registrationCount = (allRegistrations || []).filter(
          reg => reg.event_id === event.id
        ).length;
        
        return {
          ...event,
          startTime: event.start_time,
          endTime: event.end_time,
          calendlyLink: event.calendly_link,
          registrations: registrationCount
        };
      });
      
      // Get registered event IDs for the current user
      const registeredEventIds = userRegistrations
        .map(reg => reg.event_id)
        .filter(id => id !== null && id !== undefined) as string[];
      
      return {
        events: eventsWithCounts,
        registeredEventIds,
        userRegistrations
      };
    },
    staleTime: 0, // Always fetch fresh data
  });
};