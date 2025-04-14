import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useStoreRedirectPath = () => {
  const location = useLocation();

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    const isAuthPage = ['/login', '/register'].includes(location.pathname);
    const alreadyStored = localStorage.getItem('redirectAfterLogin');

    if (!alreadyStored && !isAuthPage) {
      localStorage.setItem('redirectAfterLogin', fullPath);
      console.log('[useStoreRedirectPath] Stored path:', fullPath);
    }
  }, [location.pathname, location.search]);
};

// import React, { createContext, useContext, useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// // Create context with undefined initial value
// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const auth = useAuthProvider();
//   const location = useLocation();

//   useEffect(() => {
//     const query = new URLSearchParams(location.search);
//     const redirectParam = query.get('redirect');
//     const fromState = location.state?.from?.pathname;
//     const storedRedirect = localStorage.getItem('redirectAfterLogin');

//     console.log('[AuthProvider] Context initialized');
//     console.log('[AuthProvider] Auth state:', {
//       isAuthenticated: auth.isAuthenticated,
//       loading: auth.loading,
//       redirectParam,
//       fromState,
//       storedRedirect
//     });

//     const validRedirect = redirectParam || fromState || storedRedirect;

//     if (auth.isAuthenticated && !auth.loading) {
//       if (validRedirect && !['/login', '/register'].includes(validRedirect)) {
//         console.log('[AuthProvider] ✅ Redirecting to:', validRedirect);
//         localStorage.setItem('redirectAfterLogin', validRedirect); // Ensure consistency
//         auth.handleRedirectAfterLogin();
//       } else {
//         console.log('[AuthProvider] ℹ️ No valid redirect path to process');
//       }
//     } else {
//       console.log('[AuthProvider] ⏳ Waiting for authentication to complete...');
//     }
//   }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin, location]);

//   return (
//     <AuthContext.Provider value={auth}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

// import React, { createContext, useContext, useEffect } from 'react';
// import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// // Create context with undefined initial value
// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// // Provider component that wraps app and makes auth object available
// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const auth = useAuthProvider();

//   useEffect(() => {
//     const storedRedirect = localStorage.getItem('redirectAfterLogin');

//     console.log('[AuthProvider] Context initialized');
//     console.log('[AuthProvider] Auth state:', {
//       isAuthenticated: auth.isAuthenticated,
//       loading: auth.loading,
//       storedRedirect
//     });

//     // Check if there's a stored redirect path and we're authenticated
//     if (auth.isAuthenticated && !auth.loading) {
//       if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
//         console.log('[AuthProvider] ✅ Valid stored redirect detected:', storedRedirect);
//         console.log('[AuthProvider] 🔁 Triggering handleRedirectAfterLogin');
//         auth.handleRedirectAfterLogin();
//       } else {
//         console.log('[AuthProvider] ℹ️ No valid redirect path to process');
//       }
//     } else {
//       console.log('[AuthProvider] ⏳ Waiting for auth or still loading...');
//     }
//   }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin]);

//   return (
//     <AuthContext.Provider value={auth}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// // Hook for components to get access to auth object
// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };
