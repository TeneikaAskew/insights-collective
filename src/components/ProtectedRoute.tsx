
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { validateSessionIntegrity } from '@/utils/securityUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Enhanced ProtectedRoute with improved security validation
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, session, storeRedirectPath } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  React.useEffect(() => {
    // Validate and store redirect path securely
    if (!isAuthenticated) {
      const pathForRedirect = location.pathname + location.search;
      // Basic validation of redirect path
      if (pathForRedirect.startsWith('/') && !pathForRedirect.includes('..')) {
        storeRedirectPath(pathForRedirect);
        console.log('[ProtectedRoute] Stored redirect path for unauthenticated user:', pathForRedirect);
      }
    }
  }, [isAuthenticated, location.pathname, location.search, storeRedirectPath]);

  if (isAuthenticated === undefined) {
    return null;
  }

  // Enhanced session validation
  if (isAuthenticated && session && !validateSessionIntegrity(session)) {
    console.warn('[ProtectedRoute] Invalid session detected, redirecting to login');
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

  // Enhanced admin access validation
  if (requireAdmin) {
    const hasAdminRole = user?.roles?.includes('admin');
    if (!hasAdminRole) {
      console.warn('[ProtectedRoute] Non-admin user attempted protected access:', user?.id);
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        variant: 'destructive',
      });
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
