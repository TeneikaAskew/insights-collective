
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { validateSessionIntegrity, logSecurityEvent } from '@/utils/securityUtils';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('if');

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Enhanced AdminGuard with improved security checks using new database functions
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAuthenticated, user, session, loading } = useAuth();
  const location = useLocation();
  const [hasAdminAccess, setHasAdminAccess] = React.useState<boolean | null>(null);

  // Check admin access using new security function
  React.useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.id) {
        setHasAdminAccess(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        if (error) {
          logger.error('Error checking admin access:', error);
          await logSecurityEvent(user.id, 'admin_guard_check_failed', 'error', 'Failed to verify admin access in AdminGuard', { error: error.message });
          setHasAdminAccess(false);
          return;
        }
        
        setHasAdminAccess(data || false);
        
        // Log security event
        await logSecurityEvent(user.id, 'admin_guard_check', 'info', `Admin access check: ${data ? 'granted' : 'denied'}`, { path: location.pathname });
        
      } catch (error) {
        logger.error('Exception in admin access check:', error);
        setHasAdminAccess(false);
      }
    };

    if (isAuthenticated && user) {
      checkAdminAccess();
    } else if (!session && !loading) {
      // Same gap as ProtectedRoute: isAuthenticated lags the session while the
      // profile loads, and answering false in that window locks a real admin
      // out before has_admin_access can reply.
      setHasAdminAccess(false);
    }
  }, [isAuthenticated, user, session, loading, location.pathname]);

  // Enhanced security checks
  if (loading || (session !== null && !isAuthenticated) || hasAdminAccess === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Shield className="h-16 w-16 text-primary animate-pulse" />
        <p className="mt-4 text-lg">Verifying admin credentials...</p>
      </div>
    );
  }

  // Check session integrity
  if (isAuthenticated && session && !validateSessionIntegrity(session)) {
    logger.warn('[AdminGuard] Invalid session detected, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enhanced admin role verification using new security function
  if (!hasAdminAccess) {
    logger.warn('[AdminGuard] Non-admin user attempted to access admin area:', user?.id);
    
    // Log security event for unauthorized access attempt
    if (user?.id) {
      logSecurityEvent(user.id, 'unauthorized_admin_access', 'warning', 'Non-admin user attempted to access admin area', { path: location.pathname });
    }
    
    return <Navigate to="/dashboard" state={{ message: "Access denied. Admin privileges required." }} replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
