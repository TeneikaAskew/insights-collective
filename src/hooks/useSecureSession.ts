// Enhanced session security hook
import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { validateSessionIntegrity, logSecurityEvent } from '@/utils/securityUtils';
import { useToast } from './use-toast';

export const useSecureSession = () => {
  const { session, user, logout } = useAuth();
  const { toast } = useToast();

  // Proactive session validation
  const validateSession = useCallback(async () => {
    if (!session || !user) return;

    // Check session integrity
    if (!validateSessionIntegrity(session)) {
      console.warn('[useSecureSession] Invalid session detected');
      await logSecurityEvent(
        user.id,
        'invalid_session_detected',
        'warning',
        'Session failed integrity check',
        { sessionId: session.access_token?.substring(0, 10) + '...' }
      );
      
      toast({
        title: 'Session Invalid',
        description: 'Your session has expired. Please log in again.',
        variant: 'destructive',
      });
      
      logout();
      return;
    }

    // Check if session is close to expiring (within 5 minutes)
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    if (expiresAt && expiresAt < fiveMinutesFromNow) {
      console.log('[useSecureSession] Session expiring soon, attempting refresh');
      // Note: Supabase auto-refresh should handle this, but we log for monitoring
      await logSecurityEvent(
        user.id,
        'session_near_expiry',
        'info',
        'Session is close to expiring',
        { expiresAt: expiresAt.toISOString() }
      );
    }
  }, [session, user, logout, toast]);

  // Monitor session activity
  useEffect(() => {
    if (!session || !user) return;

    // Validate session on mount and periodically
    validateSession();
    
    const interval = setInterval(validateSession, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [validateSession]);

  // Monitor for suspicious activity patterns
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        // Re-validate session when tab becomes visible
        validateSession();
      }
    };

    const handleFocus = () => {
      if (session) {
        validateSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, validateSession]);

  return { validateSession };
};