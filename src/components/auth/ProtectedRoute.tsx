import React, { useEffect } from 'react';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requireAuth = true,
  requireAdmin = false,
  children
}) => {
  const { isAuthenticated, isAdminAuthenticated, storeRedirectPath, loading } = useAuth();
  const location = useLocation();
  
  // Store current path on mount
  useEffect(() => {
    if (requireAuth && !isAuthenticated) {
      const currentPath = location.pathname + location.search;
      storeRedirectPath(currentPath);
    }
  }, [isAuthenticated, requireAuth, location, storeRedirectPath]);
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Verifying credentials...</p>
      </div>
    );
  }
  
  // Check auth requirements
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Check admin requirements
  if (requireAdmin && !isAdminAuthenticated) {
    return <Navigate to="/dashboard" state={{ message: "You don't have admin access." }} replace />;
  }
  
  // Render children or outlet
  return <>{children || <Outlet />}</>;
};

export default ProtectedRoute;
