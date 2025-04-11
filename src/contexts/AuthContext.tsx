
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps app and makes auth object available
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  
  // Check for admin authentication on mount and storage changes
  useEffect(() => {
    const checkAdminAuth = () => {
      const adminAuth = sessionStorage.getItem('isAdminAuthenticated') === 'true';
      setIsAdminAuthenticated(adminAuth);
    };
    
    checkAdminAuth();
    
    // Listen for storage events (if admin logs out in another tab)
    const handleStorageChange = () => {
      checkAdminAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Create an enhanced auth object with admin authentication status
  const enhancedAuth: AuthContextType = {
    ...auth,
    isAdminAuthenticated,
    adminLogout: () => {
      sessionStorage.removeItem('isAdminAuthenticated');
      setIsAdminAuthenticated(false);
    },
    // Add method to store redirect path (can be used anywhere in the app)
    storeRedirectPath: (path: string) => {
      if (path && path !== '/login' && path !== '/register' && path !== '/') {
        localStorage.setItem('redirectAfterLogin', path);
        console.log('AuthContext: Stored redirect path:', path);
      }
    }
  };
  
  return (
    <AuthContext.Provider value={enhancedAuth}>
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
