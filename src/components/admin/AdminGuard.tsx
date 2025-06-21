
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { validateSessionIntegrity, logSecurityEvent } from '@/utils/securityUtils';
import { supabase } from '@/integrations/supabase/client';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Enhanced AdminGuard with improved security checks using new database functions
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAuthenticated, user, session } = useAuth();
  const location = useLocation();
  const [hasAdminAccess, setHasAdminAccess] = React.useState<boolean | null>(null);

  // Check admin access using new security function
  React.useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.id) {
        setHasAdminAccess(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        if (error) {
          console.error('Error checking admin access:', error);
          await logSecurityEvent(user.id, 'admin_guard_check_failed', 'error', 'Failed to verify admin access in AdminGuard', { error: error.message });
          setHasAdminAccess(false);
          return;
        }
        
        setHasAdminAccess(data || false);
        
        // Log security event
        await logSecurityEvent(user.id, 'admin_guard_check', 'info', `Admin access check: ${data ? 'granted' : 'denied'}`, { path: location.pathname });
        
      } catch (error) {
        console.error('Exception in admin access check:', error);
        setHasAdminAccess(false);
      }
    };

    if (isAuthenticated && user) {
      checkAdminAccess();
    } else {
      setHasAdminAccess(false);
    }
  }, [isAuthenticated, user, location.pathname]);

  // Enhanced security checks
  if (isAuthenticated === undefined || hasAdminAccess === null) {
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

  // Enhanced admin role verification using new security function
  if (!hasAdminAccess) {
    console.warn('[AdminGuard] Non-admin user attempted to access admin area:', user?.id);
    
    // Log security event for unauthorized access attempt
    if (user?.id) {
      logSecurityEvent(user.id, 'unauthorized_admin_access', 'warning', 'Non-admin user attempted to access admin area', { path: location.pathname });
    }
    
    return <Navigate to="/dashboard" state={{ message: "Access denied. Admin privileges required." }} replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
