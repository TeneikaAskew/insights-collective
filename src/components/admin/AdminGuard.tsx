
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AdminGuardProps {
  children: React.ReactNode;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAuthenticated, user, storeRedirectPath } = useAuth();
  const location = useLocation();
  
  // Check if user has admin role
  const isAdmin = user?.roles?.includes('admin');
  
  // Store current admin path for post-login redirect
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      if (location.pathname.startsWith('/admin')) {
        // Save the admin path both ways for redundancy
        // 1. In localStorage (our primary method)
        localStorage.setItem('redirectAfterLogin', location.pathname);
        console.log('AdminGuard: stored admin path in localStorage:', location.pathname);
        
        // 2. Using the context method if available (redundant backup)
        if (storeRedirectPath) {
          storeRedirectPath(location.pathname);
          console.log('AdminGuard: stored admin path via context:', location.pathname);
        }
      }
    }
  }, [isAuthenticated, isAdmin, location.pathname, storeRedirectPath]);
  
  // Show loading state while checking authentication
  if (isAuthenticated === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Shield className="h-16 w-16 text-primary animate-pulse" />
        <p className="mt-4 text-lg">Verifying admin credentials...</p>
      </div>
    );
  }
  
  // Redirect to unified login page if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={`/login`} state={{ from: location }} replace />;
  }
  
  // Redirect to dashboard if authenticated but not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" state={{ message: "You don't have admin access." }} replace />;
  }
  
  // Render children if authenticated and is admin
  return <>{children}</>;
};

export default AdminGuard;
