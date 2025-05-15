
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

  // Only store the redirect path once when the component mounts
  // This prevents redirect loops caused by continuous path storing
  useEffect(() => {
    // If authentication is still loading, don't do anything yet
    if (isAuthenticated === undefined) return;
    
    // If user is not authenticated, store the path
    if (!isAuthenticated) {
      const pathForRedirect = location.pathname + location.search;
      
      // Avoid storing login/register paths
      if (!['/login', '/register', '/auth/callback'].includes(location.pathname)) {
        console.log('[ProtectedRoute] Storing redirect path:', pathForRedirect);
        storeRedirectPath(pathForRedirect);
      } else {
        console.log('[ProtectedRoute] Not storing auth page path:', location.pathname);
      }
    }
  }, [isAuthenticated, location.pathname, location.search, storeRedirectPath]);

  // While auth is loading, show nothing to prevent flashes
  if (isAuthenticated === undefined) {
    return null;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If admin access is required but user is not admin, redirect to dashboard
  if (requireAdmin && !(user?.roles?.includes('admin'))) {
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to access this page.',
      variant: 'destructive',
    });
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and authorized, render children
  return <>{children}</>;
};

export default ProtectedRoute;
