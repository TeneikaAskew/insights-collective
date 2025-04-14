
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps app and makes auth object available
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  
  // Handle automatic redirects when the auth context is initialized 
  // This ensures redirects happen at the app root level
  useEffect(() => {
    // Check if there's a stored redirect path and we're authenticated
    if (auth.isAuthenticated && !auth.loading) {
      const storedRedirect = localStorage.getItem('redirectAfterLogin');
      if (storedRedirect && storedRedirect !== '/login' && storedRedirect !== '/register') {
        if (process.env.NODE_ENV === "development") {
          console.log('AuthProvider detected redirect path:', storedRedirect);
        }
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

// Hook for components to get access to auth object
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
