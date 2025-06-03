
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/profileUtils';
import { validateSessionIntegrity } from '@/utils/securityUtils';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Enhanced AdminGuard with improved security checks
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAuthenticated, user, session } = useAuth();
  const location = useLocation();

  const userIsAdmin = isAdmin(user?.roles);

  // Enhanced security checks
  if (isAuthenticated === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Shield className="h-16 w-16 text-primary animate-pulse" />
        <p className="mt-4 text-lg">Verifying admin credentials...</p>
      </div>
    );
  }

  // Check session integrity
  if (isAuthenticated && session && !validateSessionIntegrity(session)) {
    console.warn('[AdminGuard] Invalid session detected, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enhanced admin role verification
  if (!userIsAdmin) {
    console.warn('[AdminGuard] Non-admin user attempted to access admin area:', user?.id);
    return <Navigate to="/dashboard" state={{ message: "Access denied. Admin privileges required." }} replace />;
  }

  // Additional security check for critical admin roles
  if (!user?.roles?.includes('admin')) {
    console.error('[AdminGuard] User roles do not contain admin:', user?.roles);
    return <Navigate to="/dashboard" state={{ message: "Invalid admin access." }} replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
