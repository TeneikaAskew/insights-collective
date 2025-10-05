// Enhanced session security hook
import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { validateSessionIntegrity, logSecurityEvent } from '@/utils/securityUtils';
import { useToast } from './use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useSecureSession');

export const useSecureSession = () => {
  const { session, user, logout } = useAuth();
  const { toast } = useToast();

  // Proactive session validation with grace period
  const validateSession = useCallback(async () => {
    if (!session || !user) return;

    // Check if session is close to expiring (within 5 minutes)
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    if (expiresAt && expiresAt < fiveMinutesFromNow) {
      logger.log('[useSecureSession] Session expiring soon, Supabase will auto-refresh');
      await logSecurityEvent(
        user.id,
        'session_near_expiry',
        'info',
        'Session is close to expiring',
        { expiresAt: expiresAt.toISOString() }
      );
    }

    // Only check integrity for critical issues, don't logout automatically
    if (!validateSessionIntegrity(session)) {
      logger.warn('[useSecureSession] Session integrity check failed - logging for monitoring');
      await logSecurityEvent(
        user.id,
        'session_integrity_warning',
        'warning',
        'Session integrity check failed',
        { sessionId: session.access_token?.substring(0, 10) + '...' }
      );
      // Don't logout - let Supabase handle session refresh naturally
    }
  }, [session, user]);

  // Monitor session activity - reduced frequency for production stability
  useEffect(() => {
    if (!session || !user) return;

    // Validate session on mount
    validateSession();
    
    // Check every 5 minutes instead of every minute to reduce load
    const interval = setInterval(validateSession, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [validateSession]);

  return { validateSession };
};