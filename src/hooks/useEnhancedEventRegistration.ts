// Enhanced event registration hook with security and state management
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logSecurityEvent, logAuditEvent } from '@/utils/securityUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useEnhancedEventRegistration');

interface UseEnhancedEventRegistrationProps {
  eventId: string;
}

export function useEnhancedEventRegistration({ eventId }: UseEnhancedEventRegistrationProps) {
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Check registration status
  const checkRegistrationStatus = useCallback(async () => {
    if (!user?.id || !eventId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        logger.error('Error checking registration status:', error);
        // Log security event for potential access issues
        await logSecurityEvent(
          user.id,
          'event_registration_check_failed',
          'warning',
          'Failed to check event registration status',
          { eventId, error: error.message }
        );
      } else {
        setIsRegistered(!!data);
      }
    } catch (error) {
      logger.error('Exception checking registration status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, eventId]);

  // Initial load
  useEffect(() => {
    checkRegistrationStatus();
  }, [checkRegistrationStatus]);

  // Register for event
  const registerForEvent = useCallback(async () => {
    if (!user?.id || !eventId || isRegistering) return;

    setIsRegistering(true);

    try {
      // Check if already registered (prevent race conditions)
      const { data: existingRegistration, error: checkError } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking existing registration:', checkError);
        toast({
          title: 'Registration Failed',
          description: 'Could not verify your registration status. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      if (existingRegistration) {
        setIsRegistered(true);
        toast({
          title: 'Already Registered',
          description: 'You are already registered for this event.',
          variant: 'default'
        });
        return;
      }

      // Perform registration
      const { error } = await supabase
        .from('event_registrations')
        .insert([{
          event_id: eventId,
          user_id: user.id
        }]);

      if (error) {
        logger.error('Registration error:', error);
        toast({
          title: 'Registration Failed',
          description: 'Failed to register for the event. Please try again.',
          variant: 'destructive'
        });

        // Log security event for failed registration
        await logSecurityEvent(
          user.id,
          'event_registration_failed',
          'warning',
          'Event registration attempt failed',
          { eventId, error: error.message }
        );
      } else {
        setIsRegistered(true);
        toast({
          title: 'Registration Successful',
          description: 'You have successfully registered for the event!',
          variant: 'default'
        });

        // Log audit event for successful registration
        await logAuditEvent(
          user.id,
          'insert',
          'event_registrations',
          undefined,
          undefined,
          { event_id: eventId, user_id: user.id }
        );

        // Log security event for successful registration
        await logSecurityEvent(
          user.id,
          'event_registration_success',
          'info',
          'User successfully registered for event',
          { eventId }
        );
      }
    } catch (error) {
      logger.error('Exception during registration:', error);
      toast({
        title: 'Registration Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsRegistering(false);
    }
  }, [user?.id, eventId, isRegistering, toast]);

  // Unregister from event
  const unregisterFromEvent = useCallback(async () => {
    if (!user?.id || !eventId || isRegistering) return;

    setIsRegistering(true);

    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) {
        logger.error('Unregistration error:', error);
        toast({
          title: 'Unregistration Failed',
          description: 'Failed to unregister from the event. Please try again.',
          variant: 'destructive'
        });
      } else {
        setIsRegistered(false);
        toast({
          title: 'Unregistration Successful',
          description: 'You have been unregistered from the event.',
          variant: 'default'
        });

        // Log audit event for unregistration
        await logAuditEvent(
          user.id,
          'delete',
          'event_registrations',
          undefined,
          { event_id: eventId, user_id: user.id },
          undefined
        );
      }
    } catch (error) {
      logger.error('Exception during unregistration:', error);
      toast({
        title: 'Unregistration Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsRegistering(false);
    }
  }, [user?.id, eventId, isRegistering, toast]);

  // Toggle registration status
  const toggleRegistration = useCallback(() => {
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to register for events.',
        variant: 'default'
      });
      return;
    }

    if (isRegistered) {
      unregisterFromEvent();
    } else {
      registerForEvent();
    }
  }, [isAuthenticated, isRegistered, registerForEvent, unregisterFromEvent, toast]);

  return {
    isRegistered,
    isLoading,
    isRegistering,
    registerForEvent,
    unregisterFromEvent,
    toggleRegistration,
    checkRegistrationStatus
  };
}