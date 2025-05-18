<<<<<<< HEAD
import React, { createContext, useContext } from 'react';
=======

import React, { createContext, useContext, useEffect } from 'react';
>>>>>>> f43ad96e6a152d1e4fa38753e23097c1efc10aef
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// ✅ AuthProvider wraps your app and manages session state
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();

<<<<<<< HEAD
=======
  useEffect(() => {
    const storedRedirect = localStorage.getItem('redirectAfterLogin');

    console.log('[AuthProvider] 🔄 Checking auth context init');
    console.log('[AuthProvider] State:', {
      isAuthenticated: auth.isAuthenticated,
      loading: auth.loading,
      storedRedirect
    });

    if (auth.isAuthenticated && !auth.loading) {
      if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
        console.log('[AuthProvider] ✅ Redirect detected. Routing to:', storedRedirect);
        auth.handleRedirectAfterLogin();
      } else {
        console.log('[AuthProvider] ℹ️ No redirect path needed or on login/register');
      }
    } else {
      console.log('[AuthProvider] ⏳ Waiting on authentication to complete...');
    }
  }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin]);

>>>>>>> f43ad96e6a152d1e4fa38753e23097c1efc10aef
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ Named hook — use this everywhere to access auth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
