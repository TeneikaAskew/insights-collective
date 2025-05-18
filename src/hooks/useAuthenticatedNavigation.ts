
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
    
    // Always store the destination path
    if (requireAuth) {
      localStorage.setItem('redirectAfterLogin', path);
      storeRedirectPath?.(path);
      console.log('[useAuthenticatedNavigation] Stored redirect path:', path);
    }
    
    // Check if we need authentication
    if (requireAuth && !isAuthenticated) {
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
