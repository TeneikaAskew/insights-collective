
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ AuthProvider wraps your app and manages session state
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  const { toast } = useToast();

  useEffect(() => {
    // Add debounce to prevent multiple redirects
    let redirectTimeout: number | undefined;
    
    // Only handle redirect after login when:
    // 1. User is authenticated
    // 2. No longer loading
    // 3. There is a stored redirect path
    if (auth.isAuthenticated && !auth.loading) {
      const storedRedirect = localStorage.getItem('redirectAfterLogin');
      
      console.log('[AuthProvider] Auth state:', {
        isAuthenticated: auth.isAuthenticated,
        loading: auth.loading,
        storedRedirect
      });
      
      // Clear any existing timeout to prevent race conditions
      if (redirectTimeout) {
        window.clearTimeout(redirectTimeout);
      }
      
      // Only redirect if there's a path stored and it's not a login/register page
      if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
        console.log('[AuthProvider] Will redirect to:', storedRedirect);
        
        // Use timeout to prevent redirection loops
        redirectTimeout = window.setTimeout(() => {
          console.log('[AuthProvider] Executing redirect to:', storedRedirect);
          auth.handleRedirectAfterLogin();
        }, 300);
      } else if (storedRedirect) {
        console.log('[AuthProvider] Skipping redirect to login/register page');
        // Clean up redirect path if it points to auth pages
        localStorage.removeItem('redirectAfterLogin');
      }
    }
    
    return () => {
      if (redirectTimeout) {
        window.clearTimeout(redirectTimeout);
      }
    };
  }, [auth.isAuthenticated, auth.loading, auth.handleRedirectAfterLogin]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
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
