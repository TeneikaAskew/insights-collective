
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

  // Monitor session integrity
  useEffect(() => {
    if (auth.session && !validateSessionIntegrity(auth.session)) {
      logger.warn('[AuthProvider] Invalid session detected, signing out user');
      auth.logout();
    }
  }, [auth.session]);

  // Security event logging
  useEffect(() => {
    if (auth.isAuthenticated) {
      logger.log('[AuthProvider] User authenticated:', {
        userId: auth.user?.id,
        roles: auth.user?.roles,
        timestamp: new Date().toISOString()
      });
    }
  }, [auth.isAuthenticated, auth.user]);

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
