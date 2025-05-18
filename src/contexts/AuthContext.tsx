import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Create context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Wrap the provider content in a separate component for better error isolation
const AuthProviderContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedRedirect = localStorage.getItem('redirectAfterLogin');

    console.log('[AuthProvider] 🔄 Checking auth context init');
    console.log('[AuthProvider] State:', {
      isAuthenticated: auth.isAuthenticated,
      loading: auth.loading,
      storedRedirect
    });

    if (!auth.loading) {
      setIsInitialized(true);
      
      if (auth.isAuthenticated) {
        if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
          console.log('[AuthProvider] ✅ Redirect detected. Routing to:', storedRedirect);
          auth.handleRedirectAfterLogin();
        } else {
          console.log('[AuthProvider] ℹ️ No redirect path needed or on login/register');
        }
      }
    } else {
      console.log('[AuthProvider] ⏳ Waiting on authentication to complete...');
    }
  }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin]);

  if (!isInitialized) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ AuthProvider wraps your app and manages session state
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary fallback={<div>Something went wrong with authentication. Please try refreshing the page.</div>}>
      <AuthProviderContent>{children}</AuthProviderContent>
    </ErrorBoundary>
  );
};

// ✅ Named hook — use this everywhere to access auth
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
