
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps app and makes auth object available
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  
  // Create an enhanced auth object with admin status derived from user role
  const enhancedAuth: AuthContextType = {
    ...auth,
    isAdminAuthenticated: auth.user?.role === 'admin',
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
