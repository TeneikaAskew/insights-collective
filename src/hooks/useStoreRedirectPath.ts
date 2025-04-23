
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useStoreRedirectPath = () => {
  const location = useLocation();
  const { storeRedirectPath, isAuthenticated } = useAuth();
  // Use a ref to track if we've already set up the click handler
  const clickHandlerSetup = useRef(false);

  useEffect(() => {
    // Don't update redirect if user is already authenticated
    if (isAuthenticated) {
      return;
    }

    const updateRedirect = (path: string) => {
      const isAuthPage = ['/login', '/register'].includes(path);
      
      // Don't store auth pages as redirect destinations
      if (!isAuthPage) {
        localStorage.setItem('redirectAfterLogin', path);
        storeRedirectPath?.(path);
        console.log('[useStoreRedirectPath] 🔁 Updated redirectAfterLogin to:', path);
      } else {
        console.log('[useStoreRedirectPath] Skipped storing auth path:', path);
      }
    };

    const clickHandler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest('a');
      // Also handle button clicks that might navigate (for React Router Link components wrapped in buttons)
      const button = (e.target as HTMLElement)?.closest('button');
      const element = anchor || button;
      
      if (!element) return;
      
      // Extract href from anchor or data attribute from button
      let href = '';
      if (anchor && anchor.href) {
        href = anchor.href;
        console.log(href, " - button clicked");
      } else if (button && button.dataset.href) {
        href = button.dataset.href;
      } else {
        return; // No href to process
      }
      
      try {
        // Parse the URL to check if it's internal
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin) {
          const newPath = url.pathname + url.search;
          
          // Don't update if it's the current path
          if (newPath !== location.pathname + location.search) {
            console.log('[useStoreRedirectPath] 🔍 Captured click navigation to:', newPath);
            // Use setTimeout to ensure this executes after React's event handling
            setTimeout(() => updateRedirect(newPath), 0);
          }
        }
      } catch (err) {
        console.error('[useStoreRedirectPath] Error processing navigation:', err);
      }
    };

    if (!clickHandlerSetup.current) {
      // Set up global click handler with capture to get it before React's event handling
      window.addEventListener('click', clickHandler, { capture: true });
      clickHandlerSetup.current = true;
    }

    return () => {
      window.removeEventListener('click', clickHandler, { capture: true });
      clickHandlerSetup.current = false;
    };
  }, [location, storeRedirectPath, isAuthenticated]);

  // Set up current path as fallback redirect ONLY on initial mount
  useEffect(() => {
    if (!isAuthenticated) {
      const currentPath = location.pathname + location.search;
      const isAuthPage = ['/login', '/register'].includes(location.pathname);
      const storedPath = localStorage.getItem('redirectAfterLogin');
      
      // Only set if:
      // 1. Not an auth page
      // 2. There's no stored path already
      if (!isAuthPage && !storedPath) {
        localStorage.setItem('redirectAfterLogin', currentPath);
        storeRedirectPath?.(currentPath);
        console.log('[useStoreRedirectPath] 📌 Setting initial fallback redirect to:', currentPath);
      }
    }
  }, [isAuthenticated]);
};

