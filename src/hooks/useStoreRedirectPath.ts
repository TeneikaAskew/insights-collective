
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useStoreRedirectPath = () => {
  const location = useLocation();
  const { storeRedirectPath } = useAuth(); // Optional if using auth context

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    const alreadyStored = localStorage.getItem('redirectAfterLogin');

    const isAuthRoute = ['/login', '/register'].includes(location.pathname);

    // if (!alreadyStored && !isAuthRoute) {
    //   localStorage.setItem('redirectAfterLogin', fullPath);
      
    //   // Also use context method if available
    //   if (storeRedirectPath) {
    //     storeRedirectPath(fullPath);
    //   }
     if (!alreadyStored  && !['/login', '/register'].includes(location.pathname)) {
      localStorage.setItem('redirectAfterLogin', fullPath);
      storeRedirectPath?.(fullPath);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Redirect Logic] Stored:', fullPath);
      }
    }
  }, [location.pathname, location.search, storeRedirectPath]);
};
