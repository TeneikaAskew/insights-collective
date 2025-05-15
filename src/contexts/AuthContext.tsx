
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider wraps your app and manages session state
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();

  // Only attempt redirect if authenticated and not loading
  useEffect(() => {
    if (!auth.loading) {
      const storedRedirect = localStorage.getItem('redirectAfterLogin');
      
      console.log('[AuthProvider] 🔄 Auth context init check');
      console.log('[AuthProvider] State:', {
        isAuthenticated: auth.isAuthenticated,
        loading: auth.loading,
        storedRedirect
      });

      // Only handle redirect if authenticated and there's a stored path
      if (auth.isAuthenticated && storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
        console.log('[AuthProvider] ✅ Handling stored redirect:', storedRedirect);
        auth.handleRedirectAfterLogin();
      }
    }
  }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Named hook to access auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
