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
     const currentPath = location.pathname + location.search;
    const isAuthPage = ['/login', '/register'].includes(location.pathname);
    // const updateRedirect = (path: string) => {
      // const isAuthPage = ['/login', '/register'].includes(path);
      
      // Don't store auth pages as redirect destinations
      if (!isAuthPage) {
      //   localStorage.setItem('redirectAfterLogin', path);
      //   storeRedirectPath?.(path);
      //   console.log('[useStoreRedirectPath] 🔁 Updated redirectAfterLogin to:', path);
      // } else {
      //   console.log('[storeRedirectPath] Skipped storing auth path:', path);
      // }
        storeRedirectPath(currentPath);
        }
      }, []);
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
        console.log(href, " - button clicked")
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

    // Only set up the click handler once
    if (!clickHandlerSetup.current) {
      // Set up global click handler with capture to get it before React's event handling
      window.addEventListener('click', clickHandler, { capture: true });
      clickHandlerSetup.current = true;
      
      // Clean up function
      return () => {
        window.removeEventListener('click', clickHandler, { capture: true });
        clickHandlerSetup.current = false;
      };
    }
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
  }, [isAuthenticated]); // Empty deps array to run only once on mount
};

// import { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import { useAuth } from '@/contexts/AuthContext';

// export const useStoreRedirectPath = () => {
//   const location = useLocation();
//   const { storeRedirectPath, isAuthenticated } = useAuth();

//   useEffect(() => {
//     // Don't update redirect if user is already authenticated
//     if (isAuthenticated) {
//       return;
//     }

//     const updateRedirect = (path: string) => {
//       const isAuthPage = ['/login', '/register'].includes(path);
      
//       // Don't store auth pages as redirect destinations
//       if (!isAuthPage) {
//         localStorage.setItem('redirectAfterLogin', path);
//         storeRedirectPath?.(path);
//         console.log('[useStoreRedirectPath] 🔁 Updated redirectAfterLogin to:', path);
//       } else {
//         console.log('[storeRedirectPath] Skipped storing auth path:', path);
//       }
//     };

//     const clickHandler = (e: MouseEvent) => {
//       const anchor = (e.target as HTMLElement)?.closest('a');
//       if (!anchor || !anchor.href) return;
      
//       try {
//         // Only handle internal links
//         const url = new URL(anchor.href);
//         if (url.origin === window.location.origin) {
//           const newPath = url.pathname + url.search;
          
//           // Store the path user is trying to navigate to
//           updateRedirect(newPath);
//         }
//       } catch (err) {
//         console.error('[useStoreRedirectPath] Error processing link:', err);
//       }
//     };

//     // Listen for anchor link clicks to capture path before navigation
//     window.addEventListener('click', clickHandler);
    
//     // Don't automatically store current path on mount
//     // This prevents overwriting more specific clicked paths
    
//     return () => window.removeEventListener('click', clickHandler);
//   }, [location, storeRedirectPath, isAuthenticated]);
// };

// import { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import { useAuth } from '@/contexts/AuthContext';

// export const useStoreRedirectPath = () => {
//   const location = useLocation();
//   const { storeRedirectPath } = useAuth();

//   useEffect(() => {
//     const fullPath = location.pathname + location.search;
//     console.log('[DEBUG] Set redirectAfterLogin from:', window.location.href, " here is the location.pathname: ", fullPath);
//     const isAuthPage = ['/login', '/register'].includes(location.pathname);

//     if (!isAuthPage) {
//       localStorage.setItem('redirectAfterLogin', fullPath);
//       storeRedirectPath?.(fullPath);

//       if (process.env.NODE_ENV === 'development') {
//         console.log('[useStoreRedirectPath] 🔁 Updated redirectAfterLogin to:', fullPath);
//       }
//     }
//   }, [location.pathname, location.search, storeRedirectPath]);
// };

// hooks/useStoreRedirectPath.ts



// import { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import { useAuth } from '@/contexts/AuthContext';

// export const useStoreRedirectPath = () => {
//   const location = useLocation();
//   const { storeRedirectPath } = useAuth();

//   useEffect(() => {
//     const updateRedirect = (path: string) => {
//       const isAuthPage = ['/login', '/register'].includes(path);
//       const alreadyStored = localStorage.getItem('redirectAfterLogin');

//       if (!isAuthPage && alreadyStored !== path) {
//         localStorage.setItem('redirectAfterLogin', path);
//         storeRedirectPath?.(path);
//         console.log('[useStoreRedirectPath] 🔁 Updated redirectAfterLogin to:', path);
//       } else {
//         console.log('[storeRedirectPath] Skipped storing path:', { path, alreadyStored });
//       }
//     };

//     const clickHandler = (e: MouseEvent) => {
//       const anchor = (e.target as HTMLElement)?.closest('a');
//       if (anchor && anchor.href && anchor.origin === window.location.origin) {
//         const newPath = anchor.pathname + anchor.search;
//         updateRedirect(newPath);
//       }
//     };

//     // Listen for anchor link clicks to capture path before navigation
//     window.addEventListener('click', clickHandler);

//     // Fallback: store current path on mount
//     const fallbackPath = location.pathname + location.search;
//     updateRedirect(fallbackPath);

//     return () => window.removeEventListener('click', clickHandler);
//   }, [location.pathname, location.search, storeRedirectPath]);
// };



// import { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import { useAuth } from '@/contexts/AuthContext';

// export const useStoreRedirectPath = () => {
//   const location = useLocation();
//   const { storeRedirectPath } = useAuth(); // Optional if using auth context

//   useEffect(() => {
//     const path = location.pathname;
//     const fullPath = location.pathname + location.search;
//     const alreadyStored = localStorage.getItem('redirectAfterLogin');

//     const isAuthRoute = ['/login', '/register'].includes(location.pathname);

//     // if (!alreadyStored && !isAuthRoute) {
//     //   localStorage.setItem('redirectAfterLogin', fullPath);
      
//     //   // Also use context method if available
//     //   if (storeRedirectPath) {
//     //     storeRedirectPath(fullPath);
//     //   }
//      if (!alreadyStored  && !['/login', '/register'].includes(location.pathname)) {
//       localStorage.setItem('redirectAfterLogin', fullPath);
//        // localStorage.setItem('redirectAfterLogin', path);
//       console.log('[DEBUG] Set redirectAfterLogin from:', window.location.href, " here is the location.pathname: ", path);

//       storeRedirectPath?.(fullPath);
       
      
//       if (process.env.NODE_ENV === 'development') {
//         console.log('[Redirect Logic] Stored:', fullPath);
//       }
//     }
//   }, [location.pathname, location.search, storeRedirectPath]);
// };
