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

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { useAuth } from '@/contexts/AuthContext'; // <-- ADD THIS
import { Clock } from 'lucide-react';

export default function PageVisibilityGuard({ children }) {
  const location = useLocation();
  const { isAuthenticated, storeRedirectPath } = useAuth(); // <-- ADD THIS
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      const fullPath = location.pathname + location.search;
      localStorage.setItem('redirectAfterLogin', fullPath);
      storeRedirectPath?.(fullPath);
      console.log('[PageVisibilityGuard] Stored redirectAfterLogin from guard:', fullPath);
    }
  }, [location, isAuthenticated, storeRedirectPath]);

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(isPageVisible(location.pathname));
    }
  }, [location.pathname, isPageVisible, isLoading]);

  if (isLoading) return <>{children}</>;
  if (isVisible) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
        <div className="text-center p-8 rounded-lg max-w-md">
          <Clock className="mx-auto h-16 w-16 text-primary mb-4" />
          <h2 className="text-2xl font-bold text-primary mb-2">Coming Soon</h2>
          <p className="text-gray-700">
            This page isn't available yet. Check back later for updates.
          </p>
        </div>
      </div>
    </div>
  );
}


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
