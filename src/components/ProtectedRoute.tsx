
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { validateSessionIntegrity, logSecurityEvent } from '@/utils/securityUtils';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';

import { createLogger } from '@/utils/logger';

const logger = createLogger('if');

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /**
   * When set alongside `requireAdmin`, users holding the instructor role also
   * satisfy the guard. Used where the database already grants instructors the
   * capability (e.g. blog authoring, where RLS lets an instructor CRUD their
   * own posts) but the route was previously admin-only.
   *
   * This is a routing gate, not the security boundary — RLS remains the
   * authority on what any given role can actually read or write.
   */
  allowInstructor?: boolean;
}

/**
 * Enhanced ProtectedRoute with improved security validation using new database functions
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  allowInstructor = false,
}) => {
  const { isAuthenticated, user, session, storeRedirectPath, loading } = useAuth();
  const location = useLocation();
  const [hasAdminAccess, setHasAdminAccess] = React.useState<boolean | null>(null);
  // Presence, not identity: useAuthProvider calls setSession for every auth
  // event, so depending on the session object re-ran the admin check and wrote
  // another protected_route_access audit entry on each token refresh.
  const hasSession = session !== null;

  // Roles are resolved server-side via the get_user_roles RPC (see
  // useUserProfile), so this is not a client-asserted claim.
  const isInstructor = !!user?.roles?.includes('instructor');

  // Check admin access if required
  React.useEffect(() => {
    const checkAdminAccess = async () => {
      if (!requireAdmin || !user?.id) {
        setHasAdminAccess(true);
        return;
      }

      // An instructor satisfies routes that opt into instructor access without
      // needing the admin RPC. Admins still fall through to has_admin_access.
      if (allowInstructor && isInstructor) {
        setHasAdminAccess(true);
        await logSecurityEvent(user.id, 'protected_route_access', 'info', 'Protected route access: granted (instructor)', { path: location.pathname, requireAdmin, allowInstructor });
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        if (error) {
          logger.error('Error checking admin access in ProtectedRoute:', error);
          await logSecurityEvent(user.id, 'protected_route_admin_check_failed', 'error', 'Failed to verify admin access in ProtectedRoute', { error: error.message, path: location.pathname });
          setHasAdminAccess(false);
          return;
        }
        
        setHasAdminAccess(data || false);
        
        // Log access attempt
        await logSecurityEvent(user.id, 'protected_route_access', 'info', `Protected route access: ${data ? 'granted' : 'denied'}`, { path: location.pathname, requireAdmin });
        
      } catch (error) {
        logger.error('Exception in ProtectedRoute admin check:', error);
        setHasAdminAccess(false);
      }
    };

    if (isAuthenticated && user) {
      checkAdminAccess();
    } else if (!hasSession && !loading) {
      // Only conclude "not an admin" once auth has settled with no session at
      // all. isAuthenticated is derived from the enriched profile, which loads
      // after the session: in that gap this branch used to write a definitive
      // false, which stopped the loading check below from holding the route
      // and redirected a real admin away — logging them as an unauthorized
      // access attempt — before has_admin_access could reply.
      setHasAdminAccess(!requireAdmin);
    }
  }, [isAuthenticated, user?.id, hasSession, loading, requireAdmin, allowInstructor, isInstructor, location.pathname]);

  React.useEffect(() => {
    // Validate and store redirect path securely
    if (!isAuthenticated) {
      const pathForRedirect = location.pathname + location.search;
      // Basic validation of redirect path
      if (pathForRedirect.startsWith('/') && !pathForRedirect.includes('..')) {
        storeRedirectPath(pathForRedirect);
        logger.log('[ProtectedRoute] Stored redirect path for unauthenticated user:', pathForRedirect);
      }
    }
  }, [isAuthenticated, location.pathname, location.search, storeRedirectPath]);

  if (loading || (session !== null && !isAuthenticated) || (requireAdmin && hasAdminAccess === null)) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-3">
        <Spinner size="lg" className="text-primary" />
        <p className="text-sm text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  // Enhanced session validation
  if (isAuthenticated && session && !validateSessionIntegrity(session)) {
    return (
      <RedirectWithNotice
        to="/login"
        state={{ from: location }}
        title="Session Invalid"
        description="Your session has expired. Please log in again."
        onShown={() => logger.warn('[ProtectedRoute] Invalid session detected, redirecting to login')}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enhanced admin access validation using new security function
  if (requireAdmin && !hasAdminAccess) {
    const userId = user?.id;
    const path = location.pathname;
    return (
      <RedirectWithNotice
        to="/dashboard"
        title="Access Denied"
        description="You do not have permission to access this page."
        onShown={() => {
          logger.warn('[ProtectedRoute] Non-admin user attempted protected access:', userId);
          if (userId) {
            logSecurityEvent(userId, 'unauthorized_protected_access', 'warning', 'Non-admin user attempted to access admin-protected route', { path });
          }
        }}
      />
    );
  }

  return <>{children}</>;
};

/**
 * Redirects and announces why, ONCE per mount, from an effect. Calling toast() or logging during render updated the
 * toast context this guard reads, so it rendered again and toasted again; with React Router's v7_startTransition the
 * urgent toast updates kept interrupting the redirect, leaving a blank page and a toast that remounted thousands of
 * times (run 41294441748; docs in the review export).
 */
const RedirectWithNotice: React.FC<{
  to: string;
  state?: unknown;
  title: string;
  description: string;
  onShown?: () => void;
}> = ({ to, state, title, description, onShown }) => {
  const { toast } = useToast();
  const shown = React.useRef(false);
  React.useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    onShown?.();
    toast({ title, description, variant: 'destructive' });
  }, [toast, title, description, onShown]);
  return <Navigate to={to} state={state} replace />;
};

export default ProtectedRoute;
