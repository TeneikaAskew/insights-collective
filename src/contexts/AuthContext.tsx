import React, { createContext, useContext, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps app and makes auth object available
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();

  useEffect(() => {
    const storedRedirect = localStorage.getItem('redirectAfterLogin');

    console.log('[AuthProvider] Context initialized');
    console.log('[AuthProvider] Auth state:', {
      isAuthenticated: auth.isAuthenticated,
      loading: auth.loading,
      storedRedirect
    });

    // Check if there's a stored redirect path and we're authenticated
    if (auth.isAuthenticated && !auth.loading) {
      if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
        console.log('[AuthProvider] ✅ Valid stored redirect detected:', storedRedirect);
        console.log('[AuthProvider] 🔁 Triggering handleRedirectAfterLogin');
        auth.handleRedirectAfterLogin();
      } else {
        console.log('[AuthProvider] ℹ️ No valid redirect path to process');
      }
    } else {
      console.log('[AuthProvider] ⏳ Waiting for auth or still loading...');
    }
  }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for components to get access to auth object
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
