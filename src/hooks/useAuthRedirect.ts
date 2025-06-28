import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './use-toast';
import type { EnrichedUser } from './useAuth';

export const useAuthRedirect = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasRedirected, setHasRedirected] = useState(false);

  const storeRedirectPath = useCallback((path: string) => {
    if (path && !['/login', '/register', '/', '/auth/callback'].includes(path)) {
      localStorage.setItem('redirectAfterLogin', path);
      console.log('[useAuthRedirect] Stored redirect path:', path);
    }
  }, []);

  const executeRedirect = useCallback((user: EnrichedUser | null) => {
    if (hasRedirected) {
      console.log('[useAuthRedirect] Already redirected, skipping');
      return;
    }

    const storedPath = localStorage.getItem('redirectAfterLogin');
    if (!storedPath) {
      console.log('[useAuthRedirect] No stored redirect path');
      return;
    }

    let redirectTo = storedPath;

    // Check admin access
    if (!user?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access the admin area.',
        variant: 'destructive',
      });
      redirectTo = '/dashboard';
    }

    console.log('[useAuthRedirect] Executing redirect to:', redirectTo);
    localStorage.removeItem('redirectAfterLogin');
    setHasRedirected(true);
    navigate(redirectTo, { replace: true });
  }, [navigate, toast, hasRedirected]);

  const resetRedirectFlag = useCallback(() => {
    setHasRedirected(false);
  }, []);

  return {
    storeRedirectPath,
    executeRedirect,
    resetRedirectFlag,
    hasRedirected
  };
};