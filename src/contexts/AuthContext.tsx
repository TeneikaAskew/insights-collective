
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthProvider, AuthContextType } from '@/hooks/useAuth';
import { validateSessionIntegrity } from '@/utils/securityUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useAuth');

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Enhanced AuthProvider with security monitoring
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();

  // Security event logging - only on initial auth, not on every change
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      logger.log('[AuthProvider] User authenticated:', {
        userId: auth.user.id,
        roles: auth.user.roles,
        timestamp: new Date().toISOString()
      });
    }
  }, [auth.isAuthenticated]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

// Enhanced hook with security checks
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
