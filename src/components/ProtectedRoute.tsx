
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * ProtectedRoute component centralizes authentication and authorization,
 * stores intended redirect path, and routes accordingly.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, storeRedirectPath } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  
  // Only store path when needed and avoid storing login paths
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/register') {
      const pathForRedirect = location.pathname + location.search;
      storeRedirectPath(pathForRedirect);
      console.log('[ProtectedRoute] Stored redirect path:', pathForRedirect);
    }
  }, [isAuthenticated, location.pathname, location.search, storeRedirectPath]);

  // Handle loading state
  if (isAuthenticated === undefined) {
    return null; // Return nothing during loading to avoid flicker
  }

  // Handle unauthenticated users
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle admin authorization
  if (requireAdmin && !(user?.roles?.includes('admin'))) {
    toast({
      title: 'Access Denied',
      variant: 'destructive',
    });
    return <Navigate to="/dashboard" replace />;
  }

  // Authenticated and authorized
  return <>{children}</>;
};

export default ProtectedRoute;
