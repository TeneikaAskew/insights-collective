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


import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useStoreRedirectPath = () => {
  const location = useLocation();
  const { storeRedirectPath } = useAuth();

  useEffect(() => {
    const updateRedirectPath = (path: string) => {
      const isAuthPage = ['/login', '/register'].includes(path);
      const alreadyStored = localStorage.getItem('redirectAfterLogin');

      if (!isAuthPage && alreadyStored !== path) {
        localStorage.setItem('redirectAfterLogin', path);
        storeRedirectPath?.(path);

        if (process.env.NODE_ENV === 'development') {
          console.log('[useStoreRedirectPath] 🔁 Updated redirectAfterLogin to:', path);
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement)?.closest('a');
      if (anchor && anchor.href && anchor.origin === window.location.origin) {
        const nextPath = anchor.pathname + anchor.search;
        updateRedirectPath(nextPath);
      }
    };

    // Listen for clicks to capture the intended destination before navigation
    window.addEventListener('click', handleClick);

    // Also run once on mount (as fallback)
    const currentPath = location.pathname + location.search;
    updateRedirectPath(currentPath);

    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [location.pathname, location.search, storeRedirectPath]);
};


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
