
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AdminGuardProps {
  children: React.ReactNode;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAdminAuthenticated, storeRedirectPath } = useAuth();
  const location = useLocation();
  
  // Store current admin path for post-login redirect
  useEffect(() => {
    if (!isAdminAuthenticated && location.pathname.startsWith('/admin')) {
      storeRedirectPath(location.pathname);
      console.log('AdminGuard: stored admin path:', location.pathname);
    }
  }, [isAdminAuthenticated, location.pathname, storeRedirectPath]);
  
  // Show loading state while checking authentication
  if (isAdminAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Shield className="h-16 w-16 text-primary animate-pulse" />
        <p className="mt-4 text-lg">Verifying admin credentials...</p>
      </div>
    );
  }
  
  // Redirect to unified login page with admin tab if not authenticated
  if (!isAdminAuthenticated) {
    // Pass the current location via state for redirect after login
    return <Navigate to="/login?tab=admin" state={{ from: location }} replace />;
  }
  
  // Render children if authenticated
  return <>{children}</>;
};

export default AdminGuard;
