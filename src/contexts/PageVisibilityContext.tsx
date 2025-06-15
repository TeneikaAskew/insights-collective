
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PageVisibilityContextType {
  isPageVisible: (path: string) => boolean;
  isLoading: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export const usePageVisibility = () => {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    // Return default values when context is not available to prevent blocking
    console.warn('[PageVisibilityContext] Context not found, returning default visibility');
    return {
      isPageVisible: () => true, // Default to visible
      isLoading: false
    };
  }
  return context;
};

interface PageVisibilityProviderProps {
  children: ReactNode;
}

export const PageVisibilityProvider: React.FC<PageVisibilityProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const isPageVisible = (path: string): boolean => {
    console.log(`[PageVisibilityProvider] Checking visibility for path: ${path}`);
    
    // For now, make all pages visible by default
    // This can be enhanced later with actual page visibility logic
    const adminPaths = ['/admin'];
    const isAdminPath = adminPaths.some(adminPath => path.startsWith(adminPath));
    
    if (isAdminPath) {
      const hasAdminRole = user?.roles?.includes('admin');
      console.log(`[PageVisibilityProvider] Admin path ${path}, user has admin role: ${hasAdminRole}`);
      return hasAdminRole || false;
    }
    
    // All other pages are visible by default
    return true;
  };

  const value = {
    isPageVisible,
    isLoading
  };

  return <PageVisibilityContext.Provider value={value}>{children}</PageVisibilityContext.Provider>;
};
