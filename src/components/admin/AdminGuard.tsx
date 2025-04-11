
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
    // Create URL with tab parameter and redirect to admin login
    const loginUrl = `/login?tab=admin`;
    
    // Pass the current location via state for redirect after login
    return <Navigate to={loginUrl} state={{ from: location }} replace />;
  }
  
  // Render children if authenticated
  return <>{children}</>;
};

export default AdminGuard;
