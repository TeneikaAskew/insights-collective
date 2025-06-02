
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/profileUtils';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Updated AdminGuard to rely on ProtectedRoute instead for redirect and storeRedirectPath logic.
 * This component only shows loading while auth state is undefined,
 * and denies access to non-admin users, redirecting them elsewhere.
 * 
 * (You can replace this component entirely with ProtectedRoute with requireAdmin=true,
 * but we keep it for backward compatibility if still used.)
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  const userIsAdmin = isAdmin(user?.roles);

  if (isAuthenticated === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Shield className="h-16 w-16 text-primary animate-pulse" />
        <p className="mt-4 text-lg">Verifying admin credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userIsAdmin) {
    return <Navigate to="/dashboard" state={{ message: "You don't have admin access." }} replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
