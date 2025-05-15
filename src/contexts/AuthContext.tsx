
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider wraps your app and manages session state
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();

  // Simple logging of auth state changes
  useEffect(() => {
    console.log('[AuthProvider] 🔄 Checking auth context init');
    console.log('[AuthProvider] State:', {
      isAuthenticated: auth.isAuthenticated,
      loading: auth.loading,
      storedRedirect: localStorage.getItem('redirectAfterLogin')
    });

    // Let the core authentication logic in useAuthProvider handle redirects
    if (auth.isAuthenticated && !auth.loading) {
      if (localStorage.getItem('redirectAfterLogin')) {
        console.log('[AuthProvider] ✅ Redirect detected. Handling redirection via provider.');
      } else {
        console.log('[AuthProvider] ℹ️ No redirect path needed or on login/register');
      }
    } else {
      console.log('[AuthProvider] ⏳ Waiting on authentication to complete...');
    }
  }, [auth.isAuthenticated, auth.loading]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Named hook — use this everywhere to access auth
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
