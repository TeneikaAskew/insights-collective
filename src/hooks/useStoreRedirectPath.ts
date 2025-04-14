import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useStoreRedirectPath = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth(); // 👈 Access auth state

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    const isAuthPage = ['/login', '/register'].includes(location.pathname);
    const alreadyStored = localStorage.getItem('redirectAfterLogin');

    console.log('[useStoreRedirectPath] Current location:', fullPath);
    console.log('[useStoreRedirectPath] Already stored:', alreadyStored);
    console.log('[useStoreRedirectPath] Authenticated:', isAuthenticated);

    // ✅ Store only if not on auth page, not logged in, and nothing already stored
    if (!isAuthenticated && !isAuthPage && alreadyStored !== fullPath) {
      localStorage.setItem('redirectAfterLogin', fullPath);
      console.log('[useStoreRedirectPath] 🔁 Stored new path:', fullPath);
    }
  }, [location.pathname, location.search, isAuthenticated]);
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
