
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface OnlineUser {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface CurrentUserPresence {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface PageVisibilityEntry {
  id: string;
  page_path: string;
  page_name: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
}

interface PageVisibilityContextType {
  isPageVisible: (path: string) => boolean;
  isLoading: boolean;
  onlineUsers: OnlineUser[];
  currentUserPresence: CurrentUserPresence | null;
  pageVisibility: PageVisibilityEntry[];
  updatePageVisibility: (pageId: string, updates: Partial<PageVisibilityEntry>) => Promise<void>;
  syncAvailablePages: () => Promise<void>;
  isSyncing: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export const usePageVisibility = () => {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    // Return default values when context is not available to prevent blocking
    console.warn('[PageVisibilityContext] Context not found, returning default visibility');
    return {
      isPageVisible: () => true, // Default to visible
      isLoading: false,
      onlineUsers: [] as OnlineUser[],
      currentUserPresence: null,
      pageVisibility: [] as PageVisibilityEntry[],
      updatePageVisibility: async () => {},
      syncAvailablePages: async () => {},
      isSyncing: false
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
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<CurrentUserPresence | null>(null);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Set current user presence when user changes
  useEffect(() => {
    if (user?.user_metadata) {
      setCurrentUserPresence({
        first_name: user.user_metadata.first_name,
        last_name: user.user_metadata.last_name,
        avatar_url: user.user_metadata.avatar_url
      });
    }
  }, [user]);

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

  const updatePageVisibility = async (pageId: string, updates: Partial<PageVisibilityEntry>) => {
    console.log(`[PageVisibilityProvider] Updating page visibility for ${pageId}:`, updates);
    // Implementation would go here for actual database updates
  };

  const syncAvailablePages = async () => {
    setIsSyncing(true);
    try {
      console.log(`[PageVisibilityProvider] Syncing available pages`);
      // Implementation would go here for actual page syncing
    } catch (error) {
      console.error('[PageVisibilityProvider] Error syncing pages:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const value = {
    isPageVisible,
    isLoading,
    onlineUsers,
    currentUserPresence,
    pageVisibility,
    updatePageVisibility,
    syncAvailablePages,
    isSyncing
  };

  return <PageVisibilityContext.Provider value={value}>{children}</PageVisibilityContext.Provider>;
};
