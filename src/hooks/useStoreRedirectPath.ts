import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useStoreRedirectPath = () => {
  const location = useLocation();
  const { storeRedirectPath, isAuthenticated } = useAuth();

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
        console.log('[storeRedirectPath] Skipped storing auth path:', path);
      }
    };

    const clickHandler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!anchor || !anchor.href) return;
      
      try {
        // Only handle internal links
        const url = new URL(anchor.href);
        if (url.origin === window.location.origin) {
          const newPath = url.pathname + url.search;
          
          // Store the path user is trying to navigate to
          updateRedirect(newPath);
        }
      } catch (err) {
        console.error('[useStoreRedirectPath] Error processing link:', err);
      }
    };

    // Listen for anchor link clicks to capture path before navigation
    window.addEventListener('click', clickHandler);
    
    // Don't automatically store current path on mount
    // This prevents overwriting more specific clicked paths
    
    return () => window.removeEventListener('click', clickHandler);
  }, [location, storeRedirectPath, isAuthenticated]);
};

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
