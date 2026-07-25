import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';
import { safeInternalPath } from '@/utils/safeRedirect';

const logger = createLogger('useAuthenticatedNavigation');

/**
 * A hook that provides authentication-aware navigation
 * It ensures redirect paths are properly stored before auth redirects
 */
export const useAuthenticatedNavigation = () => {
  const navigate = useNavigate();
  const { isAuthenticated, storeRedirectPath } = useAuth();
  const { toast } = useToast();

  const navigateWithAuth = useCallback((
    path: string, 
    options?: { 
      requireAuth?: boolean, 
      message?: string,
      title?: string
    }
  ) => {
    const { requireAuth = false, message, title } = options || {};
    
    // Check if we need authentication
    if (requireAuth && !isAuthenticated) {
      // Only store path if not already on login/register pages
      const currentPath = window.location.pathname;
      if (!['/login', '/register', '/auth/callback'].includes(currentPath)) {
        const safePath = safeInternalPath(path);
        localStorage.setItem('redirectAfterLogin', safePath);
        storeRedirectPath?.(safePath);
        logger.log('[useAuthenticatedNavigation] Stored redirect path:', safePath);
      }
      
      // Show toast if message provided
      if (message) {
        toast({
          title: title || "Authentication Required",
          description: message,
          variant: "default",
        });
      }
      
      // Redirect to login
      navigate('/login');
      return;
    }
    
    // Normal navigation if authenticated or auth not required
    navigate(path);
  }, [isAuthenticated, navigate, storeRedirectPath, toast]);
  
  return { navigateWithAuth, isAuthenticated };
};
