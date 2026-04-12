
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { validateSessionIntegrity, logSecurityEvent } from '@/utils/securityUtils';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';

import { createLogger } from '@/utils/logger';

const logger = createLogger('if');

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Enhanced ProtectedRoute with improved security validation using new database functions
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, session, storeRedirectPath, loading } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [hasAdminAccess, setHasAdminAccess] = React.useState<boolean | null>(null);

  // Check admin access if required
  React.useEffect(() => {
    const checkAdminAccess = async () => {
      if (!requireAdmin || !user?.id) {
        setHasAdminAccess(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        if (error) {
          logger.error('Error checking admin access in ProtectedRoute:', error);
          await logSecurityEvent(user.id, 'protected_route_admin_check_failed', 'error', 'Failed to verify admin access in ProtectedRoute', { error: error.message, path: location.pathname });
          setHasAdminAccess(false);
          return;
        }
        
        setHasAdminAccess(data || false);
        
        // Log access attempt
        await logSecurityEvent(user.id, 'protected_route_access', 'info', `Protected route access: ${data ? 'granted' : 'denied'}`, { path: location.pathname, requireAdmin });
        
      } catch (error) {
        logger.error('Exception in ProtectedRoute admin check:', error);
        setHasAdminAccess(false);
      }
    };

    if (isAuthenticated && user) {
      checkAdminAccess();
    } else {
      setHasAdminAccess(!requireAdmin);
    }
  }, [isAuthenticated, user, requireAdmin, location.pathname]);

  React.useEffect(() => {
    // Validate and store redirect path securely
    if (!isAuthenticated) {
      const pathForRedirect = location.pathname + location.search;
      // Basic validation of redirect path
      if (pathForRedirect.startsWith('/') && !pathForRedirect.includes('..')) {
        storeRedirectPath(pathForRedirect);
        logger.log('[ProtectedRoute] Stored redirect path for unauthenticated user:', pathForRedirect);
      }
    }
  }, [isAuthenticated, location.pathname, location.search, storeRedirectPath]);

  if (loading || (session !== null && !isAuthenticated) || (requireAdmin && hasAdminAccess === null)) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-3">
        <Spinner size="lg" className="text-[#9b87f5]" />
        <p className="text-sm text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  // Enhanced session validation
  if (isAuthenticated && session && !validateSessionIntegrity(session)) {
    logger.warn('[ProtectedRoute] Invalid session detected, redirecting to login');
    toast({
      title: 'Session Invalid',
      description: 'Your session has expired. Please log in again.',
      variant: 'destructive',
    });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enhanced admin access validation using new security function
  if (requireAdmin && !hasAdminAccess) {
    logger.warn('[ProtectedRoute] Non-admin user attempted protected access:', user?.id);
    
    // Log security event for unauthorized access attempt
    if (user?.id) {
      logSecurityEvent(user.id, 'unauthorized_protected_access', 'warning', 'Non-admin user attempted to access admin-protected route', { path: location.pathname });
    }
    
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to access this page.',
      variant: 'destructive',
    });
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
