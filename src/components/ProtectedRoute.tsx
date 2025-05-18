
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredRole?: string;
}

/**
 * ProtectedRoute component centralizes authentication and authorization,
 * stores intended redirect path, and routes accordingly.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false, requiredRole = '' }) => {
  const { isAuthenticated, user, storeRedirectPath } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  React.useEffect(() => {
    // If user not authenticated, save the intended path for redirect after login
    if (!isAuthenticated) {
      const pathForRedirect = location.pathname + location.search;
      // Delegate redirect path storing to context method
      storeRedirectPath(pathForRedirect);
      console.log('[ProtectedRoute] Stored redirect path for unauthenticated user:', pathForRedirect);
    }
  }, [isAuthenticated, location.pathname, location.search, storeRedirectPath]);

  if (isAuthenticated === undefined) {
    // Loading auth state: optionally render a spinner or null to reduce delay
    return null;
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated users to login, preserve intended location for redirect param
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !(user?.roles?.includes('admin'))) {
    // If requires admin and user not admin, show toast and redirect to dashboard
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to access this page.',
      variant: 'destructive',
    });
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredRole && !(user?.roles?.includes(requiredRole))) {
    // If requires specific role and user doesn't have it, show toast and redirect to dashboard
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to access this page.',
      variant: 'destructive',
    });
    return <Navigate to="/dashboard" replace />;
  }

  // Authenticated and authorized, render children
  return <>{children}</>;
};

export default ProtectedRoute;
