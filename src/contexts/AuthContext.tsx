
import React, { createContext, useContext } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps app and makes auth object available
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  
  // Create an enhanced auth object with admin status derived from user roles
  const enhancedAuth: AuthContextType = {
    ...auth,
    // Make sure storeRedirectPath is available from the context
    storeRedirectPath: auth.storeRedirectPath
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
